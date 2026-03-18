// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

import { useMemo } from "react";
import { diffLines, type Change } from "diff";

export function htmlToPlainText(html: string): string {
  let text = html;
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, "\n");
  text = text.replace(/<(p|div|h[1-6]|li|blockquote)[^>]*>/gi, "");
  const tmp = document.createElement("div");
  tmp.innerHTML = text;
  const result = tmp.textContent || "";
  return result.replace(/\n{3,}/g, "\n\n").trim();
}

interface DiffViewProps {
  oldText: string;
  newText: string;
  maxHeight?: string;
}

export function DiffView({ oldText, newText, maxHeight = "max-h-80" }: DiffViewProps) {
  const changes = useMemo(() => diffLines(oldText, newText), [oldText, newText]);

  return (
    <div className={`font-mono text-xs overflow-auto ${maxHeight} border border-gray-200 dark:border-gray-600 rounded-lg`}>
      {changes.map((change: Change, i: number) => {
        const bg = change.added
          ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200"
          : change.removed
            ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200"
            : "text-gray-700 dark:text-gray-300";

        const prefix = change.added ? "+" : change.removed ? "-" : " ";

        return (
          <div key={i} className={`${bg} px-2 py-0.5 whitespace-pre-wrap`}>
            {change.value
              .split("\n")
              .filter((_, idx, arr) => idx < arr.length - 1 || _ !== "")
              .map((line, j) => (
                <div key={j}>
                  <span className="text-gray-400 select-none mr-2">{prefix}</span>
                  {line}
                </div>
              ))}
          </div>
        );
      })}
    </div>
  );
}
