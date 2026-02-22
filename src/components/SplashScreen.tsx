// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

import { useTranslation } from "react-i18next";
import { Spinner } from "./Spinner";

export function SplashScreen() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 gap-4">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
        {t("app.title")}
      </h1>
      <Spinner size="lg" />
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {t("loading.startup")}
      </p>
    </div>
  );
}
