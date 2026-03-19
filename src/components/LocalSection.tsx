// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore, selectProjectsForContext } from "../store";
import { ProjectList } from "./ProjectList";
import type { ProjectListItem } from "../lib/types";

interface LocalSectionProps {
  onSelectProject: (project: ProjectListItem, contextId: string) => void;
  onEditProject: (project: ProjectListItem) => void;
  onDeleteProject: (project: ProjectListItem) => void;
  onReorderProjects: (reordered: ProjectListItem[]) => void;
  onSwitchToLocal: () => void;
  onLocalSettings: () => void;
  loadingProjects: boolean;
  openingProjectId: string | null;
}

export function LocalSection({
  onSelectProject,
  onEditProject,
  onDeleteProject,
  onReorderProjects,
  onSwitchToLocal,
  onLocalSettings,
  loadingProjects,
  openingProjectId,
}: LocalSectionProps) {
  const { t } = useTranslation();
  const activeContextId = useAppStore((s) => s.activeContextId);
  const selectedProjectId = useAppStore((s) => s.selectedProjectId);
  const localExpanded = useAppStore((s) => s.localExpanded);
  const setLocalExpanded = useAppStore((s) => s.setLocalExpanded);

  const isActive = activeContextId === "local";
  const projectsSelector = useMemo(() => selectProjectsForContext("local"), []);
  const localProjects = useAppStore(projectsSelector);

  return (
    <div>
      <div
        className={`flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
          isActive
            ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/10"
            : "text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
        }`}
      >
        <div className="flex items-center gap-1 flex-1">
          <button
            onClick={() => setLocalExpanded(!localExpanded)}
            className="shrink-0"
          >
            <svg
              className={`w-3 h-3 transition-transform ${localExpanded ? "rotate-90" : ""}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </button>
          <button
            onClick={() => {
              if (!isActive) onSwitchToLocal();
            }}
            className="flex-1 text-left"
          >
            <span>{t("localSection.title")}</span>
          </button>
        </div>
        <div className="flex items-center gap-1">
          {isActive && (
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

      {localExpanded && (
        <>
          {isActive && loadingProjects ? (
            <div className="pl-5 px-3 py-2">
              <div className="space-y-1.5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-6 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                ))}
              </div>
            </div>
          ) : localProjects && localProjects.length > 0 ? (
            <div className="pl-5">
              <ProjectList
                projects={localProjects}
                selectedProjectId={selectedProjectId}
                openingProjectId={openingProjectId}
                isActive={isActive}
                contextId="local"
                onSelect={onSelectProject}
                onEdit={onEditProject}
                onDelete={onDeleteProject}
                onReorder={onReorderProjects}
              />
            </div>
          ) : localProjects !== undefined ? (
            <div className="pl-5 px-3 py-1">
              <p className="text-xs text-gray-400">{t("sidebar.empty")}</p>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
