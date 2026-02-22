// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useTauri } from "../hooks/useTauri";
import { useAppStore } from "../store";
import type { DecryptedProject } from "../lib/types";

interface EditProjectDialogProps {
  open: boolean;
  project: DecryptedProject | null;
  currentPassword?: string;
  onClose: () => void;
  onSaved: () => void;
}

export function EditProjectDialog({
  open,
  project,
  currentPassword,
  onClose,
  onSaved,
}: EditProjectDialogProps) {
  const { t } = useTranslation();
  const tauri = useTauri();
  const masterPassword = useAppStore((s) => s.masterPassword);

  const [name, setName] = useState("");
  const [useCustomPassword, setUseCustomPassword] = useState(false);
  const [customPassword, setCustomPassword] = useState("");
  const [customPasswordConfirm, setCustomPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && project) {
      setName(project.name);
      setUseCustomPassword(project.has_custom_password);
      setCustomPassword("");
      setCustomPasswordConfirm("");
      setError("");
    }
  }, [open, project]);

  if (!open || !project) return null;

  const passwordChanged =
    useCustomPassword !== project.has_custom_password ||
    (useCustomPassword && customPassword.length > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError(t("newProject.validation.nameRequired"));
      return;
    }

    if (useCustomPassword) {
      const switchingToCustom = !project.has_custom_password;
      const needsNewPassword = switchingToCustom || customPassword.length > 0;

      if (switchingToCustom && customPassword.length === 0) {
        setError(t("newProject.validation.customRequired"));
        return;
      }
      if (needsNewPassword) {
        if (customPassword.length < 8) {
          setError(t("newProject.validation.customMinLength"));
          return;
        }
        if (customPassword !== customPasswordConfirm) {
          setError(t("newProject.validation.mismatch"));
          return;
        }
      }
    }

    let password = "";
    const hasCustom = useCustomPassword;

    if (hasCustom) {
      if (customPassword.length > 0) {
        password = customPassword;
      } else if (currentPassword) {
        password = currentPassword;
      } else {
        password = "";
      }
    } else {
      password = masterPassword ?? "";
    }

    try {
      setLoading(true);
      await tauri.updateProject(
        project.id,
        name.trim(),
        project.content,
        password,
        hasCustom
      );
      onSaved();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {t("editProject.title")}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("newProject.nameLabel")}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                autoFocus
              />
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useCustomPassword}
                  onChange={(e) => setUseCustomPassword(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {t("editProject.switchToCustom")}
                </span>
              </label>

              {useCustomPassword && (
                <div className="mt-3 space-y-3 pl-6">
                  {project.has_custom_password && customPassword.length === 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t("editProject.keepCurrentPassword")}
                    </p>
                  )}
                  <input
                    type="password"
                    value={customPassword}
                    onChange={(e) => setCustomPassword(e.target.value)}
                    placeholder={t("editProject.newCustomPassword")}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                  />
                  {customPassword.length > 0 && (
                    <input
                      type="password"
                      value={customPasswordConfirm}
                      onChange={(e) => setCustomPasswordConfirm(e.target.value)}
                      placeholder={t("editProject.confirmCustomPassword")}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                    />
                  )}
                  {passwordChanged && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      {t("editProject.passwordWillChange")}
                    </p>
                  )}
                </div>
              )}

              {!useCustomPassword && project.has_custom_password && (
                <p className="mt-2 pl-6 text-xs text-amber-600 dark:text-amber-400">
                  {t("editProject.switchToMaster")}
                </p>
              )}
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 px-4 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
              >
                {t("newProject.cancel")}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2 px-4 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                {loading ? t("editProject.saving") : t("editProject.save")}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
