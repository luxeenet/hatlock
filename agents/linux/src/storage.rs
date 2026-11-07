// HatLock Linux Agent — Credential Store
// Manages device token and enrollment state persistence with strict file permissions (0600)

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredCredentials {
    pub device_id: String,
    pub device_token: String,
    pub business_id: String,
    pub enrolled_at: String,
}

pub struct CredentialStore {
    path: PathBuf,
}

impl CredentialStore {
    pub fn new() -> Self {
        let dir = Path::new("/var/lib/hatlock");
        if !dir.exists() {
            let _ = fs::create_dir_all(dir);
        }
        Self {
            path: dir.join("credentials.json"),
        }
    }

    pub fn with_path(path: PathBuf) -> Self {
        Self { path }
    }

    pub fn load(&self) -> Option<StoredCredentials> {
        if !self.path.exists() {
            return None;
        }
        let content = fs::read_to_string(&self.path).ok()?;
        serde_json::from_str(&content).ok()
    }

    pub fn save(&self, creds: &StoredCredentials) -> Result<(), std::io::Error> {
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent)?;
        }
        let json = serde_json::to_string_pretty(creds)?;
        fs::write(&self.path, json)?;

        // Ensure restricted permissions on Unix
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let perms = fs::Permissions::from_mode(0o600);
            let _ = fs::set_permissions(&self.path, perms);
        }

        Ok(())
    }

    pub fn clear(&self) -> Result<(), std::io::Error> {
        if self.path.exists() {
            fs::remove_file(&self.path)?;
        }
        Ok(())
    }
}
