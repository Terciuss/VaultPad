// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

use tauri::State;

use crate::storage::remote::RemoteStorage;
use crate::storage::StorageProvider;
use crate::AppState;

#[tauri::command]
pub fn sync_projects(state: State<AppState>) -> Result<String, String> {
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

    let remote = RemoteStorage::new(&server_url, &token);
    remote.init().map_err(|e| e.to_string())?;

    let local_projects = local.list_projects().map_err(|e| e.to_string())?;
    let remote_projects = remote.list_projects().map_err(|e| e.to_string())?;

    let mut uploaded = 0u32;
    let mut downloaded = 0u32;

    // Upload local projects that haven't been synced
    for lp in &local_projects {
        match lp.sync_status.as_str() {
            "local" => {
                remote
                    .create_project(lp)
                    .map_err(|e| e.to_string())?;

                let mut updated = lp.clone();
                updated.sync_status = "synced".to_string();
                local.update_project(&updated).map_err(|e| e.to_string())?;
                uploaded += 1;
            }
            "modified" => {
                if lp.server_id.is_some() {
                    remote
                        .update_project(lp)
                        .map_err(|e| e.to_string())?;
                } else {
                    remote
                        .create_project(lp)
                        .map_err(|e| e.to_string())?;
                }
                let mut updated = lp.clone();
                updated.sync_status = "synced".to_string();
                local.update_project(&updated).map_err(|e| e.to_string())?;
                uploaded += 1;
            }
            "deleted" => {
                if let Some(ref sid) = lp.server_id {
                    let _ = remote.delete_project(sid);
                }
                local.delete_project(&lp.id).map_err(|e| e.to_string())?;
            }
            _ => {}
        }
    }

    // Download remote projects not present locally
    let local_server_ids: Vec<String> = local_projects
        .iter()
        .filter_map(|p| p.server_id.clone())
        .collect();

    for rp in &remote_projects {
        let sid = rp.server_id.as_deref().unwrap_or(&rp.id);
        if !local_server_ids.contains(&sid.to_string()) {
            local
                .create_project(rp)
                .map_err(|e| e.to_string())?;
            downloaded += 1;
        }
    }

    Ok(format!(
        "Sync complete: {} uploaded, {} downloaded",
        uploaded, downloaded
    ))
}
