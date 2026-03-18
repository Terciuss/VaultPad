// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

import { useEffect, useRef, useCallback, useState } from "react";
import { useAppStore } from "../store";
import { useTauri } from "./useTauri";
import type { ConflictInfo } from "../lib/types";

const PUSH_DEBOUNCE_MS = 60_000;
const REMOTE_CHECK_INTERVAL_MS = 120_000;

interface UseSyncManagerOptions {
  onConflicts: (conflicts: ConflictInfo[]) => void;
  loadProjects: () => void;
}

export function useSyncManager({ onConflicts, loadProjects }: UseSyncManagerOptions) {
  const tauri = useTauri();
  const activeContextId = useAppStore((s) => s.activeContextId);
  const servers = useAppStore((s) => s.servers);
  const updateServer = useAppStore((s) => s.updateServer);
  const view = useAppStore((s) => s.view);
  const autoSyncEnabled = useAppStore((s) => s.autoSyncEnabled);

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingPushRef = useRef(false);
  const syncingRef = useRef(false);

  const isServerContext = activeContextId !== "local" && view === "main";

  const activeServer = servers.find((s) => s.id === activeContextId);
  const canSync =
    isServerContext &&
    !!activeServer?.is_authenticated &&
    !!activeServer?.has_master_password &&
    autoSyncEnabled;

  const doSyncPush = useCallback(async () => {
    if (!canSync || syncingRef.current) return;
    syncingRef.current = true;
    pendingPushRef.current = false;

    updateServer(activeContextId, { sync_status: "syncing" });
    try {
      const result = await tauri.syncPush();
      const hasConflicts = result.conflicts.length > 0;
      updateServer(activeContextId, {
        sync_status: hasConflicts ? "conflict" : "idle",
        last_synced_at: new Date().toISOString(),
      });
      if (hasConflicts) {
        onConflicts(result.conflicts);
      }
      if (result.uploaded > 0 || result.deleted > 0) {
        loadProjects();
      }
    } catch {
      pendingPushRef.current = true;
    } finally {
      syncingRef.current = false;
    }
  }, [canSync, activeContextId, tauri, updateServer, onConflicts, loadProjects]);

  const doRemoteCheck = useCallback(async () => {
    if (!canSync || syncingRef.current) return;
    try {
      const changed = await tauri.checkRemoteChanges();
      if (changed.length === 0) return;

      syncingRef.current = true;
      updateServer(activeContextId, { sync_status: "syncing" });

      const ids = changed.map((c) => c.server_id);
      const result = await tauri.syncPullChanged(ids);

      updateServer(activeContextId, {
        sync_status: "idle",
        last_synced_at: new Date().toISOString(),
      });

      if (result.downloaded > 0 || result.updated > 0) {
        loadProjects();
      }
    } catch {
      // silent fail for background checks
    } finally {
      syncingRef.current = false;
    }
  }, [canSync, activeContextId, tauri, updateServer, loadProjects]);

  const notifyLocalSave = useCallback(() => {
    if (!canSync) return;

    pendingPushRef.current = true;

    if (pushTimerRef.current) {
      clearTimeout(pushTimerRef.current);
    }

    if (!isOnline) return;

    pushTimerRef.current = setTimeout(() => {
      pushTimerRef.current = null;
      doSyncPush();
    }, PUSH_DEBOUNCE_MS);
  }, [canSync, isOnline, doSyncPush]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (pendingPushRef.current && canSync) {
        if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
        pushTimerRef.current = null;
        doSyncPush().then(() => doRemoteCheck());
      } else if (canSync) {
        doRemoteCheck();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      if (pushTimerRef.current) {
        clearTimeout(pushTimerRef.current);
        pushTimerRef.current = null;
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [canSync, doSyncPush, doRemoteCheck]);

  useEffect(() => {
    if (!canSync || !isOnline) {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      return;
    }

    checkIntervalRef.current = setInterval(doRemoteCheck, REMOTE_CHECK_INTERVAL_MS);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    };
  }, [canSync, isOnline, doRemoteCheck]);

  useEffect(() => {
    return () => {
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    };
  }, []);

  return { notifyLocalSave };
}
