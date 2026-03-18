// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::crypto;
use crate::keychain;
use crate::AppState;

#[derive(Debug, Serialize, Deserialize)]
pub struct BackupListItem {
    pub id: String,
    pub project_id: String,
    pub created_at: String,
    pub trigger_type: String,
    pub content_length: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BackupContent {
    pub name: String,
    pub content: String,
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
pub fn list_project_backups(
    state: State<AppState>,
    project_id: String,
) -> Result<Vec<BackupListItem>, String> {
    let storage = state.storage.lock().map_err(|e| e.to_string())?;
    let storage = storage.as_ref().ok_or("Database not initialized")?;

    let backups = storage.list_backups(&project_id).map_err(|e| e.to_string())?;

    Ok(backups
        .into_iter()
        .map(|b| BackupListItem {
            id: b.id,
            project_id: b.project_id,
            created_at: b.created_at,
            trigger_type: b.trigger_type,
            content_length: b.content_length,
        })
        .collect())
}

#[tauri::command]
pub fn get_backup_content(
    state: State<AppState>,
    backup_id: String,
    password: String,
) -> Result<BackupContent, String> {
    let key = get_cached_key(&state)?;
    let mp = get_master_password(&state);
    let storage = state.storage.lock().map_err(|e| e.to_string())?;
    let storage = storage.as_ref().ok_or("Database not initialized")?;

    let backup = storage.get_backup(&backup_id).map_err(|e| e.to_string())?;

    if let Some(name_bytes) = crypto::try_decrypt_with_key(&backup.encrypted_name, &key) {
        let content_bytes = crypto::decrypt_auto(
            &backup.encrypted_content,
            Some(&key),
            mp.as_deref(),
        )
        .map_err(|e| e.to_string())?;

        return Ok(BackupContent {
            name: String::from_utf8(name_bytes).map_err(|e| e.to_string())?,
            content: String::from_utf8(content_bytes).map_err(|e| e.to_string())?,
        });
    }

    let pw = if password.is_empty() {
        keychain::get(&kc_key(&backup.project_id))
            .ok_or("No password available for decryption")?
    } else {
        password
    };

    let name_bytes = crypto::decrypt_auto(&backup.encrypted_name, None, Some(&pw))
        .map_err(|e| e.to_string())?;
    let content_bytes = crypto::decrypt_auto(&backup.encrypted_content, None, Some(&pw))
        .map_err(|e| e.to_string())?;

    Ok(BackupContent {
        name: String::from_utf8(name_bytes).map_err(|e| e.to_string())?,
        content: String::from_utf8(content_bytes).map_err(|e| e.to_string())?,
    })
}

#[tauri::command]
pub fn restore_backup(
    state: State<AppState>,
    backup_id: String,
    password: String,
) -> Result<(), String> {
    let storage = state.storage.lock().map_err(|e| e.to_string())?;
    let storage = storage.as_ref().ok_or("Database not initialized")?;

    let backup = storage.get_backup(&backup_id).map_err(|e| e.to_string())?;
    let mut project = storage.get_project(&backup.project_id).map_err(|e| e.to_string())?;

    let _ = password;

    project.encrypted_name = backup.encrypted_name;
    project.encrypted_content = backup.encrypted_content;
    project.updated_at = chrono::Utc::now().to_rfc3339();

    if project.sync_status == "synced" {
        project.sync_status = "modified".to_string();
    }

    storage
        .update_project(&project)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_backup_cmd(
    state: State<AppState>,
    backup_id: String,
) -> Result<(), String> {
    let storage = state.storage.lock().map_err(|e| e.to_string())?;
    let storage = storage.as_ref().ok_or("Database not initialized")?;

    storage.delete_backup(&backup_id).map_err(|e| e.to_string())?;
    Ok(())
}
