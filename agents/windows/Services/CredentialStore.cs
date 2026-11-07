// HatLock Windows Agent — Credential Store
// Securely stores device token and enrollment state using DPAPI (Windows Data Protection API)
// Keys are non-exportable and bound to the local machine

using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace HatLock.Agent.Services;

public class CredentialStore
{
    private readonly ILogger<CredentialStore> _logger;
    private readonly string _storePath;

    public CredentialStore(ILogger<CredentialStore> logger)
    {
        _logger = logger;
        var appData = Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData);
        var dir = Path.Combine(appData, "Luxeenet", "HatLock");
        Directory.CreateDirectory(dir);
        _storePath = Path.Combine(dir, "credential.dat");
    }

    public bool HasCredentials()
    {
        return File.Exists(_storePath);
    }

    public void SaveCredentials(AgentCredentials credentials)
    {
        try
        {
            var json = JsonSerializer.Serialize(credentials);
            var plainBytes = Encoding.UTF8.GetBytes(json);

            // DPAPI: encrypt to LOCAL_MACHINE scope — survives reboots but bound to machine
            var encrypted = ProtectedData.Protect(plainBytes, null, DataProtectionScope.LocalMachine);
            File.WriteAllBytes(_storePath, encrypted);
            _logger.LogInformation("Credentials saved to DPAPI store at {Path}", _storePath);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save credentials to DPAPI store");
            throw;
        }
    }

    public AgentCredentials? LoadCredentials()
    {
        if (!File.Exists(_storePath)) return null;

        try
        {
            var encrypted = File.ReadAllBytes(_storePath);
            var decrypted = ProtectedData.Unprotect(encrypted, null, DataProtectionScope.LocalMachine);
            var json = Encoding.UTF8.GetString(decrypted);
            return JsonSerializer.Deserialize<AgentCredentials>(json);
        }
        catch (CryptographicException ex)
        {
            _logger.LogWarning(ex, "DPAPI decryption failed — credential may have been moved to different machine");
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load credentials");
            return null;
        }
    }

    public void ClearCredentials()
    {
        if (File.Exists(_storePath))
        {
            File.Delete(_storePath);
            _logger.LogInformation("Credentials cleared from DPAPI store");
        }
    }
}

public record AgentCredentials
{
    public string DeviceId { get; init; } = "";
    public string DeviceToken { get; init; } = "";
    public string BusinessId { get; init; } = "";
    public DateTime EnrolledAt { get; init; }
}
