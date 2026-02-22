// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

import { useState } from "react";
import { useTranslation } from "react-i18next";

interface CustomPasswordDialogProps {
  open: boolean;
  projectName: string;
  onSubmit: (password: string) => void;
  onClose: () => void;
}

export function CustomPasswordDialog({
  open,
  projectName,
  onSubmit,
  onClose,
}: CustomPasswordDialogProps) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError(t("customPassword.required"));
      return;
    }
    onSubmit(password);
    setPassword("");
    setError("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-sm w-full mx-4 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          {t("customPassword.title")}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {t("customPassword.description", { name: projectName })}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("customPassword.placeholder")}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            autoFocus
          />

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setPassword("");
                setError("");
                onClose();
              }}
              className="flex-1 py-2 px-4 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
            >
              {t("customPassword.cancel")}
            </button>
            <button
              type="submit"
              className="flex-1 py-2 px-4 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              {t("customPassword.unlock")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
