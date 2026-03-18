// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useTauri } from "../hooks/useTauri";

interface ChangeMasterPasswordDialogProps {
  open: boolean;
  mode: "local" | "server";
  serverId?: string;
  serverName?: string;
  onClose: () => void;
  onSuccess: () => void;
}

type Phase = "form" | "processing" | "done";

export function ChangeMasterPasswordDialog({
  open: isOpen,
  mode,
  serverId,
  serverName,
  onClose,
  onSuccess,
}: ChangeMasterPasswordDialogProps) {
  const { t } = useTranslation();
  const tauri = useTauri();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [reencryptedCount, setReencryptedCount] = useState(0);

  if (!isOpen) return null;

  const resetForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setPhase("form");
    setReencryptedCount(0);
  };

  const handleClose = () => {
    if (phase === "processing") return;
    resetForm();
    onClose();
  };

  const handleDone = () => {
    resetForm();
    onSuccess();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 8) {
      setError(t("changeMasterPassword.error.minLength"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("changeMasterPassword.error.mismatch"));
      return;
    }

    setPhase("processing");

    try {
      let count: number;
      if (mode === "local") {
        count = await tauri.changeMasterPassword(currentPassword, newPassword);
      } else {
        count = await tauri.changeServerMasterPassword(
          serverId!,
          currentPassword,
          newPassword
        );
      }
      setReencryptedCount(count);
      setPhase("done");
    } catch (err) {
      const msg = String(err);
      if (msg.includes("wrong_password")) {
        setError(t("changeMasterPassword.error.wrongPassword"));
      } else if (msg.includes("same_password")) {
        setError(t("changeMasterPassword.error.samePassword"));
      } else {
        setError(msg);
      }
      setPhase("form");
    }
  };

  const title =
    mode === "server" && serverName
      ? t("changeMasterPassword.titleServer", { name: serverName })
      : t("changeMasterPassword.title");

  if (phase === "processing") {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {t("changeMasterPassword.processing")}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t("changeMasterPassword.processingHint")}
          </p>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 p-8 text-center">
          <div className="flex justify-center mb-4">
            <svg
              className="w-12 h-12 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-6">
            {t("changeMasterPassword.success", { count: reencryptedCount })}
          </p>
          <button
            onClick={handleDone}
            className="px-6 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            {t("changeMasterPassword.done")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {title}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <p className="text-sm text-amber-600 dark:text-amber-400">
            {t("changeMasterPassword.hint")}
          </p>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              {t("changeMasterPassword.currentLabel")}
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              {t("changeMasterPassword.newLabel")}
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              {t("changeMasterPassword.confirmLabel")}
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              {t("changeMasterPassword.cancel")}
            </button>
            <button
              type="submit"
              disabled={!currentPassword || !newPassword || !confirmPassword}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {t("changeMasterPassword.submit")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
