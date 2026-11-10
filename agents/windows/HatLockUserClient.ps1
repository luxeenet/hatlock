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

while ($true) {
    try {
        $isRestricted = Test-Path $FlagPath

        if ($isRestricted) {
            # Check if lock process is currently running
            $isProcessAlive = $false
            if ($lockProcess -and -not $lockProcess.HasExited) {
                $isProcessAlive = $true
            } else {
                # Look for existing interactive lock screen process
                $existing = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
                    $_.CommandLine -like "*HatLockLockScreen.ps1*"
                }
                if ($existing) {
                    $isProcessAlive = $true
                }
            }

            if (-not $isProcessAlive -and (Test-Path $LockScreenScript)) {
                # Launch the WPF lock screen directly in this interactive user session
                $lockProcess = Start-Process "powershell.exe" -ArgumentList "-WindowStyle Normal -ExecutionPolicy Bypass -File `"$LockScreenScript`"" -PassThru -WindowStyle Maximized
            }
        } else {
            # Device is unrestricted — ensure lock screen is dismissed
            if ($lockProcess -and -not $lockProcess.HasExited) {
                $lockProcess.Kill()
                $lockProcess = $null
            }

            $stray = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
                $_.CommandLine -like "*HatLockLockScreen.ps1*"
            }
            foreach ($p in $stray) {
                Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
            }
        }
    } catch {}

    Start-Sleep -Seconds 3
}
