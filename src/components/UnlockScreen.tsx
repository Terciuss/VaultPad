// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Spinner } from "./Spinner";
import { useTauri } from "../hooks/useTauri";
import { useAppStore } from "../store";

export function UnlockScreen() {
  const { t } = useTranslation();
  const tauri = useTauri();
  const setView = useAppStore((s) => s.setView);
  const setMasterPassword = useAppStore((s) => s.setMasterPassword);
  const touchActivity = useAppStore((s) => s.touchActivity);

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      setLoading(true);
      const valid = await tauri.verifyMasterPassword(password);
      if (!valid) {
        setError(t("unlock.error"));
        return;
      }
      setMasterPassword(password);
      touchActivity();

      const pinExists = await tauri.hasPin();
      setView(pinExists ? "main" : "pin-setup");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full mx-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {t("app.title")}
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            {t("unlock.hint")}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("unlock.label")}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                autoFocus
              />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading || password.length === 0}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Spinner size="sm" className="border-white/30 border-t-white" />}
              {loading ? t("unlock.loading") : t("unlock.submit")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
