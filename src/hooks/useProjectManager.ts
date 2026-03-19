// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

import { useCallback, useRef } from "react";
import { useAppStore } from "../store";
import { useTauri } from "./useTauri";
import type { ProjectListItem } from "../lib/types";

export function useProjectManager() {
  const tauri = useTauri();
  const setProjectsForContext = useAppStore((s) => s.setProjectsForContext);
  const setOpenProject = useAppStore((s) => s.setOpenProject);
  const setSelectedProjectId = useAppStore((s) => s.setSelectedProjectId);
  const setActiveContextId = useAppStore((s) => s.setActiveContextId);
  const toggleServerExpanded = useAppStore((s) => s.toggleServerExpanded);
  const setServersExpanded = useAppStore((s) => s.setServersExpanded);

  const flushSaveRef = useRef<(() => Promise<void>) | null>(null);

  const registerFlushSave = useCallback((fn: () => Promise<void>) => {
    flushSaveRef.current = fn;
  }, []);

  const loadProjectsForContext = useCallback(async (contextId?: string) => {
    const ctx = contextId ?? useAppStore.getState().activeContextId;
    const mp = useAppStore.getState().masterPassword;
    if (!mp && ctx === "local") return;
    try {
      const projects = await tauri.listProjects();
      if (useAppStore.getState().activeContextId === ctx) {
        setProjectsForContext(ctx, projects);
      }
    } catch (e) {
      const errMsg = String(e);
      if (errMsg.includes("Database not initialized")) {
        try {
          const dbPath = useAppStore.getState().dbPath;
          const isInit = await tauri.isDatabaseInitialized();
          if (!isInit) {
            if (dbPath) {
              await tauri.initDatabase(dbPath);
            } else {
              const savedPath = await tauri.getSavedDbPath();
              if (savedPath) await tauri.initDatabase(savedPath);
              else return;
            }
          }
          const projects = await tauri.listProjects();
          if (useAppStore.getState().activeContextId === ctx) {
            setProjectsForContext(ctx, projects);
          }
        } catch { /* ignore nested errors */ }
      }
    }
  }, [tauri, setProjectsForContext]);

  const switchContextSafely = useCallback(async (contextId: string) => {
    if (flushSaveRef.current) {
      try { await flushSaveRef.current(); } catch { /* ignore flush errors */ }
    }

    await tauri.switchContext(contextId);

    setOpenProject(null);
    setSelectedProjectId(null);
    setActiveContextId(contextId);

    if (contextId === "local") {
      const mp = useAppStore.getState().masterPassword;
      if (mp) {
        await tauri.cacheMasterKey(mp);
      }
    } else {
      setServersExpanded(true);
      const expanded = useAppStore.getState().expandedServers;
      if (!expanded.has(contextId)) {
        toggleServerExpanded(contextId);
      }
    }

    await loadProjectsForContext(contextId);
  }, [tauri, setOpenProject, setSelectedProjectId, setActiveContextId,
      setServersExpanded, toggleServerExpanded, loadProjectsForContext]);

  const selectProjectFromContext = useCallback(async (
    project: ProjectListItem,
    contextId: string,
    callbacks: {
      onCustomPassword: (project: ProjectListItem) => void;
    }
  ) => {
    const currentCtx = useAppStore.getState().activeContextId;
    if (contextId !== currentCtx) {
      await switchContextSafely(contextId);
    }

    if (project.is_password_registry) {
      setSelectedProjectId(project.id);
      setOpenProject(null);
      return;
    }

    if (project.has_custom_password && !project.password_saved) {
      callbacks.onCustomPassword(project);
      return;
    }

    const mp = useAppStore.getState().masterPassword;
    const password = project.has_custom_password ? "" : (mp ?? "");
    try {
      const decrypted = await tauri.getProject(project.id, password);
      setSelectedProjectId(project.id);
      setOpenProject(decrypted);
    } catch {
      callbacks.onCustomPassword(project);
    }
  }, [tauri, switchContextSafely, setSelectedProjectId, setOpenProject]);

  return {
    registerFlushSave,
    loadProjectsForContext,
    switchContextSafely,
    selectProjectFromContext,
  };
}
