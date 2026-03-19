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
import { AddServerDialog } from "./AddServerDialog";
import { ServerAuthDialog } from "./ServerAuthDialog";
import { ServerMasterPasswordDialog } from "./ServerMasterPasswordDialog";
import { ConflictResolutionDialog } from "./ConflictResolutionDialog";
import { AdminPanel } from "./AdminPanel";
import { ChangeMasterPasswordDialog } from "./ChangeMasterPasswordDialog";
import { ChangeCredentialsDialog } from "./ChangeCredentialsDialog";
import { useAppStore } from "../store";
import { useTauri } from "../hooks/useTauri";
import { useAutoLock } from "../hooks/useAutoLock";
import { useSyncManager } from "../hooks/useSyncManager";
import { useProjectManager } from "../hooks/useProjectManager";
import type { ProjectListItem, DecryptedProject, ConflictInfo } from "../lib/types";

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
  const servers = useAppStore((s) => s.servers);
  const setServers = useAppStore((s) => s.setServers);
  const updateServer = useAppStore((s) => s.updateServer);
  const activeContextId = useAppStore((s) => s.activeContextId);

  const {
    registerFlushSave,
    loadProjectsForContext,
    switchContextSafely,
    selectProjectFromContext,
  } = useProjectManager();

  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addServerOpen, setAddServerOpen] = useState(false);
  const [authServerId, setAuthServerId] = useState<string | null>(null);
  const [authWithMasterSetup, setAuthWithMasterSetup] = useState(false);
  const [masterPwServerId, setMasterPwServerId] = useState<string | null>(null);
  const [masterPwMode, setMasterPwMode] = useState<"setup" | "verify">("setup");
  const [customPasswordProject, setCustomPasswordProject] = useState<ProjectListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectListItem | null>(null);
  const [editTarget, setEditTarget] = useState<DecryptedProject | null>(null);
  const [editPassword, setEditPassword] = useState<string | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [openingProjectId, setOpeningProjectId] = useState<string | null>(null);
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  const [changePwMode, setChangePwMode] = useState<"local" | "server" | null>(null);
  const [changePwServerId, setChangePwServerId] = useState<string | null>(null);
  const [removingServer, setRemovingServer] = useState<{ id: string; name: string } | null>(null);
  const [credentialsServerId, setCredentialsServerId] = useState<string | null>(null);

  const pendingAddServer = useAppStore((s) => s.pendingAddServer);
  const setPendingAddServer = useAppStore((s) => s.setPendingAddServer);

  const [sidebarWidth, setSidebarWidth] = useState(getInitialSidebarWidth);
  const dragging = useRef(false);

  useAutoLock();

  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);

  const loadProjectsWithUI = useCallback(async () => {
    setLoadingProjects(true);
    try {
      await loadProjectsForContext();
    } finally {
      setLoadingProjects(false);
    }
  }, [loadProjectsForContext]);

  const { notifyLocalSave } = useSyncManager({
    onConflicts: setConflicts,
    loadProjects: loadProjectsForContext,
  });

  const loadServers = useCallback(async () => {
    try {
      const srvList = await tauri.listServers();

      for (const srv of srvList) {
        if (srv.is_authenticated) {
          try {
            const isAdmin = await tauri.refreshServerUser(srv.id);
            srv.is_admin = isAdmin;
          } catch { /* server unreachable — keep cached value */ }
        }
      }

      setServers(
        srvList.map((s) => ({
          ...s,
          sync_status: "idle" as const,
          sync_error: null,
          last_synced_at: null,
        }))
      );
    } catch (e) {
      console.error("Failed to load servers:", e);
    }
  }, [tauri, setServers]);

  useEffect(() => {
    loadServers();
  }, [loadServers]);

  useEffect(() => {
    loadProjectsWithUI();
  }, [masterPassword]);

  // Deep link при разблокированном приложении: открываем диалог сразу.
  useEffect(() => {
    const unlisten = listen<{ name: string; url: string }>("deep-link-add-server", (event) => {
      setPendingAddServer(event.payload);
      setAddServerOpen(true);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [setPendingAddServer]);

  // Открыть диалог при появлении pendingAddServer (в т.ч. после разблокировки, если ссылку открыли при заблокированном приложении).
  useEffect(() => {
    if (pendingAddServer && !addServerOpen) {
      setAddServerOpen(true);
    }
  }, [pendingAddServer, addServerOpen]);

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
          tauri.switchContext("local").catch(() => {});
          tauri.clearCachedKey().catch(() => {});
          lock();
          break;
        case "add-server":
          setAddServerOpen(true);
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

  const handleSelectProject = async (project: ProjectListItem, contextId: string) => {
    try {
      setOpeningProjectId(project.id);
      await selectProjectFromContext(project, contextId, {
        onCustomPassword: setCustomPasswordProject,
      });
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
    loadProjectsForContext();
    if (target && selectedProjectId === target.id) {
      tauri.getProject(target.id, "").then((p) => {
        setOpenProject(p);
      }).catch(() => {});
    }
  };

  const handleCustomPasswordSubmit = async (password: string) => {
    if (!customPasswordProject) return;

    try {
      const decrypted = await tauri.getProject(customPasswordProject.id, password);
      setSelectedProjectId(customPasswordProject.id);
      setOpenProject(decrypted);
      setCustomPasswordProject(null);
      loadProjectsForContext();
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
      loadProjectsForContext();
    }
  }, [tauri, setProjects, loadProjectsForContext]);

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

  const handleServerSwitch = async (contextId: string) => {
    try {
      setLoadingProjects(true);
      await switchContextSafely(contextId);
    } catch (e) {
      console.error("Failed to switch context:", e);
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleServerSync = async (serverId: string) => {
    if (activeContextId !== serverId) {
      await handleServerSwitch(serverId);
    }

    try {
      const isAdmin = await tauri.refreshServerUser(serverId);
      updateServer(serverId, { is_admin: isAdmin });
    } catch { /* server unreachable */ }

    updateServer(serverId, { sync_status: "syncing", sync_error: null });
    try {
      const result = await tauri.syncProjects();
      updateServer(serverId, {
        sync_status: result.conflicts.length > 0 ? "conflict" : "idle",
        sync_error: null,
        last_synced_at: new Date().toISOString(),
      });
      if (result.conflicts.length > 0) {
        setConflicts(result.conflicts);
      }
      loadProjectsForContext();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Sync failed:", msg);
      updateServer(serverId, { sync_status: "error", sync_error: msg });
    }
  };

  const handleServerRemove = (serverId: string) => {
    const server = servers.find((s) => s.id === serverId);
    if (!server) return;
    setRemovingServer({ id: serverId, name: server.name });
  };

  const handleServerRemoveConfirm = async () => {
    if (!removingServer) return;
    const serverId = removingServer.id;
    setRemovingServer({ ...removingServer, id: "" });
    try {
      if (activeContextId === serverId) {
        await handleServerSwitch("local");
      }
      await tauri.removeServer(serverId);
      loadServers();
    } catch (e) {
      console.error("Failed to remove server:", e);
    } finally {
      setRemovingServer(null);
    }
  };

  const handleServerAuth = (serverId: string) => {
    setAuthWithMasterSetup(false);
    setAuthServerId(serverId);
  };

  const handleAddServerAdded = useCallback(async (server: { id: string }) => {
    await loadServers();
    setAddServerOpen(false);
    setAuthServerId(server.id);
    setAuthWithMasterSetup(true);
  }, [loadServers]);

  const handleServerAuthenticated = useCallback(() => {
    loadServers();
    if (authWithMasterSetup && authServerId) {
      handleServerSwitch(authServerId);
      handleServerSync(authServerId);
    }
    setAuthServerId(null);
    setAuthWithMasterSetup(false);
  }, [loadServers, authWithMasterSetup, authServerId]);

  const handleServerAuthClose = useCallback(() => {
    setAuthServerId(null);
    setAuthWithMasterSetup(false);
  }, []);

  const handleServerMasterPassword = (serverId: string) => {
    const server = servers.find((s) => s.id === serverId);
    if (!server) return;

    setMasterPwMode(server.has_master_password ? "verify" : "setup");
    setMasterPwServerId(serverId);
  };

  const handleServerMasterPasswordSuccess = async () => {
    loadServers();
    if (masterPwServerId) {
      await handleServerSwitch(masterPwServerId);
      handleServerSync(masterPwServerId);
    }
  };

  const handleLocalSettings = () => {
    setChangePwMode("local");
    setChangePwServerId(null);
  };

  const handleChangeServerMasterPassword = (serverId: string) => {
    setChangePwMode("server");
    setChangePwServerId(serverId);
  };

  const handleChangePwSuccess = () => {
    loadProjectsForContext();
  };

  const authServer = authServerId ? servers.find((s) => s.id === authServerId) : null;
  const masterPwServer = masterPwServerId ? servers.find((s) => s.id === masterPwServerId) : null;
  const changePwServer = changePwServerId ? servers.find((s) => s.id === changePwServerId) : null;

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
        onServerAuth={handleServerAuth}
        onServerSync={handleServerSync}
        onServerRemove={handleServerRemove}
        onServerSwitch={handleServerSwitch}
        onServerMasterPassword={handleServerMasterPassword}
        onOpenAdminPanel={() => setAdminPanelOpen(true)}
        onLocalSettings={handleLocalSettings}
        onChangeServerMasterPassword={handleChangeServerMasterPassword}
        onChangeCredentials={setCredentialsServerId}
      />
      <div
        className="w-1 shrink-0 cursor-col-resize bg-gray-200 dark:bg-gray-700 hover:bg-blue-400 dark:hover:bg-blue-500 active:bg-blue-500 dark:active:bg-blue-400 transition-colors"
        onMouseDown={handleDividerMouseDown}
      />
      <ContentView
        openingProject={openingProjectId !== null}
        onLocalSave={notifyLocalSave}
        registerFlushSave={registerFlushSave}
      />

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

      <AddServerDialog
        open={addServerOpen}
        onClose={() => setAddServerOpen(false)}
        onAdded={handleAddServerAdded}
        prefill={pendingAddServer}
        onClearPrefill={() => setPendingAddServer(null)}
      />

      <ServerAuthDialog
        open={!!authServerId}
        serverId={authServerId ?? ""}
        serverName={authServer?.name ?? ""}
        withMasterPasswordSetup={authWithMasterSetup}
        onClose={handleServerAuthClose}
        onAuthenticated={handleServerAuthenticated}
      />

      <ServerMasterPasswordDialog
        open={!!masterPwServerId}
        serverId={masterPwServerId ?? ""}
        serverName={masterPwServer?.name ?? ""}
        mode={masterPwMode}
        onClose={() => setMasterPwServerId(null)}
        onSuccess={handleServerMasterPasswordSuccess}
      />

      <ConflictResolutionDialog
        open={conflicts.length > 0}
        conflicts={conflicts}
        onClose={() => setConflicts([])}
        onResolved={() => {
          setConflicts([]);
          loadProjectsForContext();
        }}
      />

      <AdminPanel
        open={adminPanelOpen}
        onClose={() => setAdminPanelOpen(false)}
      />

      <ChangeMasterPasswordDialog
        open={changePwMode !== null}
        mode={changePwMode ?? "local"}
        serverId={changePwServerId ?? undefined}
        serverName={changePwServer?.name ?? undefined}
        onClose={() => { setChangePwMode(null); setChangePwServerId(null); }}
        onSuccess={handleChangePwSuccess}
      />

      <ChangeCredentialsDialog
        open={!!credentialsServerId}
        serverId={credentialsServerId ?? ""}
        serverName={servers.find(s => s.id === credentialsServerId)?.name ?? ""}
        onClose={() => setCredentialsServerId(null)}
        onSuccess={() => setCredentialsServerId(null)}
      />

      {removingServer && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4">
            {removingServer.id === "" ? (
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="w-10 h-10 border-3 rounded-full border-gray-300 dark:border-gray-600 border-t-red-500 dark:border-t-red-400 animate-spin" />
                <p className="text-sm text-gray-600 dark:text-gray-300">{t("servers.removing")}</p>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{t("servers.removeTitle")}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                  {t("servers.removeConfirm", { name: removingServer.name })}
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setRemovingServer(null)}
                    className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    {t("servers.removeCancel")}
                  </button>
                  <button
                    onClick={handleServerRemoveConfirm}
                    className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors"
                  >
                    {t("servers.removeDelete")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
