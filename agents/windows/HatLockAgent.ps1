# ==============================================================================
# HatLock Windows Security & Lock Agent Daemon
# Developed by Luxeenet for HatLock PRO Universal Fleet Protection
# ==============================================================================

param (
    [string]$ConfigPath = "C:\ProgramData\Luxeenet\HatLock\config.json",
    [switch]$SingleLoop
)

$ErrorActionPreference = "Continue"

# Configure Modern TLS Protocols
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12 -bor [System.Net.SecurityProtocolType]::Tls13

# Setup Win32 P/Invoke for Native Session Lock
if (-not ([System.Management.Automation.PSTypeName]'HatLock.Win32Lock').Type) {
    try {
        Add-Type -MemberDefinition @'
[DllImport("user32.dll", SetLastError = true)]
public static extern bool LockWorkStation();

[DllImport("user32.dll")]
public static extern bool SetForegroundWindow(IntPtr hWnd);
'@ -Name "Win32Lock" -Namespace "HatLock" -ErrorAction SilentlyContinue
    } catch {}
}

$InstallDir = "C:\Program Files\Luxeenet\HatLock"
$DataDir = "C:\ProgramData\Luxeenet\HatLock"
$FlagPath = Join-Path $DataDir "restricted.flag"
$RestrictionJsonPath = Join-Path $DataDir "restriction.json"
$LockScreenScript = Join-Path $InstallDir "HatLockLockScreen.ps1"
$LogPath = Join-Path $DataDir "agent.log"

function Write-AgentLog {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $line = "[$timestamp] [$Level] $Message"
    try {
        Add-Content -Path $LogPath -Value $line -ErrorAction SilentlyContinue
    } catch {}
}

function Invoke-PhysicalWorkstationLock {
    Write-AgentLog "Initiating physical workstation lock via Win32 LockWorkStation..." "WARN"
    try {
        if (([System.Management.Automation.PSTypeName]'HatLock.Win32Lock').Type) {
            [HatLock.Win32Lock]::LockWorkStation() | Out-Null
        }
    } catch {}
    try {
        Start-Process "rundll32.exe" -ArgumentList "user32.dll,LockWorkStation" -NoNewWindow
    } catch {}
}

function Start-LockScreenOverlay {
    param([object]$RestrictionData)

    # Persist restriction payload for the UI overlay to display
    if ($RestrictionData) {
        $RestrictionData | ConvertTo-Json -Depth 5 | Set-Content -Path $RestrictionJsonPath -Force
    }

    # Set restricted flag
    Set-Content -Path $FlagPath -Value "RESTRICTED" -Force

    # Check if LockScreen overlay process is already running
    $running = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
        $_.CommandLine -like "*HatLockLockScreen.ps1*"
    }

    if (-not $running) {
        Write-AgentLog "Spawning HatLock fullscreen lock screen overlay..." "WARN"
        Start-Process "powershell.exe" -ArgumentList "-WindowStyle Normal -ExecutionPolicy Bypass -File `"$LockScreenScript`"" -WindowStyle Maximized -ErrorAction SilentlyContinue
    }
}

function Stop-LockScreenOverlay {
    Write-AgentLog "Lifting device restriction and restoring workstation..." "INFO"

    # Remove restriction flags
    if (Test-Path $FlagPath) {
        Remove-Item -Path $FlagPath -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path $RestrictionJsonPath) {
        Remove-Item -Path $RestrictionJsonPath -Force -ErrorAction SilentlyContinue
    }

    # Terminate any running lock screen overlay instances
    $processes = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
        $_.CommandLine -like "*HatLockLockScreen.ps1*"
    }
    foreach ($proc in $processes) {
        try {
            Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
        } catch {}
    }
}

Write-AgentLog "HatLock Windows Security Agent Daemon started. Monitoring device policy..." "INFO"

# Main Telemetry and Watchdog Loop
while ($true) {
    try {
        if (-not (Test-Path $ConfigPath)) {
            Write-AgentLog "Configuration file missing at $ConfigPath. Waiting 10s..." "WARN"
            Start-Sleep -Seconds 10
            continue
        }

        $config = Get-Content -Path $ConfigPath -Raw | ConvertFrom-Json
        $deviceId = $config.deviceId
        $apiUrl = $config.apiUrl.TrimEnd('/')

        if (-not $deviceId -or -not $apiUrl) {
            Start-Sleep -Seconds 10
            continue
        }

        # 1. Send Heartbeat Telemetry
        $heartbeatUrl = "$apiUrl/api/v1/agent/heartbeat"
        $body = @{
            deviceId = $deviceId
            agentVersion = "2.4.0"
            os = "WINDOWS"
        } | ConvertTo-Json

        $hbResponse = $null
        try {
            $hbResponse = Invoke-RestMethod -Uri $heartbeatUrl -Method POST -Body $body -ContentType "application/json" -TimeoutSec 10
        } catch {
            Write-AgentLog "Heartbeat ping failed: $_" "DEBUG"
        }

        $shouldBeRestricted = $false
        $restrictionPayload = $null

        # 2. Check Pending Signed Commands
        if ($hbResponse -and $hbResponse.hasPendingCommands) {
            $cmdUrl = "$apiUrl/api/v1/agent/commands/pending/$deviceId"
            try {
                $cmdResponse = Invoke-RestMethod -Uri $cmdUrl -Method GET -TimeoutSec 10
                if ($cmdResponse -and $cmdResponse.commands) {
                    foreach ($cmd in $cmdResponse.commands) {
                        Write-AgentLog "Received command: $($cmd.commandType) (ID: $($cmd.id))" "INFO"

                        if ($cmd.commandType -eq "RESTRICT") {
                            $shouldBeRestricted = $true
                            $restrictionPayload = $cmd.payload

                            Invoke-PhysicalWorkstationLock
                            Start-LockScreenOverlay -RestrictionData $cmd.payload

                            # Acknowledge command execution
                            $ackUrl = "$apiUrl/api/v1/agent/commands/acknowledge"
                            $ackBody = @{
                                commandId = $cmd.id
                                deviceId = $deviceId
                                success = $true
                            } | ConvertTo-Json
                            Invoke-RestMethod -Uri $ackUrl -Method POST -Body $ackBody -ContentType "application/json" -TimeoutSec 10 | Out-Null
                        }
                        elseif ($cmd.commandType -eq "UNRESTRICT") {
                            $shouldBeRestricted = $false
                            Stop-LockScreenOverlay

                            # Acknowledge command execution
                            $ackUrl = "$apiUrl/api/v1/agent/commands/acknowledge"
                            $ackBody = @{
                                commandId = $cmd.id
                                deviceId = $deviceId
                                success = $true
                            } | ConvertTo-Json
                            Invoke-RestMethod -Uri $ackUrl -Method POST -Body $ackBody -ContentType "application/json" -TimeoutSec 10 | Out-Null
                        }
                    }
                }
            } catch {
                Write-AgentLog "Failed to process commands: $_" "WARN"
            }
        }

        # 3. Synchronize with Server Device Status
        if ($hbResponse -and $null -ne $hbResponse.isRestricted) {
            if ($hbResponse.isRestricted -eq $true) {
                $shouldBeRestricted = $true
            } elseif ($hbResponse.isRestricted -eq $false -and -not (Test-Path $RestrictionJsonPath)) {
                $shouldBeRestricted = $false
            }
        } else {
            # Backup query to status endpoint
            try {
                $statusUrl = "$apiUrl/api/v1/agent/status/$deviceId"
                $statusRes = Invoke-RestMethod -Uri $statusUrl -Method GET -TimeoutSec 10
                if ($statusRes -and $statusRes.status) {
                    if ($statusRes.status.authorized -eq $false) {
                        $shouldBeRestricted = $true
                        $restrictionPayload = $statusRes.status.restrictionInfo
                    } elseif ($statusRes.status.authorized -eq $true) {
                        $shouldBeRestricted = $false
                    }
                }
            } catch {}
        }

        # 4. Enforce State
        if ($shouldBeRestricted) {
            if (-not (Test-Path $FlagPath)) {
                Invoke-PhysicalWorkstationLock
                Start-LockScreenOverlay -RestrictionData $restrictionPayload
            } else {
                # Ensure lock screen is active
                $running = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
                    $_.CommandLine -like "*HatLockLockScreen.ps1*"
                }
                if (-not $running) {
                    Start-LockScreenOverlay -RestrictionData $restrictionPayload
                }
            }
        } else {
            if (Test-Path $FlagPath) {
                Stop-LockScreenOverlay
            }
        }

    } catch {
        Write-AgentLog "Watchdog loop exception: $_" "ERROR"
    }

    if ($SingleLoop) { break }
    Start-Sleep -Seconds 15
}
