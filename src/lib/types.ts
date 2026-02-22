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

export type AppView = "loading" | "init" | "master-password-setup" | "pin-setup" | "pin-unlock" | "unlock" | "main";
export type ThemeMode = "system" | "light" | "dark";
