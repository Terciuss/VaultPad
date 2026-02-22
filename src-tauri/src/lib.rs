// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

mod commands;
mod crypto;
mod keychain;
mod models;
mod storage;

use std::sync::Mutex;
use storage::StorageProvider;
use tauri::Emitter;
use tauri::menu::{MenuBuilder, SubmenuBuilder, MenuItem, PredefinedMenuItem};

pub struct AppState {
    pub storage: Mutex<Option<Box<dyn StorageProvider>>>,
    pub db_path: Mutex<Option<String>>,
    pub server_token: Mutex<Option<String>>,
    pub server_url: Mutex<Option<String>>,
    pub cached_key: Mutex<Option<[u8; crypto::KEY_LEN]>>,
    pub master_password: Mutex<Option<String>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle();

            let app_submenu = SubmenuBuilder::new(handle, "VaultPad")
                .item(&PredefinedMenuItem::about(handle, Some("About VaultPad"), None)?)
                .separator()
                .item(&MenuItem::with_id(handle, "settings", "Settings\u{2026}", true, Some("CmdOrCtrl+,"))?)
                .item(&MenuItem::with_id(handle, "lock", "Lock Now", true, Some("CmdOrCtrl+L"))?)
                .separator()
                .item(&PredefinedMenuItem::quit(handle, Some("Quit VaultPad"))?)
                .build()?;

            let file_submenu = SubmenuBuilder::new(handle, "File")
                .item(&MenuItem::with_id(handle, "new-project", "New Project", true, Some("CmdOrCtrl+N"))?)
                .build()?;

            let edit_submenu = SubmenuBuilder::new(handle, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;

            let server_submenu = SubmenuBuilder::new(handle, "Server")
                .item(&MenuItem::with_id(handle, "server-connect", "Connect\u{2026}", true, None::<&str>)?)
                .build()?;

            let menu = MenuBuilder::new(handle)
                .item(&app_submenu)
                .item(&file_submenu)
                .item(&edit_submenu)
                .item(&server_submenu)
                .build()?;

            app.set_menu(menu)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            let _ = app.emit("menu-action", event.id.0.as_str());
        })
        .manage(AppState {
            storage: Mutex::new(None),
            db_path: Mutex::new(None),
            server_token: Mutex::new(None),
            server_url: Mutex::new(None),
            cached_key: Mutex::new(None),
            master_password: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            commands::settings::init_database,
            commands::settings::has_master_password,
            commands::settings::set_master_password,
            commands::settings::verify_master_password,
            commands::settings::get_db_path,
            commands::settings::get_setting,
            commands::settings::set_setting,
            commands::settings::is_database_initialized,
            commands::settings::cache_master_key,
            commands::settings::clear_cached_key,
            commands::projects::list_projects,
            commands::projects::get_project,
            commands::projects::create_project,
            commands::projects::update_project,
            commands::projects::delete_project,
            commands::projects::get_project_password,
            commands::auth::server_login,
            commands::auth::server_register,
            commands::auth::server_logout,
            commands::auth::is_server_connected,
            commands::sync::sync_projects,
            commands::settings::setup_pin,
            commands::settings::verify_pin,
            commands::settings::has_saved_session,
            commands::settings::has_pin,
            commands::settings::get_saved_db_path,
            commands::settings::get_saved_master_password,
            commands::settings::clear_saved_session,
            commands::settings::change_pin,
            commands::settings::remove_pin,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
