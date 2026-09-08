"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useShop } from "@/lib/shop/store";
import { toastError } from "@/lib/api/errors";
import {
  RESOLUTION_LABEL,
  RESOLUTIONS,
  ROOT_CAUSE_LABEL,
  ROOT_CAUSES,
} from "@/lib/findings";
import { labelForIssue } from "@/lib/diagnosis";
import type {
  DefectArea,
  IssueCatalog,
  RepairFinding,
  Resolution,
  RootCause,
  Ticket,
} from "@/lib/types";

/**
 * Confirming a diagnosis writes it to the ticket's finding.
 *
 * There is no separate diagnosis record in this app, deliberately:
 * `repair_findings` is already one-per-ticket and already carries a `defects`
 * array from the same vocabulary the picker uses. Writing anywhere else would
 * give the shop two answers to "what is wrong with this unit".
 *
 * That has one consequence worth being upfront about, and it is why this
 * dialog exists at all rather than the confirm being a single button: the
 * server requires a root cause and a resolution on every finding. A diagnosis
 * made at the counter genuinely does not know the resolution yet, so the
 * technician is asked rather than having something plausible invented for
 * them. Once a finding exists, re-confirming only updates the defects and
 * these two keep whatever they already said.
 */
export function ConfirmDiagnosisDialog({
  open,
  onOpenChange,
  ticket,
  finding,
  catalog,
  selectedIssueKeys,
  customNote,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: Ticket;
  finding: RepairFinding | null;
  catalog: IssueCatalog;
  /** Defect keys — the dialog only opens when the source is `defect`. */
  selectedIssueKeys: string[];
  customNote: string;
  onSaved: (next: RepairFinding) => void;
}) {
  const { api, user } = useShop();

  const suggestedSummary =
    selectedIssueKeys
      .map((key) => labelForIssue(catalog, "defect", key))
      .join(", ") || "";

  const [summary, setSummary] = useState(finding?.summary ?? suggestedSummary);
  const [rootCause, setRootCause] = useState<RootCause | "">(
    finding?.rootCause ?? "",
  );
  const [resolution, setResolution] = useState<Resolution | "">(
    finding?.resolution ?? "",
  );
  const [saving, setSaving] = useState(false);

  const trimmedNote = customNote.trim();

  async function save() {
    if (summary.trim().length < 3 || !rootCause || !resolution) return;

    setSaving(true);
    try {
      /* The note is appended to `details` rather than replacing it: a finding
         may already carry an explanation the server made mandatory (an
         "other" root cause, an "unrepairable" verdict), and silently dropping
         it would fail validation or lose the reason. */
      const existingDetails = finding?.details?.trim() ?? "";
      const details = [existingDetails, trimmedNote]
        .filter(Boolean)
        .filter((value, index, all) => all.indexOf(value) === index)
        .join("\n\n");

      const next = await api.saveFinding({
        ticketId: ticket.id,
        summary: summary.trim(),
        details: details || undefined,
        rootCause,
        defects: selectedIssueKeys as DefectArea[],
        resolution,
        technicianNotes: finding?.technicianNotes,
        qcPassed: finding?.qcPassed,
        actorId: user.id,
      });

      toast.success("Diagnosis saved to the ticket");
      onSaved(next);
      onOpenChange(false);
    } catch (caught) {
      const { message, description } = toastError(
        caught,
        "Could not save the diagnosis.",
      );
      toast.error(message, { description });
    } finally {
      setSaving(false);
    }
  }

  const valid = summary.trim().length >= 3 && rootCause && resolution;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {finding ? "Update the diagnosis" : "Record the diagnosis"}
          </DialogTitle>
          <DialogDescription>
            This is saved onto the ticket&rsquo;s findings — the record the
            quote, the warranty slip, and the failure reports all read from.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="confirm-summary">What is wrong</Label>
            <Input
              id="confirm-summary"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              className="mt-1.5"
              placeholder="Charging port pins corroded from liquid ingress."
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Root cause</Label>
              <Select
                value={rootCause}
                onValueChange={(value) => setRootCause(value as RootCause)}
              >
                <SelectTrigger className="mt-1.5 w-full">
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
            </div>

            <div>
              <Label>What was done</Label>
              <Select
                value={resolution}
                onValueChange={(value) => setResolution(value as Resolution)}
              >
                <SelectTrigger className="mt-1.5 w-full">
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
            </div>
          </div>

          {/* The server makes details mandatory for these two, and it is
              better to say so here than to have the save bounce. */}
          {(rootCause === "other" || resolution === "unrepairable") &&
          !trimmedNote &&
          !finding?.details?.trim() ? (
            <p className="rounded-sm border border-flag/40 bg-flag-fill px-2.5 py-2 text-xs leading-relaxed text-flag-ink">
              {rootCause === "other"
                ? "A root cause of “Other” needs an explanation."
                : "An unrepairable verdict needs a reason — the customer is told this."}{" "}
              Add it in the note beside the picker before saving.
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={save} disabled={!valid || saving}>
            {saving ? "Saving…" : "Save diagnosis"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
