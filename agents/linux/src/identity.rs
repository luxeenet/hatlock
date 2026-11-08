// HatLock Linux Agent — Hardware Identity Collector
// Reads stable hardware identifiers from sysfs, DMI, and network subsystems.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HardwareIdentity {
    pub system_uuid: String,
    pub manufacturer: String,
    pub model: String,
    pub serial_number: String,
    pub motherboard_serial: String,
    pub mac_addresses: Vec<String>,
    pub storage_serials: Vec<String>,
    pub tpm_present: bool,
    pub tpm_version: String,
    pub secure_boot: bool,
    pub uefi_enabled: bool,
    pub disk_encryption_active: bool,
    pub os_version: String,
    pub agent_version: String,
    pub hardware_identity_hash: String,
}

pub fn collect_hardware_identity() -> HardwareIdentity {
    let system_uuid = read_sysfs_string("/sys/class/dmi/id/product_uuid")
        .unwrap_or_else(|| read_sysfs_string("/etc/machine-id").unwrap_or_else(|| "UNKNOWN_UUID".into()));

    let manufacturer = read_sysfs_string("/sys/class/dmi/id/sys_vendor")
        .unwrap_or_else(|| "Generic".into());

    let model = read_sysfs_string("/sys/class/dmi/id/product_name")
        .unwrap_or_else(|| "Linux Machine".into());

    let serial_number = read_sysfs_string("/sys/class/dmi/id/product_serial")
        .unwrap_or_else(|| "UNKNOWN_SERIAL".into());

    let motherboard_serial = read_sysfs_string("/sys/class/dmi/id/board_serial")
        .unwrap_or_else(|| "UNKNOWN_BOARD".into());

    let mac_addresses = collect_mac_addresses();
    let storage_serials = collect_storage_serials();

    let tpm_present = Path::new("/sys/class/tpm/tpm0").exists() || Path::new("/dev/tpm0").exists();
    let tpm_version = if tpm_present {
        if Path::new("/sys/class/tpm/tpm0/tpm_version_major").exists() {
            read_sysfs_string("/sys/class/tpm/tpm0/tpm_version_major").unwrap_or_else(|| "2.0".into())
        } else {
            "2.0".into()
        }
    } else {
        "NONE".into()
    };

    let uefi_enabled = Path::new("/sys/firmware/efi").exists();
    let secure_boot = check_secure_boot();
    let disk_encryption_active = check_disk_encryption();

    let os_version = read_os_release();
    let agent_version = "1.0.0".to_string();

    // Compute deterministic composite hash
    let mut hasher = Sha256::new();
    hasher.update(system_uuid.as_bytes());
    hasher.update(b"|");
    hasher.update(serial_number.as_bytes());
    hasher.update(b"|");
    hasher.update(motherboard_serial.as_bytes());
    hasher.update(b"|");
    if let Some(first_mac) = mac_addresses.first() {
        hasher.update(first_mac.as_bytes());
    }
    let hardware_identity_hash = hex::encode(hasher.finalize());

    HardwareIdentity {
        system_uuid,
        manufacturer,
        model,
        serial_number,
        motherboard_serial,
        mac_addresses,
        storage_serials,
        tpm_present,
        tpm_version,
        secure_boot,
        uefi_enabled,
        disk_encryption_active,
        os_version,
        agent_version,
        hardware_identity_hash,
    }
}

fn check_disk_encryption() -> bool {
    if let Ok(entries) = fs::read_dir("/dev/mapper") {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with("luks-") || name.contains("crypt") {
                return true;
            }
        }
    }
    false
}

fn read_sysfs_string(path: &str) -> Option<String> {
    fs::read_to_string(path)
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

fn collect_mac_addresses() -> Vec<String> {
    let mut macs = Vec::new();
    if let Ok(entries) = fs::read_dir("/sys/class/net") {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name == "lo" {
                continue;
            }
            let addr_path = entry.path().join("address");
            if let Ok(addr) = fs::read_to_string(addr_path) {
                let trimmed = addr.trim().to_string();
                if !trimmed.is_empty() && trimmed != "00:00:00:00:00:00" {
                    macs.push(trimmed);
                }
            }
        }
    }
    macs
}

fn collect_storage_serials() -> Vec<String> {
    let mut serials = Vec::new();
    if let Ok(entries) = fs::read_dir("/sys/block") {
        for entry in entries.flatten() {
            let dev_name = entry.file_name().to_string_lossy().to_string();
            if dev_name.starts_with("loop") || dev_name.starts_with("ram") {
                continue;
            }
            let serial_path = entry.path().join("device/serial");
            if let Ok(serial) = fs::read_to_string(serial_path) {
                let s = serial.trim().to_string();
                if !s.is_empty() {
                    serials.push(s);
                }
            }
        }
    }
    serials
}

fn check_secure_boot() -> bool {
    let efi_var = Path::new("/sys/firmware/efi/efivars/SecureBoot-8be4df61-93ca-11d2-aa0d-00e098032b8c");
    if efi_var.exists() {
        if let Ok(bytes) = fs::read(efi_var) {
            // Last byte in EFIVAR is value (1 = enabled)
            return bytes.last().copied() == Some(1);
        }
    }
    false
}

fn read_os_release() -> String {
    if let Ok(content) = fs::read_to_string("/etc/os-release") {
        for line in content.lines() {
            if let Some(val) = line.strip_prefix("PRETTY_NAME=") {
                return val.trim_matches('"').to_string();
            }
        }
    }
    "Linux".to_string()
}
