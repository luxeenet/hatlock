// HatLock Linux Agent — Main Service Entry Point
// Runs as a systemd daemon on Linux distributions (Ubuntu, Debian, Fedora, RHEL)

mod api;
mod commands;
mod identity;
mod restriction;
mod storage;

use api::ApiClient;
use commands::CommandProcessor;
use identity::collect_hardware_identity;
use restriction::RestrictionEngine;
use storage::{CredentialStore, StoredCredentials};
use std::env;
use std::time::Duration;
use tokio::time::sleep;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    log::info!("Starting HatLock Linux Protection Agent v1.0.0 (Luxeenet)...");

    let api_url = env::var("HATLOCK_API_URL").unwrap_or_else(|_| "http://localhost:3000".to_string());
    let enrollment_token = env::var("HATLOCK_ENROLLMENT_TOKEN").unwrap_or_default();
    let heartbeat_secs: u64 = env::var("HATLOCK_HEARTBEAT_SECONDS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(30);

    let cred_store = CredentialStore::new();
    let mut api_client = ApiClient::new(api_url.clone());
    let mut command_processor = CommandProcessor::new();
    let restriction_engine = RestrictionEngine::new();

    // 1. Check or perform enrollment
    let mut current_creds = cred_store.load();

    if current_creds.is_none() {
        if enrollment_token.is_empty() {
            log::warn!("Device is not enrolled and HATLOCK_ENROLLMENT_TOKEN is not set.");
            log::warn!("Provide token via environment or run hatlock-agent --enroll <TOKEN>");
        } else {
            log::info!("Attempting device enrollment with token...");
            let hw = collect_hardware_identity();
            match api_client.enroll(&enrollment_token, &hw).await {
                Ok(resp) => {
                    log::info!(
                        "Enrollment successful! Device ID: {}, Re-enroll: {}, OS Changed: {}",
                        resp.device_id, resp.is_re_enrollment, resp.os_changed
                    );
                    let creds = StoredCredentials {
                        device_id: resp.device_id.clone(),
                        device_token: resp.device_token.clone(),
                        business_id: "".to_string(),
                        enrolled_at: chrono::Utc::now().to_rfc3339(),
                    };
                    if let Err(e) = cred_store.save(&creds) {
                        log::error!("Failed to persist credentials: {}", e);
                    }
                    if !resp.authorization_status.authorized {
                        log::warn!("Device unauthorized upon enrollment: {}", resp.authorization_status.reason);
                        let _ = restriction_engine.apply_restriction(&restriction::RestrictionInfo {
                            business_name: None,
                            agreement_number: None,
                            agreement_type: None,
                            device_details: None,
                            reason: resp.authorization_status.reason,
                            outstanding_amount_tzs: None,
                            currency: Some("TZS".into()),
                            payment_instructions: Some("Pay via HatPesa mobile checkout".into()),
                            support_contact: Some("support@luxeenet.com".into()),
                            recovery_instructions: None,
                        });
                    }
                    current_creds = Some(creds);
                }
                Err(e) => {
                    log::error!("Enrollment failed: {}", e);
                }
            }
        }
    }

    if let Some(creds) = &current_creds {
        api_client.set_token(creds.device_token.clone());
        log::info!("Agent active for Device ID: {}", creds.device_id);
    }

    // 2. Main agent loop
    loop {
        if let Some(creds) = &current_creds {
            match api_client.heartbeat(&creds.device_id).await {
                Ok(hb) => {
                    if hb.has_pending_commands {
                        log::info!("Heartbeat flagged pending commands. Fetching...");
                        if let Ok(commands) = api_client.get_pending_commands(&creds.device_id).await {
                            for cmd in commands {
                                let (success, reason) = match command_processor.process_command(&cmd, &creds.device_id) {
                                    Ok(_) => (true, None),
                                    Err(e) => (false, Some(e.to_string())),
                                };
                                let _ = api_client.acknowledge_command(&cmd.id, &creds.device_id, success, reason).await;
                            }
                        }
                    }
                }
                Err(e) => {
                    log::warn!("Heartbeat failed: {}", e);
                }
            }
        } else {
            // Retry enrollment check if token is added
            if let Ok(token) = env::var("HATLOCK_ENROLLMENT_TOKEN") {
                if !token.is_empty() {
                    let hw = collect_hardware_identity();
                    if let Ok(resp) = api_client.enroll(&token, &hw).await {
                        let creds = StoredCredentials {
                            device_id: resp.device_id.clone(),
                            device_token: resp.device_token.clone(),
                            business_id: "".to_string(),
                            enrolled_at: chrono::Utc::now().to_rfc3339(),
                        };
                        let _ = cred_store.save(&creds);
                        api_client.set_token(creds.device_token.clone());
                        current_creds = Some(creds);
                    }
                }
            }
        }

        sleep(Duration::from_secs(heartbeat_secs)).await;
    }
}
