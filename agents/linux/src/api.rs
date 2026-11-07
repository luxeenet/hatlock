// HatLock Linux Agent — API Client
// HTTP communication with HatLock SaaS Backend

use crate::identity::HardwareIdentity;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, USER_AGENT};
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Clone)]
pub struct ApiClient {
    client: reqwest::Client,
    base_url: String,
    device_token: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnrollmentRequest {
    pub enrollment_token: String,
    pub hardware: HardwarePayload,
    pub os: String,
    pub os_version: String,
    pub agent_version: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HardwarePayload {
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
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnrollmentResponse {
    pub device_id: String,
    pub device_token: String,
    pub is_re_enrollment: bool,
    pub os_changed: bool,
    pub authorization_status: AuthStatus,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthStatus {
    pub authorized: bool,
    pub reason: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HeartbeatRequest {
    pub device_id: String,
    pub agent_version: String,
    pub os: String,
    pub uptime_seconds: u64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HeartbeatResponse {
    pub status: String,
    pub server_time: String,
    pub has_pending_commands: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingCommandsResponse {
    pub device_id: String,
    pub count: usize,
    pub commands: Vec<DeviceCommandDto>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceCommandDto {
    pub id: String,
    pub command_type: String,
    pub payload: serde_json::Value,
    pub signature: String,
    pub nonce: String,
    pub expires_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AcknowledgeRequest {
    pub command_id: String,
    pub device_id: String,
    pub success: bool,
    pub fail_reason: Option<String>,
}

impl ApiClient {
    pub fn new(base_url: String) -> Self {
        let mut headers = HeaderMap::new();
        headers.insert(
            USER_AGENT,
            HeaderValue::from_static("HatLock-Linux-Agent/1.0.0"),
        );

        let client = reqwest::Client::builder()
            .default_headers(headers)
            .timeout(Duration::from_secs(30))
            .build()
            .unwrap_or_default();

        Self {
            client,
            base_url,
            device_token: None,
        }
    }

    pub fn set_token(&mut self, token: String) {
        self.device_token = Some(token);
    }

    pub async fn enroll(
        &self,
        enrollment_token: &str,
        hw: &HardwareIdentity,
    ) -> anyhow::Result<EnrollmentResponse> {
        let url = format!("{}/api/v1/agent/enroll", self.base_url);
        let req = EnrollmentRequest {
            enrollment_token: enrollment_token.to_string(),
            hardware: HardwarePayload {
                system_uuid: hw.system_uuid.clone(),
                manufacturer: hw.manufacturer.clone(),
                model: hw.model.clone(),
                serial_number: hw.serial_number.clone(),
                motherboard_serial: hw.motherboard_serial.clone(),
                mac_addresses: hw.mac_addresses.clone(),
                storage_serials: hw.storage_serials.clone(),
                tpm_present: hw.tpm_present,
                tpm_version: hw.tpm_version.clone(),
                secure_boot: hw.secure_boot,
                uefi_enabled: hw.uefi_enabled,
            },
            os: "LINUX".to_string(),
            os_version: hw.os_version.clone(),
            agent_version: hw.agent_version.clone(),
        };

        let resp = self.client.post(&url).json(&req).send().await?;
        let result = resp.error_for_status()?.json::<EnrollmentResponse>().await?;
        Ok(result)
    }

    pub async fn heartbeat(&self, device_id: &str) -> anyhow::Result<HeartbeatResponse> {
        let url = format!("{}/api/v1/agent/heartbeat", self.base_url);
        let mut req = self.client.post(&url);

        if let Some(token) = &self.device_token {
            req = req.header(AUTHORIZATION, format!("Bearer {}", token));
        }

        let body = HeartbeatRequest {
            device_id: device_id.to_string(),
            agent_version: "1.0.0".to_string(),
            os: "LINUX".to_string(),
            uptime_seconds: get_uptime_seconds(),
        };

        let resp = req.json(&body).send().await?;
        let result = resp.error_for_status()?.json::<HeartbeatResponse>().await?;
        Ok(result)
    }

    pub async fn get_pending_commands(&self, device_id: &str) -> anyhow::Result<Vec<DeviceCommandDto>> {
        let url = format!("{}/api/v1/agent/commands/pending/{}", self.base_url, device_id);
        let mut req = self.client.get(&url);

        if let Some(token) = &self.device_token {
            req = req.header(AUTHORIZATION, format!("Bearer {}", token));
        }

        let resp = req.send().await?;
        let result = resp.error_for_status()?.json::<PendingCommandsResponse>().await?;
        Ok(result.commands)
    }

    pub async fn acknowledge_command(
        &self,
        command_id: &str,
        device_id: &str,
        success: bool,
        fail_reason: Option<String>,
    ) -> anyhow::Result<()> {
        let url = format!("{}/api/v1/agent/commands/acknowledge", self.base_url);
        let mut req = self.client.post(&url);

        if let Some(token) = &self.device_token {
            req = req.header(AUTHORIZATION, format!("Bearer {}", token));
        }

        let body = AcknowledgeRequest {
            command_id: command_id.to_string(),
            device_id: device_id.to_string(),
            success,
            fail_reason,
        };

        req.json(&body).send().await?.error_for_status()?;
        Ok(())
    }
}

fn get_uptime_seconds() -> u64 {
    if let Ok(content) = std::fs::read_to_string("/proc/uptime") {
        if let Some(first) = content.split_whitespace().next() {
            if let Ok(secs) = first.parse::<f64>() {
                return secs as u64;
            }
        }
    }
    0
}
