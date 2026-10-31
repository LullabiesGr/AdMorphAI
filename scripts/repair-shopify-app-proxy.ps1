# Emergency recovery only: release one version without App Proxy, then restore it.
# Do not run unless a correctly configured and released proxy still returns 404.
# This script does not modify the database or uninstall the app.
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$config = Join-Path $root "shopify.app.toml"

if (-not (Test-Path $config)) { throw "shopify.app.toml is missing." }
if (-not (Get-Command shopify -ErrorAction SilentlyContinue)) {
  throw "Shopify CLI is missing."
}
$allConfigs = @(Get-ChildItem -Path $root -Filter "shopify.app*.toml" -File)
if ($allConfigs.Count -ne 1 -or $allConfigs[0].Name -ne "shopify.app.toml") {
  throw "Multiple Shopify configurations detected. Automated repair is disabled to prevent publishing to the wrong app."
}

$originalBytes = [System.IO.File]::ReadAllBytes($config)
$utf8 = [System.Text.UTF8Encoding]::new($false)
$content = $utf8.GetString($originalBytes)
$clientId = [regex]::Match($content, '(?m)^client_id\s*=\s*"([^"]+)"').Groups[1].Value
if ([string]::IsNullOrWhiteSpace($clientId)) {
  throw "Client ID missing. Link the EXISTING AdMorph AI Shopify app first."
}
if (-not [regex]::IsMatch($content, '(?m)^name\s*=\s*"AdMorph AI"\s*$')) {
  throw "The selected config does not belong to AdMorph AI."
}
if (-not [regex]::IsMatch($content, '(?m)^application_url\s*=\s*"https://admorphai\.onrender\.com"\s*$')) {
  throw "Unexpected application URL."
}

$proxySection = [regex]::Match($content, '(?ms)^\[app_proxy\]\s*(.*?)(?=^\[|\z)')
if (-not $proxySection.Success) { throw "Missing [app_proxy] section." }
$proxy = $proxySection.Groups[1].Value
$correctTarget = [regex]::IsMatch($proxy, '(?m)^url\s*=\s*"https://admorphai\.onrender\.com/apps/admorph"\s*$')
$correctPrefix = [regex]::IsMatch($proxy, '(?m)^prefix\s*=\s*"apps"\s*$')
$correctSubpath = [regex]::IsMatch($proxy, '(?m)^subpath\s*=\s*"admorph"\s*$')
if (-not ($correctTarget -and $correctPrefix -and $correctSubpath)) {
  throw "App Proxy must point to /apps/admorph on the production Render server."
}
$build = [regex]::Match($content, '(?ms)^\[build\]\s*(.*?)(?=^\[|\z)')
if (-not $build.Success -or -not [regex]::IsMatch($build.Groups[1].Value, '(?m)^automatically_update_urls_on_dev\s*=\s*false\s*$')) {
  throw "Production URL rewrite protection is missing."
}
$proxyDeclarations = [regex]::Matches($content, '(?m)^\[app_proxy\]\s*$')
if ($proxyDeclarations.Count -ne 1) { throw "Expected one [app_proxy] declaration." }

$offset = $proxyDeclarations[0].Index
$tail = $content.Substring($offset)
if ([regex]::IsMatch($tail, '(?m)^\[(?!app_proxy\])')) {
  throw "[app_proxy] must be the final TOML section for this repair."
}

Write-Warning "Two Shopify app versions will be released. The first removes the proxy temporarily."
Write-Warning "Confirm the Client ID belongs to the EXISTING AdMorph AI app in the Shopify Dev Dashboard."
$approval = Read-Host 'Type exactly REPAIR ADMORPH to continue'
if ($approval -cne "REPAIR ADMORPH") { throw "Canceled; no files changed." }

try {
  $withoutProxy = $content.Substring(0, $offset).TrimEnd() + [Environment]::NewLine
  [System.IO.File]::WriteAllText($config, $withoutProxy, $utf8)
  Push-Location $root
  try {
    Write-Host "Releasing app version 1/2 WITHOUT proxy..." -ForegroundColor Yellow
    & shopify app deploy
    if ($LASTEXITCODE -ne 0) { throw "First deployment failed. No second deployment attempted." }
  } finally { Pop-Location }

  [System.IO.File]::WriteAllBytes($config, $originalBytes)
  Push-Location $root
  try {
    Write-Host "Releasing app version 2/2 WITH proxy..." -ForegroundColor Yellow
    & shopify app deploy
    if ($LASTEXITCODE -ne 0) {
      throw "Second deployment failed. Proxy may be unregistered. Deploy restored TOML after correcting the issue."
    }
  } finally { Pop-Location }
  Write-Host "Both Shopify app versions released." -ForegroundColor Green
} finally {
  [System.IO.File]::WriteAllBytes($config, $originalBytes)
}
