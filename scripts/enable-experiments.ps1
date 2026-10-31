# Enable Shopify Pixel scopes on the local linked production config without replacing Client ID.
[CmdletBinding()]
param()
$ErrorActionPreference="Stop"
$root=Split-Path -Parent $PSScriptRoot
$config=Join-Path $root "shopify.app.toml"
if(-not(Test-Path $config)){throw "Missing shopify.app.toml"}
$utf8=New-Object System.Text.UTF8Encoding($false)
$old=[System.IO.File]::ReadAllText($config)
if($old -notmatch '(?m)^client_id\s*=\s*"[^"]+"'){
 throw "Link the existing AdMorph AI Shopify app first. Client ID is missing."
}
$check=[regex]::Match($old,'(?ms)^\[access_scopes\]\s*(.*?)(?=^\[|\z)')
if(-not $check.Success){throw "Missing [access_scopes] section"}
$scopes=[regex]::Match($check.Groups[1].Value,'(?m)^\s*scopes\s*=\s*"([^"]*)"')
if(-not $scopes.Success){throw "Missing scopes in [access_scopes]"}
$existing=@($scopes.Groups[1].Value.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ })
$required=@("read_customer_events","write_pixels")
foreach($scope in $required){if($existing -notcontains $scope){$existing+= $scope}}
$updated=$old.Substring(0,$scopes.Groups[1].Index+$check.Groups[1].Index)+
  ($existing -join ",")+
  $old.Substring($scopes.Groups[1].Index+$check.Groups[1].Index+$scopes.Groups[1].Length)
if($updated -eq $old){Write-Host "Pixel scopes already present.";exit 0}
$backup=$config+".before-pixel-scopes.bak"
[System.IO.File]::WriteAllText($backup,$old,$utf8)
[System.IO.File]::WriteAllText($config,$updated,$utf8)
Write-Host "Pixel scopes enabled locally. Backup: $backup"
Write-Host "Recheck Client ID; then run shopify app config validate and shopify app deploy."
Write-Host "After scope approval, connect Shopify Web Pixel once from AI Campaigns."
