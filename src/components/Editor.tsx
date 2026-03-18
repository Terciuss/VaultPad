// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

import { useEffect, useRef, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Color from "@tiptap/extension-color";
import TextStyle from "@tiptap/extension-text-style";
import { SearchAndReplace } from "../lib/tiptap-search";
import { EditorToolbar } from "./EditorToolbar";

function normalizeContent(html: string): string {
  if (!html) return html;
  if (!html.includes("\n")) return html;

  const isHtml = /<[a-z][\s\S]*>/i.test(html);
  if (!isHtml) {
    return html
      .split(/\r?\n/)
      .map((line) => `<p>${line || "<br>"}</p>`)
      .join("");
  }

  return html.replace(/\n/g, "<br>");
}

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  fontSize?: number;
  wordWrap?: boolean;
  onEditorReady?: (editor: ReturnType<typeof useEditor>) => void;
}

export function Editor({
  value,
  onChange,
  readOnly = false,
  placeholder,
  fontSize,
  wordWrap = true,
  onEditorReady,
}: EditorProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onEditorReadyRef = useRef(onEditorReady);
  onEditorReadyRef.current = onEditorReady;

  const userHasEdited = useRef(false);

  const handleUpdate = useCallback(({ editor: e }: { editor: ReturnType<typeof useEditor> }) => {
    if (!userHasEdited.current) return;
    if (!e) return;
    onChangeRef.current(e.getHTML());
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
      Underline,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Color,
      TextStyle,
      SearchAndReplace,
    ],
    content: normalizeContent(value),
    editable: !readOnly,
    parseOptions: {
      preserveWhitespace: "full",
    },
    onUpdate: handleUpdate,
    onFocus: () => {
      userHasEdited.current = true;
    },
  });

  useEffect(() => {
    if (editor && onEditorReadyRef.current) {
      onEditorReadyRef.current(editor);
    }
  }, [editor]);

  useEffect(() => {
    if (!editor) return;

    const normalized = normalizeContent(value);
    const currentHTML = editor.getHTML();
    if (normalized !== currentHTML) {
      userHasEdited.current = false;
      editor.commands.setContent(normalized, false, { preserveWhitespace: "full" });
    }
  }, [value, editor]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(!readOnly);
    }
  }, [readOnly, editor]);

  return (
    <div className="flex flex-col h-full">
      {!readOnly && editor && <EditorToolbar editor={editor} />}
      <div
        className="flex-1 overflow-y-auto"
        style={{ fontSize: fontSize ? `${fontSize}px` : undefined }}
      >
        <EditorContent
          editor={editor}
          className={`tiptap-container h-full ${wordWrap ? "tiptap-wrap" : "tiptap-nowrap"}`}
        />
      </div>
    </div>
  );
}
