// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

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
  loadingProjects: boolean;
  openingProjectId: string | null;
}

export function Sidebar({
  width,
  onNewProject,
  onSelectProject,
  onEditProject,
  onDeleteProject,
  loadingProjects,
  openingProjectId,
}: SidebarProps) {
  const { t } = useTranslation();
  const projects = useAppStore((s) => s.projects);
  const selectedProjectId = useAppStore((s) => s.selectedProjectId);

  return (
    <div
      className="bg-gray-100 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full shrink-0"
      style={{ width }}
    >
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {t("sidebar.title")}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loadingProjects ? (
          <div className="p-3 space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-8 rounded-md bg-gray-200 dark:bg-gray-700 animate-pulse"
              />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="p-4 text-sm text-gray-400 dark:text-gray-500 text-center">
            {t("sidebar.empty")}
          </div>
        ) : (
          <ul className="py-1">
            {projects.map((project) => (
              <li key={project.id} className="group relative">
                <button
                  onClick={() => onSelectProject(project)}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                    selectedProjectId === project.id
                      ? "bg-blue-100 dark:bg-blue-900/40 text-blue-900 dark:text-blue-100"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  <div className="flex items-center gap-2 pr-14">
                    {project.has_custom_password && (
                      <svg
                        className="w-3.5 h-3.5 text-amber-500 shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                    {openingProjectId === project.id ? (
                      <Spinner size="sm" />
                    ) : null}
                    <span className="truncate">
                      {project.name === "locked_custom_password"
                        ? t("project.lockedCustomPassword")
                        : project.name}
                    </span>
                  </div>
                </button>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditProject(project);
                    }}
                    className="p-1 rounded text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteProject(project);
                    }}
                    className="p-1 rounded text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
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
