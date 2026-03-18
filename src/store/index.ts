// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

import { create } from "zustand";
import type {
  AppView,
  DecryptedProject,
  ProjectListItem,
  ServerInfo,
  ServerSyncStatus,
  ThemeMode,
} from "../lib/types";

interface ServerState extends ServerInfo {
  sync_status: ServerSyncStatus;
  sync_error: string | null;
  last_synced_at: string | null;
}

interface AppStore {
  view: AppView;
  setView: (view: AppView) => void;

  masterPassword: string | null;
  setMasterPassword: (password: string | null) => void;

  projects: ProjectListItem[];
  setProjects: (projects: ProjectListItem[]) => void;

  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;

  openProject: DecryptedProject | null;
  setOpenProject: (project: DecryptedProject | null) => void;

  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;

  dbPath: string | null;
  setDbPath: (path: string | null) => void;

  dbFolder: string | null;
  setDbFolder: (folder: string | null) => void;

  lastActivity: number;
  touchActivity: () => void;
  autoLockMinutes: number;
  setAutoLockMinutes: (minutes: number) => void;

  autoSyncEnabled: boolean;
  setAutoSyncEnabled: (v: boolean) => void;

  onboardingShown: boolean;
  setOnboardingShown: (shown: boolean) => void;

  locale: string;
  setLocale: (locale: string) => void;

  hasSavedSession: boolean;
  setHasSavedSession: (v: boolean) => void;

  fontSize: number;
  setFontSize: (size: number) => void;

  wordWrap: boolean;
  setWordWrap: (v: boolean) => void;

  hasPinCode: boolean;
  setHasPinCode: (v: boolean) => void;

  servers: ServerState[];
  setServers: (servers: ServerState[]) => void;
  updateServer: (id: string, partial: Partial<ServerState>) => void;

  activeContextId: string;
  setActiveContextId: (id: string) => void;

  expandedServers: Set<string>;
  toggleServerExpanded: (id: string) => void;

  serversExpanded: boolean;
  setServersExpanded: (v: boolean) => void;

  lock: () => void;
}

export const useAppStore = create<AppStore>((set) => ({
  view: "loading",
  setView: (view) => set({ view }),

  masterPassword: null,
  setMasterPassword: (password) => set({ masterPassword: password }),

  projects: [],
  setProjects: (projects) => set({ projects }),

  selectedProjectId: null,
  setSelectedProjectId: (id) => set({ selectedProjectId: id }),

  openProject: null,
  setOpenProject: (project) => set({ openProject: project }),

  theme: "system",
  setTheme: (theme) => set({ theme }),

  dbPath: null,
  setDbPath: (path) => set({ dbPath: path }),

  dbFolder: null,
  setDbFolder: (folder) => set({ dbFolder: folder }),

  lastActivity: Date.now(),
  touchActivity: () => set({ lastActivity: Date.now() }),
  autoLockMinutes: (() => {
    const v = parseInt(localStorage.getItem("vaultpad-auto-lock-minutes") || "", 10);
    return [0, 1, 5, 15, 30, 60].includes(v) ? v : 5;
  })(),
  setAutoLockMinutes: (minutes) => {
    localStorage.setItem("vaultpad-auto-lock-minutes", String(minutes));
    set({ autoLockMinutes: minutes });
  },

  autoSyncEnabled: localStorage.getItem("vaultpad-auto-sync") !== "false",
  setAutoSyncEnabled: (v) => {
    localStorage.setItem("vaultpad-auto-sync", String(v));
    set({ autoSyncEnabled: v });
  },

  onboardingShown: false,
  setOnboardingShown: (shown) => set({ onboardingShown: shown }),

  locale: localStorage.getItem("vaultpad-locale") || (navigator.language.startsWith("ru") ? "ru" : "en"),
  setLocale: (locale) => {
    localStorage.setItem("vaultpad-locale", locale);
    set({ locale });
  },

  fontSize: (() => {
    const v = parseInt(localStorage.getItem("vaultpad-font-size") || "", 10);
    return v >= 6 && v <= 24 ? v : 14;
  })(),
  setFontSize: (size) => {
    localStorage.setItem("vaultpad-font-size", String(size));
    set({ fontSize: size });
  },

  wordWrap: localStorage.getItem("vaultpad-word-wrap") !== "false",
  setWordWrap: (v) => {
    localStorage.setItem("vaultpad-word-wrap", String(v));
    set({ wordWrap: v });
  },

  hasSavedSession: false,
  setHasSavedSession: (v) => set({ hasSavedSession: v }),

  hasPinCode: false,
  setHasPinCode: (v) => set({ hasPinCode: v }),

  servers: [],
  setServers: (servers) => set({ servers }),
  updateServer: (id, partial) =>
    set((state) => ({
      servers: state.servers.map((s) =>
        s.id === id ? { ...s, ...partial } : s
      ),
    })),

  activeContextId: "local",
  setActiveContextId: (id) => set({ activeContextId: id }),

  expandedServers: new Set<string>(),
  toggleServerExpanded: (id) =>
    set((state) => {
      const next = new Set(state.expandedServers);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { expandedServers: next };
    }),

  serversExpanded: true,
  setServersExpanded: (v) => set({ serversExpanded: v }),

  lock: () =>
    set((state) => ({
      masterPassword: null,
      openProject: null,
      projects: [],
      selectedProjectId: null,
      view: state.hasPinCode ? "pin-unlock" : "unlock",
    })),
}));
