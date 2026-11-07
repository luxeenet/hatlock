// HatLock Linux Agent — Restriction Engine
// Implements visible, reversible device restriction for Linux.
// Displays broadcast alerts, fullscreen messages, and manages lock state.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestrictionInfo {
    pub business_name: Option<String>,
    pub agreement_number: Option<String>,
    pub agreement_type: Option<String>,
    pub device_details: Option<String>,
    pub reason: String,
    pub outstanding_amount_tzs: Option<f64>,
    pub currency: Option<String>,
    pub payment_instructions: Option<String>,
    pub support_contact: Option<String>,
    pub recovery_instructions: Option<String>,
}

pub struct RestrictionEngine {
    lock_file: &'static str,
}

impl RestrictionEngine {
    pub fn new() -> Self {
        Self {
            lock_file: "/var/run/hatlock.lock",
        }
    }

    pub fn is_restricted(&self) -> bool {
        Path::new(self.lock_file).exists()
    }

    pub fn apply_restriction(&self, info: &RestrictionInfo) -> Result<(), std::io::Error> {
        log::warn!("Applying visible restriction on Linux: {}", info.reason);

        // 1. Write active lock file with restriction details
        let json = serde_json::to_string_pretty(info).unwrap_or_default();
        fs::write(self.lock_file, json)?;

        // 2. Broadcast message to all active terminals via wall
        let broadcast_msg = format!(
            "\n=======================================================\n\
             HATLOCK DEVICE NOTICE - ACCESS RESTRICTED\n\
             =======================================================\n\
             Agreement: {}\n\
             Reason: {}\n\
             Amount Due: {} {}\n\
             Instructions: {}\n\
             Support: {}\n\
             =======================================================\n",
            info.agreement_number.as_deref().unwrap_or("N/A"),
            info.reason,
            info.outstanding_amount_tzs.unwrap_or(0.0),
            info.currency.as_deref().unwrap_or("TZS"),
            info.payment_instructions.as_deref().unwrap_or("Please complete payment via HatPesa"),
            info.support_contact.as_deref().unwrap_or("support@luxeenet.com")
        );

        let _ = Command::new("wall")
            .arg(&broadcast_msg)
            .status();

        // 3. Trigger screen lock via loginctl or xdg-screensaver if available
        let _ = Command::new("loginctl")
            .arg("lock-sessions")
            .status();

        Ok(())
    }

    pub fn remove_restriction(&self) -> Result<(), std::io::Error> {
        log::info!("Removing restriction on Linux. Device restored to normal state.");

        if Path::new(self.lock_file).exists() {
            fs::remove_file(self.lock_file)?;
        }

        let broadcast_msg = "\n=======================================================\n\
                             HATLOCK NOTICE: DEVICE RESTRICTION LIFTED\n\
                             Payment verified or restored by provider. Thank you!\n\
                             =======================================================\n";

        let _ = Command::new("wall")
            .arg(broadcast_msg)
            .status();

        let _ = Command::new("loginctl")
            .arg("unlock-sessions")
            .status();

        Ok(())
    }
}
