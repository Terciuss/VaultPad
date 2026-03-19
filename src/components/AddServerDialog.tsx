// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { open } from "@tauri-apps/plugin-dialog";
import { useTauri } from "../hooks/useTauri";
import type { ServerInfo } from "../lib/types";

interface AddServerDialogProps {
  open: boolean;
  onClose: () => void;
  onAdded: (server: ServerInfo) => void;
  prefill?: { name: string; url: string } | null;
  onClearPrefill?: () => void;
}

export function AddServerDialog({ open: isOpen, onClose, onAdded, prefill, onClearPrefill }: AddServerDialogProps) {
  const { t } = useTranslation();
  const tauri = useTauri();

  const [name, setName] = useState("");
  const [url, setUrl] = useState("http://localhost:8080");
  const [dbFolder, setDbFolder] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (prefill) {
        setName(prefill.name);
        setUrl(prefill.url || "http://localhost:8080");
      }
      if (!dbFolder) {
        tauri.getDefaultDbFolder().then((folder) => {
          setDbFolder((prev) => prev || folder);
        }).catch(() => {});
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectFolder = async () => {
    const selected = await open({ directory: true, title: t("addServer.dbFolder") });
    if (selected && typeof selected === "string") {
      setDbFolder(selected);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError(t("addServer.validation.nameRequired"));
      return;
    }
    if (!url.trim()) {
      setError(t("addServer.validation.urlRequired"));
      return;
    }
    if (!dbFolder.trim()) {
      setError(t("addServer.validation.folderRequired"));
      return;
    }

    setLoading(true);
    try {
      const server = await tauri.addServer(name.trim(), url.trim(), dbFolder.trim());
      setName("");
      setUrl("http://localhost:8080");
      setDbFolder("");
      onClearPrefill?.();
      onAdded(server);
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t("addServer.title")}
          </h2>
          <button onClick={() => { onClearPrefill?.(); onClose(); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              {t("addServer.name")}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("addServer.namePlaceholder")}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              {t("addServer.url")}
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t("addServer.urlPlaceholder")}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              {t("addServer.dbFolder")}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={dbFolder}
                readOnly
                className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white outline-none"
              />
              <button
                type="button"
                onClick={handleSelectFolder}
                className="px-3 py-2 text-sm bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-lg transition-colors text-gray-700 dark:text-gray-200"
              >
                {t("addServer.selectFolder")}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-400">{t("addServer.dbFolderHint")}</p>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => { onClearPrefill?.(); onClose(); }}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              {t("addServer.cancel")}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {loading ? t("addServer.adding") : t("addServer.add")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
