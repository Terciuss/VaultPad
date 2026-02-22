// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { open } from "@tauri-apps/plugin-dialog";
import { useTauri } from "../hooks/useTauri";
import { useAppStore } from "../store";

export function InitScreen() {
  const { t } = useTranslation();
  const tauri = useTauri();
  const setView = useAppStore((s) => s.setView);
  const setDbPath = useAppStore((s) => s.setDbPath);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    try {
      const path = await open({
        title: t("init.dialogCreate"),
        filters: [{ name: "Database", extensions: ["db"] }],
        directory: true,
      });
      if (!path) return;

      const dbPath = `${path}/vaultpad.db`;
      setLoading(true);
      await tauri.initDatabase(dbPath);
      setDbPath(dbPath);
      setView("master-password-setup");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = async () => {
    try {
      const path = await open({
        title: t("init.dialogOpen"),
        filters: [{ name: "Database", extensions: ["db"] }],
      });
      if (!path) return;

      setLoading(true);
      await tauri.initDatabase(path as string);
      setDbPath(path as string);

      const hasMaster = await tauri.hasMasterPassword();
      setView(hasMaster ? "unlock" : "master-password-setup");
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
            {t("app.subtitle")}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm text-blue-800 dark:text-blue-200">
            {t("init.dbHint")}
          </div>

          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
          >
            {t("init.createDb")}
          </button>

          <button
            onClick={handleOpen}
            disabled={loading}
            className="w-full py-3 px-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 text-gray-900 dark:text-white font-medium rounded-lg transition-colors"
          >
            {t("init.openDb")}
          </button>

          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
