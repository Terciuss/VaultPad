// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useTauri } from "../hooks/useTauri";
import { useAppStore } from "../store";

interface LoginDialogProps {
  open: boolean;
  onClose: () => void;
}

export function LoginDialog({ open, onClose }: LoginDialogProps) {
  const { t } = useTranslation();
  const tauri = useTauri();
  const masterPassword = useAppStore((s) => s.masterPassword);
  const setProjects = useAppStore((s) => s.setProjects);

  const [mode, setMode] = useState<"login" | "register">("login");
  const [serverUrl, setServerUrl] = useState("http://localhost:8080");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "login") {
        await tauri.serverLogin(serverUrl, email, password);
      } else {
        const result = await tauri.serverRegister(serverUrl, email, password);
        await tauri.serverLogin(serverUrl, result.email, password);
      }
      setConnected(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncMessage("");
    setError("");
    setLoading(true);
    try {
      const msg = await tauri.syncProjects();
      setSyncMessage(msg);
      if (masterPassword) {
        const projects = await tauri.listProjects();
        setProjects(projects);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    await tauri.serverLogout();
    setConnected(false);
    setSyncMessage("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {connected ? t("login.connected") : t("login.connect")}
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

        <div className="p-4">
          {connected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-sm font-medium">
                  {t("login.connectedTo", { url: serverUrl })}
                </span>
              </div>

              <button
                onClick={handleSync}
                disabled={loading}
                className="w-full py-2 px-4 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                {loading ? t("login.syncing") : t("login.syncNow")}
              </button>

              {syncMessage && (
                <p className="text-sm text-green-600 dark:text-green-400">
                  {syncMessage}
                </p>
              )}

              <button
                onClick={handleDisconnect}
                className="w-full py-2 px-4 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
              >
                {t("login.disconnect")}
              </button>
            </div>
          ) : (
            <>
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setMode("login")}
                  className={`flex-1 py-1.5 text-sm rounded-lg transition-colors ${
                    mode === "login"
                      ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                      : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  {t("login.tab.login")}
                </button>
                <button
                  onClick={() => setMode("register")}
                  className={`flex-1 py-1.5 text-sm rounded-lg transition-colors ${
                    mode === "register"
                      ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                      : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  {t("login.tab.register")}
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    {t("login.serverUrl")}
                  </label>
                  <input
                    type="url"
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    {t("login.email")}
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    {t("login.password")}
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div
                  className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs text-blue-700 dark:text-blue-300"
                  dangerouslySetInnerHTML={{ __html: t("login.hint") }}
                />

                {error && <p className="text-red-500 text-sm">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 px-4 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                >
                  {loading
                    ? t("login.connecting")
                    : mode === "login"
                      ? t("login.tab.login")
                      : t("login.tab.register")}
                </button>
              </form>
            </>
          )}

          {error && connected && (
            <p className="text-red-500 text-sm mt-2">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
