// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useTauri } from "../hooks/useTauri";
import { useAppStore } from "../store";

interface NewProjectDialogProps {
  open: boolean;
  onClose: () => void;
}

export function NewProjectDialog({ open, onClose }: NewProjectDialogProps) {
  const { t } = useTranslation();
  const tauri = useTauri();
  const masterPassword = useAppStore((s) => s.masterPassword);
  const setProjects = useAppStore((s) => s.setProjects);
  const setSelectedProjectId = useAppStore((s) => s.setSelectedProjectId);
  const setOpenProject = useAppStore((s) => s.setOpenProject);
  const onboardingShown = useAppStore((s) => s.onboardingShown);

  const [name, setName] = useState("");
  const [useCustomPassword, setUseCustomPassword] = useState(false);
  const [customPassword, setCustomPassword] = useState("");
  const [customPasswordConfirm, setCustomPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError(t("newProject.validation.nameRequired"));
      return;
    }

    if (useCustomPassword) {
      if (customPassword.length < 8) {
        setError(t("newProject.validation.customMinLength"));
        return;
      }
      if (customPassword !== customPasswordConfirm) {
        setError(t("newProject.validation.mismatch"));
        return;
      }
    }

    const password = useCustomPassword ? customPassword : masterPassword;
    if (!password) {
      setError(t("newProject.validation.noPassword"));
      return;
    }

    try {
      setLoading(true);
      const id = await tauri.createProject(
        name.trim(),
        "",
        password,
        useCustomPassword
      );

      if (masterPassword) {
        const projects = await tauri.listProjects();
        setProjects(projects);
      }

      const project = await tauri.getProject(id, password);
      setSelectedProjectId(id);
      setOpenProject(project);
      resetAndClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const resetAndClose = () => {
    setName("");
    setUseCustomPassword(false);
    setCustomPassword("");
    setCustomPasswordConfirm("");
    setError("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {t("newProject.title")}
          </h2>

          {!onboardingShown && (
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-800 dark:text-blue-200 mb-4">
              {t("newProject.hint")}
            </div>
          )}

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
                  {t("newProject.customPassword")}
                </span>
              </label>

              {useCustomPassword && (
                <div className="mt-3 space-y-3 pl-6">
                  <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-200">
                    {t("newProject.customPasswordHint")}
                  </div>
                  <input
                    type="password"
                    value={customPassword}
                    onChange={(e) => setCustomPassword(e.target.value)}
                    placeholder={t("newProject.customPasswordPlaceholder")}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                  />
                  <input
                    type="password"
                    value={customPasswordConfirm}
                    onChange={(e) => setCustomPasswordConfirm(e.target.value)}
                    placeholder={t("newProject.customPasswordConfirm")}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                  />
                </div>
              )}
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={resetAndClose}
                className="flex-1 py-2 px-4 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
              >
                {t("newProject.cancel")}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2 px-4 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                {loading ? t("newProject.creating") : t("newProject.create")}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
