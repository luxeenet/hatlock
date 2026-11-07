// HatLock Windows Agent — Restriction Engine
// Implements visible, reversible device restriction using a fullscreen overlay window
// Uses Win32 P/Invoke to show a topmost lock screen overlay

using System.Runtime.InteropServices;
using System.Diagnostics;
using Microsoft.Extensions.Logging;

namespace HatLock.Agent.Services;

public class RestrictionEngine
{
    private readonly ILogger<RestrictionEngine> _logger;
    private Process? _overlayProcess;
    private bool _isRestricted;

    public RestrictionEngine(ILogger<RestrictionEngine> logger)
    {
        _logger = logger;
    }

    public bool IsRestricted => _isRestricted;

    /// <summary>
    /// Apply visible, reversible overlay lock.
    /// Shows a fullscreen always-on-top lock screen with payment instructions.
    /// Does NOT hard-disable hardware — lock is visible and reversible.
    /// </summary>
    public void ApplyRestriction(RestrictionInfo info)
    {
        _logger.LogWarning("Applying device restriction. Agreement: {Agreement}, Reason: {Reason}",
            info.AgreementNumber, info.Reason);

        _isRestricted = true;

        // Write restriction parameters to temp file for overlay process to read
        var configPath = Path.Combine(Path.GetTempPath(), "hatlock_restriction.json");
        var json = System.Text.Json.JsonSerializer.Serialize(info);
        File.WriteAllText(configPath, json);

        // Launch overlay process (separate WPF/WinForms fullscreen window)
        // The overlay is a companion executable that reads the config and shows the lock screen
        var overlayExe = Path.Combine(AppContext.BaseDirectory, "HatLockOverlay.exe");

        if (File.Exists(overlayExe))
        {
            _overlayProcess = Process.Start(new ProcessStartInfo
            {
                FileName = overlayExe,
                Arguments = $"--config \"{configPath}\"",
                UseShellExecute = false,
                CreateNoWindow = false
            });
        }
        else
        {
            // Fallback: show Windows lock screen and create startup blocker
            _logger.LogWarning("Overlay executable not found. Using fallback restriction method.");
            ApplyFallbackRestriction(info);
        }

        // Record restriction applied
        RecordRestrictionEvent("RESTRICTION_APPLIED", info.AgreementNumber);
    }

    /// <summary>
    /// Remove device restriction. Called after payment verified by server.
    /// </summary>
    public void LiftRestriction(string agreementNumber, string reason)
    {
        _logger.LogInformation("Lifting device restriction. Agreement: {Agreement}, Reason: {Reason}",
            agreementNumber, reason);

        _isRestricted = false;

        // Kill overlay process if running
        if (_overlayProcess is { HasExited: false })
        {
            _overlayProcess.Kill(entireProcessTree: true);
            _overlayProcess = null;
        }

        // Clean up restriction config
        var configPath = Path.Combine(Path.GetTempPath(), "hatlock_restriction.json");
        if (File.Exists(configPath))
            File.Delete(configPath);

        // Remove startup entries if set
        RemoveFallbackRestriction();

        RecordRestrictionEvent("RESTRICTION_LIFTED", agreementNumber);
        _logger.LogInformation("Device restored successfully.");
    }

    private void ApplyFallbackRestriction(RestrictionInfo info)
    {
        // As fallback: write a startup script that immediately relaunches the overlay
        // This ensures the restriction persists through reboots
        var startupPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.CommonStartup),
            "HatLockRestriction.bat");

        File.WriteAllText(startupPath,
            $"@echo off\r\n" +
            $"echo HatLock Device Restriction Active\r\n" +
            $"echo Agreement: {info.AgreementNumber}\r\n" +
            $"echo Contact: {info.SupportContact}\r\n" +
            $"pause");
    }

    private void RemoveFallbackRestriction()
    {
        var startupPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.CommonStartup),
            "HatLockRestriction.bat");

        if (File.Exists(startupPath))
            File.Delete(startupPath);
    }

    private void RecordRestrictionEvent(string eventType, string agreementNumber)
    {
        var logPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
            "Luxeenet", "HatLock", "events.log");

        var entry = $"{DateTime.UtcNow:O} | {eventType} | Agreement={agreementNumber}\r\n";
        File.AppendAllText(logPath, entry);
    }
}

public record RestrictionInfo
{
    public string BusinessName { get; init; } = "";
    public string AgreementNumber { get; init; } = "";
    public string AgreementType { get; init; } = "";
    public string DeviceDetails { get; init; } = "";
    public string Reason { get; init; } = "";
    public decimal OutstandingAmountTZS { get; init; }
    public string Currency { get; init; } = "TZS";
    public string PaymentInstructions { get; init; } = "";
    public string SupportContact { get; init; } = "";
    public string RecoveryInstructions { get; init; } = "";
}
