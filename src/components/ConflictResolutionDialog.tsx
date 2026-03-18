// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useTauri } from "../hooks/useTauri";
import { htmlToPlainText } from "./DiffView";
import type { ConflictInfo } from "../lib/types";

interface ConflictResolutionDialogProps {
  open: boolean;
  conflicts: ConflictInfo[];
  onClose: () => void;
  onResolved: () => void;
}

export function ConflictResolutionDialog({
  open,
  conflicts,
  onClose,
  onResolved,
}: ConflictResolutionDialogProps) {
  const { t } = useTranslation();
  const tauri = useTauri();

  const [currentIdx, setCurrentIdx] = useState(0);
  const [localText, setLocalText] = useState("");
  const [remoteText, setRemoteText] = useState("");
  const [localEdited, setLocalEdited] = useState(false);
  const [remoteEdited, setRemoteEdited] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const conflict = conflicts[currentIdx] ?? null;

  useEffect(() => {
    if (conflict) {
      setLocalText(htmlToPlainText(conflict.local_content));
      setRemoteText(htmlToPlainText(conflict.remote_content));
      setLocalEdited(false);
      setRemoteEdited(false);
      setError("");
    }
  }, [conflict?.project_id]);

  if (!open || !conflict) return null;

  const handleResolve = async (side: "local" | "remote") => {
    setError("");
    setLoading(true);
    try {
      const wasEdited = side === "local" ? localEdited : remoteEdited;
      const content = side === "local" ? localText : remoteText;
      const name = side === "local" ? conflict.local_name : conflict.remote_name;

      if (wasEdited) {
        await tauri.resolveConflict(conflict.project_id, "merged", name, content);
      } else {
        await tauri.resolveConflict(conflict.project_id, side);
      }

      if (currentIdx < conflicts.length - 1) {
        setCurrentIdx(currentIdx + 1);
      } else {
        onResolved();
        onClose();
        setCurrentIdx(0);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleLocalChange = (value: string) => {
    setLocalText(value);
    setLocalEdited(true);
  };

  const handleRemoteChange = (value: string) => {
    setRemoteText(value);
    setRemoteEdited(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-[95vw] h-[95vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t("conflict.title")} ({currentIdx + 1}/{conflicts.length})
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {t("conflict.description")}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-hidden p-4 space-y-3 flex flex-col">
          {conflict.local_name !== conflict.remote_name && (
            <div className="text-xs text-amber-600 dark:text-amber-400 shrink-0">
              {t("conflict.localVersion")}: <span className="font-medium">{conflict.local_name}</span>
              {" → "}
              {t("conflict.remoteVersion")}: <span className="font-medium">{conflict.remote_name}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
            <div className="flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-1 shrink-0">
                <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {t("conflict.localVersion")}
                </h4>
                <span className="text-[10px] text-gray-400">
                  {new Date(conflict.local_updated_at).toLocaleString()}
                </span>
              </div>
              <textarea
                value={localText}
                onChange={(e) => handleLocalChange(e.target.value)}
                className="flex-1 min-h-0 p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-xs font-mono whitespace-pre-wrap text-gray-700 dark:text-gray-300 outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              />
            </div>
            <div className="flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-1 shrink-0">
                <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {t("conflict.remoteVersion")}
                </h4>
                <span className="text-[10px] text-gray-400">
                  {new Date(conflict.remote_updated_at).toLocaleString()}
                </span>
              </div>
              <textarea
                value={remoteText}
                onChange={(e) => handleRemoteChange(e.target.value)}
                className="flex-1 min-h-0 p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-xs font-mono whitespace-pre-wrap text-gray-700 dark:text-gray-300 outline-none focus:ring-1 focus:ring-orange-500 resize-none"
              />
            </div>
          </div>

          {error && <p className="text-red-500 text-sm shrink-0">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {t("conflict.cancel")}
          </button>
          <button
            onClick={() => handleResolve("local")}
            disabled={loading}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            {t("conflict.keepLocal")}
          </button>
          <button
            onClick={() => handleResolve("remote")}
            disabled={loading}
            className="px-4 py-2 text-sm bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            {t("conflict.keepRemote")}
          </button>
        </div>
      </div>
    </div>
  );
}
