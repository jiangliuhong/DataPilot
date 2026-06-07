"use client";

import { useReducer, useCallback } from "react";
import type { ProjectFile } from "@/web/types/dbt";

export interface EditorTab {
  fileId: number;
  name: string;
  fileType: string;
  content: string;
  originalContent: string;
  dirty: boolean;
}

interface EditorState {
  tabs: EditorTab[];
  activeFileId: number | null;
}

type EditorAction =
  | { type: "OPEN_TAB"; file: ProjectFile }
  | { type: "CLOSE_TAB"; fileId: number }
  | { type: "SET_ACTIVE"; fileId: number }
  | { type: "UPDATE_CONTENT"; fileId: number; content: string }
  | { type: "MARK_SAVED"; fileId: number };

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "OPEN_TAB": {
      const existing = state.tabs.find((t) => t.fileId === action.file.id);
      if (existing) {
        return { ...state, activeFileId: action.file.id };
      }
      const content = action.file.content ?? "";
      const tab: EditorTab = {
        fileId: action.file.id,
        name: action.file.name,
        fileType: action.file.fileType,
        content,
        originalContent: content,
        dirty: false,
      };
      return {
        tabs: [...state.tabs, tab],
        activeFileId: tab.fileId,
      };
    }
    case "CLOSE_TAB": {
      const idx = state.tabs.findIndex((t) => t.fileId === action.fileId);
      const newTabs = state.tabs.filter((t) => t.fileId !== action.fileId);
      let newActive = state.activeFileId;
      if (state.activeFileId === action.fileId) {
        if (newTabs.length === 0) {
          newActive = null;
        } else {
          const nextIdx = Math.min(idx, newTabs.length - 1);
          newActive = newTabs[nextIdx].fileId;
        }
      }
      return { tabs: newTabs, activeFileId: newActive };
    }
    case "SET_ACTIVE":
      return { ...state, activeFileId: action.fileId };
    case "UPDATE_CONTENT": {
      return {
        ...state,
        tabs: state.tabs.map((t) =>
          t.fileId === action.fileId
            ? {
                ...t,
                content: action.content,
                dirty: action.content !== t.originalContent,
              }
            : t,
        ),
      };
    }
    case "MARK_SAVED":
      return {
        ...state,
        tabs: state.tabs.map((t) =>
          t.fileId === action.fileId
            ? { ...t, originalContent: t.content, dirty: false }
            : t,
        ),
      };
    default:
      return state;
  }
}

export function useEditorState() {
  const [state, dispatch] = useReducer(editorReducer, {
    tabs: [],
    activeFileId: null,
  });

  const openTab = useCallback((file: ProjectFile) => {
    dispatch({ type: "OPEN_TAB", file });
  }, []);

  const closeTab = useCallback((fileId: number) => {
    dispatch({ type: "CLOSE_TAB", fileId });
  }, []);

  const setActive = useCallback((fileId: number) => {
    dispatch({ type: "SET_ACTIVE", fileId });
  }, []);

  const updateContent = useCallback((fileId: number, content: string) => {
    dispatch({ type: "UPDATE_CONTENT", fileId, content });
  }, []);

  const markSaved = useCallback((fileId: number) => {
    dispatch({ type: "MARK_SAVED", fileId });
  }, []);

  const activeTab = state.tabs.find((t) => t.fileId === state.activeFileId) ?? null;
  const hasDirty = state.tabs.some((t) => t.dirty);

  return {
    tabs: state.tabs,
    activeFileId: state.activeFileId,
    activeTab,
    hasDirty,
    openTab,
    closeTab,
    setActive,
    updateContent,
    markSaved,
  };
}
