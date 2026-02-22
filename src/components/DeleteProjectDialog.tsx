// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

import { useState } from "react";
import { useTranslation } from "react-i18next";

interface DeleteProjectDialogProps {
  open: boolean;
  projectName: string;
  onConfirm: () => void;
  onClose: () => void;
}

export function DeleteProjectDialog({
  open,
  projectName,
  onConfirm,
  onClose,
}: DeleteProjectDialogProps) {
  const { t } = useTranslation();
  const [confirmText, setConfirmText] = useState("");

  if (!open) return null;

  const canDelete = confirmText === projectName;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canDelete) return;
    onConfirm();
    setConfirmText("");
  };

  const handleClose = () => {
    setConfirmText("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
        <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-3">
          {t("deleteProject.title")}
        </h2>

        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          {t("deleteProject.warning")}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t("deleteProject.confirmHint", { name: projectName })}
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={t("deleteProject.placeholder")}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
              autoFocus
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 py-2 px-4 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
            >
              {t("deleteProject.cancel")}
            </button>
            <button
              type="submit"
              disabled={!canDelete}
              className="flex-1 py-2 px-4 text-sm bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              {t("deleteProject.delete")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
