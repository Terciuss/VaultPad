// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use crate::crypto;
use crate::keychain;
use crate::models::{DecryptedProject, Project};
use crate::AppState;

#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectListItem {
    pub id: String,
    pub name: String,
    pub has_custom_password: bool,
    pub password_saved: bool,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
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
        match crypto::try_decrypt_with_key(&p.encrypted_name, &key) {
            Some(name_bytes) => {
                let name = String::from_utf8(name_bytes).map_err(|e| e.to_string())?;
                items.push(ProjectListItem {
                    id: p.id,
                    name,
                    has_custom_password: false,
                    password_saved: false,
                    sort_order: p.sort_order,
                    created_at: p.created_at,
                    updated_at: p.updated_at,
                });
            }
            None => {
                let saved_pw = keychain::get(&kc_key(&p.id));
                if let Some(pw) = &saved_pw {
                    match crypto::decrypt_auto(&p.encrypted_name, None, Some(pw)) {
                        Ok(name_bytes) => {
                            let name =
                                String::from_utf8(name_bytes).map_err(|e| e.to_string())?;
                            items.push(ProjectListItem {
                                id: p.id,
                                name,
                                has_custom_password: true,
                                password_saved: true,
                                sort_order: p.sort_order,
                                created_at: p.created_at,
                                updated_at: p.updated_at,
                            });
                        }
                        Err(_) => {
                            items.push(ProjectListItem {
                                id: p.id,
                                name: "locked_custom_password".to_string(),
                                has_custom_password: true,
                                password_saved: false,
                                sort_order: p.sort_order,
                                created_at: p.created_at,
                                updated_at: p.updated_at,
                            });
                        }
                    }
                } else {
                    items.push(ProjectListItem {
                        id: p.id,
                        name: "locked_custom_password".to_string(),
                        has_custom_password: true,
                        password_saved: false,
                        sort_order: p.sort_order,
                        created_at: p.created_at,
                        updated_at: p.updated_at,
                    });
                }
            }
        }
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

    if let Some(key) = cached.as_ref() {
        if let Some(name_bytes) = crypto::try_decrypt_with_key(&project.encrypted_name, key) {
            let content_bytes =
                crypto::decrypt_auto(&project.encrypted_content, Some(key), mp.as_deref())
                    .map_err(|e| e.to_string())?;
            return Ok(DecryptedProject {
                id: project.id,
                name: String::from_utf8(name_bytes).map_err(|e| e.to_string())?,
                content: String::from_utf8(content_bytes).map_err(|e| e.to_string())?,
                has_custom_password: false,
                sort_order: project.sort_order,
                created_at: project.created_at,
                updated_at: project.updated_at,
            });
        }
    }

    let pw = if password.is_empty() {
        keychain::get(&kc_key(&id)).ok_or("No saved password for this project")?
    } else {
        let _ = keychain::save(&kc_key(&id), &password);
        password
    };

    let name_bytes = crypto::decrypt_auto(&project.encrypted_name, None, Some(&pw))
        .map_err(|e| e.to_string())?;
    let content_bytes = crypto::decrypt_auto(&project.encrypted_content, None, Some(&pw))
        .map_err(|e| e.to_string())?;

    Ok(DecryptedProject {
        id: project.id,
        name: String::from_utf8(name_bytes).map_err(|e| e.to_string())?,
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

    let (encrypted_name, encrypted_content) = if has_custom_password {
        let _ = keychain::save(&kc_key(&id), &password);
        (
            crypto::encrypt(name.as_bytes(), &password).map_err(|e| e.to_string())?,
            crypto::encrypt(content.as_bytes(), &password).map_err(|e| e.to_string())?,
        )
    } else {
        keychain::remove(&kc_key(&id));
        (
            crypto::encrypt_with_key(name.as_bytes(), &key).map_err(|e| e.to_string())?,
            crypto::encrypt_with_key(content.as_bytes(), &key).map_err(|e| e.to_string())?,
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
        encrypted_name,
        encrypted_content,
        sort_order: max_order + 1,
        created_at: now.clone(),
        updated_at: now,
        server_id: None,
        sync_status: "local".to_string(),
    };

    storage
        .create_project(&project)
        .map_err(|e| e.to_string())?;
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
    let storage = state.storage.lock().map_err(|e| e.to_string())?;
    let storage = storage.as_ref().ok_or("Database not initialized")?;

    let existing = storage.get_project(&id).map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();

    let (encrypted_name, encrypted_content) = if has_custom_password {
        let pw = if password.is_empty() {
            keychain::get(&kc_key(&id)).ok_or("No password available for this project")?
        } else {
            let _ = keychain::save(&kc_key(&id), &password);
            password
        };
        (
            crypto::encrypt(name.as_bytes(), &pw).map_err(|e| e.to_string())?,
            crypto::encrypt(content.as_bytes(), &pw).map_err(|e| e.to_string())?,
        )
    } else {
        keychain::remove(&kc_key(&id));
        (
            crypto::encrypt_with_key(name.as_bytes(), &key).map_err(|e| e.to_string())?,
            crypto::encrypt_with_key(content.as_bytes(), &key).map_err(|e| e.to_string())?,
        )
    };

    let sync_status = if existing.sync_status == "synced" {
        "modified".to_string()
    } else {
        existing.sync_status
    };

    let project = Project {
        id,
        encrypted_name,
        encrypted_content,
        sort_order: existing.sort_order,
        created_at: existing.created_at,
        updated_at: now,
        server_id: existing.server_id,
        sync_status,
    };

    storage
        .update_project(&project)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_project(state: State<AppState>, id: String) -> Result<(), String> {
    let storage = state.storage.lock().map_err(|e| e.to_string())?;
    let storage = storage.as_ref().ok_or("Database not initialized")?;
    keychain::remove(&kc_key(&id));
    storage.delete_project(&id).map_err(|e| e.to_string())?;
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
