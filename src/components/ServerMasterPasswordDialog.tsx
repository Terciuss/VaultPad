// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useTauri } from "../hooks/useTauri";

interface ServerMasterPasswordDialogProps {
  open: boolean;
  serverId: string;
  serverName: string;
  mode: "setup" | "verify";
  onClose: () => void;
  onSuccess: () => void;
}

export function ServerMasterPasswordDialog({
  open: isOpen,
  serverId,
  serverName,
  mode,
  onClose,
  onSuccess,
}: ServerMasterPasswordDialogProps) {
  const { t } = useTranslation();
  const tauri = useTauri();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (mode === "setup") {
      if (password.length < 8) {
        setError(t("masterPassword.validation.minLength"));
        return;
      }
      if (password !== confirm) {
        setError(t("masterPassword.validation.mismatch"));
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === "setup") {
        await tauri.setServerMasterPassword(serverId, password);
      } else {
        const ok = await tauri.verifyServerMasterPassword(serverId, password);
        if (!ok) {
          setError(t("unlock.error"));
          setLoading(false);
          return;
        }
      }
      setPassword("");
      setConfirm("");
      onSuccess();
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
            {mode === "setup"
              ? t("serverMasterPassword.setup.title")
              : t("serverMasterPassword.verify.title")}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {mode === "setup" ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t("serverMasterPassword.setup.hint")}
            </p>
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t("serverMasterPassword.verify.hint", { name: serverName })}
            </p>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              {t("serverMasterPassword.setup.label")}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {mode === "setup" && (
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                {t("serverMasterPassword.setup.confirm")}
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              {t("addServer.cancel")}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {mode === "setup"
                ? t("serverMasterPassword.setup.submit")
                : t("serverMasterPassword.verify.submit")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
