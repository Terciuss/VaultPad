// Based on sereneinserenade/tiptap-search-and-replace (MIT License)
// Copyright (c) 2023-2024 Jeet Mandaliya

import { Extension, type Range } from "@tiptap/core";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { Dispatch } from "@tiptap/core";
import type { EditorState, Transaction } from "@tiptap/pm/state";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    searchAndReplace: {
      setSearchTerm: (searchTerm: string) => ReturnType;
      setReplaceTerm: (replaceTerm: string) => ReturnType;
      setCaseSensitive: (caseSensitive: boolean) => ReturnType;
      resetIndex: () => ReturnType;
      nextSearchResult: () => ReturnType;
      previousSearchResult: () => ReturnType;
      replace: () => ReturnType;
      replaceAll: () => ReturnType;
    };
  }
}

interface TextNodesWithPosition {
  text: string;
  pos: number;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildRegex(term: string, caseSensitive: boolean): RegExp {
  return new RegExp(escapeRegex(term), caseSensitive ? "gu" : "gui");
}

function processSearches(
  doc: PMNode,
  searchTerm: RegExp,
  searchResultClass: string,
  resultIndex: number,
): { decorations: DecorationSet; results: Range[] } {
  const decorations: Decoration[] = [];
  const results: Range[] = [];

  if (!searchTerm) {
    return { decorations: DecorationSet.empty, results: [] };
  }

  let textNodesWithPosition: TextNodesWithPosition[] = [];
  let index = 0;

  doc.descendants((node, pos) => {
    if (node.isText) {
      if (textNodesWithPosition[index]) {
        textNodesWithPosition[index] = {
          text: textNodesWithPosition[index].text + node.text,
          pos: textNodesWithPosition[index].pos,
        };
      } else {
        textNodesWithPosition[index] = { text: `${node.text}`, pos };
      }
    } else {
      index += 1;
    }
  });

  textNodesWithPosition = textNodesWithPosition.filter(Boolean);

  for (const element of textNodesWithPosition) {
    const { text, pos } = element;
    const matches = Array.from(text.matchAll(searchTerm)).filter(
      ([matchText]) => matchText.trim(),
    );
    for (const m of matches) {
      if (m[0] === "" || m.index === undefined) continue;
      results.push({ from: pos + m.index, to: pos + m.index + m[0].length });
    }
  }

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const cls =
      i === resultIndex
        ? `${searchResultClass} ${searchResultClass}-current`
        : searchResultClass;
    decorations.push(Decoration.inline(r.from, r.to, { class: cls }));
  }

  return {
    decorations: DecorationSet.create(doc, decorations),
    results,
  };
}

function replaceFirst(
  replaceTerm: string,
  results: Range[],
  { state, dispatch }: { state: EditorState; dispatch: Dispatch },
) {
  const first = results[0];
  if (!first) return;
  if (dispatch) dispatch(state.tr.insertText(replaceTerm, first.from, first.to));
}

function replaceAllMatches(
  replaceTerm: string,
  results: Range[],
  { tr, dispatch }: { tr: Transaction; dispatch: Dispatch },
) {
  if (!results.length) return;

  let offset = 0;
  const copy = results.slice();

  for (let i = 0; i < copy.length; i++) {
    const { from, to } = copy[i];
    tr.insertText(replaceTerm, from, to);

    const nextIndex = i + 1;
    if (copy[nextIndex]) {
      const currentLen = to - from;
      offset += currentLen - replaceTerm.length;
      copy[nextIndex] = {
        from: copy[nextIndex].from - offset,
        to: copy[nextIndex].to - offset,
      };
    }
  }

  if (dispatch) dispatch(tr);
}

export const searchAndReplacePluginKey = new PluginKey("searchAndReplacePlugin");

export interface SearchAndReplaceStorage {
  searchTerm: string;
  replaceTerm: string;
  results: Range[];
  lastSearchTerm: string;
  caseSensitive: boolean;
  lastCaseSensitive: boolean;
  resultIndex: number;
  lastResultIndex: number;
}

export const SearchAndReplace = Extension.create<
  { searchResultClass: string },
  SearchAndReplaceStorage
>({
  name: "searchAndReplace",

  addOptions() {
    return { searchResultClass: "search-result" };
  },

  addStorage() {
    return {
      searchTerm: "",
      replaceTerm: "",
      results: [],
      lastSearchTerm: "",
      caseSensitive: false,
      lastCaseSensitive: false,
      resultIndex: 0,
      lastResultIndex: 0,
    };
  },

  addCommands() {
    return {
      setSearchTerm:
        (searchTerm: string) =>
        ({ editor }) => {
          editor.storage.searchAndReplace.searchTerm = searchTerm;
          editor.storage.searchAndReplace.resultIndex = 0;
          return false;
        },
      setReplaceTerm:
        (replaceTerm: string) =>
        ({ editor }) => {
          editor.storage.searchAndReplace.replaceTerm = replaceTerm;
          return false;
        },
      setCaseSensitive:
        (caseSensitive: boolean) =>
        ({ editor }) => {
          editor.storage.searchAndReplace.caseSensitive = caseSensitive;
          return false;
        },
      resetIndex:
        () =>
        ({ editor }) => {
          editor.storage.searchAndReplace.resultIndex = 0;
          return false;
        },
      nextSearchResult:
        () =>
        ({ editor }) => {
          const { results, resultIndex } = editor.storage.searchAndReplace;
          const next = resultIndex + 1;
          editor.storage.searchAndReplace.resultIndex =
            results[next] ? next : 0;
          return false;
        },
      previousSearchResult:
        () =>
        ({ editor }) => {
          const { results, resultIndex } = editor.storage.searchAndReplace;
          const prev = resultIndex - 1;
          editor.storage.searchAndReplace.resultIndex =
            prev >= 0 ? prev : results.length - 1;
          return false;
        },
      replace:
        () =>
        ({ editor, state, dispatch }) => {
          const { replaceTerm, results, resultIndex } =
            editor.storage.searchAndReplace;
          const current = results[resultIndex];
          if (current) {
            replaceFirst(replaceTerm, [current], { state, dispatch });
          }
          return false;
        },
      replaceAll:
        () =>
        ({ editor, tr, dispatch }) => {
          const { replaceTerm, results } = editor.storage.searchAndReplace;
          replaceAllMatches(replaceTerm, results, { tr, dispatch });
          return false;
        },
    };
  },

  addProseMirrorPlugins() {
    const editor = this.editor;
    const { searchResultClass } = this.options;

    return [
      new Plugin({
        key: searchAndReplacePluginKey,
        state: {
          init: () => DecorationSet.empty,
          apply({ doc, docChanged }, oldState) {
            const storage = editor.storage
              .searchAndReplace as SearchAndReplaceStorage;
            const {
              searchTerm,
              lastSearchTerm,
              caseSensitive,
              lastCaseSensitive,
              resultIndex,
              lastResultIndex,
            } = storage;

            if (
              !docChanged &&
              lastSearchTerm === searchTerm &&
              lastCaseSensitive === caseSensitive &&
              lastResultIndex === resultIndex
            )
              return oldState;

            storage.lastSearchTerm = searchTerm;
            storage.lastCaseSensitive = caseSensitive;
            storage.lastResultIndex = resultIndex;

            if (!searchTerm) {
              storage.results = [];
              return DecorationSet.empty;
            }

            const { decorations, results } = processSearches(
              doc,
              buildRegex(searchTerm, caseSensitive),
              searchResultClass,
              resultIndex,
            );

            storage.results = results;
            return decorations;
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});
