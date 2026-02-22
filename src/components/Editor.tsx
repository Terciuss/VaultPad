// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

import { useEffect, useRef } from "react";

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
}

export function Editor({
  value,
  onChange,
  readOnly = false,
  placeholder,
}: EditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      readOnly={readOnly}
      placeholder={placeholder}
      spellCheck={false}
      className="w-full h-full resize-none bg-transparent text-gray-900 dark:text-gray-100 font-mono text-sm leading-relaxed p-4 outline-none placeholder-gray-400 dark:placeholder-gray-500"
    />
  );
}
