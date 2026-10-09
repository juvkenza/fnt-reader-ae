<#
 Development helper (Windows): links ..\src into the CEP extensions folder and enables
 PlayerDebugMode so After Effects loads the unsigned panel straight from the repository.
 For normal use, install the signed .zxp from the Releases page instead.

   .\scripts\dev-link.ps1            link + enable debug mode
   .\scripts\dev-link.ps1 -Remove    remove the link (and turn debug mode off)
#>
param([switch]$Remove)
$ErrorActionPreference = 'Stop'
$id = 'com.juvkenza.fntreader'
$target = Join-Path $env:APPDATA "Adobe\CEP\extensions\$id"

if ($Remove) {
    if (Test-Path $target) { Remove-Item $target -Recurse -Force }
    foreach ($v in 9..13) {
        $key = "HKCU:\Software\Adobe\CSXS.$v"
        if (Test-Path $key) { Remove-ItemProperty -Path $key -Name PlayerDebugMode -ErrorAction SilentlyContinue }
    }
    Write-Host "Removed $target"; return
}

$source = (Resolve-Path (Join-Path $PSScriptRoot '..\src')).Path
New-Item -ItemType Directory -Force (Split-Path $target) | Out-Null
if (Test-Path $target) { Remove-Item $target -Recurse -Force }
New-Item -ItemType Junction -Path $target -Target $source | Out-Null
foreach ($v in 9..13) {
    $key = "HKCU:\Software\Adobe\CSXS.$v"
    if (-not (Test-Path $key)) { New-Item $key | Out-Null }
    New-ItemProperty -Path $key -Name PlayerDebugMode -Value '1' -PropertyType String -Force | Out-Null
}
Write-Host "Linked $target -> $source"
Write-Host "Restart After Effects and open Window > Extensions > FNT Reader."
