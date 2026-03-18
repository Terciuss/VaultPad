// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use crate::backup;
use crate::crypto;
use crate::keychain;
use crate::models::{DecryptedProject, Project, ProjectBackup};
use crate::password_registry;
use crate::AppState;

const BACKUP_KEEP_COUNT: usize = 15;

#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectListItem {
    pub id: String,
    pub name: String,
    pub has_custom_password: bool,
    pub password_saved: bool,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
    pub server_id: Option<String>,
    pub is_password_registry: bool,
}

fn get_cached_key(state: &AppState) -> Result<[u8; crypto::KEY_LEN], String> {
    state
        .cached_key
        .lock()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "No cached key. Please unlock first.".to_string())
}

fn get_master_password(state: &AppState) -> Option<String> {
    state.master_password.lock().ok()?.clone()
}

fn kc_key(project_id: &str) -> String {
    format!("project-password-{}", project_id)
}

#[tauri::command]
pub fn list_projects(state: State<AppState>) -> Result<Vec<ProjectListItem>, String> {
    let key = get_cached_key(&state)?;
    let storage = state.storage.lock().map_err(|e| e.to_string())?;
    let storage = storage.as_ref().ok_or("Database not initialized")?;

    let projects = storage.list_projects().map_err(|e| e.to_string())?;
    let mut items = Vec::new();

    for p in projects {
        if p.sync_status == "deleted" {
            continue;
        }

        let srv_id = p.server_id.clone();
        let is_registry_by_id = password_registry::is_registry(&p.id);
        let is_registry = is_registry_by_id || p.name == password_registry::PASSWORD_REGISTRY_NAME;

        let has_custom = if !p.key_check.is_empty() {
            crypto::try_decrypt_with_key(&p.key_check, &key).is_none()
        } else {
            false
        };

        let password_saved = if has_custom {
            keychain::get(&kc_key(&p.id)).is_some()
        } else {
            false
        };

        let display_name = if p.name.is_empty() {
            if has_custom && !password_saved {
                "locked_custom_password".to_string()
            } else {
                p.id.clone()
            }
        } else {
            p.name
        };

        items.push(ProjectListItem {
            id: p.id,
            name: display_name,
            has_custom_password: has_custom,
            password_saved,
            sort_order: p.sort_order,
            created_at: p.created_at,
            updated_at: p.updated_at,
            server_id: srv_id,
            is_password_registry: is_registry,
        });
    }

    Ok(items)
}

#[tauri::command]
pub fn get_project(
    state: State<AppState>,
    id: String,
    password: String,
) -> Result<DecryptedProject, String> {
    let cached = state.cached_key.lock().map_err(|e| e.to_string())?;
    let mp = get_master_password(&state);
    let storage = state.storage.lock().map_err(|e| e.to_string())?;
    let storage = storage.as_ref().ok_or("Database not initialized")?;

    let project = storage.get_project(&id).map_err(|e| e.to_string())?;

    let has_custom = if !project.key_check.is_empty() {
        cached.as_ref().map_or(true, |key| {
            crypto::try_decrypt_with_key(&project.key_check, key).is_none()
        })
    } else {
        false
    };

    if !has_custom {
        if let Some(key) = cached.as_ref() {
            let content_bytes =
                crypto::decrypt_auto(&project.encrypted_content, Some(key), mp.as_deref())
                    .map_err(|e| e.to_string())?;
            return Ok(DecryptedProject {
                id: project.id,
                name: project.name,
                content: String::from_utf8(content_bytes).map_err(|e| e.to_string())?,
                has_custom_password: false,
                sort_order: project.sort_order,
                created_at: project.created_at,
                updated_at: project.updated_at,
            });
        }
    }

    let explicitly_provided = !password.is_empty();
    let pw = if password.is_empty() {
        keychain::get(&kc_key(&id)).ok_or("No saved password for this project")?
    } else {
        password
    };

    let content_bytes = crypto::decrypt_auto(&project.encrypted_content, None, Some(&pw))
        .map_err(|e| e.to_string())?;

    if explicitly_provided {
        let _ = keychain::save(&kc_key(&id), &pw);
    }

    Ok(DecryptedProject {
        id: project.id,
        name: project.name,
        content: String::from_utf8(content_bytes).map_err(|e| e.to_string())?,
        has_custom_password: true,
        sort_order: project.sort_order,
        created_at: project.created_at,
        updated_at: project.updated_at,
    })
}

#[tauri::command]
pub fn create_project(
    state: State<AppState>,
    name: String,
    content: String,
    password: String,
    has_custom_password: bool,
) -> Result<String, String> {
    let key = get_cached_key(&state)?;
    let storage = state.storage.lock().map_err(|e| e.to_string())?;
    let storage = storage.as_ref().ok_or("Database not initialized")?;

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let (encrypted_content, key_check) = if has_custom_password {
        let _ = keychain::save(&kc_key(&id), &password);
        (
            crypto::encrypt(content.as_bytes(), &password).map_err(|e| e.to_string())?,
            crypto::encrypt(b"cp", &password).map_err(|e| e.to_string())?,
        )
    } else {
        keychain::remove(&kc_key(&id));
        (
            crypto::encrypt_with_key(content.as_bytes(), &key).map_err(|e| e.to_string())?,
            crypto::encrypt_with_key(b"mk", &key).map_err(|e| e.to_string())?,
        )
    };

    let max_order: i32 = storage
        .list_projects()
        .map_err(|e| e.to_string())?
        .iter()
        .map(|p| p.sort_order)
        .max()
        .unwrap_or(-1);

    let project = Project {
        id: id.clone(),
        name,
        encrypted_content,
        key_check,
        sort_order: max_order + 1,
        created_at: now.clone(),
        updated_at: now,
        server_id: None,
        sync_status: "local".to_string(),
        last_synced_at: None,
    };

    storage
        .create_project(&project)
        .map_err(|e| e.to_string())?;

    if has_custom_password {
        let _ = password_registry::rebuild_registry(&**storage, &key);
    }

    Ok(id)
}

#[tauri::command]
pub fn update_project(
    state: State<AppState>,
    id: String,
    name: String,
    content: String,
    password: String,
    has_custom_password: bool,
) -> Result<(), String> {
    let key = get_cached_key(&state)?;
    let mp = get_master_password(&state);
    let storage = state.storage.lock().map_err(|e| e.to_string())?;
    let storage = storage.as_ref().ok_or("Database not initialized")?;

    let existing = storage.get_project(&id).map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();
    let had_custom_password = keychain::get(&kc_key(&id)).is_some();

    let old_content = crypto::decrypt_auto(
        &existing.encrypted_content,
        Some(&key),
        mp.as_deref(),
    )
    .ok()
    .and_then(|bytes| String::from_utf8(bytes).ok());

    if let Some(ref old_text) = old_content {
        if backup::is_significant_change(old_text, &content) {
            let backup_entry = ProjectBackup {
                id: Uuid::new_v4().to_string(),
                project_id: id.clone(),
                name: existing.name.clone(),
                encrypted_content: existing.encrypted_content.clone(),
                key_check: existing.key_check.clone(),
                created_at: now.clone(),
                trigger_type: "auto".to_string(),
                content_length: old_text.len() as i64,
            };
            let _ = storage.create_backup(&backup_entry);
            let _ = storage.cleanup_backups(&id, BACKUP_KEEP_COUNT);
        }
    }

    let (encrypted_content, key_check) = if has_custom_password {
        let pw = if password.is_empty() {
            keychain::get(&kc_key(&id)).ok_or("No password available for this project")?
        } else {
            let _ = keychain::save(&kc_key(&id), &password);
            password
        };
        (
            crypto::encrypt(content.as_bytes(), &pw).map_err(|e| e.to_string())?,
            crypto::encrypt(b"cp", &pw).map_err(|e| e.to_string())?,
        )
    } else {
        keychain::remove(&kc_key(&id));
        (
            crypto::encrypt_with_key(content.as_bytes(), &key).map_err(|e| e.to_string())?,
            crypto::encrypt_with_key(b"mk", &key).map_err(|e| e.to_string())?,
        )
    };

    let sync_status = if existing.sync_status == "synced" {
        "modified".to_string()
    } else {
        existing.sync_status
    };

    let project = Project {
        id,
        name,
        encrypted_content,
        key_check,
        sort_order: existing.sort_order,
        created_at: existing.created_at,
        updated_at: now,
        server_id: existing.server_id,
        sync_status,
        last_synced_at: existing.last_synced_at,
    };

    storage
        .update_project(&project)
        .map_err(|e| e.to_string())?;

    if has_custom_password || had_custom_password {
        let _ = password_registry::rebuild_registry(&**storage, &key);
    }

    Ok(())
}

#[tauri::command]
pub fn delete_project(state: State<AppState>, id: String) -> Result<(), String> {
    let key = get_cached_key(&state)?;
    let storage = state.storage.lock().map_err(|e| e.to_string())?;
    let storage = storage.as_ref().ok_or("Database not initialized")?;
    let had_custom_password = keychain::get(&kc_key(&id)).is_some();
    keychain::remove(&kc_key(&id));

    let existing = storage.get_project(&id).map_err(|e| e.to_string())?;
    if existing.server_id.is_some() {
        let mut tombstone = existing;
        tombstone.sync_status = "deleted".to_string();
        storage.update_project(&tombstone).map_err(|e| e.to_string())?;
    } else {
        storage.delete_project(&id).map_err(|e| e.to_string())?;
    }

    if had_custom_password {
        let _ = password_registry::rebuild_registry(&**storage, &key);
    }

    Ok(())
}

#[tauri::command]
pub fn reorder_projects(state: State<AppState>, ids: Vec<String>) -> Result<(), String> {
    let storage = state.storage.lock().map_err(|e| e.to_string())?;
    let storage = storage.as_ref().ok_or("Database not initialized")?;

    let pairs: Vec<(String, i32)> = ids
        .into_iter()
        .enumerate()
        .map(|(i, id)| (id, i as i32))
        .collect();

    storage
        .reorder_projects(&pairs)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_project_password(id: String) -> Result<Option<String>, String> {
    Ok(keychain::get(&kc_key(&id)))
}

#[tauri::command]
pub fn import_password_registry(state: State<AppState>) -> Result<u32, String> {
    let key = get_cached_key(&state)?;
    let storage = state.storage.lock().map_err(|e| e.to_string())?;
    let storage = storage.as_ref().ok_or("Database not initialized")?;
    password_registry::import_registry(&**storage, &key)
}

#[tauri::command]
pub fn get_password_registry(state: State<AppState>) -> Result<Vec<password_registry::RegistryEntry>, String> {
    let key = get_cached_key(&state)?;
    let storage = state.storage.lock().map_err(|e| e.to_string())?;
    let storage = storage.as_ref().ok_or("Database not initialized")?;
    let reg_project = storage
        .get_project(password_registry::PASSWORD_REGISTRY_UUID)
        .map_err(|e| e.to_string())?;
    let registry = password_registry::parse_registry(&reg_project, &key)?;
    Ok(registry.entries)
}
