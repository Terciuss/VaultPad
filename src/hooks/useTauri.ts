// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

import { useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { DecryptedProject, ProjectListItem } from "../lib/types";

export function useTauri() {
  return useMemo(() => ({
    initDatabase: (dbPath: string) =>
      invoke<void>("init_database", { dbPath }),

    isDatabaseInitialized: () => invoke<boolean>("is_database_initialized"),

    hasMasterPassword: () => invoke<boolean>("has_master_password"),

    setMasterPassword: (password: string) =>
      invoke<void>("set_master_password", { password }),

    verifyMasterPassword: (password: string) =>
      invoke<boolean>("verify_master_password", { password }),

    getDbPath: () => invoke<string | null>("get_db_path"),

    getSetting: (key: string) =>
      invoke<string | null>("get_setting", { key }),

    setSetting: (key: string, value: string) =>
      invoke<void>("set_setting", { key, value }),

    listProjects: () =>
      invoke<ProjectListItem[]>("list_projects"),

    getProject: (id: string, password: string) =>
      invoke<DecryptedProject>("get_project", { id, password }),

    createProject: (
      name: string,
      content: string,
      password: string,
      hasCustomPassword: boolean
    ) =>
      invoke<string>("create_project", {
        name,
        content,
        password,
        hasCustomPassword,
      }),

    updateProject: (
      id: string,
      name: string,
      content: string,
      password: string,
      hasCustomPassword: boolean
    ) =>
      invoke<void>("update_project", {
        id,
        name,
        content,
        password,
        hasCustomPassword,
      }),

    deleteProject: (id: string) => invoke<void>("delete_project", { id }),

    getProjectPassword: (id: string) =>
      invoke<string | null>("get_project_password", { id }),

    serverLogin: (serverUrl: string, email: string, password: string) =>
      invoke<{ token: string; user_id: number; email: string }>(
        "server_login",
        { serverUrl, email, password }
      ),

    serverRegister: (serverUrl: string, email: string, password: string) =>
      invoke<{ token: string; user_id: number; email: string }>(
        "server_register",
        { serverUrl, email, password }
      ),

    serverLogout: () => invoke<void>("server_logout"),

    isServerConnected: () => invoke<boolean>("is_server_connected"),

    syncProjects: () => invoke<string>("sync_projects"),

    setupPin: (pin: string, masterPassword: string) =>
      invoke<void>("setup_pin", { pin, masterPassword }),

    verifyPin: (pin: string) => invoke<string>("verify_pin", { pin }),

    hasSavedSession: () => invoke<boolean>("has_saved_session"),

    hasPin: () => invoke<boolean>("has_pin"),

    getSavedDbPath: () => invoke<string | null>("get_saved_db_path"),

    getSavedMasterPassword: () => invoke<string | null>("get_saved_master_password"),

    clearSavedSession: () => invoke<void>("clear_saved_session"),

    changePin: (oldPin: string, newPin: string) =>
      invoke<void>("change_pin", { oldPin, newPin }),

    removePin: () => invoke<void>("remove_pin"),

    cacheMasterKey: (password: string) =>
      invoke<void>("cache_master_key", { password }),

    clearCachedKey: () => invoke<void>("clear_cached_key"),
  }), []);
}
