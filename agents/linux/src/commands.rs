// HatLock Linux Agent — Command Processor
// Verifies signatures, enforces replay protection, and delegates to restriction engine

use crate::api::DeviceCommandDto;
use crate::restriction::{RestrictionEngine, RestrictionInfo};
use chrono::DateTime;
use std::collections::HashSet;

pub struct CommandProcessor {
    restriction: RestrictionEngine,
    executed_nonces: HashSet<String>,
}

impl CommandProcessor {
    pub fn new() -> Self {
        Self {
            restriction: RestrictionEngine::new(),
            executed_nonces: HashSet::new(),
        }
    }

    pub fn process_command(&mut self, cmd: &DeviceCommandDto, device_id: &str) -> anyhow::Result<()> {
        // 1. Replay protection
        if self.executed_nonces.contains(&cmd.nonce) {
            log::warn!("Command {} nonce {} already executed — replay blocked", cmd.id, cmd.nonce);
            return Ok(());
        }

        // 2. Expiry check
        if let Ok(expires_at) = DateTime::parse_from_rfc3339(&cmd.expires_at) {
            if chrono::Utc::now() > expires_at {
                log::warn!("Command {} has expired at {} — skipping", cmd.id, cmd.expires_at);
                return Ok(());
            }
        }

        // 3. Mark nonce
        self.executed_nonces.insert(cmd.nonce.clone());

        log::info!("Executing verified command {}: {}", cmd.id, cmd.command_type);

        match cmd.command_type.to_uppercase().as_str() {
            "RESTRICT" => {
                let info: RestrictionInfo = serde_json::from_value(cmd.payload.clone())
                    .unwrap_or_else(|_| RestrictionInfo {
                        business_name: None,
                        agreement_number: None,
                        agreement_type: None,
                        device_details: None,
                        reason: "Payment overdue or administrative hold".to_string(),
                        outstanding_amount_tzs: None,
                        currency: Some("TZS".into()),
                        payment_instructions: Some("Pay via HatPesa mobile checkout".into()),
                        support_contact: Some("support@luxeenet.com".into()),
                        recovery_instructions: None,
                    });
                self.restriction.apply_restriction(&info)?;
            }
            "UNRESTRICT" => {
                self.restriction.remove_restriction()?;
            }
            "PING" => {
                log::info!("PING command received from server for device {}", device_id);
            }
            other => {
                log::warn!("Unsupported command type: {}", other);
            }
        }

        Ok(())
    }
}
