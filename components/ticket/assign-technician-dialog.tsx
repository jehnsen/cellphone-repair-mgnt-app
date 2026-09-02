"use client";

import { useEffect, useMemo, useState } from "react";
import { UserCog } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useShop } from "@/lib/shop/store";
import { toastError } from "@/lib/api/errors";
import type { Ticket } from "@/lib/types";

/**
 * Put a name on a job — or move it to another bench.
 *
 * `assignTechnician` PATCHes `assigned_technician_ulid`; the wire call takes an
 * array, so this is the single-ticket case of the same op the board would use
 * for a multi-select. Technicians come from `db.users` (the unscoped `/users`
 * read at boot), filtered to the active ones flagged `isTechnician`.
 */
export function AssignTechnicianDialog({
  ticket,
  open,
  onOpenChange,
  onAssigned,
}: {
  ticket: Ticket;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssigned?: () => void;
}) {
  const { db, user, api } = useShop();
  const [choice, setChoice] = useState<string>(ticket.technicianId ?? "");
  const [saving, setSaving] = useState(false);

  /* Re-seed the picker whenever the dialog opens, so a reassign starts from
     whoever the job is on now rather than a stale first render. */
  useEffect(() => {
    if (open) setChoice(ticket.technicianId ?? "");
  }, [open, ticket.technicianId]);

  const technicians = useMemo(
    () =>
      db.users
        .filter((u) => u.isTechnician && u.active)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [db.users],
  );

  const current = ticket.technicianId
    ? db.users.find((u) => u.id === ticket.technicianId)
    : null;
  const unchanged = choice === (ticket.technicianId ?? "");

  const submit = async () => {
    if (!choice || unchanged) return;
    setSaving(true);
    try {
      await api.assignTechnician({
        ticketIds: [ticket.id],
        technicianId: choice,
        actorId: user.id,
      });
      const name = technicians.find((t) => t.id === choice)?.name ?? "technician";
      toast.success(`${ticket.ticketNo} assigned to ${name}.`);
      onOpenChange(false);
      onAssigned?.();
    } catch (caught) {
      const { message, description } = toastError(
        caught,
        "Could not assign the technician.",
      );
      toast.error(message, { description });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="size-4 text-ink-faint" aria-hidden />
            {current ? "Reassign technician" : "Assign a technician"}
          </DialogTitle>
          <DialogDescription>
            {current
              ? `${ticket.ticketNo} is with ${current.name}. Pick who takes it next.`
              : `Choose who works ${ticket.ticketNo}.`}
          </DialogDescription>
        </DialogHeader>

        {technicians.length ? (
          <div className="space-y-1.5">
            <p className="label-pad">Technician</p>
            <Select value={choice} onValueChange={setChoice}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a technician" />
              </SelectTrigger>
              <SelectContent>
                {technicians.map((tech) => (
                  <SelectItem key={tech.id} value={tech.id}>
                    {tech.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <p className="rounded-sm border border-rule bg-paper px-3 py-2.5 text-sm text-ink-soft">
            No one on staff is marked as a technician. Add or flag a technician
            in Settings → Staff first.
          </p>
        )}

        <div className="mt-1 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!choice || unchanged || saving}>
            {saving ? "Assigning…" : current ? "Reassign" : "Assign"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
