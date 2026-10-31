# Read-only preflight for AdMorph Shopify CLI configuration.
# No app deploys, network calls, file mutations or secrets in output.
[CmdletBinding()]
param(
  [string]$Config = ""
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

function Get-TomlValue {
  param(
    [string]$Text,
    [string]$Key
  )
  $pattern = '(?m)^\s*' + [regex]::Escape($Key) + '\s*=\s*"([^"]*)"'
  $match = [regex]::Match($Text, $pattern)
  if ($match.Success) { return $match.Groups[1].Value }
  return ""
}

function Get-TomlSection {
  param(
    [string]$Text,
    [string]$Name
  )
  $pattern = '(?ms)^\[' + [regex]::Escape($Name) + '\]\s*(.*?)(?=^\[|\z)'
  $match = [regex]::Match($Text, $pattern)
  if ($match.Success) { return $match.Groups[1].Value }
  return ""
}

$files = @(Get-ChildItem -Path $root -Filter "shopify.app*.toml" -File | Sort-Object Name)
if ($files.Count -eq 0) { throw "No shopify.app*.toml files found in $root" }

Write-Host "AdMorph AI - Shopify configuration preflight" -ForegroundColor Cyan
Write-Host "Found $($files.Count) Shopify app configuration file(s)."
$readyConfigs = @()

foreach ($file in $files) {
  $contents = [System.IO.File]::ReadAllText($file.FullName)
  $clientId = Get-TomlValue -Text $contents -Key "client_id"
  $appName = Get-TomlValue -Text $contents -Key "name"
  $appUrl = Get-TomlValue -Text $contents -Key "application_url"
  $scopeString = Get-TomlValue -Text (Get-TomlSection -Text $contents -Name "access_scopes") -Key "scopes"
  $scopes = @($scopeString -split '\s*,\s*')
  $proxy = Get-TomlSection -Text $contents -Name "app_proxy"
  $proxyUrl = Get-TomlValue -Text $proxy -Key "url"
  $prefix = Get-TomlValue -Text $proxy -Key "prefix"
  $subpath = Get-TomlValue -Text $proxy -Key "subpath"
  $build = Get-TomlSection -Text $contents -Name "build"
  $protectsProduction = [regex]::IsMatch($build, '(?m)^\s*automatically_update_urls_on_dev\s*=\s*false\s*$')

  $checks = [ordered]@{
    "App name is AdMorph AI" = ($appName -eq "AdMorph AI")
    "Client ID present" = (-not [string]::IsNullOrWhiteSpace($clientId))
    "Production Render URL" = ($appUrl -eq "https://admorphai.onrender.com")
    "App Proxy destination" = ($proxyUrl -eq "https://admorphai.onrender.com/apps/admorph")
    "App Proxy prefix /apps" = ($prefix -eq "apps")
    "App Proxy subpath admorph" = ($subpath -eq "admorph")
    "write_app_proxy scope" = ($scopes -contains "write_app_proxy")
    "Prevent development URL rewrites" = $protectsProduction
  }

  $failures = @($checks.Keys | Where-Object { -not $checks[$_] })
  if ($failures.Count -eq 0) {
    Write-Host "$($file.Name): READY" -ForegroundColor Green
    $readyConfigs += $file.Name
  } else {
    Write-Host "$($file.Name): NOT READY" -ForegroundColor Yellow
    foreach ($failure in $failures) { Write-Host "  Missing / incorrect: $failure" }
  }
}

$selected = ""
if (-not [string]::IsNullOrWhiteSpace($Config)) {
  $selected = Split-Path -Leaf $Config
  if ($readyConfigs -notcontains $selected) {
    throw "Selected configuration '$selected' is NOT READY. No deploy should be attempted."
  }
} elseif ($readyConfigs.Count -eq 1) {
  $selected = $readyConfigs[0]
} elseif ($readyConfigs.Count -eq 0) {
  throw "No production-ready Shopify config. Correct the listed checks before deploying."
} else {
  throw "Multiple READY configs. Re-run with -Config shopify.app.production.toml (or the correct filename)."
}

Write-Host ""
Write-Host "READY: $selected" -ForegroundColor Green
if ($selected -eq "shopify.app.toml") {
  Write-Host "Use 'shopify app config use' to select the root config, then:"
  Write-Host "  shopify app config validate"
  Write-Host "  shopify app deploy"
} else {
  $configName = (($selected -replace '^shopify\.app\.', '') -replace '\.toml$', '')
  Write-Host "Deploy with the Shopify CONFIG NAME, not the filename:"
  Write-Host "  shopify app config validate --config $configName"
  Write-Host "  shopify app deploy --config $configName"
}
Write-Warning "READY only verifies local settings; verify the Client ID belongs to the existing Shopify app before publishing."
