"use client";

import { useState } from "react";
import { ClipboardList, Pencil, ShieldCheck, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/states";
import { useShop } from "@/lib/shop/store";
import { toastError } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format";
import {
  DEFECT_AREAS,
  DEFECT_LABEL,
  RESOLUTION_LABEL,
  RESOLUTIONS,
  ROOT_CAUSE_LABEL,
  ROOT_CAUSES,
  validateFinding,
} from "@/lib/findings";
import { cn } from "@/lib/utils";
import type {
  DefectArea,
  RepairFinding,
  Resolution,
  RootCause,
  Ticket,
} from "@/lib/types";

/**
 * What was wrong with the unit, and what was done about it.
 *
 * Reads as a record once saved and only becomes a form when someone chooses to
 * edit — a technician passing the bench should be able to see the conclusion
 * without risk of changing it.
 */
export function FindingPanel({
  ticket,
  finding,
  onSaved,
  readOnly,
}: {
  ticket: Ticket;
  finding: RepairFinding | null;
  onSaved: (next: RepairFinding) => void;
  readOnly?: boolean;
}) {
  const { api, user } = useShop();
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <Panel>
        <PanelHeader>
          <ClipboardList className="size-3.5 text-ink-faint" aria-hidden />
          <PanelTitle>Findings</PanelTitle>
          {!readOnly ? (
            <Button
              variant="outline"
              size="xs"
              className="ml-auto"
              onClick={() => setEditing(true)}
            >
              <Pencil aria-hidden /> {finding ? "Edit" : "Record findings"}
            </Button>
          ) : null}
        </PanelHeader>

        {finding ? (
          <FindingSummary finding={finding} />
        ) : (
          <EmptyState
            icon={ClipboardList}
            title="No findings recorded."
            body="Once the unit has been on the bench, record what was wrong and what was done — it drives the warranty slip and the failure reports."
          />
        )}
      </Panel>
    );
  }

  return (
    <FindingForm
      ticket={ticket}
      finding={finding}
      onCancel={() => setEditing(false)}
      onSaved={(next) => {
        onSaved(next);
        setEditing(false);
      }}
      save={(input) => api.saveFinding({ ...input, actorId: user.id })}
    />
  );
}

function FindingSummary({ finding }: { finding: RepairFinding }) {
  return (
    <PanelBody className="space-y-3">
      <p className="text-sm font-medium leading-relaxed text-ink">
        {finding.summary}
      </p>

      <div className="flex flex-wrap gap-1.5">
        <Badge variant="tint">{ROOT_CAUSE_LABEL[finding.rootCause] ?? finding.rootCause}</Badge>
        <Badge variant={finding.resolution === "unrepairable" ? "stamp" : "bench"}>
          {RESOLUTION_LABEL[finding.resolution] ?? finding.resolution}
        </Badge>
        {finding.qcPassed === true ? (
          <Badge variant="bench">
            <ShieldCheck aria-hidden /> QC passed
          </Badge>
        ) : finding.qcPassed === false ? (
          <Badge variant="stamp">
            <TriangleAlert aria-hidden /> QC failed
          </Badge>
        ) : null}
      </div>

      {finding.defects.length ? (
        <div>
          <p className="label-pad mb-1.5">Defects found</p>
          <div className="flex flex-wrap gap-1.5">
            {finding.defects.map((defect) => (
              <Badge key={defect} variant="outline">
                {DEFECT_LABEL[defect] ?? defect}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      {finding.details ? (
        <div>
          <p className="label-pad mb-1">Details</p>
          <p className="text-sm leading-relaxed text-ink-soft">{finding.details}</p>
        </div>
      ) : null}

      {finding.technicianNotes ? (
        <div>
          <p className="label-pad mb-1">Technician notes</p>
          <p className="text-sm leading-relaxed text-ink-soft">
            {finding.technicianNotes}
          </p>
        </div>
      ) : null}

      <p className="border-t border-rule-soft pt-2 text-xs text-ink-faint">
        Last updated {formatDateTime(finding.updatedAt)}
      </p>
    </PanelBody>
  );
}

interface Draft {
  summary: string;
  details: string;
  rootCause: RootCause | "";
  defects: DefectArea[];
  resolution: Resolution | "";
  technicianNotes: string;
  qcPassed: "" | "pass" | "fail";
}

function FindingForm({
  ticket,
  finding,
  onCancel,
  onSaved,
  save,
}: {
  ticket: Ticket;
  finding: RepairFinding | null;
  onCancel: () => void;
  onSaved: (next: RepairFinding) => void;
  save: (input: {
    ticketId: string;
    summary: string;
    details?: string;
    rootCause: RootCause;
    defects: DefectArea[];
    resolution: Resolution;
    technicianNotes?: string;
    qcPassed?: boolean;
  }) => Promise<RepairFinding>;
}) {
  const [draft, setDraft] = useState<Draft>({
    summary: finding?.summary ?? "",
    details: finding?.details ?? "",
    rootCause: finding?.rootCause ?? "",
    defects: finding?.defects ?? [],
    resolution: finding?.resolution ?? "",
    technicianNotes: finding?.technicianNotes ?? "",
    qcPassed:
      finding?.qcPassed === true ? "pass" : finding?.qcPassed === false ? "fail" : "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const toggleDefect = (defect: DefectArea) =>
    setDraft((prev) => ({
      ...prev,
      defects: prev.defects.includes(defect)
        ? prev.defects.filter((d) => d !== defect)
        : [...prev.defects, defect],
    }));

  const submit = async () => {
    const found = validateFinding(draft);
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    try {
      const next = await save({
        ticketId: ticket.id,
        summary: draft.summary.trim(),
        details: draft.details.trim() || undefined,
        rootCause: draft.rootCause as RootCause,
        defects: draft.defects,
        resolution: draft.resolution as Resolution,
        technicianNotes: draft.technicianNotes.trim() || undefined,
        qcPassed:
          draft.qcPassed === "" ? undefined : draft.qcPassed === "pass",
      });
      toast.success("Findings recorded.");
      onSaved(next);
    } catch (caught) {
      const { message, description } = toastError(
        caught,
        "Could not record the findings.",
      );
      toast.error(message, { description });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel>
      <PanelHeader>
        <ClipboardList className="size-3.5 text-ink-faint" aria-hidden />
        <PanelTitle>{finding ? "Edit findings" : "Record findings"}</PanelTitle>
      </PanelHeader>

      <PanelBody className="space-y-4">
        <Field label="What was wrong" error={errors.summary} htmlFor="f-summary">
          <Input
            id="f-summary"
            value={draft.summary}
            onChange={(e) => set("summary", e.target.value)}
            placeholder="Charging port pins corroded from liquid ingress."
            aria-invalid={Boolean(errors.summary)}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Root cause" error={errors.rootCause}>
            <Select
              value={draft.rootCause}
              onValueChange={(v) => set("rootCause", v as RootCause)}
            >
              <SelectTrigger className="w-full" aria-invalid={Boolean(errors.rootCause)}>
                <SelectValue placeholder="Why it failed" />
              </SelectTrigger>
              <SelectContent>
                {ROOT_CAUSES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {ROOT_CAUSE_LABEL[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="What was done" error={errors.resolution}>
            <Select
              value={draft.resolution}
              onValueChange={(v) => set("resolution", v as Resolution)}
            >
              <SelectTrigger className="w-full" aria-invalid={Boolean(errors.resolution)}>
                <SelectValue placeholder="Resolution" />
              </SelectTrigger>
              <SelectContent>
                {RESOLUTIONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {RESOLUTION_LABEL[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="space-y-1.5">
          <Label>Defects found</Label>
          <div className="flex flex-wrap gap-1.5">
            {DEFECT_AREAS.map((defect) => {
              const active = draft.defects.includes(defect);
              return (
                <button
                  key={defect}
                  type="button"
                  onClick={() => toggleDefect(defect)}
                  aria-pressed={active}
                  className={cn(
                    "tap rounded-sm border px-3 text-xs font-medium transition-colors",
                    active
                      ? "border-bench bg-bench-fill text-bench-ink"
                      : "border-rule bg-copy text-ink-soft hover:bg-secondary",
                  )}
                >
                  {DEFECT_LABEL[defect]}
                </button>
              );
            })}
          </div>
        </div>

        <Field
          label={
            draft.rootCause === "other" || draft.resolution === "unrepairable"
              ? "Details (required)"
              : "Details"
          }
          error={errors.details}
          htmlFor="f-details"
        >
          <Textarea
            id="f-details"
            value={draft.details}
            onChange={(e) => set("details", e.target.value)}
            rows={3}
            placeholder="Board otherwise clean. Ultrasonic cleaned, port flex replaced."
            aria-invalid={Boolean(errors.details)}
          />
        </Field>

        <Field label="Technician notes" htmlFor="f-notes">
          <Textarea
            id="f-notes"
            value={draft.technicianNotes}
            onChange={(e) => set("technicianNotes", e.target.value)}
            rows={2}
            placeholder="Anything the vocabulary above cannot say."
          />
        </Field>

        <div className="space-y-1.5">
          <Label>Bench test after the work</Label>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["", "Not tested yet"],
                ["pass", "Passed"],
                ["fail", "Failed"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value || "none"}
                type="button"
                onClick={() => set("qcPassed", value)}
                aria-pressed={draft.qcPassed === value}
                className={cn(
                  "tap rounded-md border px-3 text-xs font-medium transition-colors",
                  draft.qcPassed === value
                    ? value === "fail"
                      ? "border-stamp bg-stamp-fill text-stamp-ink"
                      : "border-bench bg-bench-fill text-bench-ink"
                    : "border-rule bg-copy text-ink-soft hover:bg-secondary",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-rule-soft pt-3">
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Saving…" : "Save findings"}
          </Button>
        </div>
      </PanelBody>
    </Panel>
  );
}

function Field({
  label,
  error,
  htmlFor,
  children,
}: {
  label: string;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-stamp-ink">{error}</p> : null}
    </div>
  );
}
