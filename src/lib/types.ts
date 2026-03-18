// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

export interface ProjectListItem {
  id: string;
  name: string;
  has_custom_password: boolean;
  password_saved: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  server_id?: string | null;
  sync_status?: string;
  last_synced_at?: string | null;
  is_password_registry: boolean;
}

export interface PasswordRegistryEntry {
  server_id: string | null;
  local_id: string;
  name: string;
  password: string;
}

export interface DecryptedProject {
  id: string;
  name: string;
  content: string;
  has_custom_password: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ServerInfo {
  id: string;
  name: string;
  url: string;
  db_path: string;
  is_authenticated: boolean;
  has_master_password: boolean;
  is_admin: boolean;
}

export interface ConflictInfo {
  project_id: string;
  local_name: string;
  local_content: string;
  remote_name: string;
  remote_content: string;
  local_updated_at: string;
  remote_updated_at: string;
}

export interface SyncResult {
  uploaded: number;
  downloaded: number;
  deleted: number;
  conflicts: ConflictInfo[];
}

export interface SyncPushResult {
  uploaded: number;
  deleted: number;
  conflicts: ConflictInfo[];
}

export interface RemoteChangedInfo {
  server_id: string;
  remote_updated_at: string;
}

export interface SyncPullResult {
  downloaded: number;
  updated: number;
}

export type ServerSyncStatus = "idle" | "syncing" | "error" | "conflict";

export interface BackupListItem {
  id: string;
  project_id: string;
  created_at: string;
  trigger_type: "auto" | "pre_sync";
  content_length: number;
}

export interface BackupContent {
  name: string;
  content: string;
}

export type AppView = "loading" | "init" | "master-password-setup" | "pin-setup" | "pin-unlock" | "unlock" | "main";
export type ThemeMode = "system" | "light" | "dark";
