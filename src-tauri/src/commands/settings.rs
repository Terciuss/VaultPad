// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

use base64::Engine;
use tauri::State;
use zeroize::Zeroize;

use crate::crypto;
use crate::keychain;
use crate::storage::local::LocalStorage;
use crate::AppState;

const KC_DB_PATH: &str = "db-path";
const KC_MASTER_PASSWORD: &str = "master-password";
const KC_PIN_HASH: &str = "pin-hash";

#[tauri::command]
pub fn init_database(state: State<AppState>, db_path: String) -> Result<(), String> {
    let storage = LocalStorage::new(&db_path).map_err(|e| e.to_string())?;
    let mut guard = state.storage.lock().map_err(|e| e.to_string())?;
    *guard = Some(Box::new(storage));

    let mut path_guard = state.db_path.lock().map_err(|e| e.to_string())?;
    *path_guard = Some(db_path);

    Ok(())
}

#[tauri::command]
pub fn has_master_password(state: State<AppState>) -> Result<bool, String> {
    let storage = state.storage.lock().map_err(|e| e.to_string())?;
    let storage = storage.as_ref().ok_or("Database not initialized")?;
    let token = storage.get_verification_token().map_err(|e| e.to_string())?;
    Ok(token.is_some())
}

#[tauri::command]
pub fn set_master_password(state: State<AppState>, password: String) -> Result<(), String> {
    let storage = state.storage.lock().map_err(|e| e.to_string())?;
    let storage = storage.as_ref().ok_or("Database not initialized")?;

    let existing = storage.get_verification_token().map_err(|e| e.to_string())?;
    if existing.is_some() {
        return Err("Master password already set".to_string());
    }

    let token = crypto::create_verification_token(&password).map_err(|e| e.to_string())?;
    storage.set_verification_token(&token).map_err(|e| e.to_string())?;

    let mut key = crypto::derive_master_key(&password).map_err(|e| e.to_string())?;
    let mut cached = state.cached_key.lock().map_err(|e| e.to_string())?;
    *cached = Some(key);
    key.zeroize();

    let mut mp = state.master_password.lock().map_err(|e| e.to_string())?;
    *mp = Some(password.clone());

    let db_path = state.db_path.lock().map_err(|e| e.to_string())?.clone();
    if let Some(ref path) = db_path {
        keychain::save(KC_DB_PATH, path)?;
    }
    keychain::save(KC_MASTER_PASSWORD, &password)?;

    Ok(())
}

#[tauri::command]
pub fn verify_master_password(state: State<AppState>, password: String) -> Result<bool, String> {
    let token = {
        let guard = state.storage.lock().map_err(|e| e.to_string())?;
        let storage = guard.as_ref().ok_or("Database not initialized")?;
        storage
            .get_verification_token()
            .map_err(|e| e.to_string())?
            .ok_or("No master password set")?
    };

    if !crypto::verify_password(&token, &password) {
        return Ok(false);
    }

    let mut key = crypto::derive_master_key(&password).map_err(|e| e.to_string())?;
    let mut cached = state.cached_key.lock().map_err(|e| e.to_string())?;
    *cached = Some(key);
    key.zeroize();

    let mut mp = state.master_password.lock().map_err(|e| e.to_string())?;
    *mp = Some(password.clone());

    let db_path = state.db_path.lock().map_err(|e| e.to_string())?.clone();
    if let Some(ref path) = db_path {
        keychain::save(KC_DB_PATH, path)?;
    }
    keychain::save(KC_MASTER_PASSWORD, &password)?;

    Ok(true)
}

#[tauri::command]
pub fn cache_master_key(state: State<AppState>, password: String) -> Result<(), String> {
    let mut key = crypto::derive_master_key(&password).map_err(|e| e.to_string())?;
    let mut cached = state.cached_key.lock().map_err(|e| e.to_string())?;
    *cached = Some(key);
    key.zeroize();

    let mut mp = state.master_password.lock().map_err(|e| e.to_string())?;
    *mp = Some(password);
    Ok(())
}

#[tauri::command]
pub fn clear_cached_key(state: State<AppState>) -> Result<(), String> {
    let mut cached = state.cached_key.lock().map_err(|e| e.to_string())?;
    if let Some(ref mut k) = *cached {
        k.zeroize();
    }
    *cached = None;

    let mut mp = state.master_password.lock().map_err(|e| e.to_string())?;
    *mp = None;
    Ok(())
}

#[tauri::command]
pub fn get_db_path(state: State<AppState>) -> Result<Option<String>, String> {
    let path = state.db_path.lock().map_err(|e| e.to_string())?;
    Ok(path.clone())
}

#[tauri::command]
pub fn get_setting(state: State<AppState>, key: String) -> Result<Option<String>, String> {
    let storage = state.storage.lock().map_err(|e| e.to_string())?;
    let storage = storage.as_ref().ok_or("Database not initialized")?;
    storage.get_setting(&key).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_setting(state: State<AppState>, key: String, value: String) -> Result<(), String> {
    let storage = state.storage.lock().map_err(|e| e.to_string())?;
    let storage = storage.as_ref().ok_or("Database not initialized")?;
    storage.set_setting(&key, &value).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn is_database_initialized(state: State<AppState>) -> bool {
    state.storage.lock().map(|s| s.is_some()).unwrap_or(false)
}

#[tauri::command]
pub fn setup_pin(
    state: State<AppState>,
    pin: String,
    master_password: String,
) -> Result<(), String> {
    let pin_token = crypto::create_pin_verification_token(&pin).map_err(|e| e.to_string())?;
    let pin_hash_b64 = base64::engine::general_purpose::STANDARD.encode(&pin_token);

    let db_path = state
        .db_path
        .lock()
        .map_err(|e| e.to_string())?
        .clone()
        .ok_or("No database path")?;

    keychain::save(KC_DB_PATH, &db_path)?;
    keychain::save(KC_MASTER_PASSWORD, &master_password)?;
    keychain::save(KC_PIN_HASH, &pin_hash_b64)?;

    Ok(())
}

#[tauri::command]
pub fn verify_pin(state: State<AppState>, pin: String) -> Result<String, String> {
    let pin_hash_b64 = keychain::get(KC_PIN_HASH).ok_or("No PIN configured")?;
    let pin_hash = base64::engine::general_purpose::STANDARD
        .decode(&pin_hash_b64)
        .map_err(|e| format!("Invalid PIN hash: {e}"))?;

    if !crypto::verify_pin(&pin_hash, &pin) && !crypto::verify_password(&pin_hash, &pin) {
        return Err("invalid_pin".to_string());
    }

    let master_password = keychain::get(KC_MASTER_PASSWORD)
        .ok_or("Master password not found in keychain")?;

    let mut key = crypto::derive_master_key(&master_password).map_err(|e| e.to_string())?;
    let mut cached = state.cached_key.lock().map_err(|e| e.to_string())?;
    *cached = Some(key);
    key.zeroize();

    let mut mp = state.master_password.lock().map_err(|e| e.to_string())?;
    *mp = Some(master_password.clone());

    Ok(master_password)
}

#[tauri::command]
pub fn has_saved_session() -> bool {
    keychain::get(KC_DB_PATH).is_some()
        && keychain::get(KC_MASTER_PASSWORD).is_some()
}

#[tauri::command]
pub fn has_pin() -> bool {
    keychain::get(KC_PIN_HASH).is_some()
}

#[tauri::command]
pub fn get_saved_master_password() -> Option<String> {
    keychain::get(KC_MASTER_PASSWORD)
}

#[tauri::command]
pub fn remove_pin() {
    keychain::remove(KC_PIN_HASH);
}

#[tauri::command]
pub fn get_saved_db_path() -> Option<String> {
    keychain::get(KC_DB_PATH)
}

#[tauri::command]
pub fn clear_saved_session() {
    keychain::remove(KC_DB_PATH);
    keychain::remove(KC_MASTER_PASSWORD);
    keychain::remove(KC_PIN_HASH);
}

#[tauri::command]
pub fn change_pin(old_pin: String, new_pin: String) -> Result<(), String> {
    let pin_hash_b64 = keychain::get(KC_PIN_HASH).ok_or("No PIN configured")?;
    let pin_hash = base64::engine::general_purpose::STANDARD
        .decode(&pin_hash_b64)
        .map_err(|e| format!("Invalid PIN hash: {e}"))?;

    if !crypto::verify_pin(&pin_hash, &old_pin) && !crypto::verify_password(&pin_hash, &old_pin) {
        return Err("invalid_pin".to_string());
    }

    let new_token = crypto::create_pin_verification_token(&new_pin).map_err(|e| e.to_string())?;
    let new_hash_b64 = base64::engine::general_purpose::STANDARD.encode(&new_token);
    keychain::save(KC_PIN_HASH, &new_hash_b64)?;

    Ok(())
}
