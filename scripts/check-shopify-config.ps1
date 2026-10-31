# Diagnose all Shopify CLI configuration files BEFORE deploying AdMorph AI.
# No network calls, no writes and no secrets printed.
[CmdletBinding()]
param(
  [string]$Config = ""
)
$ErrorActionPreference = "Stop"
$root=Split-Path -Parent $PSScriptRoot
Set-Location $root
$files=Get-ChildItem -Path $root -Filter "shopify.app*.toml" -File | Sort-Object Name
if (!$files) { throw "No Shopify CLI config found." }
Write-Host "AdMorph Shopify config preflight" -ForegroundColor Cyan
Write-Host "Found $($files.Count) Shopify app config file(s)."
$good=@()
foreach ($file in $files) {
  $content=[System.IO.File]::ReadAllText($file.FullName)
  $id=[regex]::Match($content,'(?m)^client_id\s*=\s*"([^"]*)"').Groups[1].Value
  $name=[regex]::Match($content,'(?m)^name\s*=\s*"([^"]*)"').Groups[1].Value
  $application=[regex]::Match($content,'(?m)^application_url\s*=\s*"([^"]*)"').Groups[1].Value
  $scopes=[regex]::Match($content,'(?m)^scopes\s*=\s*"([^"]*)"').Groups[1].Value
  $proxy=[regex]::Match($content,'(?ms)^\[app_proxy\]\s*(.*?)(?=^\[|\z)').Groups[1].Value
  $target=[regex]::Match($proxy,'(?m)^url\s*=\s*"([^"]*)"').Groups[1].Value
  $prefix=[regex]::Match($proxy,'(?m)^prefix\s*=\s*"([^"]*)"').Groups[1].Value
  $subpath=[regex]::Match($proxy,'(?m)^subpath\s*=\s*"([^"]*)"').Groups[1].Value
  $keepUrl=$content -match '(?ms)^\[build\](.*?)(?=^\[|\z)' -and $Matches[1] -match 'automatically_update_urls_on_dev\s*=\s*false'
  $validName=$name -eq "AdMorph AI"
  $validId=![string]::IsNullOrWhiteSpace($id)
  $validUrl=$application -eq "https://admorphai.onrender.com"
  $validProxy=($target -eq "https://admorphai.onrender.com/apps/admorph" -or $target -eq "/apps/admorph") -and $prefix -eq "apps" -and $subpath -eq "admorph"
  $validScope=($scopes.Split(",") -contains "write_app_proxy")
  $valid=$validName -and $validId -and $validUrl -and $validProxy -and $validScope -and $keepUrl
  Write-Host ("- "+$file.Name+": "+ $(if($valid){"READY"}else{"NOT READY"}))
  Write-Host ("  app: "+$name+" | client ID: "+$(if($validId){"present"}else{"MISSING"})+" | Render URL: "+$validUrl)
  Write-Host ("  proxy: "+$(if($validProxy){"correct"}else{"MISSING / INCORRECT"})+" | scope: "+$validScope+" | dev URL protection: "+$keepUrl)
  if($valid){$good+=,$file.Name}
}
if($Config){
  $selected=Split-Path -Leaf $Config
  if($good -notcontains $selected){
    throw "Selected $selected is not ready. Do not deploy. Review Shopify config."
  }
  if($selected -eq "shopify.app.toml") {
    Write-Host "READY: $selected. Set this as the selected default with shopify app config use, then run shopify app config validate and shopify app deploy." -ForegroundColor Green
  } else {
    $key=$selected -replace '^shopify\.app\.', '' -replace '\.toml
}elseif($good.Count -eq 1){
  if($good[0] -eq "shopify.app.toml") {
    Write-Host "One ready file: shopify.app.toml. Select it via shopify app config use, validate, then run shopify app deploy." -ForegroundColor Green
  } else {
    $key=$good[0] -replace '^shopify\.app\.', '' -replace '\.toml
}else{
  Write-Warning "Select the linked production file using -Config shopify.app.production.toml; deploy using its config name (for example --config production), not the filename."
}
, ''
    Write-Host "READY: $selected. Use: shopify app config validate --config $key; shopify app deploy --config $key" -ForegroundColor Green
  }
}elseif($good.Count -eq 1){
  Write-Host "One ready file: $($good[0]). Run: shopify app deploy --config $($good[0])" -ForegroundColor Green
}else{
  Write-Warning "Select the correct file with -Config shopify.app.production.toml. Do NOT deploy until it passes."
}
, ''
    Write-Host "One ready file: $($good[0]). Run: shopify app config validate --config $key; shopify app deploy --config $key" -ForegroundColor Green
  }
}else{
  Write-Warning "Select the correct file with -Config shopify.app.production.toml. Do NOT deploy until it passes."
}
, ''
    Write-Host "READY: $selected. Use: shopify app config validate --config $key; shopify app deploy --config $key" -ForegroundColor Green
  }
}elseif($good.Count -eq 1){
  Write-Host "One ready file: $($good[0]). Run: shopify app deploy --config $($good[0])" -ForegroundColor Green
}else{
  Write-Warning "Select the correct file with -Config shopify.app.production.toml. Do NOT deploy until it passes."
}
