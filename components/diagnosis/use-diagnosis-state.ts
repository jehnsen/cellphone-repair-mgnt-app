"use client";

import { useMemo, useReducer } from "react";
import { partKeysForIssues } from "@/lib/diagnosis";
import type { IssueCatalog, IssueSource, PartCategory } from "@/lib/types";

/**
 * View state for the visualizer: mode, explode, what is selected, what is
 * highlighted.
 *
 * A `useReducer` rather than a store library. The app already has exactly one
 * state pattern — the reducer behind `ShopProvider` — and this is view state
 * that lives and dies with the panel: it is not server data, nothing outside
 * the visualizer reads it, and it must reset when the technician closes the
 * panel. A second global store would outlive the thing it describes.
 */

export type DiagnosisMode = "diagnosis" | "explore";

export interface DiagnosisState {
  mode: DiagnosisMode;
  /** 0 assembled, 1 fully apart. Explore mode only. */
  explode: number;
  /** Which vocabulary the picker is choosing from. */
  source: IssueSource;
  /** Issue keys the technician has selected. */
  selectedIssueKeys: string[];
  /** Free text for when the stock taxonomy does not fit. */
  customNote: string;
  /** The part a technician clicked, to read its blurb. Not a diagnosis. */
  inspectedPartKey: string | null;
  /** Explore-mode filter; "all" is not a category, so it is spelled out. */
  categoryFilter: PartCategory | "all";
}

export type DiagnosisAction =
  | { type: "mode"; mode: DiagnosisMode }
  | { type: "explode"; value: number }
  | { type: "source"; source: IssueSource }
  | { type: "toggleIssue"; key: string }
  | { type: "setIssues"; keys: string[] }
  | { type: "note"; value: string }
  | { type: "inspect"; key: string | null }
  | { type: "category"; value: PartCategory | "all" }
  | { type: "reset"; state: DiagnosisState };

function reducer(state: DiagnosisState, action: DiagnosisAction): DiagnosisState {
  switch (action.type) {
    case "mode":
      /* Leaving explore puts the device back together. Coming back to a
         half-exploded phone mid-conversation is disorienting, and diagnosis
         mode does not use the value anyway. */
      return {
        ...state,
        mode: action.mode,
        explode: action.mode === "diagnosis" ? 0 : state.explode,
        inspectedPartKey: null,
      };

    case "explode":
      return { ...state, explode: Math.min(1, Math.max(0, action.value)) };

    case "source":
      /* Keys are only meaningful inside their own vocabulary — 'screen' means
         something different in each — so switching source clears them rather
         than carrying keys that would silently map to the wrong parts. */
      return { ...state, source: action.source, selectedIssueKeys: [] };

    case "toggleIssue": {
      const selected = state.selectedIssueKeys.includes(action.key)
        ? state.selectedIssueKeys.filter((key) => key !== action.key)
        : [...state.selectedIssueKeys, action.key];
      return { ...state, selectedIssueKeys: selected, inspectedPartKey: null };
    }

    case "setIssues":
      return { ...state, selectedIssueKeys: action.keys, inspectedPartKey: null };

    case "note":
      return { ...state, customNote: action.value };

    case "inspect":
      return { ...state, inspectedPartKey: action.key };

    case "category":
      return { ...state, categoryFilter: action.value };

    case "reset":
      return action.state;
  }
}

export function initialDiagnosisState(
  source: IssueSource,
  issueKeys: string[],
): DiagnosisState {
  return {
    mode: "diagnosis",
    explode: 0,
    source,
    selectedIssueKeys: issueKeys,
    customNote: "",
    inspectedPartKey: null,
    categoryFilter: "all",
  };
}

export function useDiagnosisState(
  catalog: IssueCatalog | null,
  initial: { source: IssueSource; keys: string[] },
) {
  const [state, dispatch] = useReducer(
    reducer,
    initialDiagnosisState(initial.source, initial.keys),
  );

  /**
   * The parts the current selection implicates — the highlight, and what a
   * snapshot records.
   *
   * Derived rather than stored: keeping a copy in state means a mapping that
   * loads a moment after the selection leaves the highlight stale, and it is
   * one more thing to keep in step for no gain.
   */
  const highlightedPartKeys = useMemo(() => {
    if (!catalog) return [];
    return partKeysForIssues(catalog, state.source, state.selectedIssueKeys);
  }, [catalog, state.source, state.selectedIssueKeys]);

  return { state, dispatch, highlightedPartKeys };
}
