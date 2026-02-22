// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Editor } from "./Editor";
import { useAppStore } from "../store";
import { useTauri } from "../hooks/useTauri";

const DEBOUNCE_MS = 1500;

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface ContentViewProps {
  openingProject?: boolean;
}

export function ContentView({ openingProject }: ContentViewProps) {
  const { t } = useTranslation();
  const tauri = useTauri();
  const openProject = useAppStore((s) => s.openProject);
  const setOpenProject = useAppStore((s) => s.setOpenProject);
  const masterPassword = useAppStore((s) => s.masterPassword);
  const fontSize = useAppStore((s) => s.fontSize);

  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const contentRef = useRef(content);
  contentRef.current = content;
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;

  const openProjectRef = useRef(openProject);
  openProjectRef.current = openProject;
  const masterPasswordRef = useRef(masterPassword);
  masterPasswordRef.current = masterPassword;

  useEffect(() => {
    if (openProject) {
      setContent(openProject.content);
      setDirty(false);
      dirtyRef.current = false;
      setSaveStatus("idle");
      setError("");
    }
  }, [openProject?.id]);

  const handleSave = useCallback(async () => {
    const proj = openProjectRef.current;
    const mp = masterPasswordRef.current;
    if (!proj || !dirtyRef.current) return;

    setError("");
    setSaveStatus("saving");

    try {
      const password = proj.has_custom_password ? "" : (mp ?? "");
      await tauri.updateProject(
        proj.id,
        proj.name,
        contentRef.current,
        password,
        proj.has_custom_password
      );

      dirtyRef.current = false;
      setDirty(false);
      setOpenProject({ ...proj, content: contentRef.current });

      setSaveStatus("saved");
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (e) {
      setError(String(e));
      setSaveStatus("error");
    }
  }, [tauri, setOpenProject]);

  useEffect(() => {
    if (!dirty) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      handleSave();
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [dirty, handleSave]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (dirtyRef.current) {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          handleSave();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const handleContentChange = (value: string) => {
    setContent(value);
    setDirty(true);
  };

  if (!openProject) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-900">
        {openingProject ? (
          <div className="flex flex-col items-center gap-3 text-gray-400 dark:text-gray-500">
            <div className="w-10 h-10 border-3 rounded-full border-gray-300 dark:border-gray-600 border-t-blue-600 dark:border-t-blue-400 animate-spin" />
            <p className="text-sm">{t("loading.decrypting")}</p>
          </div>
        ) : (
          <div className="text-center text-gray-400 dark:text-gray-500">
            <svg
              className="w-16 h-16 mx-auto mb-4 opacity-30"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p>{t("content.placeholder")}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 h-full relative">
      {error && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm shrink-0">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        <Editor
          value={content}
          onChange={handleContentChange}
          placeholder={t("content.editorPlaceholder")}
          fontSize={fontSize}
        />
      </div>

      {saveStatus !== "idle" && (
        <div className="absolute bottom-3 right-4 pointer-events-none">
          <span
            className={`text-xs font-medium px-2 py-1 rounded-md ${
              saveStatus === "saving"
                ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30"
                : saveStatus === "saved"
                  ? "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30"
                  : "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30"
            }`}
          >
            {saveStatus === "saving" && t("content.autoSaving")}
            {saveStatus === "saved" && t("content.autoSaved")}
            {saveStatus === "error" && t("error.decryptFailed")}
          </span>
        </div>
      )}
    </div>
  );
}
