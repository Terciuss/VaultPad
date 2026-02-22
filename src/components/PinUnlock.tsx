// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

import { useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Spinner } from "./Spinner";
import { PinInput } from "./PinInput";
import { useTauri } from "../hooks/useTauri";
import { useAppStore } from "../store";

const MAX_ATTEMPTS = 5;

export function PinUnlock() {
  const { t } = useTranslation();
  const tauri = useTauri();
  const setView = useAppStore((s) => s.setView);
  const setMasterPassword = useAppStore((s) => s.setMasterPassword);
  const touchActivity = useAppStore((s) => s.touchActivity);

  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const attemptsRef = useRef(0);

  const handleComplete = useCallback(
    async (completed: string) => {
      if (loading) return;

      try {
        setLoading(true);
        setError("");
        const masterPassword = await tauri.verifyPin(completed);
        setMasterPassword(masterPassword);
        touchActivity();
        setView("main");
      } catch {
        const next = attemptsRef.current + 1;
        attemptsRef.current = next;
        setPin("");
        if (next >= MAX_ATTEMPTS) {
          setView("unlock");
          return;
        }
        setError(
          `${t("pin.unlock.error")}. ${t("pin.unlock.attemptsLeft", { count: MAX_ATTEMPTS - next })}`,
        );
      } finally {
        setLoading(false);
      }
    },
    [loading, tauri, setMasterPassword, touchActivity, setView, t],
  );

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-sm w-full mx-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {t("app.title")}
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            {t("pin.unlock.hint")}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 space-y-5">
          <PinInput
            value={pin}
            onChange={setPin}
            onComplete={handleComplete}
            autoFocus
            error={!!error}
            disabled={loading}
          />

          {loading && (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Spinner size="sm" />
              {t("pin.unlock.loading")}
            </div>
          )}

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button
            type="button"
            onClick={() => setView("unlock")}
            className="w-full py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            {t("pin.unlock.fallback")}
          </button>
        </div>
      </div>
    </div>
  );
}
