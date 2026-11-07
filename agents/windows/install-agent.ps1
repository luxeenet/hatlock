# HatLock Windows Agent Installation Script
# Usage (Run as Administrator):
# .\install-agent.ps1 -EnrollmentToken "TOKEN_HERE" -ApiUrl "https://api.hatlock.luxeenet.com"

param (
    [Parameter(Mandatory=$false)]
    [string]$EnrollmentToken = "",

    [Parameter(Mandatory=$false)]
    [string]$ApiUrl = "http://localhost:3000",

    [Parameter(Mandatory=$false)]
    [string]$InstallDir = "C:\Program Files\Luxeenet\HatLock"
)

Write-Host "=== HatLock Windows Agent Installer ===" -ForegroundColor Cyan

# Check for Administrator privileges
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error "This installer requires Administrator privileges. Please re-run in an elevated PowerShell session."
    exit 1
}

# 1. Create install directory
Write-Host "Creating installation directory: $InstallDir"
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
New-Item -ItemType Directory -Force -Path "C:\ProgramData\Luxeenet\HatLock" | Out-Null

# 2. Publish or copy binary
$sourceBin = "$PSScriptRoot\bin\Release\net10.0-windows\win-x64\publish"
if (Test-Path $sourceBin) {
    Write-Host "Copying agent files from $sourceBin..."
    Copy-Item -Path "$sourceBin\*" -Destination $InstallDir -Recurse -Force
} else {
    Write-Host "Publish binaries not found at $sourceBin. Ensure dotnet publish has been run, or copying project output."
}

# 3. Update appsettings.json if parameters provided
$configPath = Join-Path $InstallDir "appsettings.json"
if (Test-Path $configPath) {
    $json = Get-Content $configPath -Raw | ConvertFrom-Json
    if ($ApiUrl) { $json.Api.BaseUrl = $ApiUrl }
    if ($EnrollmentToken) { $json.Agent.EnrollmentToken = $EnrollmentToken }
    $json | ConvertTo-Json -Depth 5 | Set-Content $configPath
    Write-Host "Updated configuration with API URL: $ApiUrl"
}

# 4. Register or Update Windows Service
$serviceName = "HatLockAgent"
$displayName = "HatLock Device Protection Agent"
$binPath = Join-Path $InstallDir "HatLockAgent.exe"

$existing = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Stopping and removing existing service..."
    Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
    & sc.exe delete $serviceName
    Start-Sleep -Seconds 2
}

Write-Host "Registering Windows Service..."
& sc.exe create $serviceName binPath= "`"$binPath`"" start= auto DisplayName= "`"$displayName`""
& sc.exe description $serviceName "Continuous device financing and protection agent by Luxeenet"

# Configure failure actions: restart service automatically on failure
& sc.exe failure $serviceName reset= 86400 actions= restart/60000/restart/60000/restart/60000

# Start service
Write-Host "Starting $serviceName..."
Start-Service -Name $serviceName -ErrorAction SilentlyContinue

Write-Host "HatLock Windows Agent installed and started successfully!" -ForegroundColor Green
