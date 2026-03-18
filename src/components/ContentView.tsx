// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Editor } from "./Editor";
import { SearchBar } from "./SearchBar";
import { BackupHistoryPanel } from "./BackupHistoryPanel";
import { PasswordRegistryView } from "./PasswordRegistryView";
import { useAppStore } from "../store";
import { useTauri } from "../hooks/useTauri";
import { useDebounce } from "../hooks/useDebounce";
import type { Editor as TiptapEditor } from "@tiptap/react";

const PASSWORD_REGISTRY_UUID = "00000000-0000-0000-0000-000000000001";

const DEBOUNCE_MS = 1500;

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface ContentViewProps {
  openingProject?: boolean;
  onLocalSave?: () => void;
}

export function ContentView({ openingProject, onLocalSave }: ContentViewProps) {
  const { t } = useTranslation();
  const tauri = useTauri();
  const openProject = useAppStore((s) => s.openProject);
  const setOpenProject = useAppStore((s) => s.setOpenProject);
  const masterPassword = useAppStore((s) => s.masterPassword);
  const fontSize = useAppStore((s) => s.fontSize);
  const wordWrap = useAppStore((s) => s.wordWrap);
  const selectedProjectId = useAppStore((s) => s.selectedProjectId);

  const isPasswordRegistry = selectedProjectId === PASSWORD_REGISTRY_UUID;

  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchShowReplace, setSearchShowReplace] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const saveDebounce = useDebounce(DEBOUNCE_MS);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const editorInstanceRef = useRef<TiptapEditor | null>(null);

  const contentRef = useRef(content);
  contentRef.current = content;
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;

  const openProjectRef = useRef(openProject);
  openProjectRef.current = openProject;
  const masterPasswordRef = useRef(masterPassword);
  masterPasswordRef.current = masterPassword;
  const onLocalSaveRef = useRef(onLocalSave);
  onLocalSaveRef.current = onLocalSave;

  const prevOpenProjectRef = useRef(openProject);

  useEffect(() => {
    if (dirtyRef.current && prevOpenProjectRef.current) {
      saveDebounce.cancel();
      const prev = prevOpenProjectRef.current;
      const prevContent = contentRef.current;
      const mp = masterPasswordRef.current;
      const password = prev.has_custom_password ? "" : (mp ?? "");
      tauri.updateProject(prev.id, prev.name, prevContent, password, prev.has_custom_password)
        .then(() => { onLocalSaveRef.current?.(); })
        .catch(e => console.error("Flush save failed:", e));
    }

    if (openProject) {
      setContent(openProject.content);
      setDirty(false);
      dirtyRef.current = false;
      setSaveStatus("idle");
      setError("");
      setSearchOpen(false);
    }

    prevOpenProjectRef.current = openProject;
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
      onLocalSaveRef.current?.();
    } catch (e) {
      setError(String(e));
      setSaveStatus("error");
    }
  }, [tauri, setOpenProject]);

  useEffect(() => {
    if (!dirty) return;
    saveDebounce.run(handleSave);
  }, [dirty, content, handleSave, saveDebounce]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (dirtyRef.current) {
          saveDebounce.cancel();
          handleSave();
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setSearchShowReplace(false);
        setSearchOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "h") {
        e.preventDefault();
        setSearchShowReplace(true);
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave]);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      if (dirtyRef.current && openProjectRef.current) {
        saveDebounce.cancel();
        const proj = openProjectRef.current;
        const mp = masterPasswordRef.current;
        const password = proj.has_custom_password ? "" : (mp ?? "");
        tauri.updateProject(proj.id, proj.name, contentRef.current, password, proj.has_custom_password)
          .catch(() => {});
      }
    };
  }, []);

  const handleContentChange = (value: string) => {
    const isEmpty = !value || value === "<p></p>" || value === "<p><br></p>";
    const projectHasContent = openProjectRef.current &&
      openProjectRef.current.content &&
      openProjectRef.current.content.length > 0 &&
      openProjectRef.current.content !== "<p></p>";

    if (isEmpty && projectHasContent) {
      return;
    }

    setContent(value);
    setDirty(true);
  };

  const handleEditorReady = useCallback((editor: TiptapEditor | null) => {
    editorInstanceRef.current = editor;
  }, []);

  const handleBackupRestore = useCallback(async () => {
    const proj = openProjectRef.current;
    const mp = masterPasswordRef.current;
    if (!proj) return;
    try {
      const password = proj.has_custom_password ? "" : (mp ?? "");
      const updated = await tauri.getProject(proj.id, password);
      setContent(updated.content);
      setOpenProject(updated);
      setDirty(false);
      dirtyRef.current = false;
      setHistoryOpen(false);
    } catch (e) {
      setError(String(e));
    }
  }, [tauri, setOpenProject]);

  if (isPasswordRegistry) {
    return (
      <div className="flex-1 flex bg-white dark:bg-gray-900 h-full">
        <PasswordRegistryView />
      </div>
    );
  }

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

      {searchOpen && editorInstanceRef.current && (
        <SearchBar
          editor={editorInstanceRef.current}
          onClose={() => setSearchOpen(false)}
          showReplace={searchShowReplace}
        />
      )}

      <div className="flex-1 overflow-hidden">
        <Editor
          value={content}
          onChange={handleContentChange}
          placeholder={t("content.editorPlaceholder")}
          fontSize={fontSize}
          wordWrap={wordWrap}
          onEditorReady={handleEditorReady}
        />
      </div>

      <div className="absolute bottom-3 right-4 flex items-center gap-2">
        {saveStatus !== "idle" && (
          <span
            className={`text-xs font-medium px-2 py-1 rounded-md pointer-events-none ${
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
        )}
        <button
          onClick={() => setHistoryOpen(true)}
          className="p-1.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 bg-white/80 dark:bg-gray-800/80 rounded-md backdrop-blur-sm transition-colors"
          title={t("backup.historyTitle")}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </div>

      {historyOpen && openProject && (
        <BackupHistoryPanel
          projectId={openProject.id}
          currentContent={content}
          password={openProject.has_custom_password ? "" : (masterPassword ?? "")}
          onRestore={handleBackupRestore}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </div>
  );
}
