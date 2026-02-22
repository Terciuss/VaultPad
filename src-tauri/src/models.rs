// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub encrypted_name: Vec<u8>,
    pub encrypted_content: Vec<u8>,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
    pub server_id: Option<String>,
    pub sync_status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecryptedProject {
    pub id: String,
    pub name: String,
    pub content: String,
    pub has_custom_password: bool,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub db_path: Option<String>,
    pub auto_lock_minutes: u32,
    pub theme: String,
    pub onboarding_shown: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            db_path: None,
            auto_lock_minutes: 5,
            theme: "system".to_string(),
            onboarding_shown: false,
        }
    }
}
