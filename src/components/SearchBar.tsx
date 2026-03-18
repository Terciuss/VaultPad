// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { Editor } from "@tiptap/react";
import type { SearchAndReplaceStorage } from "../lib/tiptap-search";

interface SearchBarProps {
  editor: Editor;
  onClose: () => void;
  showReplace?: boolean;
}

export function SearchBar({ editor, onClose, showReplace: initialShowReplace = false }: SearchBarProps) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  const [replaceTerm, setReplaceTerm] = useState("");
  const [showReplace, setShowReplace] = useState(initialShowReplace);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  useEffect(() => {
    setShowReplace(initialShowReplace);
  }, [initialShowReplace]);

  const storage = editor.storage.searchAndReplace as SearchAndReplaceStorage;
  const resultCount = storage.results.length;
  const currentIndex = resultCount > 0 ? storage.resultIndex + 1 : 0;

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchTerm(value);
      editor.commands.setSearchTerm(value);
    },
    [editor],
  );

  const handleReplaceChange = useCallback(
    (value: string) => {
      setReplaceTerm(value);
      editor.commands.setReplaceTerm(value);
    },
    [editor],
  );

  const handleNext = useCallback(() => {
    editor.commands.nextSearchResult();
  }, [editor]);

  const handlePrev = useCallback(() => {
    editor.commands.previousSearchResult();
  }, [editor]);

  const handleReplace = useCallback(() => {
    editor.commands.replace();
  }, [editor]);

  const handleReplaceAll = useCallback(() => {
    editor.commands.replaceAll();
  }, [editor]);

  const handleToggleCaseSensitive = useCallback(() => {
    const next = !caseSensitive;
    setCaseSensitive(next);
    editor.commands.setCaseSensitive(next);
  }, [caseSensitive, editor]);

  const handleClose = useCallback(() => {
    editor.commands.setSearchTerm("");
    editor.commands.setReplaceTerm("");
    onClose();
  }, [editor, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) {
          handlePrev();
        } else {
          handleNext();
        }
      }
    },
    [handleClose, handleNext, handlePrev],
  );

  return (
    <div className="flex flex-col gap-1.5 px-3 py-2 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700 shrink-0">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setShowReplace(!showReplace)}
          className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors shrink-0"
          title={t("search.replace")}
        >
          <svg
            className={`w-3.5 h-3.5 transition-transform ${showReplace ? "rotate-90" : ""}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        <div className="relative flex-1">
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("search.placeholder")}
            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500 pr-16"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 dark:text-gray-500 pointer-events-none">
            {searchTerm
              ? t("search.resultsCount", { current: currentIndex, total: resultCount })
              : ""}
          </span>
        </div>

        <button
          type="button"
          onClick={handleToggleCaseSensitive}
          className={`p-1 rounded text-xs font-bold shrink-0 transition-colors ${
            caseSensitive
              ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
              : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          }`}
          title={t("search.caseSensitive")}
        >
          Aa
        </button>

        <button
          type="button"
          onClick={handlePrev}
          disabled={resultCount === 0}
          className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 transition-colors shrink-0"
          title={t("search.previous")}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>

        <button
          type="button"
          onClick={handleNext}
          disabled={resultCount === 0}
          className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 transition-colors shrink-0"
          title={t("search.next")}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <button
          type="button"
          onClick={handleClose}
          className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors shrink-0"
          title="Escape"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {showReplace && (
        <div className="flex items-center gap-1.5 pl-7">
          <input
            type="text"
            value={replaceTerm}
            onChange={(e) => handleReplaceChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("search.replacePlaceholder")}
            className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={handleReplace}
            disabled={resultCount === 0}
            className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded transition-colors shrink-0"
          >
            {t("search.replace")}
          </button>
          <button
            type="button"
            onClick={handleReplaceAll}
            disabled={resultCount === 0}
            className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded transition-colors shrink-0"
          >
            {t("search.replaceAll")}
          </button>
        </div>
      )}
    </div>
  );
}
