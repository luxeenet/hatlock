# ==============================================================================
# HatLock Windows Security — Interactive User Session Client Companion
# Runs in the active user desktop session (Session 1+) to render the lock overlay
# Solves Session 0 Isolation cleanly across all Windows desktop versions
# ==============================================================================

$ErrorActionPreference = "SilentlyContinue"

$InstallDir = "C:\Program Files\Luxeenet\HatLock"
$DataDir = "C:\ProgramData\Luxeenet\HatLock"
$FlagPath = Join-Path $DataDir "restricted.flag"
$LockScreenScript = Join-Path $InstallDir "HatLockLockScreen.ps1"

$lockProcess = $null
$lastFailTime = [DateTime]::MinValue

while ($true) {
    try {
        $isRestricted = Test-Path $FlagPath

        if ($isRestricted) {
            # Check if lock process is currently running
            $isProcessAlive = $false
            if ($lockProcess) {
                try {
                    if (-not $lockProcess.HasExited) {
                        $isProcessAlive = $true
                    }
                } catch {}
            }

            if (-not $isProcessAlive) {
                $existing = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
                    $_.CommandLine -like "*HatLockLockScreen.ps1*"
                }
                if ($existing) {
                    $isProcessAlive = $true
                }
            }

            if (-not $isProcessAlive -and (Test-Path $LockScreenScript)) {
                # Don't spin in a rapid crash loop if it exited immediately
                $timeSinceLastFail = ([DateTime]::UtcNow - $lastFailTime).TotalSeconds
                if ($timeSinceLastFail -gt 5) {
                    $lastFailTime = [DateTime]::UtcNow
                    $lockProcess = Start-Process "powershell.exe" -ArgumentList "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$LockScreenScript`"" -PassThru -WindowStyle Hidden -ErrorAction SilentlyContinue
                }
            }
        } else {
            # Device is unrestricted — ensure lock screen is dismissed
            if ($lockProcess) {
                try {
                    if (-not $lockProcess.HasExited) {
                        $lockProcess.Kill()
                    }
                } catch {}
                $lockProcess = $null
            }

            $stray = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
                $_.CommandLine -like "*HatLockLockScreen.ps1*"
            }
            foreach ($p in $stray) {
                try {
                    Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
                } catch {}
            }
        }
    } catch {}

    Start-Sleep -Seconds 3
}
