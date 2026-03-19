// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore, selectProjectsForContext } from "../store";
import { SyncStatusIcon } from "./SyncStatusIcon";
import { ServerDropdownMenu } from "./ServerDropdownMenu";
import { ProjectList } from "./ProjectList";
import type { ProjectListItem, ServerSyncStatus } from "../lib/types";

interface ServerItemServer {
  id: string;
  name: string;
  url: string;
  is_authenticated: boolean;
  has_master_password: boolean;
  is_admin: boolean;
  sync_status: ServerSyncStatus;
  sync_error: string | null;
}

interface ServerItemProps {
  server: ServerItemServer;
  onAuth: (serverId: string) => void;
  onMasterPassword: (serverId: string) => void;
  onSwitch: (serverId: string) => void;
  onSync: (serverId: string) => void;
  onRemove: (serverId: string) => void;
  onChangeMasterPassword: (serverId: string) => void;
  onChangeCredentials: (serverId: string) => void;
  onOpenAdminPanel: () => void;
  onSelectProject: (project: ProjectListItem, contextId: string) => void;
  onEditProject: (project: ProjectListItem) => void;
  onDeleteProject: (project: ProjectListItem) => void;
  onReorderProjects: (reordered: ProjectListItem[]) => void;
  loadingProjects: boolean;
  openingProjectId: string | null;
}

export function ServerItem({
  server,
  onAuth,
  onMasterPassword,
  onSwitch,
  onSync,
  onRemove,
  onChangeMasterPassword,
  onChangeCredentials,
  onOpenAdminPanel,
  onSelectProject,
  onEditProject,
  onDeleteProject,
  onReorderProjects,
  loadingProjects,
  openingProjectId,
}: ServerItemProps) {
  const { t } = useTranslation();
  const activeContextId = useAppStore((s) => s.activeContextId);
  const selectedProjectId = useAppStore((s) => s.selectedProjectId);
  const expandedServers = useAppStore((s) => s.expandedServers);
  const toggleServerExpanded = useAppStore((s) => s.toggleServerExpanded);

  const isExpanded = expandedServers.has(server.id);
  const isActive = activeContextId === server.id;
  const projectsSelector = useMemo(() => selectProjectsForContext(server.id), [server.id]);
  const serverProjects = useAppStore(projectsSelector);
  const isReady = server.is_authenticated && server.has_master_password;

  return (
    <div>
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
              onAuth(server.id);
            } else if (!server.has_master_password) {
              onMasterPassword(server.id);
            } else {
              onSwitch(server.id);
            }
          }}
          className="flex-1 text-left truncate"
        >
          {server.name}
        </button>

        <SyncStatusIcon
          status={server.sync_status}
          errorMessage={server.sync_error}
          onErrorClick={() => onSync(server.id)}
        />

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
          {isReady && (
            <button
              onClick={(e) => { e.stopPropagation(); onSync(server.id); }}
              className="p-0.5 rounded text-gray-400 hover:text-blue-500 transition-colors"
              title={t("servers.sync")}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
          {isReady && (
            <ServerDropdownMenu
              isAdmin={server.is_admin}
              serverName={server.name}
              serverUrl={server.url}
              onChangeMasterPassword={() => onChangeMasterPassword(server.id)}
              onChangeCredentials={() => onChangeCredentials(server.id)}
              onOpenAdminPanel={onOpenAdminPanel}
              onRemove={() => onRemove(server.id)}
            />
          )}
          {!isReady && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(server.id); }}
              className="p-0.5 rounded text-gray-400 hover:text-red-500 transition-colors"
              title={t("serverMenu.removeServer")}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {isExpanded && isActive && loadingProjects && (
        <div className="pl-5 px-3 py-2">
          <div className="space-y-1.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-6 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
            ))}
          </div>
        </div>
      )}

      {isExpanded && !(isActive && loadingProjects) && serverProjects !== undefined && serverProjects.length > 0 && (
        <div className="pl-5">
          <ProjectList
            projects={serverProjects}
            selectedProjectId={selectedProjectId}
            openingProjectId={openingProjectId}
            isActive={isActive}
            contextId={server.id}
            onSelect={onSelectProject}
            onEdit={onEditProject}
            onDelete={onDeleteProject}
            onReorder={onReorderProjects}
          />
        </div>
      )}

      {isExpanded && !(isActive && loadingProjects) && serverProjects !== undefined && serverProjects.length === 0 && (
        <div className="pl-5 px-3 py-1">
          <p className="text-xs text-gray-400">{t("sidebar.empty")}</p>
        </div>
      )}

      {isExpanded && serverProjects === undefined && !isActive && (
        <div className="pl-5 px-3 py-1">
          <p className="text-xs text-gray-400 italic">
            {t("servers.notLoaded")}
          </p>
        </div>
      )}
    </div>
  );
}
