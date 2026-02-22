// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

use keyring::Entry;
use std::collections::HashMap;
use std::sync::Mutex;

const SERVICE: &str = "vaultpad";
const ACCOUNT: &str = "vaultpad-data";

static CACHE: Mutex<Option<HashMap<String, String>>> = Mutex::new(None);

fn entry() -> Result<Entry, String> {
    Entry::new(SERVICE, ACCOUNT).map_err(|e| format!("Keychain error: {e}"))
}

fn ensure_loaded(cache: &mut Option<HashMap<String, String>>) {
    if cache.is_some() {
        return;
    }
    let data = entry()
        .ok()
        .and_then(|e| e.get_password().ok())
        .and_then(|json| serde_json::from_str::<HashMap<String, String>>(&json).ok())
        .unwrap_or_default();
    *cache = Some(data);
}

fn write_to_keychain(data: &HashMap<String, String>) -> Result<(), String> {
    if data.is_empty() {
        if let Ok(e) = entry() {
            let _ = e.delete_credential();
        }
    } else {
        let json = serde_json::to_string(data).map_err(|e| format!("Serialize error: {e}"))?;
        entry()?
            .set_password(&json)
            .map_err(|e| format!("Keychain save error: {e}"))?;
    }
    Ok(())
}

pub fn save(key: &str, value: &str) -> Result<(), String> {
    let mut guard = CACHE.lock().unwrap_or_else(|e| e.into_inner());
    ensure_loaded(&mut *guard);
    let data = guard.as_mut().unwrap();
    let old = data.insert(key.to_string(), value.to_string());
    if let Err(e) = write_to_keychain(data) {
        match old {
            Some(v) => { data.insert(key.to_string(), v); }
            None => { data.remove(key); }
        }
        return Err(e);
    }
    Ok(())
}

pub fn get(key: &str) -> Option<String> {
    let mut guard = CACHE.lock().unwrap_or_else(|e| e.into_inner());
    ensure_loaded(&mut *guard);
    guard.as_ref().unwrap().get(key).cloned()
}

pub fn remove(key: &str) {
    let mut guard = CACHE.lock().unwrap_or_else(|e| e.into_inner());
    ensure_loaded(&mut *guard);
    let data = guard.as_mut().unwrap();
    if let Some(old_val) = data.remove(key) {
        if write_to_keychain(data).is_err() {
            data.insert(key.to_string(), old_val);
        }
    }
}
