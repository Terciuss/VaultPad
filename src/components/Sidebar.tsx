// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

import { useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../store";
import { Spinner } from "./Spinner";
import type { ProjectListItem } from "../lib/types";

interface SidebarProps {
  width: number;
  onNewProject: () => void;
  onSelectProject: (project: ProjectListItem) => void;
  onEditProject: (project: ProjectListItem) => void;
  onDeleteProject: (project: ProjectListItem) => void;
  onReorderProjects: (reordered: ProjectListItem[]) => void;
  loadingProjects: boolean;
  openingProjectId: string | null;
  onServerAuth: (serverId: string) => void;
  onServerSync: (serverId: string) => void;
  onServerRemove: (serverId: string) => void;
  onServerSwitch: (contextId: string) => void;
  onServerMasterPassword: (serverId: string) => void;
  onOpenAdminPanel: () => void;
  onLocalSettings: () => void;
  onChangeServerMasterPassword: (serverId: string) => void;
  onChangeCredentials: (serverId: string) => void;
}

function SyncStatusIcon({ status, errorMessage, onErrorClick }: { status: string; errorMessage?: string | null; onErrorClick?: () => void }) {
  const { t } = useTranslation();
  const [showTooltip, setShowTooltip] = useState(false);

  switch (status) {
    case "syncing":
      return (
        <svg className="w-3.5 h-3.5 text-blue-500 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
          <title>{t("sync.syncing")}</title>
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      );
    case "error":
      return (
        <div className="relative flex-shrink-0">
          <svg
            className="w-3.5 h-3.5 text-red-500 cursor-pointer"
            fill="currentColor"
            viewBox="0 0 20 20"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onClick={(e) => { e.stopPropagation(); onErrorClick?.(); }}
          >
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {showTooltip && (
            <div className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-1.5 px-2.5 py-1.5 rounded-md bg-red-900/95 text-white text-xs whitespace-nowrap shadow-lg border border-red-700/50 max-w-xs">
              <div className="font-medium">{t("sync.errorUnknown")}</div>
              {errorMessage && <div className="mt-0.5 opacity-80 break-all whitespace-normal max-w-[200px]">{errorMessage}</div>}
            </div>
          )}
        </div>
      );
    case "conflict":
      return (
        <svg
          className="w-3.5 h-3.5 text-orange-500 cursor-help flex-shrink-0"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <title>{t("sync.conflict")}</title>
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      );
    case "idle":
      return (
        <svg className="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <title>{t("sync.ok")}</title>
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      );
    default:
      return null;
  }
}

export function Sidebar({
  width,
  onNewProject,
  onSelectProject,
  onEditProject,
  onDeleteProject,
  onReorderProjects,
  loadingProjects,
  openingProjectId,
  onServerAuth,
  onServerSync,
  onServerRemove,
  onServerSwitch,
  onServerMasterPassword,
  onOpenAdminPanel,
  onLocalSettings,
  onChangeServerMasterPassword,
  onChangeCredentials,
}: SidebarProps) {
  const { t } = useTranslation();
  const projects = useAppStore((s) => s.projects);
  const selectedProjectId = useAppStore((s) => s.selectedProjectId);
  const servers = useAppStore((s) => s.servers);
  const activeContextId = useAppStore((s) => s.activeContextId);
  const expandedServers = useAppStore((s) => s.expandedServers);
  const toggleServerExpanded = useAppStore((s) => s.toggleServerExpanded);
  const serversExpanded = useAppStore((s) => s.serversExpanded);
  const setServersExpanded = useAppStore((s) => s.setServersExpanded);

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const dragCounter = useRef(0);

  const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(idx));
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.4";
    }
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "";
    }
    setDragIdx(null);
    setOverIdx(null);
    dragCounter.current = 0;
  }, []);

  const handleDragEnter = useCallback((idx: number) => {
    dragCounter.current++;
    setOverIdx(idx);
  }, []);

  const handleDragLeave = useCallback(() => {
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      setOverIdx(null);
      dragCounter.current = 0;
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetIdx: number) => {
      e.preventDefault();
      const sourceIdx = dragIdx;
      setDragIdx(null);
      setOverIdx(null);
      dragCounter.current = 0;

      if (sourceIdx === null || sourceIdx === targetIdx) return;

      const reordered = [...projects];
      const [moved] = reordered.splice(sourceIdx, 1);
      reordered.splice(targetIdx, 0, moved);
      onReorderProjects(reordered);
    },
    [dragIdx, projects, onReorderProjects]
  );

  const renderProjectList = (projectList: ProjectListItem[]) => (
    <ul className="py-0.5">
      {projectList.map((project, idx) => {
        if (project.is_password_registry) {
          return (
            <li key={project.id}>
              <button
                onClick={() => onSelectProject(project)}
                className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                  selectedProjectId === project.id
                    ? "bg-purple-100 dark:bg-purple-900/40 text-purple-900 dark:text-purple-100"
                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                <div className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-purple-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="truncate text-xs italic">
                    {t("passwordRegistry.title")}
                  </span>
                </div>
              </button>
            </li>
          );
        }

        const isOver = overIdx === idx && dragIdx !== null && dragIdx !== idx;
        const dropAbove = isOver && dragIdx !== null && dragIdx > idx;
        const dropBelow = isOver && dragIdx !== null && dragIdx < idx;

        return (
          <li
            key={project.id}
            className={`group relative ${dropAbove ? "border-t-2 border-t-blue-500" : ""} ${dropBelow ? "border-b-2 border-b-blue-500" : ""}`}
            draggable
            onDragStart={(e) => handleDragStart(e, idx)}
            onDragEnd={handleDragEnd}
            onDragEnter={() => handleDragEnter(idx)}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, idx)}
          >
            <button
              onClick={() => onSelectProject(project)}
              className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                selectedProjectId === project.id
                  ? "bg-blue-100 dark:bg-blue-900/40 text-blue-900 dark:text-blue-100"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              <div className="flex items-center gap-2 pr-14">
                {project.has_custom_password && (
                  <svg className={`w-3 h-3 shrink-0 ${project.password_saved ? "text-amber-500" : "text-gray-400 dark:text-gray-500"}`} fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                {openingProjectId === project.id ? <Spinner size="sm" /> : null}
                <span className={`truncate ${!project.password_saved && project.has_custom_password ? "italic text-gray-400 dark:text-gray-500" : ""}`}>
                  {project.name || t("project.lockedCustomPassword")}
                </span>
              </div>
            </button>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
              <button
                onClick={(e) => { e.stopPropagation(); onEditProject(project); }}
                className="p-1 rounded text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteProject(project); }}
                className="p-1 rounded text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div
      className="bg-gray-100 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full shrink-0"
      style={{ width }}
    >
      <div className="flex-1 overflow-y-auto">
        {/* Servers Section */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setServersExpanded(!serversExpanded)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <span>{t("servers.title")}</span>
            <svg
              className={`w-3.5 h-3.5 transition-transform ${serversExpanded ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {serversExpanded && (
            <div className="pb-2">
              {servers.length === 0 ? (
                <p className="px-3 py-1 text-xs text-gray-400 dark:text-gray-500">
                  {t("servers.empty")}
                </p>
              ) : (
                servers.map((server) => {
                  const isExpanded = expandedServers.has(server.id);
                  const isActive = activeContextId === server.id;

                  return (
                    <div key={server.id}>
                      <div
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm cursor-pointer transition-colors group ${
                          isActive
                            ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                            : "text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                        }`}
                      >
                        <button
                          onClick={() => toggleServerExpanded(server.id)}
                          className="shrink-0"
                        >
                          <svg
                            className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                        </button>

                        <button
                          onClick={() => {
                            if (!server.is_authenticated) {
                              onServerAuth(server.id);
                            } else if (!server.has_master_password) {
                              onServerMasterPassword(server.id);
                            } else {
                              onServerSwitch(server.id);
                            }
                          }}
                          className="flex-1 text-left truncate"
                        >
                          {server.name}
                        </button>

                        <SyncStatusIcon
                          status={server.sync_status}
                          errorMessage={server.sync_error}
                          onErrorClick={() => onServerSync(server.id)}
                        />

                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                          {server.is_authenticated && server.has_master_password && (
                            <>
                              <button
                                onClick={(e) => { e.stopPropagation(); onServerSync(server.id); }}
                                className="p-0.5 rounded text-gray-400 hover:text-blue-500 transition-colors"
                                title={t("servers.sync")}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); onChangeServerMasterPassword(server.id); }}
                                className="p-0.5 rounded text-gray-400 hover:text-amber-500 transition-colors"
                                title={t("changeMasterPassword.title")}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                </svg>
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); onChangeCredentials(server.id); }}
                                className="p-0.5 rounded text-gray-400 hover:text-green-500 transition-colors"
                                title={t("changeCredentials.button")}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                              </button>
                              {server.is_admin && (
                              <button
                                onClick={(e) => { e.stopPropagation(); onOpenAdminPanel(); }}
                                className="p-0.5 rounded text-gray-400 hover:text-purple-500 transition-colors"
                                title={t("admin.openPanel")}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                              </button>
                              )}
                            </>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); onServerRemove(server.id); }}
                            className="p-0.5 rounded text-gray-400 hover:text-red-500 transition-colors"
                            title={t("servers.remove")}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {isExpanded && isActive && !loadingProjects && (
                        <div className="pl-5">
                          {projects.length > 0 ? renderProjectList(projects) : (
                            <p className="px-3 py-1 text-xs text-gray-400">{t("sidebar.empty")}</p>
                          )}
                        </div>
                      )}
                      {isExpanded && isActive && loadingProjects && (
                        <div className="pl-5 px-3 py-2">
                          <div className="space-y-1.5">
                            {[1, 2, 3].map((i) => (
                              <div key={i} className="h-6 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                            ))}
                          </div>
                        </div>
                      )}
                      {isExpanded && !isActive && (
                        <div className="pl-5 px-3 py-1">
                          <p className="text-xs text-gray-400 italic">
                            {t("servers.switchTo")}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })
              )}

            </div>
          )}
        </div>

        {/* Local Storage Section */}
        <div>
          <div
            className={`flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
              activeContextId === "local"
                ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/10"
                : "text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            <button
              onClick={() => {
                if (activeContextId !== "local") {
                  onServerSwitch("local");
                }
              }}
              className="flex-1 text-left"
            >
              <span>{t("localSection.title")}</span>
            </button>
            <div className="flex items-center gap-1">
              {activeContextId === "local" && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); onLocalSettings(); }}
                    className="p-0.5 rounded text-gray-400 hover:text-amber-500 transition-colors"
                    title={t("changeMasterPassword.title")}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  </button>
                  <span className="text-[10px] font-normal normal-case tracking-normal text-blue-500">
                    {t("servers.active")}
                  </span>
                </>
              )}
            </div>
          </div>

          {activeContextId === "local" && (
            <>
              {loadingProjects ? (
                <div className="p-3 space-y-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-8 rounded-md bg-gray-200 dark:bg-gray-700 animate-pulse" />
                  ))}
                </div>
              ) : projects.length === 0 ? (
                <div className="p-4 text-sm text-gray-400 dark:text-gray-500 text-center">
                  {t("sidebar.empty")}
                </div>
              ) : (
                renderProjectList(projects)
              )}
            </>
          )}
        </div>
      </div>

      <div className="p-3 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onNewProject}
          className="w-full py-2 px-3 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t("sidebar.newProject")}
        </button>
      </div>
    </div>
  );
}
