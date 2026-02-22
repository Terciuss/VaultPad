// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::AppState;

#[derive(Serialize)]
struct AuthPayload {
    email: String,
    password: String,
}

#[derive(Deserialize)]
struct AuthUser {
    id: i64,
    email: String,
}

#[derive(Deserialize)]
struct AuthResponseBody {
    token: String,
    user: AuthUser,
}

#[derive(Serialize, Clone)]
pub struct LoginResult {
    pub token: String,
    pub user_id: i64,
    pub email: String,
}

fn send_auth_request(url: &str, email: String, password: String) -> Result<AuthResponseBody, String> {
    let client = Client::new();
    let resp = client
        .post(url)
        .json(&AuthPayload { email, password })
        .send()
        .map_err(|e| format!("Connection failed: {}", e))?;

    if !resp.status().is_success() {
        let text = resp.text().unwrap_or_default();
        return Err(format!("Request failed: {}", text));
    }

    resp.json::<AuthResponseBody>()
        .map_err(|e| format!("Parse error: {}", e))
}

#[tauri::command]
pub fn server_login(
    state: State<AppState>,
    server_url: String,
    email: String,
    password: String,
) -> Result<LoginResult, String> {
    let url = format!("{}/api/auth/login", server_url.trim_end_matches('/'));
    let body = send_auth_request(&url, email, password)?;

    let result = LoginResult {
        token: body.token.clone(),
        user_id: body.user.id,
        email: body.user.email,
    };

    let mut token_guard = state.server_token.lock().map_err(|e| e.to_string())?;
    *token_guard = Some(body.token);

    let mut url_guard = state.server_url.lock().map_err(|e| e.to_string())?;
    *url_guard = Some(server_url);

    Ok(result)
}

#[tauri::command]
pub fn server_register(
    server_url: String,
    email: String,
    password: String,
) -> Result<LoginResult, String> {
    let url = format!("{}/api/auth/register", server_url.trim_end_matches('/'));
    let body = send_auth_request(&url, email, password)?;

    Ok(LoginResult {
        token: body.token,
        user_id: body.user.id,
        email: body.user.email,
    })
}

#[tauri::command]
pub fn server_logout(state: State<AppState>) -> Result<(), String> {
    let mut token = state.server_token.lock().map_err(|e| e.to_string())?;
    *token = None;
    let mut url = state.server_url.lock().map_err(|e| e.to_string())?;
    *url = None;
    Ok(())
}

#[tauri::command]
pub fn is_server_connected(state: State<AppState>) -> bool {
    state
        .server_token
        .lock()
        .map(|t| t.is_some())
        .unwrap_or(false)
}
