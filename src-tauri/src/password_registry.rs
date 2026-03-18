// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::crypto;
use crate::keychain;
use crate::models::Project;
use crate::storage::StorageProvider;

pub const PASSWORD_REGISTRY_UUID: &str = "00000000-0000-0000-0000-000000000001";
pub const PASSWORD_REGISTRY_NAME: &str = "__PASSWORD_REGISTRY__";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegistryMeta {
    #[serde(rename = "type")]
    pub entry_type: String,
    pub auto_generated: bool,
    pub version: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegistryEntry {
    pub server_id: Option<String>,
    pub local_id: String,
    pub name: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegistryContent {
    pub _meta: RegistryMeta,
    pub entries: Vec<RegistryEntry>,
}

impl RegistryContent {
    pub fn new(entries: Vec<RegistryEntry>) -> Self {
        Self {
            _meta: RegistryMeta {
                entry_type: "password_registry".to_string(),
                auto_generated: true,
                version: 1,
            },
            entries,
        }
    }
}

pub fn kc_key(project_id: &str) -> String {
    format!("project-password-{}", project_id)
}

pub fn is_registry(project_id: &str) -> bool {
    project_id == PASSWORD_REGISTRY_UUID
}

/// Decrypt a registry project's content and parse JSON into RegistryContent.
pub fn parse_registry(
    project: &Project,
    key: &[u8; crypto::KEY_LEN],
) -> Result<RegistryContent, String> {
    let content_bytes = crypto::try_decrypt_with_key(&project.encrypted_content, key)
        .ok_or_else(|| "Cannot decrypt registry content with master key".to_string())?;
    let json_str = String::from_utf8(content_bytes).map_err(|e| e.to_string())?;
    serde_json::from_str::<RegistryContent>(&json_str)
        .map_err(|e| format!("Failed to parse registry JSON: {e}"))
}

/// Check if a project is the password registry by decrypting its name.
pub fn is_registry_by_name(project: &Project, key: &[u8; crypto::KEY_LEN]) -> bool {
    if let Some(name_bytes) = crypto::try_decrypt_with_key(&project.encrypted_name, key) {
        if let Ok(name) = String::from_utf8(name_bytes) {
            return name == PASSWORD_REGISTRY_NAME;
        }
    }
    false
}

/// Rebuild the password registry from all local projects that have custom passwords in keychain.
/// The registry project is encrypted with the master key (V2).
pub fn rebuild_registry(
    storage: &dyn StorageProvider,
    key: &[u8; crypto::KEY_LEN],
) -> Result<(), String> {
    let projects = storage.list_projects().map_err(|e| e.to_string())?;
    let mut entries = Vec::new();

    for p in &projects {
        if is_registry(&p.id) {
            continue;
        }
        if let Some(pw) = keychain::get(&kc_key(&p.id)) {
            let name = match crypto::try_decrypt_with_key(&p.encrypted_name, key) {
                Some(bytes) => String::from_utf8(bytes).unwrap_or_default(),
                None => {
                    crypto::decrypt_auto(&p.encrypted_name, None, Some(&pw))
                        .ok()
                        .and_then(|b| String::from_utf8(b).ok())
                        .unwrap_or_else(|| "[unknown]".to_string())
                }
            };
            entries.push(RegistryEntry {
                server_id: p.server_id.clone(),
                local_id: p.id.clone(),
                name,
                password: pw,
            });
        }
    }

    let existing_registry = storage.get_project(PASSWORD_REGISTRY_UUID).ok();

    if entries.is_empty() {
        if existing_registry.is_some() {
            let _ = storage.delete_project(PASSWORD_REGISTRY_UUID);
        }
        return Ok(());
    }

    let registry = RegistryContent::new(entries);
    let json = serde_json::to_string(&registry).map_err(|e| e.to_string())?;

    let encrypted_name =
        crypto::encrypt_with_key(PASSWORD_REGISTRY_NAME.as_bytes(), key).map_err(|e| e.to_string())?;
    let encrypted_content =
        crypto::encrypt_with_key(json.as_bytes(), key).map_err(|e| e.to_string())?;

    let now = chrono::Utc::now().to_rfc3339();

    if let Some(existing) = existing_registry {
        let sync_status = if existing.sync_status == "synced" {
            "modified".to_string()
        } else {
            existing.sync_status.clone()
        };
        let updated = Project {
            id: PASSWORD_REGISTRY_UUID.to_string(),
            encrypted_name,
            encrypted_content,
            sort_order: existing.sort_order,
            created_at: existing.created_at,
            updated_at: now,
            server_id: existing.server_id,
            sync_status,
            last_synced_at: existing.last_synced_at,
        };
        storage.update_project(&updated).map_err(|e| e.to_string())?;
    } else {
        let max_order: i32 = projects.iter().map(|p| p.sort_order).max().unwrap_or(-1);
        let new_project = Project {
            id: PASSWORD_REGISTRY_UUID.to_string(),
            encrypted_name,
            encrypted_content,
            sort_order: max_order + 1,
            created_at: now.clone(),
            updated_at: now,
            server_id: None,
            sync_status: "local".to_string(),
            last_synced_at: None,
        };
        storage
            .create_project(&new_project)
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// Import passwords from the local registry project into keychain.
/// Returns the number of imported passwords.
pub fn import_registry(
    storage: &dyn StorageProvider,
    key: &[u8; crypto::KEY_LEN],
) -> Result<u32, String> {
    let registry_project = match storage.get_project(PASSWORD_REGISTRY_UUID) {
        Ok(p) => p,
        Err(_) => return Ok(0),
    };

    let registry = parse_registry(&registry_project, key)?;
    let projects = storage.list_projects().map_err(|e| e.to_string())?;

    let by_server_id: HashMap<String, &Project> = projects
        .iter()
        .filter_map(|p| p.server_id.as_ref().map(|sid| (sid.clone(), p)))
        .collect();

    let by_local_id: HashMap<&str, &Project> = projects
        .iter()
        .map(|p| (p.id.as_str(), p))
        .collect();

    let mut imported = 0u32;

    for entry in &registry.entries {
        let local_project = entry
            .server_id
            .as_ref()
            .and_then(|sid| by_server_id.get(sid).copied())
            .or_else(|| by_local_id.get(entry.local_id.as_str()).copied());

        if let Some(lp) = local_project {
            if is_registry(&lp.id) {
                continue;
            }
            let current_pw = keychain::get(&kc_key(&lp.id));
            if current_pw.as_deref() != Some(&entry.password) {
                let _ = keychain::save(&kc_key(&lp.id), &entry.password);
                imported += 1;
            }
        }
    }

    Ok(imported)
}

/// Merge two sets of registry entries. Remote entries take priority for same server_id.
pub fn merge_registries(
    local_entries: &[RegistryEntry],
    remote_entries: &[RegistryEntry],
) -> Vec<RegistryEntry> {
    let mut merged: HashMap<String, RegistryEntry> = HashMap::new();

    for entry in local_entries {
        let key = entry
            .server_id
            .clone()
            .unwrap_or_else(|| entry.local_id.clone());
        merged.insert(key, entry.clone());
    }

    for entry in remote_entries {
        let key = entry
            .server_id
            .clone()
            .unwrap_or_else(|| entry.local_id.clone());
        merged.insert(key, entry.clone());
    }

    merged.into_values().collect()
}

/// Collect all known passwords: from keychain + from registry entries.
/// Returns a deduplicated list of password strings.
pub fn collect_password_pool(
    storage: &dyn StorageProvider,
    key: &[u8; crypto::KEY_LEN],
    extra_registry_entries: Option<&[RegistryEntry]>,
) -> Vec<String> {
    let mut passwords = Vec::new();
    let mut seen = std::collections::HashSet::new();

    let projects = storage.list_projects().unwrap_or_default();
    for p in &projects {
        if is_registry(&p.id) {
            continue;
        }
        if let Some(pw) = keychain::get(&kc_key(&p.id)) {
            if seen.insert(pw.clone()) {
                passwords.push(pw);
            }
        }
    }

    if let Some(entries) = extra_registry_entries {
        for entry in entries {
            if seen.insert(entry.password.clone()) {
                passwords.push(entry.password.clone());
            }
        }
    }

    if let Ok(reg_project) = storage.get_project(PASSWORD_REGISTRY_UUID) {
        if let Ok(registry) = parse_registry(&reg_project, key) {
            for entry in &registry.entries {
                if seen.insert(entry.password.clone()) {
                    passwords.push(entry.password.clone());
                }
            }
        }
    }

    passwords
}

/// Re-encrypt a project's local blobs from an old password to a new password.
/// Does NOT change sync_status or updated_at.
pub fn pre_encrypt_with_new_password(
    project: &Project,
    storage: &dyn StorageProvider,
    old_passwords: &[String],
    new_password: &str,
) -> Result<(), String> {
    let mut name_bytes = None;
    let mut content_bytes = None;

    for pw in old_passwords {
        if name_bytes.is_none() {
            if let Ok(b) = crypto::decrypt_auto(&project.encrypted_name, None, Some(pw)) {
                name_bytes = Some(b);
            }
        }
        if content_bytes.is_none() {
            if let Ok(b) = crypto::decrypt_auto(&project.encrypted_content, None, Some(pw)) {
                content_bytes = Some(b);
            }
        }
        if name_bytes.is_some() && content_bytes.is_some() {
            break;
        }
    }

    let name_bytes = name_bytes.ok_or("Cannot decrypt project name with any known password")?;
    let content_bytes =
        content_bytes.ok_or("Cannot decrypt project content with any known password")?;

    let encrypted_name =
        crypto::encrypt(name_bytes.as_slice(), new_password).map_err(|e| e.to_string())?;
    let encrypted_content =
        crypto::encrypt(content_bytes.as_slice(), new_password).map_err(|e| e.to_string())?;

    let mut updated = project.clone();
    updated.encrypted_name = encrypted_name;
    updated.encrypted_content = encrypted_content;
    storage.update_project(&updated).map_err(|e| e.to_string())?;

    let _ = keychain::save(&kc_key(&project.id), new_password);

    Ok(())
}
