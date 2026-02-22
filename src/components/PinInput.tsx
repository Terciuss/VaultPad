// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

import { useRef, useCallback, useEffect } from "react";

interface PinInputProps {
  value: string;
  onChange: (val: string) => void;
  onComplete?: (val: string) => void;
  length?: number;
  autoFocus?: boolean;
  error?: boolean;
  disabled?: boolean;
}

export function PinInput({
  value,
  onChange,
  onComplete,
  length = 4,
  autoFocus = false,
  error = false,
  disabled = false,
}: PinInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  const focusCell = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(idx, length - 1));
      refs.current[clamped]?.focus();
    },
    [length],
  );

  useEffect(() => {
    if (autoFocus) focusCell(0);
  }, [autoFocus, focusCell]);

  useEffect(() => {
    if (error) {
      focusCell(0);
      refs.current[0]?.select();
    }
  }, [error, focusCell]);

  const update = useCallback(
    (newDigits: string[]) => {
      const next = newDigits.join("").replace(/\D/g, "").slice(0, length);
      onChange(next);
      if (next.length === length && onComplete) {
        setTimeout(() => onComplete(next), 0);
      }
    },
    [length, onChange, onComplete],
  );

  const handleInput = (idx: number, char: string) => {
    if (!/^\d$/.test(char)) return;
    const next = [...digits];
    next[idx] = char;
    update(next);
    if (idx < length - 1) focusCell(idx + 1);
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = [...digits];
      if (digits[idx] && digits[idx] !== " ") {
        next[idx] = "";
        update(next);
      } else if (idx > 0) {
        next[idx - 1] = "";
        update(next);
        focusCell(idx - 1);
      }
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusCell(idx - 1);
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      focusCell(idx + 1);
      return;
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    const next = pasted.padEnd(length, "").split("").slice(0, length);
    update(next);
    focusCell(Math.min(pasted.length, length - 1));
  };

  const borderClass = error
    ? "border-red-500 dark:border-red-500"
    : "border-gray-300 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-500";

  return (
    <div className="flex gap-3 justify-center" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d.trim()}
          disabled={disabled}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "");
            if (v) handleInput(i, v[v.length - 1]);
          }}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          style={{ width: 56, height: 56, WebkitTextSecurity: "disc" } as React.CSSProperties}
          className={`text-center text-2xl font-mono rounded-xl border-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/30 transition-colors disabled:opacity-50 shrink-0 ${borderClass}`}
          autoComplete="off"
        />
      ))}
    </div>
  );
}
