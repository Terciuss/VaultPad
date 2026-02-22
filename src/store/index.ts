// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

import { create } from "zustand";
import type {
  AppView,
  DecryptedProject,
  ProjectListItem,
  ThemeMode,
} from "../lib/types";

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

  lastActivity: number;
  touchActivity: () => void;
  autoLockMinutes: number;
  setAutoLockMinutes: (minutes: number) => void;

  onboardingShown: boolean;
  setOnboardingShown: (shown: boolean) => void;

  locale: string;
  setLocale: (locale: string) => void;

  hasSavedSession: boolean;
  setHasSavedSession: (v: boolean) => void;

  hasPinCode: boolean;
  setHasPinCode: (v: boolean) => void;

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

  lastActivity: Date.now(),
  touchActivity: () => set({ lastActivity: Date.now() }),
  autoLockMinutes: 5,
  setAutoLockMinutes: (minutes) => set({ autoLockMinutes: minutes }),

  onboardingShown: false,
  setOnboardingShown: (shown) => set({ onboardingShown: shown }),

  locale: localStorage.getItem("vaultpad-locale") || (navigator.language.startsWith("ru") ? "ru" : "en"),
  setLocale: (locale) => {
    localStorage.setItem("vaultpad-locale", locale);
    set({ locale });
  },

  hasSavedSession: false,
  setHasSavedSession: (v) => set({ hasSavedSession: v }),

  hasPinCode: false,
  setHasPinCode: (v) => set({ hasPinCode: v }),

  lock: () =>
    set((state) => ({
      masterPassword: null,
      openProject: null,
      projects: [],
      selectedProjectId: null,
      view: state.hasPinCode ? "pin-unlock" : "unlock",
    })),
}));
