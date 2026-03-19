// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

import { useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { BackupContent, BackupListItem, DecryptedProject, PasswordRegistryEntry, ProjectListItem, RemoteChangedInfo, ServerInfo, SyncPullResult, SyncPushResult, SyncResult } from "../lib/types";

export function useTauri() {
  return useMemo(() => ({
    initDatabase: (dbPath: string) =>
      invoke<void>("init_database", { dbPath }),

    initNewDatabase: (dbPath: string) =>
      invoke<void>("init_new_database", { dbPath }),

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

    reorderProjects: (ids: string[]) =>
      invoke<void>("reorder_projects", { ids }),

    getProjectPassword: (id: string) =>
      invoke<string | null>("get_project_password", { id }),

    serverLogin: (serverUrl: string, email: string, password: string) =>
      invoke<{ token: string; user_id: number; email: string }>(
        "server_login",
        { serverUrl, email, password }
      ),

    serverLogout: () => invoke<void>("server_logout"),

    isServerConnected: () => invoke<boolean>("is_server_connected"),

    syncProjects: () => invoke<SyncResult>("sync_projects"),

    syncPush: () => invoke<SyncPushResult>("sync_push"),

    checkRemoteChanges: () => invoke<RemoteChangedInfo[]>("check_remote_changes"),

    syncPullChanged: (changedIds: string[]) =>
      invoke<SyncPullResult>("sync_pull_changed", { changedIds }),

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

    listServers: () =>
      invoke<ServerInfo[]>("list_servers"),

    addServer: (name: string, url: string, dbFolder: string) =>
      invoke<ServerInfo>("add_server", { name, url, dbFolder }),

    removeServer: (serverId: string) =>
      invoke<void>("remove_server", { serverId }),

    switchContext: (contextId: string) =>
      invoke<void>("switch_context", { contextId }),

    getActiveContext: () =>
      invoke<string>("get_active_context"),

    srvAuth: (serverId: string, email: string, password: string) =>
      invoke<{ token: string; user_id: number; email: string; is_admin: boolean }>(
        "srv_auth",
        { serverId, email, password }
      ),

    refreshServerUser: (serverId: string) =>
      invoke<boolean>("refresh_server_user", { serverId }),

    srvLogout: (serverId: string) =>
      invoke<void>("srv_logout", { serverId }),

    isServerAuthenticated: (serverId: string) =>
      invoke<boolean>("is_server_authenticated", { serverId }),

    setServerMasterPassword: (serverId: string, password: string) =>
      invoke<void>("set_server_master_password", { serverId, password }),

    verifyServerMasterPassword: (serverId: string, password: string) =>
      invoke<boolean>("verify_server_master_password", { serverId, password }),

    resolveConflict: (
      projectId: string,
      resolution: string,
      mergedName?: string,
      mergedContent?: string,
      password?: string
    ) =>
      invoke<void>("resolve_conflict", {
        projectId,
        resolution,
        mergedName: mergedName ?? null,
        mergedContent: mergedContent ?? null,
        password: password ?? "",
      }),

    adminListUsers: () =>
      invoke<AdminUser[]>("admin_list_users"),

    adminCreateUser: (email: string, password: string, isAdmin: boolean) =>
      invoke<AdminUser>("admin_create_user", { email, password, isAdmin }),

    adminUpdateUser: (userId: number, email: string, password: string, isAdmin: boolean) =>
      invoke<void>("admin_update_user", { userId, email, password, isAdmin }),

    adminDeleteUser: (userId: number) =>
      invoke<void>("admin_delete_user", { userId }),

    adminListUserShares: (userId: number) =>
      invoke<UserShare[]>("admin_list_user_shares", { userId }),

    shareProject: (projectId: number, userId: number) =>
      invoke<void>("share_project", { projectId, userId }),

    unshareProject: (projectId: number, userId: number) =>
      invoke<void>("unshare_project", { projectId, userId }),

    listProjectBackups: (projectId: string) =>
      invoke<BackupListItem[]>("list_project_backups", { projectId }),

    getBackupContent: (backupId: string, password: string) =>
      invoke<BackupContent>("get_backup_content", { backupId, password }),

    restoreBackup: (backupId: string, password: string) =>
      invoke<void>("restore_backup", { backupId, password }),

    deleteBackup: (backupId: string) =>
      invoke<void>("delete_backup_cmd", { backupId }),

    getDbFolder: () => invoke<string | null>("get_db_folder"),

    changeDbFolder: (newFolder: string) =>
      invoke<string | null>("change_db_folder", { newFolder }),

    importPasswordRegistry: () =>
      invoke<number>("import_password_registry"),

    getPasswordRegistry: () =>
      invoke<PasswordRegistryEntry[]>("get_password_registry"),

    changeMasterPassword: (currentPassword: string, newPassword: string) =>
      invoke<number>("change_master_password", { currentPassword, newPassword }),

    changeServerMasterPassword: (serverId: string, currentPassword: string, newPassword: string) =>
      invoke<number>("change_server_master_password", { serverId, currentPassword, newPassword }),

    srvUpdateProfile: (serverId: string, currentPassword: string, newEmail: string, newPassword: string) =>
      invoke<void>("srv_update_profile", { serverId, currentPassword, newEmail, newPassword }),

    getDefaultDbFolder: () =>
      invoke<string>("get_default_db_folder"),
    initDefaultDatabase: (dbPath: string) =>
      invoke<void>("init_default_database", { dbPath }),

    openLocalDatabase: (dbPath: string) =>
      invoke<void>("open_local_database", { dbPath }),
  }), []);
}

export interface AdminUser {
  id: number;
  email: string;
  is_admin: boolean;
  created_at: string;
}

export interface UserShare {
  id: number;
  project_id: number;
  user_id: number;
  shared_by: number;
  created_at: string;
}
