// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;
use zeroize::Zeroize;

use crate::crypto;
use crate::server_config::{self, ServerConfig};
use crate::storage::local::LocalStorage;
use crate::storage::StorageProvider;
use crate::AppState;

fn transliterate_to_filename(name: &str) -> String {
    let mut result = String::with_capacity(name.len() * 2);
    for ch in name.chars() {
        let mapped = match ch {
            'А' | 'а' => "a", 'Б' | 'б' => "b", 'В' | 'в' => "v", 'Г' | 'г' => "g",
            'Д' | 'д' => "d", 'Е' | 'е' => "e", 'Ё' | 'ё' => "yo", 'Ж' | 'ж' => "zh",
            'З' | 'з' => "z", 'И' | 'и' => "i", 'Й' | 'й' => "j", 'К' | 'к' => "k",
            'Л' | 'л' => "l", 'М' | 'м' => "m", 'Н' | 'н' => "n", 'О' | 'о' => "o",
            'П' | 'п' => "p", 'Р' | 'р' => "r", 'С' | 'с' => "s", 'Т' | 'т' => "t",
            'У' | 'у' => "u", 'Ф' | 'ф' => "f", 'Х' | 'х' => "kh", 'Ц' | 'ц' => "ts",
            'Ч' | 'ч' => "ch", 'Ш' | 'ш' => "sh", 'Щ' | 'щ' => "shch", 'Ъ' | 'ъ' => "",
            'Ы' | 'ы' => "y", 'Ь' | 'ь' => "", 'Э' | 'э' => "e", 'Ю' | 'ю' => "yu",
            'Я' | 'я' => "ya",
            ' ' | '\t' => "-",
            c if c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.' => {
                result.push(c.to_ascii_lowercase());
                continue;
            }
            _ => "_",
        };
        result.push_str(mapped);
    }

    let sanitized: String = result
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_' || *c == '.')
        .collect();

    let trimmed = sanitized.trim_matches(|c: char| c == '-' || c == '_' || c == '.');
    if trimmed.is_empty() {
        "server".to_string()
    } else {
        trimmed.to_string()
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ServerInfo {
    pub id: String,
    pub name: String,
    pub url: String,
    pub db_path: String,
    pub is_authenticated: bool,
    pub has_master_password: bool,
    pub is_admin: bool,
}

#[derive(Serialize)]
struct AuthPayload {
    email: String,
    password: String,
}

#[derive(Deserialize)]
struct AuthUser {
    id: i64,
    email: String,
    is_admin: bool,
}

#[derive(Deserialize)]
struct AuthResponseBody {
    token: String,
    user: AuthUser,
}

#[derive(Serialize, Clone)]
pub struct ServerLoginResult {
    pub token: String,
    pub user_id: i64,
    pub email: String,
    pub is_admin: bool,
}

#[tauri::command]
pub fn list_servers() -> Vec<ServerInfo> {
    server_config::list_servers()
        .into_iter()
        .map(|cfg| {
            let is_authenticated = server_config::get_server_token(&cfg.id).is_some();
            let has_master_password = server_config::get_server_master_password(&cfg.id).is_some();
            let is_admin = server_config::get_server_is_admin(&cfg.id);
            ServerInfo {
                id: cfg.id,
                name: cfg.name,
                url: cfg.url,
                db_path: cfg.db_path,
                is_authenticated,
                has_master_password,
                is_admin,
            }
        })
        .collect()
}

#[tauri::command]
pub fn add_server(name: String, url: String, db_folder: String) -> Result<ServerInfo, String> {
    let id = Uuid::new_v4().to_string();
    let short_id = &id[..8];
    let slug = transliterate_to_filename(&name);
    let base_name = format!("{}_{}", slug, short_id);
    let folder = db_folder.trim_end_matches('/');

    let mut db_path = format!("{}/{}.db", folder, base_name);
    let mut suffix = 2u32;
    while std::path::Path::new(&db_path).exists() {
        db_path = format!("{}/{}_{}.db", folder, base_name, suffix);
        suffix += 1;
    }

    let config = ServerConfig {
        id: id.clone(),
        name: name.clone(),
        url: url.clone(),
        db_path: db_path.clone(),
    };

    server_config::add_server(config)?;

    Ok(ServerInfo {
        id,
        name,
        url,
        db_path,
        is_authenticated: false,
        has_master_password: false,
        is_admin: false,
    })
}

#[tauri::command]
pub fn remove_server(state: State<AppState>, server_id: String) -> Result<(), String> {
    let cfg = server_config::find_server(&server_id)
        .ok_or("Server not found")?;

    let active = state.active_context.lock().map_err(|e| e.to_string())?;
    if *active == server_id {
        return Err("Cannot remove the active server. Switch context first.".to_string());
    }
    drop(active);

    let db_path = cfg.db_path.clone();
    server_config::remove_server(&server_id)?;

    let _ = std::fs::remove_file(&db_path);

    Ok(())
}

#[tauri::command]
pub fn switch_context(state: State<AppState>, context_id: String) -> Result<(), String> {
    {
        let mut cached = state.cached_key.lock().map_err(|e| e.to_string())?;
        if let Some(ref mut k) = *cached {
            k.zeroize();
        }
        *cached = None;
    }
    {
        let mut mp = state.master_password.lock().map_err(|e| e.to_string())?;
        *mp = None;
    }
    {
        let mut storage = state.storage.lock().map_err(|e| e.to_string())?;
        *storage = None;
    }
    {
        let mut db_path = state.db_path.lock().map_err(|e| e.to_string())?;
        *db_path = None;
    }
    {
        let mut token = state.server_token.lock().map_err(|e| e.to_string())?;
        *token = None;
    }
    {
        let mut url = state.server_url.lock().map_err(|e| e.to_string())?;
        *url = None;
    }

    if context_id == "local" {
        let mut active = state.active_context.lock().map_err(|e| e.to_string())?;
        *active = "local".to_string();
        return Ok(());
    }

    let cfg = server_config::find_server(&context_id)
        .ok_or("Server not found")?;

    let storage = LocalStorage::new(&cfg.db_path).map_err(|e| e.to_string())?;

    {
        let mut s = state.storage.lock().map_err(|e| e.to_string())?;
        *s = Some(Box::new(storage));
    }
    {
        let mut p = state.db_path.lock().map_err(|e| e.to_string())?;
        *p = Some(cfg.db_path);
    }

    if let Some(token) = server_config::get_server_token(&context_id) {
        let mut t = state.server_token.lock().map_err(|e| e.to_string())?;
        *t = Some(token);
    }
    {
        let mut u = state.server_url.lock().map_err(|e| e.to_string())?;
        *u = Some(cfg.url);
    }

    if let Some(mp) = server_config::get_server_master_password(&context_id) {
        let mut key = crypto::derive_master_key(&mp).map_err(|e| e.to_string())?;
        let mut cached = state.cached_key.lock().map_err(|e| e.to_string())?;
        *cached = Some(key);
        key.zeroize();

        let mut master = state.master_password.lock().map_err(|e| e.to_string())?;
        *master = Some(mp);
    }

    {
        let mut active = state.active_context.lock().map_err(|e| e.to_string())?;
        *active = context_id;
    }

    Ok(())
}

#[tauri::command]
pub fn get_active_context(state: State<AppState>) -> Result<String, String> {
    let active = state.active_context.lock().map_err(|e| e.to_string())?;
    Ok(active.clone())
}

#[tauri::command]
pub fn srv_auth(
    state: State<AppState>,
    server_id: String,
    email: String,
    password: String,
) -> Result<ServerLoginResult, String> {
    let cfg = server_config::find_server(&server_id)
        .ok_or("Server not found")?;

    let url = format!("{}/api/auth/login", cfg.url.trim_end_matches('/'));
    let client = Client::new();
    let resp = client
        .post(&url)
        .json(&AuthPayload { email, password })
        .send()
        .map_err(|e| format!("Connection failed: {}", e))?;

    if !resp.status().is_success() {
        let text = resp.text().unwrap_or_default();
        return Err(format!("Auth failed: {}", text));
    }

    let body: AuthResponseBody = resp
        .json()
        .map_err(|e| format!("Parse error: {}", e))?;

    server_config::save_server_token(&server_id, &body.token)?;
    server_config::save_server_is_admin(&server_id, body.user.is_admin)?;

    let active = state.active_context.lock().map_err(|e| e.to_string())?;
    if *active == server_id {
        drop(active);
        let mut t = state.server_token.lock().map_err(|e| e.to_string())?;
        *t = Some(body.token.clone());
    }

    Ok(ServerLoginResult {
        token: body.token,
        user_id: body.user.id,
        email: body.user.email,
        is_admin: body.user.is_admin,
    })
}

#[derive(Deserialize)]
#[allow(dead_code)]
struct MeResponse {
    id: i64,
    email: String,
    is_admin: bool,
}

#[tauri::command]
pub fn refresh_server_user(server_id: String) -> Result<bool, String> {
    let cfg = server_config::find_server(&server_id).ok_or("Server not found")?;
    let token = match server_config::get_server_token(&server_id) {
        Some(t) => t,
        None => return Ok(false),
    };

    let client = Client::new();
    let resp = client
        .get(format!("{}/api/auth/me", cfg.url.trim_end_matches('/')))
        .header("Authorization", format!("Bearer {}", token))
        .send();

    match resp {
        Ok(r) if r.status().is_success() => {
            if let Ok(me) = r.json::<MeResponse>() {
                let _ = server_config::save_server_is_admin(&server_id, me.is_admin);
                return Ok(me.is_admin);
            }
        }
        Ok(r) if r.status().as_u16() == 401 => {
            server_config::remove_server_token(&server_id);
            server_config::remove_server_is_admin(&server_id);
        }
        _ => {}
    }

    Ok(server_config::get_server_is_admin(&server_id))
}

#[tauri::command]
pub fn is_server_authenticated(server_id: String) -> bool {
    server_config::get_server_token(&server_id).is_some()
}

#[tauri::command]
pub fn set_server_master_password(
    state: State<AppState>,
    server_id: String,
    password: String,
) -> Result<(), String> {
    let cfg = server_config::find_server(&server_id)
        .ok_or("Server not found")?;

    let storage = LocalStorage::new(&cfg.db_path).map_err(|e| e.to_string())?;

    let token = crypto::create_verification_token(&password).map_err(|e| e.to_string())?;
    storage.set_verification_token(&token).map_err(|e| e.to_string())?;

    server_config::save_server_master_password(&server_id, &password)?;

    let active = state.active_context.lock().map_err(|e| e.to_string())?;
    if *active == server_id {
        drop(active);

        let mut key = crypto::derive_master_key(&password).map_err(|e| e.to_string())?;
        let mut cached = state.cached_key.lock().map_err(|e| e.to_string())?;
        *cached = Some(key);
        key.zeroize();

        let mut mp = state.master_password.lock().map_err(|e| e.to_string())?;
        *mp = Some(password);
    }

    Ok(())
}

#[tauri::command]
pub fn verify_server_master_password(
    state: State<AppState>,
    server_id: String,
    password: String,
) -> Result<bool, String> {
    let cfg = server_config::find_server(&server_id)
        .ok_or("Server not found")?;

    let storage = LocalStorage::new(&cfg.db_path).map_err(|e| e.to_string())?;
    let token = storage
        .get_verification_token()
        .map_err(|e| e.to_string())?
        .ok_or("No master password set for this server")?;

    if !crypto::verify_password(&token, &password) {
        return Ok(false);
    }

    server_config::save_server_master_password(&server_id, &password)?;

    let active = state.active_context.lock().map_err(|e| e.to_string())?;
    if *active == server_id {
        drop(active);

        let mut key = crypto::derive_master_key(&password).map_err(|e| e.to_string())?;
        let mut cached = state.cached_key.lock().map_err(|e| e.to_string())?;
        *cached = Some(key);
        key.zeroize();

        let mut mp = state.master_password.lock().map_err(|e| e.to_string())?;
        *mp = Some(password);
    }

    Ok(true)
}

#[tauri::command]
pub fn srv_logout(state: State<AppState>, server_id: String) -> Result<(), String> {
    server_config::remove_server_token(&server_id);
    server_config::remove_server_is_admin(&server_id);

    let active = state.active_context.lock().map_err(|e| e.to_string())?;
    if *active == server_id {
        drop(active);
        let mut t = state.server_token.lock().map_err(|e| e.to_string())?;
        *t = None;
    }

    Ok(())
}

// --- Admin commands ---

#[derive(Debug, Serialize, Deserialize)]
pub struct AdminUser {
    pub id: i64,
    pub email: String,
    pub is_admin: bool,
    pub created_at: String,
}

#[derive(Serialize)]
struct AdminCreatePayload {
    email: String,
    password: String,
    is_admin: bool,
}

#[derive(Serialize)]
struct AdminUpdatePayload {
    email: String,
    password: String,
    is_admin: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserShare {
    pub id: i64,
    pub project_id: i64,
    pub user_id: i64,
    pub shared_by: i64,
    pub created_at: String,
}

#[derive(Serialize)]
struct SharePayload {
    user_id: i64,
}

fn admin_request(state: &AppState) -> Result<(String, String), String> {
    let url = state
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
    Ok((url, token))
}

#[tauri::command]
pub fn admin_list_users(state: State<AppState>) -> Result<Vec<AdminUser>, String> {
    let (url, token) = admin_request(&state)?;
    let client = Client::new();
    let resp = client
        .get(format!("{}/api/admin/users", url.trim_end_matches('/')))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .map_err(|e| format!("Request failed: {}", e))?;

    if !resp.status().is_success() {
        let text = resp.text().unwrap_or_default();
        return Err(format!("Failed: {}", text));
    }

    resp.json::<Vec<AdminUser>>()
        .map_err(|e| format!("Parse error: {}", e))
}

#[tauri::command]
pub fn admin_create_user(
    state: State<AppState>,
    email: String,
    password: String,
    is_admin: bool,
) -> Result<AdminUser, String> {
    let (url, token) = admin_request(&state)?;
    let client = Client::new();
    let resp = client
        .post(format!("{}/api/admin/users", url.trim_end_matches('/')))
        .header("Authorization", format!("Bearer {}", token))
        .json(&AdminCreatePayload { email, password, is_admin })
        .send()
        .map_err(|e| format!("Request failed: {}", e))?;

    if !resp.status().is_success() {
        let text = resp.text().unwrap_or_default();
        return Err(format!("Failed: {}", text));
    }

    resp.json::<AdminUser>()
        .map_err(|e| format!("Parse error: {}", e))
}

#[tauri::command]
pub fn admin_update_user(
    state: State<AppState>,
    user_id: i64,
    email: String,
    password: String,
    is_admin: bool,
) -> Result<(), String> {
    let (url, token) = admin_request(&state)?;
    let client = Client::new();
    let resp = client
        .put(format!("{}/api/admin/users/{}", url.trim_end_matches('/'), user_id))
        .header("Authorization", format!("Bearer {}", token))
        .json(&AdminUpdatePayload { email, password, is_admin })
        .send()
        .map_err(|e| format!("Request failed: {}", e))?;

    if !resp.status().is_success() {
        let text = resp.text().unwrap_or_default();
        return Err(format!("Failed: {}", text));
    }
    Ok(())
}

#[tauri::command]
pub fn admin_list_user_shares(state: State<AppState>, user_id: i64) -> Result<Vec<UserShare>, String> {
    let (url, token) = admin_request(&state)?;
    let client = Client::new();
    let resp = client
        .get(format!("{}/api/admin/users/{}/shares", url.trim_end_matches('/'), user_id))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .map_err(|e| format!("Request failed: {}", e))?;

    if !resp.status().is_success() {
        let text = resp.text().unwrap_or_default();
        return Err(format!("Failed: {}", text));
    }

    resp.json::<Vec<UserShare>>()
        .map_err(|e| format!("Parse error: {}", e))
}

#[tauri::command]
pub fn admin_delete_user(state: State<AppState>, user_id: i64) -> Result<(), String> {
    let (url, token) = admin_request(&state)?;
    let client = Client::new();
    let resp = client
        .delete(format!("{}/api/admin/users/{}", url.trim_end_matches('/'), user_id))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .map_err(|e| format!("Request failed: {}", e))?;

    if !resp.status().is_success() {
        let text = resp.text().unwrap_or_default();
        return Err(format!("Failed: {}", text));
    }
    Ok(())
}

#[tauri::command]
pub fn share_project(
    state: State<AppState>,
    project_id: i64,
    user_id: i64,
) -> Result<(), String> {
    let (url, token) = admin_request(&state)?;
    let client = Client::new();
    let resp = client
        .post(format!(
            "{}/api/projects/{}/share",
            url.trim_end_matches('/'),
            project_id
        ))
        .header("Authorization", format!("Bearer {}", token))
        .json(&SharePayload { user_id })
        .send()
        .map_err(|e| format!("Request failed: {}", e))?;

    if !resp.status().is_success() {
        let text = resp.text().unwrap_or_default();
        return Err(format!("Failed: {}", text));
    }
    Ok(())
}

#[tauri::command]
pub fn unshare_project(
    state: State<AppState>,
    project_id: i64,
    user_id: i64,
) -> Result<(), String> {
    let (url, token) = admin_request(&state)?;
    let client = Client::new();
    let resp = client
        .delete(format!(
            "{}/api/projects/{}/share/{}",
            url.trim_end_matches('/'),
            project_id,
            user_id
        ))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .map_err(|e| format!("Request failed: {}", e))?;

    if !resp.status().is_success() {
        let text = resp.text().unwrap_or_default();
        return Err(format!("Failed: {}", text));
    }
    Ok(())
}

#[tauri::command]
pub fn change_server_master_password(
    state: State<AppState>,
    server_id: String,
    current_password: String,
    new_password: String,
) -> Result<u32, String> {
    let cfg = server_config::find_server(&server_id).ok_or("Server not found")?;
    let storage = LocalStorage::new(&cfg.db_path).map_err(|e| e.to_string())?;

    let token = storage
        .get_verification_token()
        .map_err(|e| e.to_string())?
        .ok_or("No master password set for this server")?;

    if !crypto::verify_password(&token, &current_password) {
        return Err("wrong_password".to_string());
    }

    if current_password == new_password {
        return Err("same_password".to_string());
    }

    let old_key = crypto::derive_master_key(&current_password).map_err(|e| e.to_string())?;
    let new_key = crypto::derive_master_key(&new_password).map_err(|e| e.to_string())?;

    let count = super::settings::reencrypt_storage(&storage, &old_key, &new_key)?;

    let new_token =
        crypto::create_verification_token(&new_password).map_err(|e| e.to_string())?;
    storage
        .set_verification_token(&new_token)
        .map_err(|e| e.to_string())?;

    server_config::save_server_master_password(&server_id, &new_password)?;

    let active = state.active_context.lock().map_err(|e| e.to_string())?;
    if *active == server_id {
        drop(active);

        let mut cached = state.cached_key.lock().map_err(|e| e.to_string())?;
        *cached = Some(new_key);

        let mut mp = state.master_password.lock().map_err(|e| e.to_string())?;
        *mp = Some(new_password);
    }

    Ok(count)
}

#[derive(Serialize)]
struct UpdateProfilePayload {
    current_password: String,
    email: String,
    new_password: String,
}

#[tauri::command]
pub fn srv_update_profile(
    _state: State<AppState>,
    server_id: String,
    current_password: String,
    new_email: String,
    new_password: String,
) -> Result<(), String> {
    let cfg = server_config::find_server(&server_id)
        .ok_or("Server not found")?;
    let token = server_config::get_server_token(&server_id)
        .ok_or("Not authenticated")?;

    let client = Client::new();
    let resp = client
        .put(format!("{}/api/users/me", cfg.url.trim_end_matches('/')))
        .header("Authorization", format!("Bearer {}", token))
        .json(&UpdateProfilePayload {
            current_password,
            email: new_email,
            new_password,
        })
        .send()
        .map_err(|e| format!("Request failed: {}", e))?;

    if !resp.status().is_success() {
        let text = resp.text().unwrap_or_default();
        return Err(format!("Failed: {}", text));
    }
    Ok(())
}
