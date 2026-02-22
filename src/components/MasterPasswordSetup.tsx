// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useTauri } from "../hooks/useTauri";
import { useAppStore } from "../store";

export function MasterPasswordSetup() {
  const { t } = useTranslation();
  const tauri = useTauri();
  const setView = useAppStore((s) => s.setView);
  const setMasterPassword = useAppStore((s) => s.setMasterPassword);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const strength = getPasswordStrength(password, t);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError(t("masterPassword.validation.minLength"));
      return;
    }

    if (password !== confirm) {
      setError(t("masterPassword.validation.mismatch"));
      return;
    }

    try {
      setLoading(true);
      await tauri.setMasterPassword(password);
      setMasterPassword(password);
      setView("pin-setup");
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
            {t("masterPassword.setup.title")}
          </h1>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <div
            className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm text-amber-800 dark:text-amber-200 mb-6"
            dangerouslySetInnerHTML={{ __html: t("masterPassword.setup.hint") }}
          />

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("masterPassword.setup.label")}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                autoFocus
              />
              {password.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={`h-1.5 flex-1 rounded-full transition-colors ${
                          level <= strength.level
                            ? strength.color
                            : "bg-gray-200 dark:bg-gray-600"
                        }`}
                      />
                    ))}
                  </div>
                  <p
                    className={`text-xs mt-1 ${
                      strength.level <= 2
                        ? "text-red-500"
                        : "text-green-600 dark:text-green-400"
                    }`}
                  >
                    {strength.label}
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("masterPassword.setup.confirm")}
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading || password.length < 8}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
            >
              {loading ? t("masterPassword.setup.loading") : t("masterPassword.setup.submit")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function getPasswordStrength(password: string, t: (key: string) => string) {
  if (password.length === 0)
    return { level: 0, label: "", color: "" };

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { level: 1, label: t("masterPassword.strength.weak"), color: "bg-red-500" };
  if (score <= 2) return { level: 2, label: t("masterPassword.strength.fair"), color: "bg-orange-500" };
  if (score <= 3) return { level: 3, label: t("masterPassword.strength.good"), color: "bg-yellow-500" };
  return { level: 4, label: t("masterPassword.strength.strong"), color: "bg-green-500" };
}
