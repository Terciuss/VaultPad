// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use crate::crypto;
use crate::keychain;
use crate::models::{DecryptedProjectData, Project, ProjectBackup};
use crate::password_registry::{self, RegistryEntry};
use crate::storage::remote::RemoteStorage;
use crate::storage::StorageProvider;
use crate::AppState;

#[derive(Debug, Serialize, Deserialize)]
pub struct RemoteChangedInfo {
    pub server_id: String,
    pub remote_updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SyncPushResult {
    pub uploaded: u32,
    pub deleted: u32,
    pub conflicts: Vec<ConflictInfo>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SyncPullResult {
    pub downloaded: u32,
    pub updated: u32,
}

const BACKUP_KEEP_COUNT: usize = 15;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConflictInfo {
    pub project_id: String,
    pub local_name: String,
    pub local_content: String,
    pub remote_name: String,
    pub remote_content: String,
    pub local_updated_at: String,
    pub remote_updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SyncResult {
    pub uploaded: u32,
    pub downloaded: u32,
    pub deleted: u32,
    pub conflicts: Vec<ConflictInfo>,
}

fn decrypt_project_data(
    project: &Project,
    key: &[u8; crypto::KEY_LEN],
    passwords: &[String],
) -> Result<DecryptedProjectData, String> {
    let content_bytes =
        if let Some(c) = crypto::try_decrypt_with_key(&project.encrypted_content, key) {
            c
        } else {
            let mut found = None;
            for pw in passwords {
                if let Ok(b) = crypto::decrypt_auto(&project.encrypted_content, None, Some(pw)) {
                    found = Some(b);
                    break;
                }
            }
            found.ok_or_else(|| "Cannot decrypt project content".to_string())?
        };

    Ok(DecryptedProjectData {
        name: project.name.clone(),
        content: String::from_utf8(content_bytes).map_err(|e| e.to_string())?,
        updated_at: project.updated_at.clone(),
    })
}

#[tauri::command]
pub fn sync_projects(state: State<AppState>) -> Result<SyncResult, String> {
    let server_url = state
        .server_url
        .lock()
        .map_err(|e| e.to_string())?
        .clone()
        .ok_or("Not connected to server")?;

    let token = state
        .server_token
        .lock()
        .map_err(|e| e.to_string())?
        .clone()
        .ok_or("Not authenticated")?;

    let storage = state.storage.lock().map_err(|e| e.to_string())?;
    let local = storage.as_ref().ok_or("Database not initialized")?;

    let cached_key = state
        .cached_key
        .lock()
        .map_err(|e| e.to_string())?
        .ok_or("No cached key")?;

    let master_password = state
        .master_password
        .lock()
        .map_err(|e| e.to_string())?
        .clone();

    let remote = RemoteStorage::new(&server_url, &token);
    remote.health_check().map_err(|e| e.to_string())?;

    let password_pool = password_registry::collect_password_pool(&**local, &cached_key, None);
    let mut all_passwords = Vec::new();
    if let Some(ref mp) = master_password {
        all_passwords.push(mp.clone());
    }
    all_passwords.extend(password_pool);

    let local_projects = local.list_projects().map_err(|e| e.to_string())?;
    let remote_metas = remote.list_projects_meta().map_err(|e| e.to_string())?;

    let mut uploaded = 0u32;
    let mut downloaded = 0u32;
    let mut deleted = 0u32;
    let mut conflicts = Vec::new();

    let now = chrono::Utc::now().to_rfc3339();

    for lp in &local_projects {
        if password_registry::is_registry(&lp.id) {
            continue;
        }
        if matches!(lp.sync_status.as_str(), "modified" | "synced") {
            let content_len = crypto::decrypt_auto(
                &lp.encrypted_content,
                Some(&cached_key),
                master_password.as_deref(),
            )
            .ok()
            .and_then(|bytes| String::from_utf8(bytes).ok())
            .map(|s| s.len() as i64)
            .unwrap_or(0);

            let backup_entry = ProjectBackup {
                id: Uuid::new_v4().to_string(),
                project_id: lp.id.clone(),
                name: lp.name.clone(),
                encrypted_content: lp.encrypted_content.clone(),
                key_check: lp.key_check.clone(),
                created_at: now.clone(),
                trigger_type: "pre_sync".to_string(),
                content_length: content_len,
            };
            let _ = local.create_backup(&backup_entry);
            let _ = local.cleanup_backups(&lp.id, BACKUP_KEEP_COUNT);
        }
    }

    for lp in &local_projects {
        if password_registry::is_registry(&lp.id) {
            continue;
        }
        match lp.sync_status.as_str() {
            "local" => {
                let server_id = remote
                    .create_project(lp)
                    .map_err(|e| e.to_string())?;

                let mut updated_project = lp.clone();
                updated_project.sync_status = "synced".to_string();
                updated_project.last_synced_at = Some(now.clone());
                if let Some(sid) = server_id {
                    updated_project.server_id = Some(sid);
                }
                local
                    .update_project(&updated_project)
                    .map_err(|e| e.to_string())?;
                uploaded += 1;
            }
            "modified" | "conflict" => {
                if let Some(ref local_server_id) = lp.server_id {
                    let remote_meta = remote_metas
                        .iter()
                        .find(|rm| rm.id.to_string() == *local_server_id);

                    let remote_changed = remote_meta.map_or(false, |rm| {
                        lp.last_synced_at
                            .as_ref()
                            .map(|lst| rm.updated_at > *lst)
                            .unwrap_or(true)
                    });

                    if remote_changed {
                        let rv = remote.get_project(local_server_id).map_err(|e| e.to_string())?;
                        match (
                            decrypt_project_data(lp, &cached_key, &all_passwords),
                            decrypt_project_data(&rv, &cached_key, &all_passwords),
                        ) {
                            (Ok(local_data), Ok(remote_data)) => {
                                if local_data.name == remote_data.name
                                    && local_data.content == remote_data.content
                                {
                                    let mut updated_project = lp.clone();
                                    updated_project.sync_status = "synced".to_string();
                                    updated_project.last_synced_at = Some(now.clone());
                                    local
                                        .update_project(&updated_project)
                                        .map_err(|e| e.to_string())?;
                                } else {
                                    conflicts.push(ConflictInfo {
                                        project_id: lp.id.clone(),
                                        local_name: local_data.name,
                                        local_content: local_data.content,
                                        remote_name: remote_data.name,
                                        remote_content: remote_data.content,
                                        local_updated_at: lp.updated_at.clone(),
                                        remote_updated_at: rv.updated_at.clone(),
                                    });

                                    let mut conflict_project = lp.clone();
                                    conflict_project.sync_status = "conflict".to_string();
                                    local
                                        .update_project(&conflict_project)
                                        .map_err(|e| e.to_string())?;
                                }
                            }
                            _ => {
                                conflicts.push(ConflictInfo {
                                    project_id: lp.id.clone(),
                                    local_name: "[encrypted]".to_string(),
                                    local_content: "[encrypted]".to_string(),
                                    remote_name: "[encrypted]".to_string(),
                                    remote_content: "[encrypted]".to_string(),
                                    local_updated_at: lp.updated_at.clone(),
                                    remote_updated_at: rv.updated_at.clone(),
                                });
                            }
                        }
                    } else {
                        remote
                            .update_project(lp)
                            .map_err(|e| e.to_string())?;

                        let mut updated_project = lp.clone();
                        updated_project.sync_status = "synced".to_string();
                        updated_project.last_synced_at = Some(now.clone());
                        local
                            .update_project(&updated_project)
                            .map_err(|e| e.to_string())?;
                        uploaded += 1;
                    }
                } else {
                    let server_id = remote
                        .create_project(lp)
                        .map_err(|e| e.to_string())?;

                    let mut updated_project = lp.clone();
                    updated_project.sync_status = "synced".to_string();
                    updated_project.last_synced_at = Some(now.clone());
                    if let Some(sid) = server_id {
                        updated_project.server_id = Some(sid);
                    }
                    local
                        .update_project(&updated_project)
                        .map_err(|e| e.to_string())?;
                    uploaded += 1;
                }
            }
            "deleted" => {
                if let Some(ref sid) = lp.server_id {
                    let _ = remote.delete_project(sid);
                }
                local.delete_project(&lp.id).map_err(|e| e.to_string())?;
                deleted += 1;
            }
            _ => {}
        }
    }

    // Handle registry push separately (auto-merge, never conflict)
    sync_registry_push(&**local, &remote, &cached_key, &now)?;

    let local_all = local.list_projects().map_err(|e| e.to_string())?;
    let local_server_ids: Vec<String> = local_all
        .iter()
        .filter_map(|p| p.server_id.clone())
        .collect();

    let remote_server_ids: std::collections::HashSet<String> = remote_metas
        .iter()
        .map(|rm| rm.id.to_string())
        .collect();

    for rm in &remote_metas {
        let sid = rm.id.to_string();
        if !local_server_ids.contains(&sid) {
            let rp = remote.get_project(&sid).map_err(|e| e.to_string())?;
            if password_registry::is_registry_by_name(&rp, &cached_key) {
                handle_pulled_registry(&**local, &rp, &cached_key, &now)?;
            } else {
                let mut new_project = rp;
                new_project.sync_status = "synced".to_string();
                new_project.last_synced_at = Some(now.clone());
                local
                    .create_project(&new_project)
                    .map_err(|e| e.to_string())?;
            }
            downloaded += 1;
        }
    }

    for lp in &local_all {
        if password_registry::is_registry(&lp.id) || lp.sync_status == "deleted" {
            continue;
        }
        if let Some(ref sid) = lp.server_id {
            if !remote_server_ids.contains(sid) && lp.sync_status == "synced" {
                local.delete_project(&lp.id).map_err(|e| e.to_string())?;
                deleted += 1;
            }
        }
    }

    let _ = password_registry::import_registry(&**local, &cached_key);

    Ok(SyncResult {
        uploaded,
        downloaded,
        deleted,
        conflicts,
    })
}

#[tauri::command]
pub fn resolve_conflict(
    state: State<AppState>,
    project_id: String,
    resolution: String,
    merged_name: Option<String>,
    merged_content: Option<String>,
    password: String,
) -> Result<(), String> {
    let storage = state.storage.lock().map_err(|e| e.to_string())?;
    let local = storage.as_ref().ok_or("Database not initialized")?;

    let server_url = state
        .server_url
        .lock()
        .map_err(|e| e.to_string())?
        .clone()
        .ok_or("Not connected to server")?;

    let token = state
        .server_token
        .lock()
        .map_err(|e| e.to_string())?
        .clone()
        .ok_or("Not authenticated")?;

    let cached_key = state
        .cached_key
        .lock()
        .map_err(|e| e.to_string())?
        .ok_or("No cached key")?;

    let existing = local.get_project(&project_id).map_err(|e| e.to_string())?;
    let remote = RemoteStorage::new(&server_url, &token);
    let now = chrono::Utc::now().to_rfc3339();

    match resolution.as_str() {
        "local" => {
            remote
                .update_project(&existing)
                .map_err(|e| e.to_string())?;

            let mut resolved = existing;
            resolved.sync_status = "synced".to_string();
            resolved.last_synced_at = Some(now);
            local
                .update_project(&resolved)
                .map_err(|e| e.to_string())?;
        }
        "remote" => {
            if let Some(ref sid) = existing.server_id {
                let remote_project = remote.get_project(sid).map_err(|e| e.to_string())?;

                let mut resolved = remote_project;
                resolved.id = existing.id;
                resolved.sync_status = "synced".to_string();
                resolved.last_synced_at = Some(now);
                local
                    .update_project(&resolved)
                    .map_err(|e| e.to_string())?;
            } else {
                return Err("No server_id for remote resolution".to_string());
            }
        }
        "merged" => {
            let name = merged_name.ok_or("Merged name required")?;
            let content = merged_content.ok_or("Merged content required")?;

            let use_custom = !password.is_empty();
            let (encrypted_content, key_check) = if use_custom {
                (
                    crypto::encrypt(content.as_bytes(), &password).map_err(|e| e.to_string())?,
                    crypto::encrypt(b"cp", &password).map_err(|e| e.to_string())?,
                )
            } else {
                (
                    crypto::encrypt_with_key(content.as_bytes(), &cached_key)
                        .map_err(|e| e.to_string())?,
                    crypto::encrypt_with_key(b"mk", &cached_key)
                        .map_err(|e| e.to_string())?,
                )
            };

            let mut resolved = existing;
            resolved.name = name;
            resolved.encrypted_content = encrypted_content;
            resolved.key_check = key_check;
            resolved.updated_at = now.clone();
            resolved.sync_status = "synced".to_string();
            resolved.last_synced_at = Some(now);

            remote
                .update_project(&resolved)
                .map_err(|e| e.to_string())?;
            local
                .update_project(&resolved)
                .map_err(|e| e.to_string())?;
        }
        _ => return Err(format!("Unknown resolution: {}", resolution)),
    }

    Ok(())
}

/// Push the password registry to the server with auto-merge (never creates conflict dialog).
fn sync_registry_push(
    local: &dyn StorageProvider,
    remote: &RemoteStorage,
    cached_key: &[u8; crypto::KEY_LEN],
    now: &str,
) -> Result<(), String> {
    let registry = match local.get_project(password_registry::PASSWORD_REGISTRY_UUID) {
        Ok(p) => p,
        Err(_) => return Ok(()),
    };

    match registry.sync_status.as_str() {
        "local" => {
            let existing_on_server = find_registry_on_server(remote, cached_key);
            if let Some(server_reg) = existing_on_server {
                let local_entries = password_registry::parse_registry(&registry, cached_key)
                    .map(|r| r.entries)
                    .unwrap_or_default();
                let remote_entries = password_registry::parse_registry(&server_reg, cached_key)
                    .map(|r| r.entries)
                    .unwrap_or_default();

                let merged = password_registry::merge_registries(&local_entries, &remote_entries);
                let merged_content = password_registry::RegistryContent::new(merged);
                let json = serde_json::to_string(&merged_content).map_err(|e| e.to_string())?;

                let encrypted_content =
                    crypto::encrypt_with_key(json.as_bytes(), cached_key).map_err(|e| e.to_string())?;
                let key_check =
                    crypto::encrypt_with_key(b"mk", cached_key).map_err(|e| e.to_string())?;

                let mut updated = registry.clone();
                updated.name = password_registry::PASSWORD_REGISTRY_NAME.to_string();
                updated.encrypted_content = encrypted_content;
                updated.key_check = key_check;
                updated.server_id = server_reg.server_id.clone();
                updated.sync_status = "synced".to_string();
                updated.last_synced_at = Some(now.to_string());

                remote.update_project(&updated).map_err(|e| e.to_string())?;
                local.update_project(&updated).map_err(|e| e.to_string())?;
            } else {
                let server_id = remote
                    .create_project(&registry)
                    .map_err(|e| e.to_string())?;
                let mut updated = registry.clone();
                updated.sync_status = "synced".to_string();
                updated.last_synced_at = Some(now.to_string());
                if let Some(sid) = server_id {
                    updated.server_id = Some(sid);
                }
                local.update_project(&updated).map_err(|e| e.to_string())?;
            }
        }
        "modified" => {
            if let Some(ref server_id) = registry.server_id {
                let remote_reg = remote.get_project(server_id).ok();
                if let Some(rr) = remote_reg {
                    let local_entries = password_registry::parse_registry(&registry, cached_key)
                        .map(|r| r.entries)
                        .unwrap_or_default();
                    let remote_entries = password_registry::parse_registry(&rr, cached_key)
                        .map(|r| r.entries)
                        .unwrap_or_default();

                    let merged =
                        password_registry::merge_registries(&local_entries, &remote_entries);
                    let merged_content = password_registry::RegistryContent::new(merged);
                    let json =
                        serde_json::to_string(&merged_content).map_err(|e| e.to_string())?;

                    let encrypted_content = crypto::encrypt_with_key(json.as_bytes(), cached_key)
                        .map_err(|e| e.to_string())?;
                    let key_check =
                        crypto::encrypt_with_key(b"mk", cached_key).map_err(|e| e.to_string())?;

                    let mut updated = registry.clone();
                    updated.name = password_registry::PASSWORD_REGISTRY_NAME.to_string();
                    updated.encrypted_content = encrypted_content;
                    updated.key_check = key_check;
                    updated.sync_status = "synced".to_string();
                    updated.last_synced_at = Some(now.to_string());

                    remote.update_project(&updated).map_err(|e| e.to_string())?;
                    local.update_project(&updated).map_err(|e| e.to_string())?;
                } else {
                    remote
                        .update_project(&registry)
                        .map_err(|e| e.to_string())?;
                    let mut updated = registry.clone();
                    updated.sync_status = "synced".to_string();
                    updated.last_synced_at = Some(now.to_string());
                    local.update_project(&updated).map_err(|e| e.to_string())?;
                }
            } else {
                let server_id = remote
                    .create_project(&registry)
                    .map_err(|e| e.to_string())?;
                let mut updated = registry.clone();
                updated.sync_status = "synced".to_string();
                updated.last_synced_at = Some(now.to_string());
                if let Some(sid) = server_id {
                    updated.server_id = Some(sid);
                }
                local.update_project(&updated).map_err(|e| e.to_string())?;
            }
        }
        _ => {}
    }

    Ok(())
}

/// Search for an existing password registry among all remote projects.
fn find_registry_on_server(
    remote: &RemoteStorage,
    cached_key: &[u8; crypto::KEY_LEN],
) -> Option<Project> {
    let all_projects = remote.list_projects().ok()?;
    for p in all_projects {
        if password_registry::is_registry_by_name(&p, cached_key) {
            return Some(p);
        }
    }
    None
}

/// Handle a pulled project that has been identified as the password registry.
fn handle_pulled_registry(
    local: &dyn StorageProvider,
    remote_project: &Project,
    cached_key: &[u8; crypto::KEY_LEN],
    now: &str,
) -> Result<(), String> {
    let remote_entries = password_registry::parse_registry(remote_project, cached_key)
        .map(|r| r.entries)
        .unwrap_or_default();

    let existing_local = local
        .get_project(password_registry::PASSWORD_REGISTRY_UUID)
        .ok();

    if let Some(local_reg) = existing_local {
        let local_entries = password_registry::parse_registry(&local_reg, cached_key)
            .map(|r| r.entries)
            .unwrap_or_default();
        let merged = password_registry::merge_registries(&local_entries, &remote_entries);
        let merged_content = password_registry::RegistryContent::new(merged);
        let json = serde_json::to_string(&merged_content).map_err(|e| e.to_string())?;

        let encrypted_content =
            crypto::encrypt_with_key(json.as_bytes(), cached_key).map_err(|e| e.to_string())?;
        let key_check =
            crypto::encrypt_with_key(b"mk", cached_key).map_err(|e| e.to_string())?;

        let mut updated = local_reg;
        updated.name = password_registry::PASSWORD_REGISTRY_NAME.to_string();
        updated.encrypted_content = encrypted_content;
        updated.key_check = key_check;
        updated.server_id = remote_project.server_id.clone();
        updated.sync_status = "modified".to_string();
        updated.last_synced_at = Some(now.to_string());
        local.update_project(&updated).map_err(|e| e.to_string())?;
    } else {
        let mut new_reg = remote_project.clone();
        new_reg.id = password_registry::PASSWORD_REGISTRY_UUID.to_string();
        new_reg.sync_status = "synced".to_string();
        new_reg.last_synced_at = Some(now.to_string());
        local
            .create_project(&new_reg)
            .map_err(|e| e.to_string())?;
    }

    let _ = password_registry::import_registry(local, cached_key);
    Ok(())
}

/// Fetch the remote registry and return its entries (without importing).
fn fetch_remote_registry_entries(
    remote: &RemoteStorage,
    local: &dyn StorageProvider,
    cached_key: &[u8; crypto::KEY_LEN],
) -> Option<Vec<RegistryEntry>> {
    let local_reg = local
        .get_project(password_registry::PASSWORD_REGISTRY_UUID)
        .ok()?;
    let server_id = local_reg.server_id.as_ref()?;
    let remote_reg = remote.get_project(server_id).ok()?;
    password_registry::parse_registry(&remote_reg, cached_key)
        .ok()
        .map(|r| r.entries)
}

fn build_remote(state: &AppState) -> Result<RemoteStorage, String> {
    let server_url = state
        .server_url
        .lock()
        .map_err(|e| e.to_string())?
        .clone()
        .ok_or("Not connected to server")?;
    let token = state
        .server_token
        .lock()
        .map_err(|e| e.to_string())?
        .clone()
        .ok_or("Not authenticated")?;
    Ok(RemoteStorage::new(&server_url, &token))
}

#[tauri::command]
pub fn sync_push(state: State<AppState>) -> Result<SyncPushResult, String> {
    let remote = build_remote(&state)?;
    remote.health_check().map_err(|e| e.to_string())?;

    let storage = state.storage.lock().map_err(|e| e.to_string())?;
    let local = storage.as_ref().ok_or("Database not initialized")?;

    let cached_key = state
        .cached_key
        .lock()
        .map_err(|e| e.to_string())?
        .ok_or("No cached key")?;

    let master_password = state
        .master_password
        .lock()
        .map_err(|e| e.to_string())?
        .clone();

    // Step 0: fetch remote registry entries (without importing)
    let remote_reg_entries = fetch_remote_registry_entries(&remote, &**local, &cached_key);

    // Build password pool: master_password + keychain + remote registry
    let keychain_pool =
        password_registry::collect_password_pool(&**local, &cached_key, remote_reg_entries.as_deref());
    let mut all_passwords = Vec::new();
    if let Some(ref mp) = master_password {
        all_passwords.push(mp.clone());
    }
    all_passwords.extend(keychain_pool);

    // Step 1: pre-encrypt local projects where password changed
    if let Some(ref reg_entries) = remote_reg_entries {
        let local_projects_snap = local.list_projects().map_err(|e| e.to_string())?;
        for lp in &local_projects_snap {
            if password_registry::is_registry(&lp.id) {
                continue;
            }
            if let Some(ref sid) = lp.server_id {
                let old_pw = keychain::get(&password_registry::kc_key(&lp.id));
                let new_pw = reg_entries
                    .iter()
                    .find(|e| e.server_id.as_deref() == Some(sid.as_str()))
                    .map(|e| e.password.as_str());
                if let (Some(old), Some(new)) = (old_pw.as_deref(), new_pw) {
                    if old != new {
                        let _ = password_registry::pre_encrypt_with_new_password(
                            lp,
                            &**local,
                            &all_passwords,
                            new,
                        );
                    }
                }
            }
        }
    }

    let local_projects = local.list_projects().map_err(|e| e.to_string())?;
    let remote_metas = remote.list_projects_meta().map_err(|e| e.to_string())?;

    let now = chrono::Utc::now().to_rfc3339();
    let mut uploaded = 0u32;
    let mut deleted = 0u32;
    let mut conflicts = Vec::new();

    for lp in &local_projects {
        if password_registry::is_registry(&lp.id) {
            continue;
        }
        if lp.sync_status == "modified" || lp.sync_status == "synced" {
            let content_len = crypto::decrypt_auto(
                &lp.encrypted_content,
                Some(&cached_key),
                master_password.as_deref(),
            )
            .ok()
            .and_then(|bytes| String::from_utf8(bytes).ok())
            .map(|s| s.len() as i64)
            .unwrap_or(0);

            let backup_entry = ProjectBackup {
                id: Uuid::new_v4().to_string(),
                project_id: lp.id.clone(),
                name: lp.name.clone(),
                encrypted_content: lp.encrypted_content.clone(),
                key_check: lp.key_check.clone(),
                created_at: now.clone(),
                trigger_type: "pre_sync".to_string(),
                content_length: content_len,
            };
            let _ = local.create_backup(&backup_entry);
            let _ = local.cleanup_backups(&lp.id, BACKUP_KEEP_COUNT);
        }
    }

    for lp in &local_projects {
        if password_registry::is_registry(&lp.id) {
            continue;
        }
        match lp.sync_status.as_str() {
            "local" => {
                let server_id = remote
                    .create_project(lp)
                    .map_err(|e| e.to_string())?;
                let mut updated_project = lp.clone();
                updated_project.sync_status = "synced".to_string();
                updated_project.last_synced_at = Some(now.clone());
                if let Some(sid) = server_id {
                    updated_project.server_id = Some(sid);
                }
                local.update_project(&updated_project).map_err(|e| e.to_string())?;
                uploaded += 1;
            }
            "modified" | "conflict" => {
                if let Some(ref local_server_id) = lp.server_id {
                    let remote_meta = remote_metas
                        .iter()
                        .find(|rm| rm.id.to_string() == *local_server_id);

                    let remote_changed = remote_meta.map_or(false, |rm| {
                        lp.last_synced_at
                            .as_ref()
                            .map(|lst| rm.updated_at > *lst)
                            .unwrap_or(true)
                    });

                    if remote_changed {
                        let rv = remote.get_project(local_server_id).map_err(|e| e.to_string())?;
                        match (
                            decrypt_project_data(lp, &cached_key, &all_passwords),
                            decrypt_project_data(&rv, &cached_key, &all_passwords),
                        ) {
                            (Ok(local_data), Ok(remote_data)) => {
                                if local_data.name == remote_data.name
                                    && local_data.content == remote_data.content
                                {
                                    let mut updated_project = lp.clone();
                                    updated_project.sync_status = "synced".to_string();
                                    updated_project.last_synced_at = Some(now.clone());
                                    local.update_project(&updated_project).map_err(|e| e.to_string())?;
                                } else {
                                    conflicts.push(ConflictInfo {
                                        project_id: lp.id.clone(),
                                        local_name: local_data.name,
                                        local_content: local_data.content,
                                        remote_name: remote_data.name,
                                        remote_content: remote_data.content,
                                        local_updated_at: lp.updated_at.clone(),
                                        remote_updated_at: rv.updated_at.clone(),
                                    });
                                    let mut conflict_project = lp.clone();
                                    conflict_project.sync_status = "conflict".to_string();
                                    local.update_project(&conflict_project).map_err(|e| e.to_string())?;
                                }
                            }
                            _ => {
                                conflicts.push(ConflictInfo {
                                    project_id: lp.id.clone(),
                                    local_name: "[encrypted]".to_string(),
                                    local_content: "[encrypted]".to_string(),
                                    remote_name: "[encrypted]".to_string(),
                                    remote_content: "[encrypted]".to_string(),
                                    local_updated_at: lp.updated_at.clone(),
                                    remote_updated_at: rv.updated_at.clone(),
                                });
                            }
                        }
                    } else {
                        remote.update_project(lp).map_err(|e| e.to_string())?;
                        let mut updated_project = lp.clone();
                        updated_project.sync_status = "synced".to_string();
                        updated_project.last_synced_at = Some(now.clone());
                        local.update_project(&updated_project).map_err(|e| e.to_string())?;
                        uploaded += 1;
                    }
                } else {
                    let server_id = remote.create_project(lp).map_err(|e| e.to_string())?;
                    let mut updated_project = lp.clone();
                    updated_project.sync_status = "synced".to_string();
                    updated_project.last_synced_at = Some(now.clone());
                    if let Some(sid) = server_id {
                        updated_project.server_id = Some(sid);
                    }
                    local.update_project(&updated_project).map_err(|e| e.to_string())?;
                    uploaded += 1;
                }
            }
            "deleted" => {
                if let Some(ref sid) = lp.server_id {
                    let _ = remote.delete_project(sid);
                }
                local.delete_project(&lp.id).map_err(|e| e.to_string())?;
                deleted += 1;
            }
            _ => {}
        }
    }

    // Step 2: push registry separately (auto-merge)
    sync_registry_push(&**local, &remote, &cached_key, &now)?;

    // Step 4: finalize — import registry passwords into keychain
    let _ = password_registry::import_registry(&**local, &cached_key);

    Ok(SyncPushResult {
        uploaded,
        deleted,
        conflicts,
    })
}

#[tauri::command]
pub fn check_remote_changes(state: State<AppState>) -> Result<Vec<RemoteChangedInfo>, String> {
    let remote = build_remote(&state)?;
    remote.health_check().map_err(|e| e.to_string())?;

    let storage = state.storage.lock().map_err(|e| e.to_string())?;
    let local = storage.as_ref().ok_or("Database not initialized")?;

    let remote_metas = remote.list_projects_meta().map_err(|e| e.to_string())?;
    let local_projects = local.list_projects().map_err(|e| e.to_string())?;

    let local_server_ids: std::collections::HashMap<String, Option<String>> = local_projects
        .iter()
        .filter_map(|p| {
            p.server_id
                .as_ref()
                .map(|sid| (sid.clone(), p.last_synced_at.clone()))
        })
        .collect();

    let mut changed = Vec::new();

    for rm in &remote_metas {
        let sid = rm.id.to_string();
        match local_server_ids.get(&sid) {
            Some(last_synced) => {
                let is_newer = last_synced
                    .as_ref()
                    .map(|lst| rm.updated_at > *lst)
                    .unwrap_or(true);
                if is_newer {
                    changed.push(RemoteChangedInfo {
                        server_id: sid,
                        remote_updated_at: rm.updated_at.clone(),
                    });
                }
            }
            None => {
                changed.push(RemoteChangedInfo {
                    server_id: sid,
                    remote_updated_at: rm.updated_at.clone(),
                });
            }
        }
    }

    Ok(changed)
}

#[tauri::command]
pub fn sync_pull_changed(
    state: State<AppState>,
    changed_ids: Vec<String>,
) -> Result<SyncPullResult, String> {
    if changed_ids.is_empty() {
        return Ok(SyncPullResult {
            downloaded: 0,
            updated: 0,
        });
    }

    let remote = build_remote(&state)?;

    let storage = state.storage.lock().map_err(|e| e.to_string())?;
    let local = storage.as_ref().ok_or("Database not initialized")?;

    let cached_key = state
        .cached_key
        .lock()
        .map_err(|e| e.to_string())?
        .ok_or("No cached key")?;

    let local_projects = local.list_projects().map_err(|e| e.to_string())?;
    let local_by_server_id: std::collections::HashMap<String, &Project> = local_projects
        .iter()
        .filter_map(|p| p.server_id.as_ref().map(|sid| (sid.clone(), p)))
        .collect();

    let now = chrono::Utc::now().to_rfc3339();
    let mut downloaded = 0u32;
    let mut updated = 0u32;

    for sid in &changed_ids {
        let rp = match remote.get_project(sid) {
            Ok(p) => p,
            Err(_) => continue,
        };

        if password_registry::is_registry_by_name(&rp, &cached_key) {
            handle_pulled_registry(&**local, &rp, &cached_key, &now)?;
            downloaded += 1;
            continue;
        }

        if let Some(existing) = local_by_server_id.get(sid) {
            if existing.sync_status == "modified" || existing.sync_status == "conflict" {
                continue;
            }
            let mut update = rp.clone();
            update.id = existing.id.clone();
            update.sync_status = "synced".to_string();
            update.last_synced_at = Some(now.clone());
            local.update_project(&update).map_err(|e| e.to_string())?;
            updated += 1;
        } else {
            let mut new_project = rp;
            new_project.sync_status = "synced".to_string();
            new_project.last_synced_at = Some(now.clone());
            local.create_project(&new_project).map_err(|e| e.to_string())?;
            downloaded += 1;
        }
    }

    if let Ok(remote_metas) = remote.list_projects_meta() {
        let remote_ids: std::collections::HashSet<String> =
            remote_metas.iter().map(|rm| rm.id.to_string()).collect();

        for lp in &local_projects {
            if password_registry::is_registry(&lp.id) || lp.sync_status == "deleted" {
                continue;
            }
            if let Some(ref sid) = lp.server_id {
                if !remote_ids.contains(sid) && lp.sync_status == "synced" {
                    let _ = local.delete_project(&lp.id);
                }
            }
        }
    }

    Ok(SyncPullResult {
        downloaded,
        updated,
    })
}
