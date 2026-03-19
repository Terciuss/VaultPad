// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

import { useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Spinner } from "./Spinner";
import type { ProjectListItem } from "../lib/types";

interface ProjectListProps {
  projects: ProjectListItem[];
  selectedProjectId: string | null;
  openingProjectId: string | null;
  isActive: boolean;
  contextId: string;
  onSelect: (project: ProjectListItem, contextId: string) => void;
  onEdit: (project: ProjectListItem) => void;
  onDelete: (project: ProjectListItem) => void;
  onReorder: (reordered: ProjectListItem[]) => void;
}

export function ProjectList({
  projects,
  selectedProjectId,
  openingProjectId,
  isActive,
  contextId,
  onSelect,
  onEdit,
  onDelete,
  onReorder,
}: ProjectListProps) {
  const { t } = useTranslation();
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
      onReorder(reordered);
    },
    [dragIdx, projects, onReorder]
  );

  return (
    <ul className="py-0.5">
      {projects.map((project, idx) => {
        if (project.is_password_registry) {
          return (
            <li key={project.id}>
              <button
                onClick={() => onSelect(project, contextId)}
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
            draggable={isActive}
            onDragStart={isActive ? (e) => handleDragStart(e, idx) : undefined}
            onDragEnd={isActive ? handleDragEnd : undefined}
            onDragEnter={isActive ? () => handleDragEnter(idx) : undefined}
            onDragLeave={isActive ? handleDragLeave : undefined}
            onDragOver={isActive ? handleDragOver : undefined}
            onDrop={isActive ? (e) => handleDrop(e, idx) : undefined}
          >
            <button
              onClick={() => onSelect(project, contextId)}
              className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                selectedProjectId === project.id
                  ? "bg-blue-100 dark:bg-blue-900/40 text-blue-900 dark:text-blue-100"
                  : isActive
                    ? "text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                    : "text-gray-400 dark:text-gray-500 hover:bg-gray-200/50 dark:hover:bg-gray-700/50"
              }`}
            >
              <div className={`flex items-center gap-2 ${isActive ? "pr-14" : ""}`}>
                {project.has_custom_password && (
                  <svg className={`w-3 h-3 shrink-0 ${project.password_saved ? "text-amber-500" : "text-gray-400 dark:text-gray-500"}`} fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                <span className={`truncate ${!project.password_saved && project.has_custom_password ? "italic text-gray-400 dark:text-gray-500" : ""}`}>
                  {project.name || t("project.lockedCustomPassword")}
                </span>
              </div>
            </button>
            {openingProjectId === project.id && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <Spinner size="sm" />
              </div>
            )}
            {isActive && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(project); }}
                  className="p-1 rounded text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(project); }}
                  className="p-1 rounded text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
