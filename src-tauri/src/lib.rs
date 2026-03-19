// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

mod backup;
mod commands;
mod crypto;
mod keychain;
mod models;
pub mod password_registry;
pub mod server_config;
mod storage;

use std::sync::Mutex;
use storage::StorageProvider;
use storage::local::LocalStorage;
use tauri::Emitter;
use tauri::Manager;
use tauri::menu::{MenuBuilder, SubmenuBuilder, MenuItem, PredefinedMenuItem};

#[derive(Clone, serde::Serialize)]
struct DeepLinkAddServer {
    name: String,
    url: String,
}

fn parse_and_emit_deep_link(app: &tauri::AppHandle, urls: Vec<url::Url>) {
    for u in urls {
        if u.host_str() == Some("add-server") || u.path().trim_start_matches('/') == "add-server" {
            let mut name = String::new();
            let mut server_url = String::new();
            for (k, v) in u.query_pairs() {
                match k.as_ref() {
                    "name" => name = v.to_string(),
                    "url" => server_url = v.to_string(),
                    _ => {}
                }
            }
            if !server_url.is_empty() {
                let _ = app.emit("deep-link-add-server", DeepLinkAddServer { name, url: server_url });
            }
        }
    }
}

pub struct AppState {
    pub storage: Mutex<Option<Box<dyn StorageProvider>>>,
    pub db_path: Mutex<Option<String>>,
    pub server_token: Mutex<Option<String>>,
    pub server_url: Mutex<Option<String>>,
    pub cached_key: Mutex<Option<[u8; crypto::KEY_LEN]>>,
    pub master_password: Mutex<Option<String>>,
    pub active_context: Mutex<String>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
            let urls: Vec<url::Url> = argv.iter().filter_map(|a| url::Url::parse(a).ok()).collect();
            if !urls.is_empty() {
                parse_and_emit_deep_link(app, urls);
            }
        }));
    }

    builder
        .plugin(tauri_plugin_deep_link::init())
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
                .item(&MenuItem::with_id(handle, "new-project", "New File", true, Some("CmdOrCtrl+N"))?)
                .separator()
                .item(&MenuItem::with_id(handle, "add-server", "Add Server\u{2026}", true, None::<&str>)?)
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

            let menu = MenuBuilder::new(handle)
                .item(&app_submenu)
                .item(&file_submenu)
                .item(&edit_submenu)
                .build()?;

            app.set_menu(menu)?;

            #[cfg(desktop)]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                let _ = app.deep_link().register("vaultpad");
            }

            if let Some(db_path) = keychain::get("db-path") {
                if let Ok(storage) = LocalStorage::new(&db_path) {
                    let state = app.state::<AppState>();
                    if let Ok(mut guard) = state.storage.lock() {
                        *guard = Some(Box::new(storage));
                    }
                    if let Ok(mut path_guard) = state.db_path.lock() {
                        *path_guard = Some(db_path);
                    };
                }
            }

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
            active_context: Mutex::new("local".to_string()),
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
            commands::projects::reorder_projects,
            commands::projects::get_project_password,
            commands::projects::import_password_registry,
            commands::projects::get_password_registry,
            commands::auth::server_login,
            commands::auth::server_logout,
            commands::auth::is_server_connected,
            commands::sync::sync_projects,
            commands::sync::sync_push,
            commands::sync::check_remote_changes,
            commands::sync::sync_pull_changed,
            commands::sync::resolve_conflict,
            commands::servers::list_servers,
            commands::servers::add_server,
            commands::servers::remove_server,
            commands::servers::switch_context,
            commands::servers::get_active_context,
            commands::servers::srv_auth,
            commands::servers::refresh_server_user,
            commands::servers::is_server_authenticated,
            commands::servers::set_server_master_password,
            commands::servers::verify_server_master_password,
            commands::servers::srv_logout,
            commands::servers::admin_list_users,
            commands::servers::admin_create_user,
            commands::servers::admin_update_user,
            commands::servers::admin_delete_user,
            commands::servers::admin_list_user_shares,
            commands::servers::share_project,
            commands::servers::unshare_project,
            commands::settings::setup_pin,
            commands::settings::verify_pin,
            commands::settings::has_saved_session,
            commands::settings::has_pin,
            commands::settings::get_saved_db_path,
            commands::settings::get_saved_master_password,
            commands::settings::clear_saved_session,
            commands::settings::change_pin,
            commands::settings::remove_pin,
            commands::settings::init_new_database,
            commands::settings::get_db_folder,
            commands::settings::change_db_folder,
            commands::settings::change_master_password,
            commands::settings::get_default_db_folder,
            commands::servers::change_server_master_password,
            commands::servers::srv_update_profile,
            commands::backups::list_project_backups,
            commands::backups::get_backup_content,
            commands::backups::restore_backup,
            commands::backups::delete_backup_cmd,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
