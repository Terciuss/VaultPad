// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useTauri, type AdminUser, type UserShare } from "../hooks/useTauri";
import { useAppStore } from "../store";

interface AdminPanelProps {
  open: boolean;
  onClose: () => void;
}

interface UserCardState {
  email: string;
  password: string;
  isAdmin: boolean;
  saving: boolean;
  shares: UserShare[];
  sharesLoading: boolean;
  shareProjectId: string;
  sharing: boolean;
}

export function AdminPanel({ open, onClose }: AdminPanelProps) {
  const { t } = useTranslation();
  const tauri = useTauri();
  const projects = useAppStore((s) => s.projects);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);
  const [cardState, setCardState] = useState<UserCardState | null>(null);

  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const list = await tauri.adminListUsers();
      setUsers(list);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [tauri]);

  useEffect(() => {
    if (open) {
      loadUsers();
      setExpandedUserId(null);
      setCardState(null);
    }
  }, [open, loadUsers]);

  const expandUser = useCallback(async (user: AdminUser) => {
    if (expandedUserId === user.id) {
      setExpandedUserId(null);
      setCardState(null);
      return;
    }

    setExpandedUserId(user.id);
    setCardState({
      email: user.email,
      password: "",
      isAdmin: user.is_admin,
      saving: false,
      shares: [],
      sharesLoading: true,
      shareProjectId: "",
      sharing: false,
    });

    try {
      const shares = await tauri.adminListUserShares(user.id);
      setCardState((prev) => prev ? { ...prev, shares, sharesLoading: false } : null);
    } catch {
      setCardState((prev) => prev ? { ...prev, sharesLoading: false } : null);
    }
  }, [expandedUserId, tauri]);

  if (!open) return null;

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      await tauri.adminCreateUser(newEmail, newPassword, newIsAdmin);
      setNewEmail("");
      setNewPassword("");
      setNewIsAdmin(false);
      loadUsers();
    } catch (e) {
      setError(String(e));
    } finally {
      setCreating(false);
    }
  };

  const handleSaveUser = async () => {
    if (!cardState || expandedUserId === null) return;
    setCardState((prev) => prev ? { ...prev, saving: true } : null);
    setError("");
    try {
      await tauri.adminUpdateUser(expandedUserId, cardState.email, cardState.password, cardState.isAdmin);
      setCardState((prev) => prev ? { ...prev, saving: false, password: "" } : null);
      loadUsers();
    } catch (e) {
      setError(String(e));
      setCardState((prev) => prev ? { ...prev, saving: false } : null);
    }
  };

  const handleDeleteUser = async (user: AdminUser) => {
    if (!confirm(`${t("admin.deleteConfirm")} ${user.email}?`)) return;
    try {
      await tauri.adminDeleteUser(user.id);
      if (expandedUserId === user.id) {
        setExpandedUserId(null);
        setCardState(null);
      }
      loadUsers();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleAddShare = async () => {
    if (!cardState || expandedUserId === null || !cardState.shareProjectId) return;
    setCardState((prev) => prev ? { ...prev, sharing: true } : null);
    setError("");
    try {
      await tauri.shareProject(parseInt(cardState.shareProjectId), expandedUserId);
      const shares = await tauri.adminListUserShares(expandedUserId);
      setCardState((prev) => prev ? { ...prev, shares, shareProjectId: "", sharing: false } : null);
    } catch (e) {
      setError(String(e));
      setCardState((prev) => prev ? { ...prev, sharing: false } : null);
    }
  };

  const handleRemoveShare = async (projectId: number) => {
    if (expandedUserId === null) return;
    setError("");
    try {
      await tauri.unshareProject(projectId, expandedUserId);
      const shares = await tauri.adminListUserShares(expandedUserId);
      setCardState((prev) => prev ? { ...prev, shares } : null);
    } catch (e) {
      setError(String(e));
    }
  };

  const getProjectName = (projectId: number): string => {
    const sid = String(projectId);
    const p = projects.find((pr) => pr.server_id === sid);
    if (!p) return `#${projectId}`;
    return p.name === "locked_custom_password" ? `[locked] (#${projectId})` : p.name;
  };

  const sharedProjectIds = new Set(cardState?.shares.map((s) => String(s.project_id)) ?? []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t("admin.title")}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {t("admin.users")}
            </h3>
            {loading ? (
              <div className="text-sm text-gray-400">{t("loading.startup")}</div>
            ) : (
              <div className="space-y-1">
                {users.map((user) => {
                  const isExpanded = expandedUserId === user.id;
                  return (
                    <div key={user.id} className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                      <button
                        onClick={() => expandUser(user)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                          isExpanded
                            ? "bg-blue-50 dark:bg-blue-900/20"
                            : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 w-6 text-right">{user.id}</span>
                          <span className="text-gray-800 dark:text-gray-200">{user.email}</span>
                          {user.is_admin && (
                            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                              admin
                            </span>
                          )}
                        </div>
                        <svg
                          className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {isExpanded && cardState && (
                        <div className="border-t border-gray-200 dark:border-gray-600 p-3 space-y-4 bg-gray-50/50 dark:bg-gray-800/50">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                {t("admin.email")}
                              </label>
                              <input
                                type="email"
                                value={cardState.email}
                                onChange={(e) => setCardState((prev) => prev ? { ...prev, email: e.target.value } : null)}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                {t("admin.password")}
                              </label>
                              <input
                                type="password"
                                value={cardState.password}
                                onChange={(e) => setCardState((prev) => prev ? { ...prev, password: e.target.value } : null)}
                                placeholder={t("admin.passwordHint")}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                              <input
                                type="checkbox"
                                checked={cardState.isAdmin}
                                onChange={(e) => setCardState((prev) => prev ? { ...prev, isAdmin: e.target.checked } : null)}
                                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                              />
                              Admin
                            </label>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleDeleteUser(user)}
                                className="px-3 py-1.5 text-xs text-red-600 hover:text-red-700 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                              >
                                {t("servers.remove")}
                              </button>
                              <button
                                onClick={handleSaveUser}
                                disabled={cardState.saving}
                                className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded transition-colors"
                              >
                                {cardState.saving ? "..." : t("admin.save")}
                              </button>
                            </div>
                          </div>

                          <div className="border-t border-gray-200 dark:border-gray-600 pt-3">
                            <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
                              {t("admin.userAccess")}
                            </h4>

                            {cardState.isAdmin ? (
                              <p className="text-xs text-gray-400 italic">{t("admin.adminHasAllAccess")}</p>
                            ) : (
                              <>
                                {cardState.sharesLoading ? (
                                  <div className="text-xs text-gray-400">...</div>
                                ) : cardState.shares.length === 0 ? (
                                  <p className="text-xs text-gray-400 italic">{t("admin.noShares")}</p>
                                ) : (
                                  <div className="space-y-1 mb-2">
                                    {cardState.shares.map((share) => (
                                      <div
                                        key={share.id}
                                        className="flex items-center justify-between px-2 py-1 text-xs bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded"
                                      >
                                        <span className="text-gray-700 dark:text-gray-300 truncate">
                                          {getProjectName(share.project_id)}
                                        </span>
                                        <button
                                          onClick={() => handleRemoveShare(share.project_id)}
                                          className="text-red-400 hover:text-red-600 shrink-0 ml-2"
                                          title={t("admin.removeAccess")}
                                        >
                                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                <div className="flex gap-1.5 mt-2">
                                  <select
                                    value={cardState.shareProjectId}
                                    onChange={(e) => setCardState((prev) => prev ? { ...prev, shareProjectId: e.target.value } : null)}
                                    className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none"
                                  >
                                    <option value="">--</option>
                                    {projects
                                      .filter((p) => p.server_id && !sharedProjectIds.has(p.server_id))
                                      .map((p) => (
                                        <option key={p.server_id} value={p.server_id!}>
                                          {p.name === "locked_custom_password" ? `[locked] (${p.id})` : p.name}
                                        </option>
                                      ))}
                                  </select>
                                  <button
                                    onClick={handleAddShare}
                                    disabled={cardState.sharing || !cardState.shareProjectId}
                                    className="px-2.5 py-1 text-xs bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded transition-colors"
                                  >
                                    {cardState.sharing ? "..." : t("admin.addAccess")}
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {t("admin.createUser")}
            </h3>
            <form onSubmit={handleCreateUser} className="flex gap-2 items-end">
              <div className="flex-1">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Email"
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none"
                />
              </div>
              <div className="flex-1">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t("serverAuth.password")}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none"
                />
              </div>
              <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={newIsAdmin}
                  onChange={(e) => setNewIsAdmin(e.target.checked)}
                />
                Admin
              </label>
              <button
                type="submit"
                disabled={creating}
                className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded transition-colors"
              >
                {t("addServer.add")}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
