// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrent } from "@tauri-apps/plugin-deep-link";
import { useAppStore } from "./store";
import { useTheme } from "./hooks/useTheme";
import { useTauri } from "./hooks/useTauri";
import { SplashScreen } from "./components/SplashScreen";
import { InitScreen } from "./components/InitScreen";
import { MasterPasswordSetup } from "./components/MasterPasswordSetup";
import { PinSetup } from "./components/PinSetup";
import { PinUnlock } from "./components/PinUnlock";
import { UnlockScreen } from "./components/UnlockScreen";
import { MainLayout } from "./components/MainLayout";
import "./i18n";
import "./App.css";

function App() {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const setDbPath = useAppStore((s) => s.setDbPath);
  const setDbFolder = useAppStore((s) => s.setDbFolder);
  const setMasterPassword = useAppStore((s) => s.setMasterPassword);
  const setHasSavedSession = useAppStore((s) => s.setHasSavedSession);
  const setHasPinCode = useAppStore((s) => s.setHasPinCode);
  const touchActivity = useAppStore((s) => s.touchActivity);
  const setPendingAddServer = useAppStore((s) => s.setPendingAddServer);
  const tauri = useTauri();
  useTheme();

  function parseAddServerFromUrls(urls: string[] | null): void {
    if (!urls?.length) return;
    for (const raw of urls) {
      try {
        const u = new URL(raw);
        const path = u.pathname.replace(/^\/+/, "") || u.hostname;
        if (path === "add-server") {
          const name = u.searchParams.get("name") ?? "";
          const serverUrl = u.searchParams.get("url") ?? "";
          if (serverUrl) {
            setPendingAddServer({ name, url: serverUrl });
            break;
          }
        }
      } catch {
        // ignore invalid URL
      }
    }
  }

  // Холодный старт: URL при открытии приложения по ссылке.
  useEffect(() => {
    getCurrent().then(parseAddServerFromUrls).catch(() => {});
  }, [setPendingAddServer]);

  // Уже запущено (macOS и др.): URL приходит через deep-link://new-url (плагин), не через single-instance.
  useEffect(() => {
    const unlisten = listen<string[] | string>("deep-link://new-url", (event) => {
      const urls = Array.isArray(event.payload) ? event.payload : [event.payload];
      parseAddServerFromUrls(urls);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [setPendingAddServer]);

  // Событие от бэкенда (single-instance на Windows/Linux, когда запускается второй процесс с URL).
  useEffect(() => {
    const unlisten = listen<{ name: string; url: string }>("deep-link-add-server", (event) => {
      setPendingAddServer(event.payload);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [setPendingAddServer]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapWithDefaultPath() {
      const defaultFolder = await tauri.getDefaultDbFolder();
      if (cancelled) return;
      const defaultPath = `${defaultFolder.replace(/\/$/, "")}/vaultpad.db`;
      await tauri.initDefaultDatabase(defaultPath);
      if (cancelled) return;
      setDbPath(defaultPath);
      setDbFolder(defaultFolder);

      const pinExists = await tauri.hasPin();
      if (cancelled) return;
      setHasPinCode(pinExists);

      if (pinExists) {
        setView("pin-unlock");
      } else {
        const hasMaster = await tauri.hasMasterPassword();
        if (cancelled) return;
        setView(hasMaster ? "unlock" : "master-password-setup");
      }
    }

    async function bootstrap() {
      try {
        const saved = await tauri.hasSavedSession();
        if (cancelled) return;

        if (!saved) {
          await bootstrapWithDefaultPath();
          return;
        }

        setHasSavedSession(true);
        const dbPath = await tauri.getSavedDbPath();
        if (cancelled) return;

        if (!dbPath) {
          await bootstrapWithDefaultPath();
          return;
        }

        await tauri.initDatabase(dbPath);
        if (cancelled) return;
        setDbPath(dbPath);

        const pinExists = await tauri.hasPin();
        if (cancelled) return;
        setHasPinCode(pinExists);

        if (pinExists) {
          setView("pin-unlock");
        } else {
          const mp = await tauri.getSavedMasterPassword();
          if (cancelled) return;

          if (mp) {
            await tauri.cacheMasterKey(mp);
            if (cancelled) return;
            setMasterPassword(mp);
            touchActivity();
            setView("main");
          } else {
            setView("unlock");
          }
        }
      } catch (err) {
        console.error("Bootstrap failed:", err);
        if (!cancelled) setView("init");
      }
    }

    bootstrap();
    return () => { cancelled = true; };
  }, []);

  switch (view) {
    case "loading":
      return <SplashScreen />;
    case "init":
      return <InitScreen />;
    case "master-password-setup":
      return <MasterPasswordSetup />;
    case "pin-setup":
      return <PinSetup />;
    case "pin-unlock":
      return <PinUnlock />;
    case "unlock":
      return <UnlockScreen />;
    case "main":
      return <MainLayout />;
  }
}

export default App;
