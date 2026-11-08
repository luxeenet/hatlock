// HatLock Windows Agent — Hardware Identity Collector
// Collects stable, hardware-bound identifiers for device fingerprinting
// Uses: WMI (System.Management), TPM WMI, CryptographicOperations

using System.Management;
using System.Security.Cryptography;
using System.Net.NetworkInformation;
using System.Text;
using Microsoft.Extensions.Logging;

namespace HatLock.Agent.Services;

public class HardwareIdentityCollector
{
    private readonly ILogger<HardwareIdentityCollector> _logger;

    public HardwareIdentityCollector(ILogger<HardwareIdentityCollector> logger)
    {
        _logger = logger;
    }

    public HardwareIdentity Collect()
    {
        _logger.LogInformation("Collecting hardware identity...");

        var identity = new HardwareIdentity
        {
            Manufacturer = GetWmiValue("Win32_ComputerSystem", "Manufacturer") ?? "Unknown",
            Model        = GetWmiValue("Win32_ComputerSystem", "Model") ?? "Unknown",
            SerialNumber = GetWmiValue("Win32_BIOS", "SerialNumber")?.Trim() ?? "Unknown",
            SystemUuid   = GetWmiValue("Win32_ComputerSystemProduct", "UUID") ?? string.Empty,
            MotherboardSerial = GetWmiValue("Win32_BaseBoard", "SerialNumber")?.Trim() ?? string.Empty,
            BiosUuid     = GetWmiValue("Win32_BIOS", "SerialNumber") ?? string.Empty,
            OsType       = "WINDOWS",
            OsVersion    = Environment.OSVersion.VersionString,
            AgentVersion = "1.0.0",
            MacAddresses = GetMacAddresses(),
            StorageSerials = GetStorageSerials(),
            TpmPresent   = DetectTpm(out var tpmVersion),
            TpmVersion   = tpmVersion,
            SecureBoot   = DetectSecureBoot(),
            BitLockerActive = DetectBitLocker(),
            AutopilotEnrolled = DetectAutopilot()
        };

        identity.IdentityHash = ComputeIdentityHash(identity);
        _logger.LogInformation("Hardware identity hash: {Hash}", identity.IdentityHash);

        return identity;
    }

    private static string? GetWmiValue(string wmiClass, string property)
    {
        try
        {
            using var searcher = new ManagementObjectSearcher($"SELECT {property} FROM {wmiClass}");
            foreach (ManagementObject obj in searcher.Get())
            {
                return obj[property]?.ToString();
            }
        }
        catch { /* WMI may not be available in some environments */ }
        return null;
    }

    private static List<string> GetMacAddresses()
    {
        var macs = new List<string>();
        try
        {
            foreach (var nic in NetworkInterface.GetAllNetworkInterfaces())
            {
                if (nic.NetworkInterfaceType == NetworkInterfaceType.Loopback) continue;
                if (nic.GetPhysicalAddress().ToString() is { Length: > 0 } mac)
                    macs.Add(mac.ToUpperInvariant());
            }
        }
        catch { }
        return macs;
    }

    private static List<string> GetStorageSerials()
    {
        var serials = new List<string>();
        try
        {
            using var searcher = new ManagementObjectSearcher("SELECT SerialNumber FROM Win32_DiskDrive");
            foreach (ManagementObject disk in searcher.Get())
            {
                var serial = disk["SerialNumber"]?.ToString()?.Trim();
                if (!string.IsNullOrWhiteSpace(serial))
                    serials.Add(serial);
            }
        }
        catch { }
        return serials;
    }

    private static bool DetectTpm(out string? tpmVersion)
    {
        tpmVersion = null;
        try
        {
            using var searcher = new ManagementObjectSearcher(@"root\cimv2\security\microsofttpm",
                "SELECT * FROM Win32_Tpm");
            foreach (ManagementObject tpm in searcher.Get())
            {
                tpmVersion = tpm["SpecVersion"]?.ToString();
                return true;
            }
        }
        catch { }
        return false;
    }

    private static bool DetectSecureBoot()
    {
        try
        {
            using var key = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(
                @"SYSTEM\CurrentControlSet\Control\SecureBoot\State");
            var val = key?.GetValue("UEFISecureBootEnabled");
            return val is int i && i == 1;
        }
        catch { return false; }
    }

    private static bool DetectBitLocker()
    {
        try
        {
            using var searcher = new ManagementObjectSearcher(@"root\CIMV2\Security\MicrosoftVolumeEncryption", "SELECT ProtectionStatus FROM Win32_EncryptableVolume WHERE DriveLetter = 'C:'");
            foreach (ManagementObject obj in searcher.Get())
            {
                if (obj["ProtectionStatus"]?.ToString() == "1")
                    return true;
            }
        }
        catch { }
        return false;
    }

    private static bool DetectAutopilot()
    {
        try
        {
            // Windows Autopilot registration markers in registry
            using var key = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Provisioning\AutopilotPolicy");
            return key != null;
        }
        catch { }
        return false;
    }

    private static string ComputeIdentityHash(HardwareIdentity id)
    {
        var fields = string.Join("|",
            id.SystemUuid, id.Manufacturer, id.Model,
            id.SerialNumber, id.MotherboardSerial, id.BiosUuid
        ).ToLowerInvariant().Trim();

        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(fields));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}

public record HardwareIdentity
{
    public string Manufacturer { get; set; } = "";
    public string Model { get; set; } = "";
    public string SerialNumber { get; set; } = "";
    public string SystemUuid { get; set; } = "";
    public string MotherboardSerial { get; set; } = "";
    public string BiosUuid { get; set; } = "";
    public string OsType { get; set; } = "WINDOWS";
    public string OsVersion { get; set; } = "";
    public string AgentVersion { get; set; } = "1.0.0";
    public List<string> MacAddresses { get; set; } = [];
    public List<string> StorageSerials { get; set; } = [];
    public bool TpmPresent { get; set; }
    public string? TpmVersion { get; set; }
    public bool SecureBoot { get; set; }
    public bool BitLockerActive { get; set; }
    public bool AutopilotEnrolled { get; set; }
    public string IdentityHash { get; set; } = "";
}
