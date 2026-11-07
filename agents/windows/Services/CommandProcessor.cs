// HatLock Windows Agent — Command Processor
// Validates ECDSA-signed commands and delegates to RestrictionEngine
// Replay protection: checks nonce expiry before executing

using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Configuration;

namespace HatLock.Agent.Services;

public class CommandProcessor
{
    private readonly ILogger<CommandProcessor> _logger;
    private readonly RestrictionEngine _restriction;
    private readonly IConfiguration _config;
    private readonly HashSet<string> _executedNonces = new(); // In-memory replay guard

    public CommandProcessor(
        ILogger<CommandProcessor> logger,
        RestrictionEngine restriction,
        IConfiguration config)
    {
        _logger = logger;
        _restriction = restriction;
        _config = config;
    }

    public async Task ProcessCommandAsync(DeviceCommand command, string deviceId)
    {
        // 1. Replay protection: reject already-executed nonces
        if (_executedNonces.Contains(command.Nonce))
        {
            _logger.LogWarning("Command {Id} with nonce {Nonce} already executed — replay blocked", command.Id, command.Nonce);
            return;
        }

        // 2. Check expiry
        if (DateTime.UtcNow > command.ExpiresAt)
        {
            _logger.LogWarning("Command {Id} expired at {Expiry} — skipping", command.Id, command.ExpiresAt);
            return;
        }

        // 3. Verify ECDSA signature
        if (!VerifySignature(command, deviceId))
        {
            _logger.LogError("Command {Id} signature verification FAILED — potential tamper attempt!", command.Id);
            return;
        }

        // 4. Mark nonce as executed before applying (prevent race condition)
        _executedNonces.Add(command.Nonce);

        _logger.LogInformation("Executing verified command {Id}: {Type}", command.Id, command.CommandType);

        switch (command.CommandType.ToUpperInvariant())
        {
            case "RESTRICT":
                var restrictInfo = ParseRestrictionPayload(command.Payload);
                _restriction.ApplyRestriction(restrictInfo);
                break;

            case "UNRESTRICT":
                var reason = command.Payload.TryGetProperty("reason", out var r) ? r.GetString() ?? "Authorized" : "Authorized";
                var agrNum = command.Payload.TryGetProperty("agreementNumber", out var a) ? a.GetString() ?? "" : "";
                _restriction.LiftRestriction(agrNum, reason);
                break;

            default:
                _logger.LogWarning("Unknown command type: {Type}", command.CommandType);
                break;
        }
    }

    private bool VerifySignature(DeviceCommand command, string deviceId)
    {
        var publicKeyPem = _config["Api:CommandSigningPublicKey"];
        if (string.IsNullOrWhiteSpace(publicKeyPem))
        {
            _logger.LogWarning("Command signing public key not configured — skipping signature verification in dev mode");
            return true; // Allow in dev; MUST be configured in production
        }

        try
        {
            var canonical = JsonSerializer.Serialize(new
            {
                deviceId,
                nonce = command.Nonce,
                expiresAt = command.ExpiresAt.ToString("O"),
                payload = command.Payload
            });

            using var ecdsa = ECDsa.Create();
            ecdsa.ImportFromPem(publicKeyPem);

            var dataBytes = Encoding.UTF8.GetBytes(canonical);
            var sigBytes = Convert.FromBase64String(command.Signature);

            return ecdsa.VerifyData(dataBytes, sigBytes, HashAlgorithmName.SHA256);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Signature verification threw exception");
            return false;
        }
    }

    private static RestrictionInfo ParseRestrictionPayload(JsonElement payload)
    {
        return new RestrictionInfo
        {
            BusinessName      = GetStr(payload, "businessName"),
            AgreementNumber   = GetStr(payload, "agreementNumber"),
            AgreementType     = GetStr(payload, "agreementType"),
            DeviceDetails     = GetStr(payload, "deviceDetails"),
            Reason            = GetStr(payload, "reason"),
            OutstandingAmountTZS = payload.TryGetProperty("outstandingAmountTZS", out var oa) ? oa.GetDecimal() : 0,
            Currency          = GetStr(payload, "currency", "TZS"),
            PaymentInstructions = GetStr(payload, "paymentInstructions"),
            SupportContact    = GetStr(payload, "supportContact"),
            RecoveryInstructions = GetStr(payload, "recoveryInstructions")
        };
    }

    private static string GetStr(JsonElement el, string prop, string fallback = "")
        => el.TryGetProperty(prop, out var v) ? v.GetString() ?? fallback : fallback;
}
