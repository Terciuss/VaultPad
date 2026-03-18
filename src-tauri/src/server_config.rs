// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

use serde::{Deserialize, Serialize};

use crate::keychain;

const KC_SERVERS: &str = "servers";

fn srv_key(server_id: &str, suffix: &str) -> String {
    format!("srv-{}-{}", server_id, suffix)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub id: String,
    pub name: String,
    pub url: String,
    pub db_path: String,
}

pub fn list_servers() -> Vec<ServerConfig> {
    keychain::get(KC_SERVERS)
        .and_then(|json| serde_json::from_str::<Vec<ServerConfig>>(&json).ok())
        .unwrap_or_default()
}

pub fn save_servers(servers: &[ServerConfig]) -> Result<(), String> {
    let json = serde_json::to_string(servers).map_err(|e| format!("Serialize error: {e}"))?;
    keychain::save(KC_SERVERS, &json)
}

pub fn find_server(server_id: &str) -> Option<ServerConfig> {
    list_servers().into_iter().find(|s| s.id == server_id)
}

pub fn add_server(config: ServerConfig) -> Result<(), String> {
    let mut servers = list_servers();
    if servers.iter().any(|s| s.id == config.id) {
        return Err("Server with this ID already exists".to_string());
    }
    servers.push(config);
    save_servers(&servers)
}

pub fn remove_server(server_id: &str) -> Result<(), String> {
    let mut servers = list_servers();
    let len_before = servers.len();
    servers.retain(|s| s.id != server_id);
    if servers.len() == len_before {
        return Err("Server not found".to_string());
    }
    save_servers(&servers)?;

    keychain::remove(&srv_key(server_id, "token"));
    keychain::remove(&srv_key(server_id, "master-password"));
    keychain::remove(&srv_key(server_id, "pin-hash"));
    keychain::remove(&srv_key(server_id, "is-admin"));

    Ok(())
}

pub fn get_server_token(server_id: &str) -> Option<String> {
    keychain::get(&srv_key(server_id, "token"))
}

pub fn save_server_token(server_id: &str, token: &str) -> Result<(), String> {
    keychain::save(&srv_key(server_id, "token"), token)
}

pub fn remove_server_token(server_id: &str) {
    keychain::remove(&srv_key(server_id, "token"));
}

pub fn get_server_master_password(server_id: &str) -> Option<String> {
    keychain::get(&srv_key(server_id, "master-password"))
}

pub fn save_server_master_password(server_id: &str, password: &str) -> Result<(), String> {
    keychain::save(&srv_key(server_id, "master-password"), password)
}

pub fn get_server_pin_hash(server_id: &str) -> Option<String> {
    keychain::get(&srv_key(server_id, "pin-hash"))
}

pub fn save_server_pin_hash(server_id: &str, hash: &str) -> Result<(), String> {
    keychain::save(&srv_key(server_id, "pin-hash"), hash)
}

pub fn remove_server_pin_hash(server_id: &str) {
    keychain::remove(&srv_key(server_id, "pin-hash"));
}

pub fn get_server_is_admin(server_id: &str) -> bool {
    keychain::get(&srv_key(server_id, "is-admin"))
        .map(|v| v == "true")
        .unwrap_or(false)
}

pub fn save_server_is_admin(server_id: &str, is_admin: bool) -> Result<(), String> {
    keychain::save(&srv_key(server_id, "is-admin"), if is_admin { "true" } else { "false" })
}

pub fn remove_server_is_admin(server_id: &str) {
    keychain::remove(&srv_key(server_id, "is-admin"));
}
