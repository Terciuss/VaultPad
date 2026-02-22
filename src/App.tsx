// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

import { useEffect } from "react";
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
  const setMasterPassword = useAppStore((s) => s.setMasterPassword);
  const setHasSavedSession = useAppStore((s) => s.setHasSavedSession);
  const setHasPinCode = useAppStore((s) => s.setHasPinCode);
  const touchActivity = useAppStore((s) => s.touchActivity);
  const tauri = useTauri();
  useTheme();

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const saved = await tauri.hasSavedSession();
        if (cancelled) return;

        if (!saved) {
          setView("init");
          return;
        }

        setHasSavedSession(true);
        const dbPath = await tauri.getSavedDbPath();
        if (cancelled) return;

        if (!dbPath) {
          setView("init");
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
