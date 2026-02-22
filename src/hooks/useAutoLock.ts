// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

import { useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../store";

export function useAutoLock() {
  const lock = useAppStore((s) => s.lock);
  const autoLockMinutes = useAppStore((s) => s.autoLockMinutes);
  const lastActivity = useAppStore((s) => s.lastActivity);
  const touchActivity = useAppStore((s) => s.touchActivity);
  const view = useAppStore((s) => s.view);

  const handleActivity = useCallback(() => {
    touchActivity();
  }, [touchActivity]);

  const doLock = useCallback(() => {
    invoke("clear_cached_key").catch(() => {});
    lock();
  }, [lock]);

  useEffect(() => {
    if (view !== "main") return;

    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("click", handleActivity);

    return () => {
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("click", handleActivity);
    };
  }, [view, handleActivity]);

  useEffect(() => {
    if (view !== "main" || autoLockMinutes <= 0) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivity;
      if (elapsed > autoLockMinutes * 60 * 1000) {
        doLock();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [view, autoLockMinutes, lastActivity, doLock]);
}
