// HatLock Windows Agent — API Client
// Communicates with the HatLock Backend API for enrollment, heartbeat, and command polling

using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace HatLock.Agent.Services;

public class ApiClient
{
    private readonly HttpClient _http;
    private readonly ILogger<ApiClient> _logger;

    public ApiClient(HttpClient http, ILogger<ApiClient> logger)
    {
        _http = http;
        _logger = logger;
    }

    public void SetDeviceToken(string token)
    {
        _http.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", token);
    }

    public async Task<EnrollmentResponse?> EnrollDeviceAsync(
        HardwareIdentity hardware,
        string enrollmentToken,
        CancellationToken ct = default)
    {
        var payload = new
        {
            enrollmentToken,
            hardware = new
            {
                systemUUID       = hardware.SystemUuid,
                manufacturer     = hardware.Manufacturer,
                model            = hardware.Model,
                serialNumber     = hardware.SerialNumber,
                motherboardSerial = hardware.MotherboardSerial,
                macAddresses     = hardware.MacAddresses,
                storageSerials   = hardware.StorageSerials,
                tpmPresent       = hardware.TpmPresent,
                tpmVersion       = hardware.TpmVersion,
                secureBoot       = hardware.SecureBoot,
                uefiEnabled      = hardware.SecureBoot
            },
            os           = "WINDOWS",
            osVersion    = hardware.OsVersion,
            agentVersion = hardware.AgentVersion
        };

        try
        {
            var response = await _http.PostAsJsonAsync("/api/v1/agent/enroll", payload, ct);
            response.EnsureSuccessStatusCode();
            return await response.Content.ReadFromJsonAsync<EnrollmentResponse>(cancellationToken: ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Device enrollment API call failed");
            return null;
        }
    }

    public async Task<HeartbeatResponse?> SendHeartbeatAsync(
        string deviceId,
        CancellationToken ct = default)
    {
        var payload = new
        {
            deviceId,
            agentVersion = "1.0.0",
            os           = "WINDOWS",
            uptimeSeconds = (long)Environment.TickCount64 / 1000
        };

        try
        {
            var response = await _http.PostAsJsonAsync("/api/v1/agent/heartbeat", payload, ct);
            if (!response.IsSuccessStatusCode) return null;
            return await response.Content.ReadFromJsonAsync<HeartbeatResponse>(cancellationToken: ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Heartbeat failed");
            return null;
        }
    }

    public async Task<List<DeviceCommand>> GetPendingCommandsAsync(
        string deviceId,
        CancellationToken ct = default)
    {
        try
        {
            var response = await _http.GetAsync($"/api/v1/agent/commands/pending/{deviceId}", ct);
            if (!response.IsSuccessStatusCode) return [];

            var result = await response.Content.ReadFromJsonAsync<PendingCommandsResponse>(cancellationToken: ct);
            return result?.Commands ?? [];
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to fetch pending commands");
            return [];
        }
    }

    public async Task<bool> AcknowledgeCommandAsync(
        string commandId,
        string deviceId,
        bool success,
        string? failReason = null,
        CancellationToken ct = default)
    {
        var payload = new { commandId, deviceId, success, failReason };
        try
        {
            var response = await _http.PostAsJsonAsync("/api/v1/agent/commands/acknowledge", payload, ct);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to acknowledge command {CommandId}", commandId);
            return false;
        }
    }
}

// Response DTOs
public record EnrollmentResponse(string DeviceId, string DeviceToken, bool IsReEnrollment, bool OsChanged, AuthorizationStatus AuthorizationStatus);
public record HeartbeatResponse(string Status, string ServerTime, bool HasPendingCommands);
public record AuthorizationStatus(bool Authorized, string Reason);
public record PendingCommandsResponse(string DeviceId, int Count, List<DeviceCommand> Commands);

public record DeviceCommand
{
    public string Id { get; init; } = "";
    public string CommandType { get; init; } = "";
    public JsonElement Payload { get; init; }
    public string Signature { get; init; } = "";
    public string Nonce { get; init; } = "";
    public DateTime ExpiresAt { get; init; }
}
