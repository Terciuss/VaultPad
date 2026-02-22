// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

use keyring::Entry;

const SERVICE: &str = "vaultpad";

fn entry(key: &str) -> Result<Entry, String> {
    Entry::new(SERVICE, key).map_err(|e| format!("Keychain error: {e}"))
}

pub fn save(key: &str, value: &str) -> Result<(), String> {
    entry(key)?
        .set_password(value)
        .map_err(|e| format!("Keychain save error: {e}"))
}

pub fn get(key: &str) -> Option<String> {
    entry(key).ok()?.get_password().ok()
}

pub fn remove(key: &str) {
    if let Ok(e) = entry(key) {
        let _ = e.delete_credential();
    }
}
