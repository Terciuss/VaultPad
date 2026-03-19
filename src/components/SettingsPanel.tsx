// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { open } from "@tauri-apps/plugin-dialog";
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
      {children}
    </h3>
  );
}

export function SettingsPanel({ open: isOpen, onClose }: SettingsPanelProps) {
  const { t, i18n } = useTranslation();
  const tauri = useTauri();
  const { theme, setTheme } = useTheme();
  const fontSize = useAppStore((s) => s.fontSize);
  const setFontSize = useAppStore((s) => s.setFontSize);
  const wordWrap = useAppStore((s) => s.wordWrap);
  const setWordWrap = useAppStore((s) => s.setWordWrap);
  const autoLockMinutes = useAppStore((s) => s.autoLockMinutes);
  const setAutoLockMinutes = useAppStore((s) => s.setAutoLockMinutes);
  const autoSyncEnabled = useAppStore((s) => s.autoSyncEnabled);
  const setAutoSyncEnabled = useAppStore((s) => s.setAutoSyncEnabled);
  const dbPath = useAppStore((s) => s.dbPath);
  const dbFolder = useAppStore((s) => s.dbFolder);
  const setDbFolder = useAppStore((s) => s.setDbFolder);
  const setDbPath = useAppStore((s) => s.setDbPath);
  const lock = useAppStore((s) => s.lock);
  const locale = useAppStore((s) => s.locale);
  const setLocale = useAppStore((s) => s.setLocale);
  const setView = useAppStore((s) => s.setView);
  const setHasSavedSession = useAppStore((s) => s.setHasSavedSession);
  const setHasPinCode = useAppStore((s) => s.setHasPinCode);
  const servers = useAppStore((s) => s.servers);
  const activeContextId = useAppStore((s) => s.activeContextId);

  const [changePinOpen, setChangePinOpen] = useState(false);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmNewPin, setConfirmNewPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinLoading, setPinLoading] = useState(false);
  const [pinExists, setPinExists] = useState(false);
  const [folderChanging, setFolderChanging] = useState(false);
  const [openOtherDbLoading, setOpenOtherDbLoading] = useState(false);

  const isConnectedToServer = servers.some(
    (s) => s.id === activeContextId && s.is_authenticated
  );

  useEffect(() => {
    if (isOpen) {
      tauri.hasPin().then(setPinExists).catch(() => {});
      if (!dbFolder) {
        tauri.getDbFolder().then((f) => {
          if (f) setDbFolder(f);
        }).catch(() => {});
      }
    }
  }, [isOpen, tauri, dbFolder, setDbFolder]);

  if (!isOpen) return null;

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
    try {
      await tauri.clearSavedSession();
      setHasSavedSession(false);

      const defaultFolder = await tauri.getDefaultDbFolder();
      const defaultPath = `${defaultFolder.replace(/\/$/, "")}/vaultpad.db`;
      await tauri.initDefaultDatabase(defaultPath);
      setDbPath(defaultPath);
      setDbFolder(defaultFolder);

      const pinExistsNow = await tauri.hasPin();
      setHasPinCode(pinExistsNow);

      if (pinExistsNow) {
        setView("pin-unlock");
      } else {
        const hasMaster = await tauri.hasMasterPassword();
        setView(hasMaster ? "unlock" : "master-password-setup");
      }
      onClose();
    } catch (e) {
      console.error("Clear session failed:", e);
      setView("init");
    }
  };

  const handleOpenOtherDb = async () => {
    try {
      const path = await open({
        title: t("settings.openOtherDb"),
        filters: [{ name: "Database", extensions: ["db"] }],
      });
      if (!path || typeof path !== "string") return;

      setOpenOtherDbLoading(true);
      await tauri.openLocalDatabase(path);

      const sep = path.includes("\\") ? "\\" : "/";
      const lastSep = path.lastIndexOf(sep);
      const parent = lastSep > 0 ? path.slice(0, lastSep) : path;

      setDbPath(path);
      setDbFolder(parent);
      await tauri.clearCachedKey();
      lock();
      onClose();
    } catch (e) {
      alert(String(e));
    } finally {
      setOpenOtherDbLoading(false);
    }
  };

  const handleChangeDbFolder = async () => {
    try {
      const folder = await open({
        title: t("settings.dbFolderConfirm"),
        directory: true,
      });
      if (!folder) return;

      setFolderChanging(true);
      const newPath = await tauri.changeDbFolder(folder as string);
      setDbFolder(folder as string);
      if (newPath) {
        setDbPath(newPath);
      }
    } catch (e) {
      alert(String(e));
    } finally {
      setFolderChanging(false);
    }
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

        <div className="p-4 space-y-6">
          {/* --- Editor --- */}
          <div>
            <SectionTitle>{t("settings.section.editor")}</SectionTitle>
            <div className="space-y-4">
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
                <label className="flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-300">
                  <span>{t("settings.wordWrap")}</span>
                  <button
                    onClick={() => setWordWrap(!wordWrap)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      wordWrap ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                        wordWrap ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </label>
              </div>
            </div>
          </div>

          {/* --- Appearance --- */}
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <SectionTitle>{t("settings.section.appearance")}</SectionTitle>
            <div className="space-y-4">
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
            </div>
          </div>

          {/* --- Security --- */}
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <SectionTitle>{t("settings.section.security")}</SectionTitle>
            <div className="space-y-4">
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
              </div>

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

              <button
                onClick={() => { tauri.clearCachedKey().catch(() => {}); lock(); }}
                className="w-full py-2 px-4 text-sm bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 rounded-lg transition-colors"
              >
                {t("settings.lockNow")}
              </button>
            </div>
          </div>

          {/* --- Synchronization (visible only when connected) --- */}
          {isConnectedToServer && (
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <SectionTitle>{t("settings.section.sync")}</SectionTitle>
              <div className="space-y-2">
                <label className="flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-300">
                  <div>
                    <span>{t("settings.autoSync")}</span>
                    <p className="text-xs font-normal text-gray-500 dark:text-gray-400 mt-0.5">
                      {t("settings.autoSyncHint")}
                    </p>
                  </div>
                  <button
                    onClick={() => setAutoSyncEnabled(!autoSyncEnabled)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                      autoSyncEnabled ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                        autoSyncEnabled ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </label>
              </div>
            </div>
          )}

          {/* --- Storage --- */}
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <SectionTitle>{t("settings.section.storage")}</SectionTitle>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t("settings.dbPath")}
                </label>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-mono break-all">
                  {dbPath || t("settings.dbPathNotSet")}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 mb-1">
                  {t("settings.openOtherDbHint")}
                </p>
                <button
                  onClick={handleOpenOtherDb}
                  disabled={openOtherDbLoading}
                  className="w-full py-2 px-4 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {openOtherDbLoading ? <Spinner size="sm" /> : null}
                  {t("settings.openOtherDb")}
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t("settings.dbFolder")}
                </label>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-mono break-all flex-1 min-w-0">
                    {dbFolder || t("settings.dbFolderNotSet")}
                  </p>
                  <button
                    onClick={handleChangeDbFolder}
                    disabled={folderChanging}
                    className="shrink-0 py-1.5 px-3 text-xs border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {folderChanging ? <Spinner size="sm" /> : t("settings.dbFolderChange")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
