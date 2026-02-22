// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import { Sidebar } from "./Sidebar";
import { ContentView } from "./ContentView";
import { NewProjectDialog } from "./NewProjectDialog";
import { EditProjectDialog } from "./EditProjectDialog";
import { CustomPasswordDialog } from "./CustomPasswordDialog";
import { DeleteProjectDialog } from "./DeleteProjectDialog";
import { SettingsPanel } from "./SettingsPanel";
import { LoginDialog } from "./LoginDialog";
import { useAppStore } from "../store";
import { useTauri } from "../hooks/useTauri";
import { useAutoLock } from "../hooks/useAutoLock";
import type { ProjectListItem, DecryptedProject } from "../lib/types";

const SIDEBAR_MIN = 160;
const SIDEBAR_MAX = 480;
const SIDEBAR_STORAGE_KEY = "vaultpad-sidebar-width";

function getInitialSidebarWidth(): number {
  const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
  if (stored) {
    const n = parseInt(stored, 10);
    if (!isNaN(n) && n >= SIDEBAR_MIN && n <= SIDEBAR_MAX) return n;
  }
  return 256;
}

export function MainLayout() {
  const { t } = useTranslation();
  const tauri = useTauri();
  const masterPassword = useAppStore((s) => s.masterPassword);
  const setProjects = useAppStore((s) => s.setProjects);
  const selectedProjectId = useAppStore((s) => s.selectedProjectId);
  const setSelectedProjectId = useAppStore((s) => s.setSelectedProjectId);
  const openProject = useAppStore((s) => s.openProject);
  const setOpenProject = useAppStore((s) => s.setOpenProject);
  const lock = useAppStore((s) => s.lock);

  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [customPasswordProject, setCustomPasswordProject] =
    useState<ProjectListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectListItem | null>(null);
  const [editTarget, setEditTarget] = useState<DecryptedProject | null>(null);
  const [editPassword, setEditPassword] = useState<string | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [openingProjectId, setOpeningProjectId] = useState<string | null>(null);

  const [sidebarWidth, setSidebarWidth] = useState(getInitialSidebarWidth);
  const dragging = useRef(false);

  useAutoLock();

  const loadProjects = useCallback(async () => {
    if (!masterPassword) return;
    try {
      setLoadingProjects(true);
      const projects = await tauri.listProjects();
      setProjects(projects);
    } catch (e) {
      console.error("Failed to load projects:", e);
    } finally {
      setLoadingProjects(false);
    }
  }, [masterPassword, tauri, setProjects]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    const unlisten = listen<string>("menu-action", (event) => {
      switch (event.payload) {
        case "settings":
          setSettingsOpen(true);
          break;
        case "new-project":
          setNewProjectOpen(true);
          break;
        case "lock":
          tauri.clearCachedKey().catch(() => {});
          lock();
          break;
        case "server-connect":
          setLoginOpen(true);
          break;
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [tauri, lock]);

  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const onMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      const newWidth = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startWidth + delta));
      setSidebarWidth(newWidth);
    };

    const onMouseUp = () => {
      dragging.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setSidebarWidth((w) => {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, String(w));
        return w;
      });
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [sidebarWidth]);

  const handleSelectProject = async (project: ProjectListItem) => {
    if (project.has_custom_password && !project.password_saved) {
      setCustomPasswordProject(project);
      return;
    }

    try {
      setOpeningProjectId(project.id);
      const password = project.has_custom_password ? "" : (masterPassword ?? "");
      const decrypted = await tauri.getProject(project.id, password);
      setSelectedProjectId(project.id);
      setOpenProject(decrypted);
    } catch (e) {
      console.error("Failed to open project:", e);
    } finally {
      setOpeningProjectId(null);
    }
  };

  const handleEditProject = async (project: ProjectListItem) => {
    if (project.has_custom_password && !project.password_saved) {
      setCustomPasswordProject(project);
      return;
    }

    try {
      let decrypted: DecryptedProject;
      if (selectedProjectId === project.id && openProject) {
        decrypted = openProject;
      } else {
        const password = project.has_custom_password ? "" : (masterPassword ?? "");
        decrypted = await tauri.getProject(project.id, password);
      }

      let currentPw: string | null = null;
      if (project.has_custom_password) {
        currentPw = await tauri.getProjectPassword(project.id);
      }
      setEditPassword(currentPw);
      setEditTarget(decrypted);
    } catch (e) {
      console.error("Failed to open project for editing:", e);
    }
  };

  const handleEditSaved = () => {
    const target = editTarget;
    setEditTarget(null);
    setEditPassword(null);
    loadProjects();
    if (target && selectedProjectId === target.id) {
      const pw = target.has_custom_password ? "" : (masterPassword ?? "");
      tauri.getProject(target.id, pw).then((p) => {
        setOpenProject(p);
      }).catch(() => {});
    }
  };

  const handleCustomPasswordSubmit = async (password: string) => {
    if (!customPasswordProject) return;

    try {
      const decrypted = await tauri.getProject(
        customPasswordProject.id,
        password
      );
      setSelectedProjectId(customPasswordProject.id);
      setOpenProject(decrypted);
      setCustomPasswordProject(null);
      loadProjects();
    } catch {
      alert(t("error.decryptFailed"));
    }
  };

  const handleReorderProjects = useCallback(async (reordered: ProjectListItem[]) => {
    setProjects(reordered);
    try {
      await tauri.reorderProjects(reordered.map((p) => p.id));
    } catch (e) {
      console.error("Failed to reorder projects:", e);
      loadProjects();
    }
  }, [tauri, setProjects, loadProjects]);

  const handleDeleteProject = async () => {
    if (!deleteTarget) return;

    try {
      await tauri.deleteProject(deleteTarget.id);
      if (selectedProjectId === deleteTarget.id) {
        setOpenProject(null);
        setSelectedProjectId(null);
      }
      if (masterPassword) {
        const projects = await tauri.listProjects();
        setProjects(projects);
      }
    } catch (e) {
      console.error("Failed to delete project:", e);
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-gray-900">
      <Sidebar
        width={sidebarWidth}
        onNewProject={() => setNewProjectOpen(true)}
        onSelectProject={handleSelectProject}
        onEditProject={handleEditProject}
        onDeleteProject={setDeleteTarget}
        onReorderProjects={handleReorderProjects}
        loadingProjects={loadingProjects}
        openingProjectId={openingProjectId}
      />
      <div
        className="w-1 shrink-0 cursor-col-resize bg-gray-200 dark:bg-gray-700 hover:bg-blue-400 dark:hover:bg-blue-500 active:bg-blue-500 dark:active:bg-blue-400 transition-colors"
        onMouseDown={handleDividerMouseDown}
      />
      <ContentView openingProject={openingProjectId !== null} />

      <NewProjectDialog
        open={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
      />

      <EditProjectDialog
        open={!!editTarget}
        project={editTarget}
        currentPassword={editPassword ?? undefined}
        onClose={() => { setEditTarget(null); setEditPassword(null); }}
        onSaved={handleEditSaved}
      />

      <CustomPasswordDialog
        open={!!customPasswordProject}
        projectName={customPasswordProject?.name ?? ""}
        onSubmit={handleCustomPasswordSubmit}
        onClose={() => setCustomPasswordProject(null)}
      />

      <DeleteProjectDialog
        open={!!deleteTarget}
        projectName={deleteTarget?.name ?? ""}
        onConfirm={handleDeleteProject}
        onClose={() => setDeleteTarget(null)}
      />

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      <LoginDialog
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
      />
    </div>
  );
}
