// HatLock Windows Agent — Background Worker
// Orchestrates device enrollment, periodic heartbeat, and command processing loop

using HatLock.Agent.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace HatLock.Agent;

public class AgentWorker : BackgroundService
{
    private readonly ILogger<AgentWorker> _logger;
    private readonly IConfiguration _config;
    private readonly ApiClient _apiClient;
    private readonly CredentialStore _credentials;
    private readonly HardwareIdentityCollector _hardware;
    private readonly CommandProcessor _commandProcessor;
    private readonly RestrictionEngine _restrictionEngine;

    public AgentWorker(
        ILogger<AgentWorker> logger,
        IConfiguration config,
        ApiClient apiClient,
        CredentialStore credentials,
        HardwareIdentityCollector hardware,
        CommandProcessor commandProcessor,
        RestrictionEngine restrictionEngine)
    {
        _logger = logger;
        _config = config;
        _apiClient = apiClient;
        _credentials = credentials;
        _hardware = hardware;
        _commandProcessor = commandProcessor;
        _restrictionEngine = restrictionEngine;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("HatLock Windows Agent service is starting...");

        // 1. Initialize or load credentials
        var creds = _credentials.LoadCredentials();
        if (creds == null)
        {
            _logger.LogInformation("No enrolled credentials found. Attempting device enrollment...");
            creds = await PerformEnrollmentAsync(stoppingToken);

            if (creds == null)
            {
                _logger.LogWarning("Enrollment did not complete. Will retry in background loop.");
            }
        }

        if (creds != null)
        {
            _apiClient.SetDeviceToken(creds.DeviceToken);
            _logger.LogInformation("Agent initialized with Device ID: {DeviceId}", creds.DeviceId);
        }

        var heartbeatIntervalSeconds = _config.GetValue<int>("Agent:HeartbeatIntervalSeconds", 30);
        var heartbeatInterval = TimeSpan.FromSeconds(Math.Max(5, heartbeatIntervalSeconds));

        // 2. Main agent loop: Heartbeat and command execution
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                // If still not enrolled, attempt enrollment again
                if (creds == null)
                {
                    creds = await PerformEnrollmentAsync(stoppingToken);
                    if (creds != null)
                    {
                        _apiClient.SetDeviceToken(creds.DeviceToken);
                    }
                    else
                    {
                        await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken);
                        continue;
                    }
                }

                // Send heartbeat
                var hb = await _apiClient.SendHeartbeatAsync(creds.DeviceId, stoppingToken);

                if (hb != null && hb.HasPendingCommands)
                {
                    _logger.LogInformation("Heartbeat indicated pending commands. Fetching...");
                    var commands = await _apiClient.GetPendingCommandsAsync(creds.DeviceId, stoppingToken);

                    foreach (var cmd in commands)
                    {
                        bool success = false;
                        string? failReason = null;
                        try
                        {
                            await _commandProcessor.ProcessCommandAsync(cmd, creds.DeviceId);
                            success = true;
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "Failed to execute command {CommandId}", cmd.Id);
                            failReason = ex.Message;
                        }

                        // Acknowledge command execution back to API
                        await _apiClient.AcknowledgeCommandAsync(cmd.Id, creds.DeviceId, success, failReason, stoppingToken);
                    }
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error in agent worker loop");
            }

            await Task.Delay(heartbeatInterval, stoppingToken);
        }

        _logger.LogInformation("HatLock Windows Agent service is shutting down.");
    }

    private async Task<AgentCredentials?> PerformEnrollmentAsync(CancellationToken ct)
    {
        try
        {
            var enrollmentToken = _config["Agent:EnrollmentToken"];
            if (string.IsNullOrWhiteSpace(enrollmentToken))
            {
                _logger.LogWarning("Agent:EnrollmentToken is not configured in appsettings.json or environment variables.");
                return null;
            }

            var hwIdentity = _hardware.Collect();
            _logger.LogInformation("Collected hardware identity: Serial={Serial}, UUID={Uuid}, Hash={Hash}",
                hwIdentity.SerialNumber, hwIdentity.SystemUuid, hwIdentity.HardwareIdentityHash);

            var resp = await _apiClient.EnrollDeviceAsync(hwIdentity, enrollmentToken, ct);
            if (resp == null)
            {
                _logger.LogError("Enrollment failed — server returned empty response");
                return null;
            }

            var creds = new AgentCredentials
            {
                DeviceId = resp.DeviceId,
                DeviceToken = resp.DeviceToken,
                BusinessId = "",
                EnrolledAt = DateTime.UtcNow
            };

            _credentials.SaveCredentials(creds);
            _logger.LogInformation("Device successfully enrolled! Device ID: {DeviceId}, Re-enrollment={ReEnroll}, OsChanged={OsChanged}",
                resp.DeviceId, resp.IsReEnrollment, resp.OsChanged);

            if (!resp.AuthorizationStatus.Authorized)
            {
                _logger.LogWarning("Device is marked unauthorized upon enrollment: {Reason}", resp.AuthorizationStatus.Reason);
                _restrictionEngine.ApplyRestriction(new RestrictionInfo
                {
                    Reason = resp.AuthorizationStatus.Reason,
                    SupportContact = "support@luxeenet.com"
                });
            }

            return creds;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception during enrollment flow");
            return null;
        }
    }
}
