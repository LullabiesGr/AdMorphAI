# Safely re-register Shopify App Proxy for the existing AdMorph AI app.
# Use only if an active app version already includes [app_proxy] but /apps/admorph still returns Shopify HTTP 404.
# Preflight: in the repo folder run: shopify app config link (select EXISTING AdMorph AI app).
# This script publishes TWO Shopify app versions, first removing the proxy and then restoring it.
# It never modifies the database or uninstalls the Shopify app.
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$config = Join-Path $root "shopify.app.toml"
if (-not (Test-Path $config)) { throw "shopify.app.toml is missing." }
if (-not (Get-Command shopify -ErrorAction SilentlyContinue)) {
  throw "Shopify CLI not found. Install @shopify/cli and authenticate first."
}
$bytes = [System.IO.File]::ReadAllBytes($config)
$utf8 = [System.Text.UTF8Encoding]::new($false)
$content = $utf8.GetString($bytes)
if ($content -notmatch '(?m)^name\s*=\s*"AdMorph AI"\s*$') {
  throw "Linked app is not named AdMorph AI. Stopping to avoid modifying another app."
}
$id = [regex]::Match($content, '(?m)^client_id\s*=\s*"([^"]*)"')
if (-not $id.Success -or [string]::IsNullOrWhiteSpace($id.Groups[1].Value)) {
  throw 'Shopify client_id is empty. First run: shopify app config link. Select EXISTING AdMorph AI.'
}
if ($content -notmatch 'url\s*=\s*"https://admorphai\.onrender\.com/apps/admorph"') {
  throw "The production proxy destination is unexpected. Review shopify.app.toml first."
}
if ($content -notmatch '(?ms)^\[build\](.*?)(?=^\[|\z)' -or $Matches[1] -notmatch 'automatically_update_urls_on_dev\s*=\s*false') { throw "The production URL rewrite safeguard is missing. Run the config preflight first." }
if ($content -notmatch '(?m)^prefix\s*=\s*"apps"\s*
    $content -notmatch '(?m)^subpath\s*=\s*"admorph"\s*$') {
  throw "The App Proxy URL is not /apps/admorph. Review configuration first."
}
$matches = [regex]::Matches($content, '(?m)^\[app_proxy\]\s*$')
if ($matches.Count -ne 1) { throw "Expected exactly one [app_proxy] section." }
$offset = $matches[0].Index
# Fail closed if any other TOML section follows the proxy section.
$tail = $content.Substring($offset)
if ([regex]::IsMatch($tail, '(?m)^\[(?!app_proxy\])')) {
  throw "[app_proxy] must be the last section in TOML for this repair script."
}

Write-Host ""
Write-Host "Shopify App Proxy repair for AdMorph AI" -ForegroundColor Cyan
Write-Host "Linked Shopify client_id: $($id.Groups[1].Value)"
Write-Host "Target: /apps/admorph -> https://admorphai.onrender.com/apps/admorph"
Write-Warning "This will RELEASE two versions of the currently linked Shopify app."
Write-Warning "Only use after verifying the existing Shopify app and active App Proxy version."
$approval = Read-Host 'Type exactly AdMorph AI to continue'
if ($approval -cne "AdMorph AI") { throw "Canceled. No changes made." }

try {
  $withoutProxy = $content.Substring(0,$offset).TrimEnd() + "`n"
  [System.IO.File]::WriteAllText($config, $withoutProxy, $utf8)
  Write-Host "Publishing version 1/2 WITHOUT App Proxy..." -ForegroundColor Yellow
  Push-Location $root
  try {
    & shopify app deploy --config "shopify.app.toml"
    if ($LASTEXITCODE -ne 0) { throw "First Shopify deploy failed ($LASTEXITCODE)." }
  } finally { Pop-Location }
  # Immediately restore the local config before the second deploy.
  [System.IO.File]::WriteAllBytes($config, $bytes)
  Write-Host "Publishing version 2/2 WITH App Proxy restored..." -ForegroundColor Yellow
  Push-Location $root
  try {
    & shopify app deploy --config "shopify.app.toml"
    if ($LASTEXITCODE -ne 0) { throw "Second Shopify deploy failed ($LASTEXITCODE). Run shopify app deploy again after resolving the error." }
  } finally { Pop-Location }
  Write-Host "Both versions released. Check the Shopify storefront URL again." -ForegroundColor Green
} finally {
  # Always preserve the original configuration, including client_id and comments.
  [System.IO.File]::WriteAllBytes($config, $bytes)
}
 -or
    $content -notmatch '(?m)^subpath\s*=\s*"admorph"\s*$') {
  throw "The App Proxy URL is not /apps/admorph. Review configuration first."
}
$matches = [regex]::Matches($content, '(?m)^\[app_proxy\]\s*$')
if ($matches.Count -ne 1) { throw "Expected exactly one [app_proxy] section." }
$offset = $matches[0].Index
# Fail closed if any other TOML section follows the proxy section.
$tail = $content.Substring($offset)
if ([regex]::IsMatch($tail, '(?m)^\[(?!app_proxy\])')) {
  throw "[app_proxy] must be the last section in TOML for this repair script."
}

Write-Host ""
Write-Host "Shopify App Proxy repair for AdMorph AI" -ForegroundColor Cyan
Write-Host "Linked Shopify client_id: $($id.Groups[1].Value)"
Write-Host "Target: /apps/admorph -> https://admorphai.onrender.com/apps/admorph"
Write-Warning "This will RELEASE two versions of the currently linked Shopify app."
Write-Warning "Only use after verifying the existing Shopify app and active App Proxy version."
$approval = Read-Host 'Type exactly AdMorph AI to continue'
if ($approval -cne "AdMorph AI") { throw "Canceled. No changes made." }

try {
  $withoutProxy = $content.Substring(0,$offset).TrimEnd() + "`n"
  [System.IO.File]::WriteAllText($config, $withoutProxy, $utf8)
  Write-Host "Publishing version 1/2 WITHOUT App Proxy..." -ForegroundColor Yellow
  Push-Location $root
  try {
    & shopify app deploy --config "shopify.app.toml"
    if ($LASTEXITCODE -ne 0) { throw "First Shopify deploy failed ($LASTEXITCODE)." }
  } finally { Pop-Location }
  # Immediately restore the local config before the second deploy.
  [System.IO.File]::WriteAllBytes($config, $bytes)
  Write-Host "Publishing version 2/2 WITH App Proxy restored..." -ForegroundColor Yellow
  Push-Location $root
  try {
    & shopify app deploy --config "shopify.app.toml"
    if ($LASTEXITCODE -ne 0) { throw "Second Shopify deploy failed ($LASTEXITCODE). Run shopify app deploy again after resolving the error." }
  } finally { Pop-Location }
  Write-Host "Both versions released. Check the Shopify storefront URL again." -ForegroundColor Green
} finally {
  # Always preserve the original configuration, including client_id and comments.
  [System.IO.File]::WriteAllBytes($config, $bytes)
}
