// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

import { useTranslation } from "react-i18next";
import { useAppStore } from "../store";
import { LocalSection } from "./LocalSection";
import { ServerItem } from "./ServerItem";
import type { ProjectListItem } from "../lib/types";

interface SidebarProps {
  width: number;
  onNewProject: () => void;
  onSelectProject: (project: ProjectListItem, contextId: string) => void;
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
  const servers = useAppStore((s) => s.servers);
  const serversExpanded = useAppStore((s) => s.serversExpanded);
  const setServersExpanded = useAppStore((s) => s.setServersExpanded);

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
                servers.map((server) => (
                  <ServerItem
                    key={server.id}
                    server={server}
                    onAuth={onServerAuth}
                    onMasterPassword={onServerMasterPassword}
                    onSwitch={onServerSwitch}
                    onSync={onServerSync}
                    onRemove={onServerRemove}
                    onChangeMasterPassword={onChangeServerMasterPassword}
                    onChangeCredentials={onChangeCredentials}
                    onOpenAdminPanel={onOpenAdminPanel}
                    onSelectProject={onSelectProject}
                    onEditProject={onEditProject}
                    onDeleteProject={onDeleteProject}
                    onReorderProjects={onReorderProjects}
                    loadingProjects={loadingProjects}
                    openingProjectId={openingProjectId}
                  />
                ))
              )}
            </div>
          )}
        </div>

        {/* Local Section */}
        <LocalSection
          onSelectProject={onSelectProject}
          onEditProject={onEditProject}
          onDeleteProject={onDeleteProject}
          onReorderProjects={onReorderProjects}
          onSwitchToLocal={() => onServerSwitch("local")}
          onLocalSettings={onLocalSettings}
          loadingProjects={loadingProjects}
          openingProjectId={openingProjectId}
        />
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
