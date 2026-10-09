# Builds dist\FNTReader-vX.Y.Z.zxp from src\ (fresh self-signed certificate on every run).
# Usage: .\scripts\build-zxp.ps1   (downloads Adobe's ZXPSignCmd if missing)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$manifest = [xml](Get-Content "$root\src\CSXS\manifest.xml" -Encoding UTF8)
$version = $manifest.ExtensionManifest.ExtensionBundleVersion

$stage = Join-Path $root 'dist\zxp-src'
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Force $stage | Out-Null
Copy-Item "$root\src\*" $stage -Recurse

$tools = Join-Path $root 'dist\tools'
$exe = Join-Path $tools 'ZXPSignCmd.exe'
if (-not (Test-Path $exe)) {
    New-Item -ItemType Directory -Force $tools | Out-Null
    Invoke-WebRequest 'https://github.com/Adobe-CEP/CEP-Resources/raw/master/ZXPSignCMD/4.1.103/win64/ZXPSignCmd.exe' -OutFile $exe
}
$cert = Join-Path $tools 'cert.p12'
$pw = [guid]::NewGuid().ToString('N')
if (Test-Path $cert) { Remove-Item $cert }
& $exe -selfSignedCert PT Lisboa 'FNT Reader' 'FNT Reader' $pw $cert
if ($LASTEXITCODE -ne 0) { throw 'Could not create the certificate' }

$out = Join-Path $root "dist\FNTReader-v$version.zxp"
if (Test-Path $out) { Remove-Item $out }
& $exe -sign $stage $out $cert $pw
if ($LASTEXITCODE -ne 0) { throw 'Signing failed' }
& $exe -verify $out -certinfo
Remove-Item $cert
Remove-Item $stage -Recurse -Force
Write-Host "Created $out"
