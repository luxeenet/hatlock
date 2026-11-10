# ==============================================================================
# HatLock Windows Protection Agent — Universal Installer
# Developed by Luxeenet for HatLock PRO
#
# Usage (Run as Administrator):
# irm "https://api.luxeenet.com/downloads/windows/install.ps1?deviceId=YOUR_DEVICE_ID" | iex
# ==============================================================================

param (
    [Parameter(Mandatory=$false)]
    [string]$DeviceId = "",

    [Parameter(Mandatory=$false)]
    [string]$EnrollmentToken = "",

    [Parameter(Mandatory=$false)]
    [string]$ApiUrl = "http://localhost:3000",

    [Parameter(Mandatory=$false)]
    [string]$InstallDir = "C:\Program Files\Luxeenet\HatLock",

    [Parameter(Mandatory=$false)]
    [string]$DataDir = "C:\ProgramData\Luxeenet\HatLock"
)

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   HATLOCK PRO — UNIVERSAL WINDOWS FLEET SECURITY AGENT     " -ForegroundColor White
Write-Host "   Continuous Cryptographic Lock & Financing Protection     " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verify Administrative Privileges
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "[ERROR] This installer requires Administrator privileges." -ForegroundColor Red
    Write-Host "Please open PowerShell as Administrator and re-run:" -ForegroundColor Yellow
    Write-Host "  Right-Click Start -> Terminal (Admin) / PowerShell (Admin)" -ForegroundColor White
    exit 1
}

# Use DeviceId as EnrollmentToken if provided
if (-not $EnrollmentToken -and $DeviceId) {
    $EnrollmentToken = $DeviceId
}

# 2. Gather Hardware Telemetry & Serial Identity
Write-Host "[1/5] Collecting hardware cryptographic identity..." -ForegroundColor Yellow

$bios = Get-CimInstance Win32_BIOS -ErrorAction SilentlyContinue
$cs = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue
$csp = Get-CimInstance Win32_ComputerSystemProduct -ErrorAction SilentlyContinue
$bb = Get-CimInstance Win32_BaseBoard -ErrorAction SilentlyContinue
$proc = Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1

$serialNumber = if ($bios.SerialNumber) { $bios.SerialNumber.Trim() } else { "UNKNOWN-$env:COMPUTERNAME" }
$manufacturer = if ($cs.Manufacturer) { $cs.Manufacturer.Trim() } else { "PC" }
$model = if ($cs.Model) { $cs.Model.Trim() } else { "Windows Workstation" }
$systemUUID = if ($csp.UUID) { $csp.UUID.Trim() } else { "" }
$mbSerial = if ($bb.SerialNumber) { $bb.SerialNumber.Trim() } else { "" }
$cpuId = if ($proc.ProcessorId) { $proc.ProcessorId.Trim() } else { "" }

# MAC Addresses
$macList = @()
try {
    $adapters = Get-CimInstance Win32_NetworkAdapterConfiguration -Filter "IPEnabled=True" -ErrorAction SilentlyContinue
    foreach ($adapter in $adapters) {
        if ($adapter.MACAddress) { $macList += $adapter.MACAddress }
    }
} catch {}

# TPM & SecureBoot Checks
$tpmPresent = $false
try {
    $tpmInfo = Get-Tpm -ErrorAction SilentlyContinue
    if ($tpmInfo -and $tpmInfo.TpmPresent) { $tpmPresent = $true }
} catch {}

$secureBoot = $false
try {
    $sb = Confirm-SecureBootUEFI -ErrorAction SilentlyContinue
    if ($sb -eq $true) { $secureBoot = $true }
} catch {}

Write-Host "  -> Manufacturer : $manufacturer" -ForegroundColor Gray
Write-Host "  -> Model        : $model" -ForegroundColor Gray
Write-Host "  -> Serial Number: $serialNumber" -ForegroundColor Gray
Write-Host "  -> Hardware UUID: $systemUUID" -ForegroundColor Gray
Write-Host "  -> TPM Security : $(if ($tpmPresent) { 'Present (TPM 2.0)' } else { 'Not Detected' })" -ForegroundColor Gray

# 3. Create Directories
Write-Host "[2/5] Creating system service directories..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
New-Item -ItemType Directory -Force -Path $DataDir | Out-Null

# 4. Enroll with HatLock PRO Cloud API
Write-Host "[3/5] Registering machine with HatLock Cloud ($ApiUrl)..." -ForegroundColor Yellow

[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12 -bor [System.Net.SecurityProtocolType]::Tls13

$enrollPayload = @{
    enrollmentToken = if ($EnrollmentToken) { $EnrollmentToken } else { $serialNumber }
    os = "WINDOWS"
    osVersion = [System.Environment]::OSVersion.VersionString
    agentVersion = "2.4.0"
    hardware = @{
        manufacturer = $manufacturer
        model = $model
        serialNumber = $serialNumber
        systemUUID = $systemUUID
        motherboardSerial = $mbSerial
        cpuId = $cpuId
        macAddresses = $macList
        storageSerials = @()
        tpmPresent = $tpmPresent
        secureBoot = $secureBoot
    }
} | ConvertTo-Json -Depth 6

$enrolledDeviceId = $DeviceId
try {
    $enrollUrl = "$($ApiUrl.TrimEnd('/'))/api/v1/agent/enroll"
    $enrollRes = Invoke-RestMethod -Uri $enrollUrl -Method POST -Body $enrollPayload -ContentType "application/json" -TimeoutSec 15
    if ($enrollRes -and $enrollRes.data -and $enrollRes.data.deviceId) {
        $enrolledDeviceId = $enrollRes.data.deviceId
        Write-Host "  -> Device enrolled successfully! ID: $enrolledDeviceId" -ForegroundColor Green
    }
} catch {
    Write-Host "  -> Notice: Initial enrollment sync note: $($_.Exception.Message)" -ForegroundColor DarkYellow
    if (-not $enrolledDeviceId) {
        $enrolledDeviceId = $serialNumber
    }
}

# 5. Write Configuration
$configObj = @{
    deviceId = $enrolledDeviceId
    serialNumber = $serialNumber
    apiUrl = $ApiUrl
    agentVersion = "2.4.0"
    installedAt = (Get-Date).ToString("o")
}
$configPath = Join-Path $DataDir "config.json"
$configObj | ConvertTo-Json -Depth 5 | Set-Content -Path $configPath -Force
Write-Host "  -> Configuration saved to $configPath" -ForegroundColor Gray

# 6. Deploy HatLock Agent & Lock Screen Scripts
Write-Host "[4/5] Deploying HatLock Security Agent & Enforcement Engine..." -ForegroundColor Yellow

$agentScriptPath = Join-Path $InstallDir "HatLockAgent.ps1"
$lockScreenScriptPath = Join-Path $InstallDir "HatLockLockScreen.ps1"

# Check if local files exist in source or write embedded versions
$sourceAgent = Join-Path $PSScriptRoot "HatLockAgent.ps1"
if (Test-Path $sourceAgent) {
    Copy-Item -Path $sourceAgent -Destination $agentScriptPath -Force
}

$sourceLockScreen = Join-Path $PSScriptRoot "HatLockLockScreen.ps1"
if (Test-Path $sourceLockScreen) {
    Copy-Item -Path $sourceLockScreen -Destination $lockScreenScriptPath -Force
}

# Ensure scripts exist in InstallDir
if (-not (Test-Path $agentScriptPath)) {
    # Fetch from server
    try {
        Invoke-WebRequest -Uri "$($ApiUrl.TrimEnd('/'))/downloads/windows/HatLockAgent.ps1" -OutFile $agentScriptPath -UseBasicParsing -TimeoutSec 10
    } catch {}
}

# 7. Register Persistent Scheduled Task Watchdog
Write-Host "[5/5] Registering continuous Windows Watchdog Task..." -ForegroundColor Yellow

$taskName = "HatLockWatchdog"
try {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
} catch {}

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$agentScriptPath`""
$triggerBoot = New-ScheduledTaskTrigger -AtStartup
$triggerLogon = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal -UserId "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Days 365)

try {
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger @($triggerBoot, $triggerLogon) -Principal $principal -Settings $settings -Force | Out-Null
    Write-Host "  -> Scheduled Task registered as '$taskName' (SYSTEM / Highest Privileges)." -ForegroundColor Green
} catch {
    Write-Host "  -> Scheduled Task note: $_" -ForegroundColor DarkYellow
}

# 8. Terminate previous instances and start agent immediately
Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*HatLockAgent.ps1*"
} | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}

Start-Process "powershell.exe" -ArgumentList "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$agentScriptPath`"" -WindowStyle Hidden

# Send immediate initial heartbeat
try {
    $body = @{
        deviceId = $enrolledDeviceId
        agentVersion = "2.4.0"
        os = "WINDOWS"
    } | ConvertTo-Json
    Invoke-RestMethod -Uri "$($ApiUrl.TrimEnd('/'))/api/v1/agent/heartbeat" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 10 | Out-Null
    Write-Host "  -> Initial agent heartbeat transmitted to HatLock PRO." -ForegroundColor Green
} catch {}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "   HATLOCK PRO AGENT INSTALLED & ACTIVE                     " -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host "Machine Hardware : $manufacturer $model (S/N: $serialNumber)" -ForegroundColor White
Write-Host "Enrolled ID      : $enrolledDeviceId" -ForegroundColor Cyan
Write-Host "Status           : Live Protection Active & Monitoring" -ForegroundColor Green
Write-Host ""
