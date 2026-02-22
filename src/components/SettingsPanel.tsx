// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Spinner } from "./Spinner";
import { PinInput } from "./PinInput";
import { useAppStore } from "../store";
import { useTheme } from "../hooks/useTheme";
import { useTauri } from "../hooks/useTauri";
import type { ThemeMode } from "../lib/types";

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "ru", label: "Русский" },
] as const;

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const { t, i18n } = useTranslation();
  const tauri = useTauri();
  const { theme, setTheme } = useTheme();
  const fontSize = useAppStore((s) => s.fontSize);
  const setFontSize = useAppStore((s) => s.setFontSize);
  const autoLockMinutes = useAppStore((s) => s.autoLockMinutes);
  const setAutoLockMinutes = useAppStore((s) => s.setAutoLockMinutes);
  const dbPath = useAppStore((s) => s.dbPath);
  const lock = useAppStore((s) => s.lock);
  const locale = useAppStore((s) => s.locale);
  const setLocale = useAppStore((s) => s.setLocale);
  const setView = useAppStore((s) => s.setView);
  const setHasSavedSession = useAppStore((s) => s.setHasSavedSession);
  const setHasPinCode = useAppStore((s) => s.setHasPinCode);

  const [changePinOpen, setChangePinOpen] = useState(false);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmNewPin, setConfirmNewPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinLoading, setPinLoading] = useState(false);
  const [pinExists, setPinExists] = useState(false);

  useEffect(() => {
    if (open) {
      tauri.hasPin().then(setPinExists).catch(() => {});
    }
  }, [open, tauri]);

  if (!open) return null;

  const handleLanguageChange = (code: string) => {
    i18n.changeLanguage(code);
    setLocale(code);
  };

  const themeLabel = (mode: ThemeMode) => t(`settings.theme.${mode}`);

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError("");

    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      setPinError(t("pin.validation.minLength"));
      return;
    }
    if (newPin !== confirmNewPin) {
      setPinError(t("pin.validation.mismatch"));
      return;
    }

    try {
      setPinLoading(true);
      await tauri.changePin(currentPin, newPin);
      setChangePinOpen(false);
      setCurrentPin("");
      setNewPin("");
      setConfirmNewPin("");
    } catch {
      setPinError(t("settings.changePinError"));
    } finally {
      setPinLoading(false);
    }
  };

  const handleClearSession = async () => {
    if (!confirm(t("settings.clearSessionConfirm"))) return;
    await tauri.clearSavedSession();
    setHasSavedSession(false);
    setView("init");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t("settings.title")}
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

        <div className="p-4 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t("settings.language")}
            </label>
            <div className="flex gap-2">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                  className={`flex-1 py-2 px-3 text-sm rounded-lg border transition-colors ${
                    locale === lang.code
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                      : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t("settings.theme")}
            </label>
            <div className="flex gap-2">
              {(["system", "light", "dark"] as ThemeMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setTheme(mode)}
                  className={`flex-1 py-2 px-3 text-sm rounded-lg border transition-colors ${
                    theme === mode
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                      : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  {themeLabel(mode)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t("settings.fontSize")}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={6}
                max={24}
                step={1}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="flex-1 accent-blue-600"
              />
              <span className="text-sm font-mono text-gray-600 dark:text-gray-400 w-10 text-right">
                {fontSize}px
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t("settings.autoLock")}
            </label>
            <select
              value={autoLockMinutes}
              onChange={(e) => setAutoLockMinutes(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={1}>{t("settings.autoLock.1min")}</option>
              <option value={5}>{t("settings.autoLock.5min")}</option>
              <option value={15}>{t("settings.autoLock.15min")}</option>
              <option value={30}>{t("settings.autoLock.30min")}</option>
              <option value={60}>{t("settings.autoLock.1hour")}</option>
              <option value={0}>{t("settings.autoLock.never")}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t("settings.dbPath")}
            </label>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-mono break-all">
              {dbPath || t("settings.dbPathNotSet")}
            </p>
          </div>

          <div className="pt-2 border-t border-gray-200 dark:border-gray-700 space-y-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("settings.pinSection")}
            </label>

            {!pinExists ? (
              <button
                onClick={() => { onClose(); setView("pin-setup"); }}
                className="w-full py-2 px-4 text-sm border border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
              >
                {t("settings.setupPin")}
              </button>
            ) : !changePinOpen ? (
              <div className="flex gap-2">
                <button
                  onClick={() => setChangePinOpen(true)}
                  className="flex-1 py-2 px-4 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  {t("settings.changePin")}
                </button>
                <button
                  onClick={async () => {
                    if (!confirm(t("settings.removePinConfirm"))) return;
                    await tauri.removePin();
                    setPinExists(false);
                    setHasPinCode(false);
                  }}
                  className="py-2 px-4 text-sm border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  {t("settings.removePin")}
                </button>
              </div>
            ) : (
              <form onSubmit={handleChangePin} className="space-y-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 text-center">
                    {t("settings.currentPin")}
                  </label>
                  <PinInput value={currentPin} onChange={setCurrentPin} autoFocus />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 text-center">
                    {t("settings.newPin")}
                  </label>
                  <PinInput value={newPin} onChange={setNewPin} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 text-center">
                    {t("settings.confirmNewPin")}
                  </label>
                  <PinInput value={confirmNewPin} onChange={setConfirmNewPin} />
                </div>
                {pinError && <p className="text-red-500 text-xs">{pinError}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setChangePinOpen(false);
                      setCurrentPin("");
                      setNewPin("");
                      setConfirmNewPin("");
                      setPinError("");
                    }}
                    className="flex-1 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    {t("settings.changePinCancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={pinLoading || currentPin.length < 4 || newPin.length < 4}
                    className="flex-1 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center justify-center gap-1"
                  >
                    {pinLoading && <Spinner size="sm" className="border-white/30 border-t-white" />}
                    {t("settings.changePinSubmit")}
                  </button>
                </div>
              </form>
            )}

            <div className="pt-1">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                {t("settings.clearSessionHint")}
              </p>
              <button
                onClick={handleClearSession}
                className="w-full py-2 px-4 text-sm bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded-lg transition-colors"
              >
                {t("settings.clearSession")}
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => { tauri.clearCachedKey().catch(() => {}); lock(); }}
              className="w-full py-2 px-4 text-sm bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 rounded-lg transition-colors"
            >
              {t("settings.lockNow")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
