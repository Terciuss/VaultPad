// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useTauri } from "../hooks/useTauri";
import { DiffView, htmlToPlainText } from "./DiffView";
import type { BackupListItem, BackupContent } from "../lib/types";

interface BackupHistoryPanelProps {
  projectId: string;
  currentContent: string;
  password: string;
  onRestore: () => void;
  onClose: () => void;
}

function formatTriggerType(type: string, t: (key: string) => string): string {
  return type === "pre_sync" ? t("backup.preSyncTrigger") : t("backup.auto");
}

function formatContentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function BackupHistoryPanel({
  projectId,
  currentContent,
  password,
  onRestore,
  onClose,
}: BackupHistoryPanelProps) {
  const { t } = useTranslation();
  const tauri = useTauri();

  const [backups, setBackups] = useState<BackupListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedContent, setSelectedContent] = useState<BackupContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);
  const [error, setError] = useState("");
  const [confirmRestore, setConfirmRestore] = useState(false);

  const loadBackups = useCallback(async () => {
    setLoading(true);
    try {
      const list = await tauri.listProjectBackups(projectId);
      setBackups(list);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [tauri, projectId]);

  useEffect(() => {
    loadBackups();
  }, [loadBackups]);

  const handleSelect = async (backupId: string) => {
    if (backupId === selectedId) return;
    setSelectedId(backupId);
    setSelectedContent(null);
    setConfirmRestore(false);
    setLoadingContent(true);
    setError("");
    try {
      const content = await tauri.getBackupContent(backupId, password);
      setSelectedContent(content);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoadingContent(false);
    }
  };

  const handleRestore = async () => {
    if (!selectedId) return;
    setError("");
    setLoading(true);
    try {
      await tauri.restoreBackup(selectedId, password);
      onRestore();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
      setConfirmRestore(false);
    }
  };

  const handleDelete = async (backupId: string) => {
    setError("");
    try {
      await tauri.deleteBackup(backupId);
      if (selectedId === backupId) {
        setSelectedId(null);
        setSelectedContent(null);
      }
      await loadBackups();
    } catch (e) {
      setError(String(e));
    }
  };

  const currentPlain = useMemo(() => htmlToPlainText(currentContent), [currentContent]);
  const backupPlain = useMemo(
    () => (selectedContent ? htmlToPlainText(selectedContent.content) : ""),
    [selectedContent]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-5xl w-full mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t("backup.historyTitle")}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex">
          <div className="w-72 border-r border-gray-200 dark:border-gray-700 overflow-y-auto shrink-0">
            {loading && backups.length === 0 ? (
              <div className="p-4 text-center text-gray-400 dark:text-gray-500 text-sm">
                {t("loading.decrypting")}
              </div>
            ) : backups.length === 0 ? (
              <div className="p-4 text-center text-gray-400 dark:text-gray-500 text-sm">
                {t("backup.noBackups")}
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {backups.map((b) => (
                  <div
                    key={b.id}
                    onClick={() => handleSelect(b.id)}
                    className={`p-3 cursor-pointer transition-colors ${
                      selectedId === b.id
                        ? "bg-blue-50 dark:bg-blue-900/20"
                        : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-900 dark:text-white">
                        {new Date(b.created_at).toLocaleString()}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(b.id);
                        }}
                        className="text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 transition-colors"
                        title={t("backup.delete")}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          b.trigger_type === "pre_sync"
                            ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        }`}
                      >
                        {formatTriggerType(b.trigger_type, t)}
                      </span>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">
                        {formatContentSize(b.content_length)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {!selectedId ? (
              <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
                {t("backup.selectToView")}
              </div>
            ) : loadingContent ? (
              <div className="h-full flex items-center justify-center">
                <div className="w-8 h-8 border-3 rounded-full border-gray-300 dark:border-gray-600 border-t-blue-600 dark:border-t-blue-400 animate-spin" />
              </div>
            ) : selectedContent ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t("backup.diffTitle")}
                    </h3>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      <span className="inline-block w-3 h-3 bg-red-100 dark:bg-red-900/30 rounded mr-1 align-middle" />
                      {t("backup.selected")}
                      <span className="inline-block w-3 h-3 bg-green-100 dark:bg-green-900/30 rounded mx-1 ml-3 align-middle" />
                      {t("backup.current")}
                    </p>
                  </div>
                  {!confirmRestore ? (
                    <button
                      onClick={() => setConfirmRestore(true)}
                      className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                      {t("backup.restore")}
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-amber-600 dark:text-amber-400">
                        {t("backup.confirmRestore")}
                      </span>
                      <button
                        onClick={handleRestore}
                        disabled={loading}
                        className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                      >
                        {t("backup.confirmYes")}
                      </button>
                      <button
                        onClick={() => setConfirmRestore(false)}
                        className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        {t("backup.confirmNo")}
                      </button>
                    </div>
                  )}
                </div>

                {selectedContent.name && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      {t("backup.backupName")}
                    </h4>
                    <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 rounded px-3 py-2">
                      {selectedContent.name}
                    </p>
                  </div>
                )}

                <DiffView oldText={backupPlain} newText={currentPlain} />
              </div>
            ) : null}
          </div>
        </div>

        {error && (
          <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm shrink-0">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
