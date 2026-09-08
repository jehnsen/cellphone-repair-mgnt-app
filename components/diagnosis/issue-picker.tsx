"use client";

import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/states";
import { SOURCE_BLURB, SOURCE_LABEL } from "@/lib/diagnosis";
import { cn } from "@/lib/utils";
import type { DiagnosisIssue, IssueCatalog, IssueSource } from "@/lib/types";

/**
 * What is wrong, picked from the vocabulary the ticket is currently described
 * by.
 *
 * The rows are large, plainly-labelled buttons rather than a dense checkbox
 * list: this is operated one-handed on a tablet, often while holding the
 * device being discussed. Nothing here depends on hover — the selected state
 * is a filled check and a border, both visible without a pointer.
 */
export function IssuePicker({
  catalog,
  source,
  selectedKeys,
  customNote,
  disabled,
  onToggle,
  onNoteChange,
}: {
  catalog: IssueCatalog;
  source: IssueSource;
  selectedKeys: string[];
  customNote: string;
  disabled?: boolean;
  onToggle: (key: string) => void;
  onNoteChange: (value: string) => void;
}) {
  const [search, setSearch] = useState("");

  const issues = useMemo(() => {
    const rows = catalog[source];
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (issue) =>
        issue.label.toLowerCase().includes(needle) ||
        issue.key.toLowerCase().includes(needle),
    );
  }, [catalog, source, search]);

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div>
        <p className="label-pad">{SOURCE_LABEL[source]}</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-soft">
          {SOURCE_BLURB[source]}
        </p>
      </div>

      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-faint"
          aria-hidden
        />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search issues"
          aria-label="Search issues"
          className="pl-8"
        />
      </div>

      {issues.length ? (
        <div
          role="group"
          aria-label="Issues"
          className="grid gap-1.5 sm:grid-cols-2"
        >
          {issues.map((issue) => (
            <IssueRow
              key={issue.key}
              issue={issue}
              selected={selectedKeys.includes(issue.key)}
              disabled={disabled}
              onToggle={() => onToggle(issue.key)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Search}
          title="Nothing matches that."
          body="Clear the search to see the full list, or describe it in the note below instead."
        />
      )}

      <div>
        <Label htmlFor="diagnosis-note">
          Note {selectedKeys.length ? "(optional)" : "— if nothing above fits"}
        </Label>
        <Textarea
          id="diagnosis-note"
          value={customNote}
          onChange={(event) => onNoteChange(event.target.value)}
          disabled={disabled}
          rows={2}
          className="mt-1.5"
          placeholder="Anything the list above does not cover."
        />
        {/* Says plainly where the text ends up. A technician who thinks this
            is a scratchpad will put the diagnosis in it and wonder why the
            quote does not mention it. */}
        <p className="mt-1.5 text-xs text-ink-faint">
          Saved onto the ticket&rsquo;s findings, so it reaches the quote and
          the warranty slip.
        </p>
      </div>
    </div>
  );
}

function IssueRow({
  issue,
  selected,
  disabled,
  onToggle,
}: {
  issue: DiagnosisIssue;
  selected: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  /* An issue with no mapped part still selects — it belongs on the finding
     either way. It just cannot point at anything, and says so rather than
     leaving the technician wondering why the model did not react. */
  const unmapped = issue.partKeys.length === 0;

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        /* min-h-11 is the tap target, not a look: this is used on a tablet
           with a customer waiting. */
        "flex min-h-11 items-center gap-2.5 rounded-sm border px-2.5 py-2 text-left transition-colors",
        "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "disabled:pointer-events-none disabled:opacity-45",
        selected
          ? "border-bench/45 bg-bench-fill text-bench-ink"
          : "border-rule bg-copy text-ink hover:border-bench/35 hover:bg-secondary",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid size-4 shrink-0 place-items-center rounded-xs border",
          selected ? "border-bench bg-bench text-white" : "border-rule-strong",
        )}
      >
        {selected ? <Check className="size-3" /> : null}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {issue.label}
        </span>
        {unmapped ? (
          <span className="block text-xs text-ink-faint">
            No part mapped — nothing to point at
          </span>
        ) : null}
      </span>
    </button>
  );
}
