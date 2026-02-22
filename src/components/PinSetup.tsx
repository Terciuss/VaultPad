// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Spinner } from "./Spinner";
import { PinInput } from "./PinInput";
import { useTauri } from "../hooks/useTauri";
import { useAppStore } from "../store";

export function PinSetup() {
  const { t } = useTranslation();
  const tauri = useTauri();
  const masterPassword = useAppStore((s) => s.masterPassword);
  const setView = useAppStore((s) => s.setView);
  const setHasSavedSession = useAppStore((s) => s.setHasSavedSession);
  const setHasPinCode = useAppStore((s) => s.setHasPinCode);

  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const validate = (): string | null => {
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) return t("pin.validation.minLength");
    if (pin !== confirm) return t("pin.validation.mismatch");
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    if (!masterPassword) return;

    try {
      setLoading(true);
      setError("");
      await tauri.setupPin(pin, masterPassword);
      setHasSavedSession(true);
      setHasPinCode(true);
      setView("main");
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
            {t("pin.setup.title")}
          </h1>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm text-blue-800 dark:text-blue-200 mb-6">
            {t("pin.setup.hint")}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 text-center">
                {t("pin.setup.label")}
              </label>
              <PinInput value={pin} onChange={setPin} autoFocus />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 text-center">
                {t("pin.setup.confirm")}
              </label>
              <PinInput value={confirm} onChange={setConfirm} />
            </div>

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading || pin.length < 4 || confirm.length < 4}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Spinner size="sm" className="border-white/30 border-t-white" />}
              {loading ? t("pin.setup.loading") : t("pin.setup.submit")}
            </button>

            <button
              type="button"
              onClick={() => setView("main")}
              className="w-full py-2 px-4 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              {t("pin.setup.skip")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
