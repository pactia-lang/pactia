# Install pactia on Windows from GitHub Releases.
#
# Usage (PowerShell):
#   irm https://raw.githubusercontent.com/pactia-lang/pactia/main/scripts/install-pactia.ps1 | iex
#   .\scripts\install-pactia.ps1
#   .\scripts\install-pactia.ps1 -Version v0.2.0
#
# Installs to %USERPROFILE%\.local\bin\pactia.exe and adds that folder to the user PATH.
param(
    [string]$Version = "latest"
)

$ErrorActionPreference = "Stop"

$Repo = "pactia-lang/pactia"
$Asset = "pactia-windows-x64.exe"
$InstallDir = if ($env:INSTALL_DIR) { $env:INSTALL_DIR } else { Join-Path $env:USERPROFILE ".local\bin" }
$Dest = Join-Path $InstallDir "pactia.exe"

function Get-ReleaseTag {
    param([string]$Requested)
    if ($Requested -eq "latest") {
        $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest"
        return $release.tag_name
    }
    return $Requested
}

$tag = Get-ReleaseTag -Requested $Version
if (-not $tag) {
    Write-Error "install-pactia: could not resolve release version '$Version'"
}

$url = "https://github.com/$Repo/releases/download/$tag/$Asset"

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

Write-Host "install-pactia: downloading $tag $Asset"
Invoke-WebRequest -Uri $url -OutFile $Dest -UseBasicParsing

$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if (-not $userPath) {
    $userPath = ""
}
$pathEntries = $userPath -split ";" | Where-Object { $_ -ne "" }
if ($pathEntries -notcontains $InstallDir) {
    $newPath = if ($userPath) { "$userPath;$InstallDir" } else { $InstallDir }
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    $env:Path = "$env:Path;$InstallDir"
    Write-Host "install-pactia: added $InstallDir to user PATH (open a new terminal)"
}

Write-Host "install-pactia: installed $tag -> $Dest"

$configDir = Join-Path $env:USERPROFILE ".pactia"
$configFile = Join-Path $configDir "config.toml"
if (-not (Test-Path $configFile)) {
    New-Item -ItemType Directory -Force -Path $configDir | Out-Null
    $configUrl = "https://raw.githubusercontent.com/$Repo/main/config/config.example.toml"
    try {
        Invoke-WebRequest -Uri $configUrl -OutFile $configFile -UseBasicParsing
        Write-Host "install-pactia: wrote $configFile"
    } catch {
        Write-Warning "install-pactia: could not download config — copy pactia/config/config.example.toml to $configFile"
    }
}

Write-Host "install-pactia: run 'pactia init my-product' then 'pactia add @pactia/rust-stack' in a new PowerShell window"
