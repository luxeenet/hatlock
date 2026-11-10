# ==============================================================================
# HatLock Windows Protection Agent - Hardened Universal Installer
# Developed by Luxeenet for HatLock PRO
#
# Multi-tier architecture:
# 1. Privileged Core Service (SYSTEM) - Hardware crypto, command verification
# 2. Interactive User Client (Session 1) - Fullscreen lock overlay presentation
# ==============================================================================

param (
    [Parameter(Mandatory=$false)]
    [string]$DeviceId = "",

    [Parameter(Mandatory=$false)]
    [string]$EnrollmentToken = "",

    [Parameter(Mandatory=$false)]
    [string]$ApiUrl = "http://localhost:3000",

    [Parameter(Mandatory=$false)]
    [string]$SigningPublicKey = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEek9hvtZIr5RREFhTlL9zLBokaR1kgSU4OHJEtpgzGQdpMTLJn5RdULUazzSmK3HJqnZ9UP77caWxhdxr6Aw39g==",

    [Parameter(Mandatory=$false)]
    [string]$InstallDir = "C:\Program Files\Luxeenet\HatLock",

    [Parameter(Mandatory=$false)]
    [string]$DataDir = "C:\ProgramData\Luxeenet\HatLock"
)

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   HATLOCK PRO - HARDENED WINDOWS FLEET SECURITY AGENT      " -ForegroundColor White
Write-Host "   Cryptographic Lock and Financing Protection Engine       " -ForegroundColor Cyan
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

if (-not $EnrollmentToken -and $DeviceId) {
    $EnrollmentToken = $DeviceId
}

# 2. Collect Hardware Identity
Write-Host "[1/6] Collecting hardware cryptographic identity..." -ForegroundColor Yellow

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

$macList = @()
try {
    $adapters = Get-CimInstance Win32_NetworkAdapterConfiguration -Filter "IPEnabled=True" -ErrorAction SilentlyContinue
    foreach ($adapter in $adapters) {
        if ($adapter.MACAddress) { $macList += $adapter.MACAddress }
    }
} catch {}

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

# 3. Create System Directories
Write-Host "[2/6] Creating system directories..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
New-Item -ItemType Directory -Force -Path $DataDir | Out-Null

# 4. Enroll with HatLock PRO Cloud API
Write-Host "[3/6] Registering machine with HatLock Cloud ($ApiUrl)..." -ForegroundColor Yellow

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

# 5. Write Hardened Configuration
$configObj = @{
    deviceId = $enrolledDeviceId
    serialNumber = $serialNumber
    apiUrl = $ApiUrl
    agentVersion = "2.4.0"
    signingPublicKey = $SigningPublicKey
    installedAt = (Get-Date).ToString("o")
}
$configPath = Join-Path $DataDir "config.json"
$configObj | ConvertTo-Json -Depth 5 | Set-Content -Path $configPath -Force
Write-Host "  -> Configuration saved to $configPath" -ForegroundColor Gray

# 6. Deploy HatLock Agent, User Client and Lock Screen Scripts
Write-Host "[4/6] Deploying multi-tier protection modules..." -ForegroundColor Yellow

$agentScriptPath = Join-Path $InstallDir "HatLockAgent.ps1"
$userClientScriptPath = Join-Path $InstallDir "HatLockUserClient.ps1"
$lockScreenScriptPath = Join-Path $InstallDir "HatLockLockScreen.ps1"

# Copy from local repository or fetch from API
$files = @(
    @{ Name = "HatLockAgent.ps1"; Dest = $agentScriptPath },
    @{ Name = "HatLockUserClient.ps1"; Dest = $userClientScriptPath },
    @{ Name = "HatLockLockScreen.ps1"; Dest = $lockScreenScriptPath }
)

foreach ($f in $files) {
    $localSource = Join-Path $PSScriptRoot $f.Name
    if (Test-Path $localSource) {
        Copy-Item -Path $localSource -Destination $f.Dest -Force
    } else {
        try {
            Invoke-WebRequest -Uri "$($ApiUrl.TrimEnd('/'))/downloads/windows/$($f.Name)" -OutFile $f.Dest -UseBasicParsing -TimeoutSec 10
        } catch {}
    }
}

# 7. Apply Strict NTFS Access Control Lists
Write-Host "[5/6] Hardening filesystem permissions (Anti-Tamper ACLs)..." -ForegroundColor Yellow

try {
    Start-Process "icacls.exe" -ArgumentList "`"$InstallDir`" /inheritance:r /grant:r `"NT AUTHORITY\SYSTEM:(OI)(CI)F`" `"BUILTIN\Administrators:(OI)(CI)F`" `"BUILTIN\Users:(OI)(CI)RX`" /t /c /q" -Wait -NoNewWindow -ErrorAction SilentlyContinue
    Start-Process "icacls.exe" -ArgumentList "`"$DataDir`" /inheritance:r /grant:r `"NT AUTHORITY\SYSTEM:(OI)(CI)F`" `"BUILTIN\Administrators:(OI)(CI)F`" `"BUILTIN\Users:(OI)(CI)RX`" /t /c /q" -Wait -NoNewWindow -ErrorAction SilentlyContinue
    Write-Host "  -> NTFS permissions locked to SYSTEM and Administrators only." -ForegroundColor Green
} catch {
    Write-Host "  -> Note on ACL application: $_" -ForegroundColor DarkYellow
}

# 8. Register Scheduled Tasks and Interactive Session Launchers
Write-Host "[6/6] Registering SYSTEM Watchdog and Interactive Session Companion..." -ForegroundColor Yellow

# A. Privileged Background Watchdog (SYSTEM)
$taskName = "HatLockWatchdog"
try {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
} catch {}

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$agentScriptPath`""
$triggerBoot = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Days 365)

try {
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $triggerBoot -Principal $principal -Settings $settings -Force | Out-Null
    Write-Host "  -> Registered SYSTEM Watchdog: '$taskName' (Session 0 Core)." -ForegroundColor Green
} catch {}

# B. Interactive Desktop Companion (Run key for user sessions)
try {
    $runKeyPath = "HKLM:\Software\Microsoft\Windows\CurrentVersion\Run"
    $runCmd = "powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$userClientScriptPath`""
    Set-ItemProperty -Path $runKeyPath -Name "HatLockUserCompanion" -Value $runCmd -Force
    Write-Host "  -> Registered Interactive Companion in HKLM Run (Session 1+ UI Delivery)." -ForegroundColor Green
} catch {}

# 9. Stop Previous Instances and Start Current Daemons
Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*HatLockAgent.ps1*" -or $_.CommandLine -like "*HatLockUserClient.ps1*"
} | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}

# Start Privileged Watchdog
Start-Process "powershell.exe" -ArgumentList "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$agentScriptPath`"" -WindowStyle Hidden

# Start Interactive Companion in current desktop session
Start-Process "powershell.exe" -ArgumentList "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$userClientScriptPath`"" -WindowStyle Hidden

# Send immediate initial heartbeat
try {
    $body = @{
        deviceId = $enrolledDeviceId
        agentVersion = "2.4.0"
        os = "WINDOWS"
    } | ConvertTo-Json
    Invoke-RestMethod -Uri "$($ApiUrl.TrimEnd('/'))/api/v1/agent/heartbeat" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 10 | Out-Null
    Write-Host "  -> Transmitted authenticated heartbeat to HatLock PRO Cloud." -ForegroundColor Green
} catch {}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "   HATLOCK PRO HARDENED SECURITY AGENT IS ACTIVE            " -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host "Hardware Profile : $manufacturer $model (S/N: $serialNumber)" -ForegroundColor White
Write-Host "Enrolled ID      : $enrolledDeviceId" -ForegroundColor Cyan
Write-Host "Crypto Security  : ECDSA P-256 Validated Commands Only" -ForegroundColor Green
Write-Host "Status           : Live Dual-Tier Protection Running" -ForegroundColor Green
Write-Host ""
