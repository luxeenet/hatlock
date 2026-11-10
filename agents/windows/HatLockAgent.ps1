# ==============================================================================
# HatLock Windows Security & Lock Agent Daemon (Privileged System Watchdog)
# Developed by Luxeenet for HatLock PRO Universal Fleet Protection
#
# Cryptographically validates ECDSA P-256 commands, tracks hardware telemetry,
# and enforces physical session security.
# ==============================================================================

param (
    [string]$ConfigPath = "C:\ProgramData\Luxeenet\HatLock\config.json",
    [switch]$SingleLoop
)

$ErrorActionPreference = "Continue"

# Configure Modern TLS Protocols (TLS 1.2 and TLS 1.3)
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12 -bor [System.Net.SecurityProtocolType]::Tls13

# Setup Win32 P/Invoke for Native Session Lock
if (-not ([System.Management.Automation.PSTypeName]'HatLock.Win32Lock').Type) {
    try {
        Add-Type -MemberDefinition @'
[DllImport("user32.dll", SetLastError = true)]
public static extern bool LockWorkStation();
'@ -Name "Win32Lock" -Namespace "HatLock" -ErrorAction SilentlyContinue
    } catch {}
}

$InstallDir = "C:\Program Files\Luxeenet\HatLock"
$DataDir = "C:\ProgramData\Luxeenet\HatLock"
$FlagPath = Join-Path $DataDir "restricted.flag"
$RestrictionJsonPath = Join-Path $DataDir "restriction.json"
$NoncesLogPath = Join-Path $DataDir "executed_nonces.log"
$LogPath = Join-Path $DataDir "agent.log"

function Write-AgentLog {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $line = "[$timestamp] [$Level] $Message"
    try {
        Add-Content -Path $LogPath -Value $line -ErrorAction SilentlyContinue
    } catch {}
}

# Convert DER-encoded ECDSA signature to IEEE P1363 (raw r [32B] + s [32B])
function Convert-DerToP1363 {
    param([byte[]]$der)
    if (-not $der -or $der.Length -lt 8) { return $null }
    if ($der[0] -ne 0x30) { return $der }
    
    $offset = 2
    if ($der[1] -ge 0x80) { $offset += ($der[1] - 0x80) }
    
    # Parse r
    if ($der[$offset] -ne 0x02) { return $null }
    $rLen = $der[$offset + 1]
    $rStart = $offset + 2
    $rBytes = $der[$rStart..($rStart + $rLen - 1)]
    $offset = $rStart + $rLen
    
    # Parse s
    if ($der[$offset] -ne 0x02) { return $null }
    $sLen = $der[$offset + 1]
    $sStart = $offset + 2
    $sBytes = $der[$sStart..($sStart + $sLen - 1)]
    
    # Normalize lengths to 32 bytes
    while ($rBytes.Length -gt 32 -and $rBytes[0] -eq 0) { $rBytes = $rBytes[1..($rBytes.Length - 1)] }
    while ($rBytes.Length -lt 32) { $rBytes = [byte[]]@(0) + $rBytes }
    while ($sBytes.Length -gt 32 -and $sBytes[0] -eq 0) { $sBytes = $sBytes[1..($sBytes.Length - 1)] }
    while ($sBytes.Length -lt 32) { $sBytes = [byte[]]@(0) + $sBytes }
    
    return [byte[]]($rBytes + $sBytes)
}

# Cryptographically verify incoming command signature against server's ECDSA P-256 public key
function Test-CommandSignature {
    param(
        [string]$CanonicalJson,
        [string]$SignatureBase64,
        [string]$PublicKeySpkiBase64
    )

    try {
        if (-not $CanonicalJson -or -not $SignatureBase64 -or -not $PublicKeySpkiBase64) {
            Write-AgentLog "Signature verification failed: Missing required cryptographic parameters" "WARN"
            return $false
        }

        # 1. Decode SPKI and extract X, Y coordinates
        $spkiBytes = [Convert]::FromBase64String($PublicKeySpkiBase64)
        if ($spkiBytes.Length -lt 91) {
            Write-AgentLog "Invalid public key SPKI length ($($spkiBytes.Length) bytes)" "ERROR"
            return $false
        }

        $x = $spkiBytes[27..58]
        $y = $spkiBytes[59..90]

        # 2. Build BCRYPT_ECCKEY_BLOB for CNG (Magic = 0x31534345 'ECS1', cbKey = 32)
        $magic = [BitConverter]::GetBytes([int]0x31534345)
        $cbKey = [BitConverter]::GetBytes([int]32)
        $cngBlob = [byte[]]($magic + $cbKey + $x + $y)

        # 3. Import key into CNG
        $cngKey = [System.Security.Cryptography.CngKey]::Import($cngBlob, [System.Security.Cryptography.CngKeyBlobFormat]::EccPublicBlob)
        $ecdsa = New-Object System.Security.Cryptography.ECDsaCng($cngKey)

        # 4. Prepare message and signature
        $msgBytes = [System.Text.Encoding]::UTF8.GetBytes($CanonicalJson)
        $sigDer = [Convert]::FromBase64String($SignatureBase64)
        $sigP1363 = Convert-DerToP1363 -der $sigDer

        if (-not $sigP1363 -or $sigP1363.Length -ne 64) {
            Write-AgentLog "Failed to convert DER signature to IEEE P1363 format" "ERROR"
            return $false
        }

        # 5. Cryptographic verification
        $isValid = $ecdsa.VerifyData($msgBytes, $sigP1363, [System.Security.Cryptography.HashAlgorithmName]::SHA256)
        return $isValid
    } catch {
        Write-AgentLog "Exception during ECDSA verification: $_" "ERROR"
        return $false
    }
}

# Replay protection: verify nonce has never been executed before
function Test-And-Record-Nonce {
    param([string]$Nonce)
    if (-not $Nonce) { return $false }

    if (-not (Test-Path $NoncesLogPath)) {
        New-Item -ItemType File -Path $NoncesLogPath -Force | Out-Null
    }

    $existing = Get-Content -Path $NoncesLogPath -ErrorAction SilentlyContinue
    if ($existing -contains $Nonce) {
        Write-AgentLog "Replay attack detected: Nonce $Nonce has already been executed. Rejecting." "ERROR"
        return $false
    }

    # Append to executed nonces
    Add-Content -Path $NoncesLogPath -Value $Nonce -ErrorAction SilentlyContinue
    return $true
}

function Invoke-PhysicalWorkstationLock {
    Write-AgentLog "Calling user32.dll LockWorkStation()..." "WARN"
    try {
        if (([System.Management.Automation.PSTypeName]'HatLock.Win32Lock').Type) {
            [HatLock.Win32Lock]::LockWorkStation() | Out-Null
        }
    } catch {}
    try {
        Start-Process "rundll32.exe" -ArgumentList "user32.dll,LockWorkStation" -NoNewWindow
    } catch {}
}

Write-AgentLog "HatLock Windows Security Agent Watchdog initialized. Monitoring fleet policies..." "INFO"

# Main Telemetry and Cryptographic Watchdog Loop
while ($true) {
    try {
        if (-not (Test-Path $ConfigPath)) {
            Start-Sleep -Seconds 10
            continue
        }

        $config = Get-Content -Path $ConfigPath -Raw | ConvertFrom-Json
        $deviceId = $config.deviceId
        $apiUrl = $config.apiUrl.TrimEnd('/')
        $publicKeySpki = $config.signingPublicKey

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
            Write-AgentLog "Heartbeat transmission note: $_" "DEBUG"
        }

        # 2. Check and Process Cryptographically Signed Commands
        if ($hbResponse -and $hbResponse.hasPendingCommands) {
            $cmdUrl = "$apiUrl/api/v1/agent/commands/pending/$deviceId"
            try {
                $cmdResponse = Invoke-RestMethod -Uri $cmdUrl -Method GET -TimeoutSec 10
                if ($cmdResponse -and $cmdResponse.commands) {
                    foreach ($cmd in $cmdResponse.commands) {
                        Write-AgentLog "Evaluating signed command: $($cmd.commandType) (ID: $($cmd.id))" "INFO"

                        # A. Expiration Check
                        $expiresAt = [DateTime]::Parse($cmd.expiresAt)
                        if ($expiresAt.ToUniversalTime() -lt [DateTime]::UtcNow) {
                            Write-AgentLog "Command $($cmd.id) expired at $($cmd.expiresAt). Discarding." "WARN"
                            continue
                        }

                        # B. Device Binding Check
                        if ($cmd.deviceId -ne $deviceId) {
                            Write-AgentLog "Command $($cmd.id) target device mismatch ($($cmd.deviceId) vs $deviceId). Discarding." "ERROR"
                            continue
                        }

                        # C. Cryptographic Signature Check
                        $canonicalString = if ($cmd.canonical) { $cmd.canonical } else {
                            [ordered]@{
                                deviceId = $cmd.deviceId
                                nonce = $cmd.nonce
                                expiresAt = $cmd.expiresAt
                                payload = $cmd.payload
                            } | ConvertTo-Json -Compress
                        }

                        $sigValid = Test-CommandSignature -CanonicalJson $canonicalString -SignatureBase64 $cmd.signature -PublicKeySpkiBase64 $publicKeySpki

                        if (-not $sigValid) {
                            Write-AgentLog "CRITICAL SECURITY ALERT: Command $($cmd.id) signature verification FAILED. Command rejected." "ERROR"
                            # Report failed command acknowledgment
                            $ackUrl = "$apiUrl/api/v1/agent/commands/acknowledge"
                            $ackBody = @{
                                commandId = $cmd.id
                                deviceId = $deviceId
                                success = $false
                                failReason = "INVALID_ECDSA_SIGNATURE"
                            } | ConvertTo-Json
                            Invoke-RestMethod -Uri $ackUrl -Method POST -Body $ackBody -ContentType "application/json" -TimeoutSec 10 | Out-Null
                            continue
                        }

                        # D. Anti-Replay Nonce Check
                        $nonceAccepted = Test-And-Record-Nonce -Nonce $cmd.nonce
                        if (-not $nonceAccepted) {
                            continue
                        }

                        # Command is 100% authentic, verified, unexpired, and not replayed!
                        Write-AgentLog "Command $($cmd.id) successfully authenticated and verified." "INFO"

                        if ($cmd.commandType -eq "RESTRICT") {
                            # Transition into restricted mode
                            if ($cmd.payload) {
                                $cmd.payload | ConvertTo-Json -Depth 5 | Set-Content -Path $RestrictionJsonPath -Force
                            }
                            Set-Content -Path $FlagPath -Value "RESTRICTED" -Force

                            # Physically lock the session once
                            Invoke-PhysicalWorkstationLock

                            # Acknowledge execution
                            $ackUrl = "$apiUrl/api/v1/agent/commands/acknowledge"
                            $ackBody = @{
                                commandId = $cmd.id
                                deviceId = $deviceId
                                success = $true
                            } | ConvertTo-Json
                            Invoke-RestMethod -Uri $ackUrl -Method POST -Body $ackBody -ContentType "application/json" -TimeoutSec 10 | Out-Null
                        }
                        elseif ($cmd.commandType -eq "UNRESTRICT") {
                            # Transition out of restricted mode
                            if (Test-Path $FlagPath) {
                                Remove-Item -Path $FlagPath -Force -ErrorAction SilentlyContinue
                            }
                            if (Test-Path $RestrictionJsonPath) {
                                Remove-Item -Path $RestrictionJsonPath -Force -ErrorAction SilentlyContinue
                            }
                            Write-AgentLog "Device restriction lifted by authenticated command." "INFO"

                            # Acknowledge execution
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

        # 3. Server Status Synchronization (Live Heartbeat State Check)
        if ($hbResponse -and $null -ne $hbResponse.isRestricted) {
            if ($hbResponse.isRestricted -eq $true -and -not (Test-Path $FlagPath)) {
                Write-AgentLog "Server confirmed device RESTRICTED via heartbeat policy. Enforcing lock." "WARN"
                Set-Content -Path $FlagPath -Value "RESTRICTED" -Force
                Invoke-PhysicalWorkstationLock
            }
            elseif ($hbResponse.isRestricted -eq $false -and (Test-Path $FlagPath)) {
                # Dashboard marks device restored
                Write-AgentLog "Server confirmed device active. Clearing restriction flag." "INFO"
                Remove-Item -Path $FlagPath -Force -ErrorAction SilentlyContinue
                Remove-Item -Path $RestrictionJsonPath -Force -ErrorAction SilentlyContinue
            }
        }

    } catch {
        Write-AgentLog "Watchdog loop exception: $_" "ERROR"
    }

    if ($SingleLoop) { break }
    Start-Sleep -Seconds 15
}
