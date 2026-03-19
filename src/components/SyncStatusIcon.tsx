// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

import { useState } from "react";
import { useTranslation } from "react-i18next";

interface SyncStatusIconProps {
  status: string;
  errorMessage?: string | null;
  onErrorClick?: () => void;
}

export function SyncStatusIcon({ status, errorMessage, onErrorClick }: SyncStatusIconProps) {
  const { t } = useTranslation();
  const [showTooltip, setShowTooltip] = useState(false);

  switch (status) {
    case "syncing":
      return (
        <svg className="w-3.5 h-3.5 text-blue-500 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
          <title>{t("sync.syncing")}</title>
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      );
    case "error":
      return (
        <div className="relative flex-shrink-0">
          <svg
            className="w-3.5 h-3.5 text-red-500 cursor-pointer"
            fill="currentColor"
            viewBox="0 0 20 20"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onClick={(e) => { e.stopPropagation(); onErrorClick?.(); }}
          >
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {showTooltip && (
            <div className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-1.5 px-2.5 py-1.5 rounded-md bg-red-900/95 text-white text-xs whitespace-nowrap shadow-lg border border-red-700/50 max-w-xs">
              <div className="font-medium">{t("sync.errorUnknown")}</div>
              {errorMessage && <div className="mt-0.5 opacity-80 break-all whitespace-normal max-w-[200px]">{errorMessage}</div>}
            </div>
          )}
        </div>
      );
    case "conflict":
      return (
        <svg
          className="w-3.5 h-3.5 text-orange-500 cursor-help flex-shrink-0"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <title>{t("sync.conflict")}</title>
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      );
    case "idle":
      return (
        <svg className="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <title>{t("sync.ok")}</title>
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      );
    default:
      return null;
  }
}
