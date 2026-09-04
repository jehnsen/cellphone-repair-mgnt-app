"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useMutation } from "@/lib/shop/store";
import { toastError } from "@/lib/api/errors";
import type { Supplier } from "@/lib/types";

/**
 * Add or edit a supplier. Shared by Settings → Suppliers and the "＋ New"
 * shortcut in the Receive dialog, so a delivery from someone not yet on the
 * list doesn't mean leaving the flow.
 *
 * A supplier is deactivated, never deleted — past goods receipts and returns
 * keep their supplier — so the only destructive move is the Active switch.
 */
export function SupplierDialog({
  supplier,
  onClose,
  onSaved,
}: {
  /** Present ⇒ edit; absent ⇒ new. */
  supplier?: Supplier;
  onClose: () => void;
  onSaved: (saved: Supplier) => void;
}) {
  const isEdit = Boolean(supplier);
  const create = useMutation(
    (api, input: Parameters<typeof api.createSupplier>[0]) =>
      api.createSupplier(input),
  );
  const update = useMutation(
    (api, input: Parameters<typeof api.updateSupplier>[0]) =>
      api.updateSupplier(input),
  );
  const pending = create.pending || update.pending;

  const [name, setName] = useState(supplier?.name ?? "");
  const [contactPerson, setContactPerson] = useState(supplier?.contactPerson ?? "");
  const [mobile, setMobile] = useState(supplier?.mobile ?? "");
  const [email, setEmail] = useState(supplier?.email ?? "");
  const [terms, setTerms] = useState(supplier?.terms ?? "");
  const [note, setNote] = useState(supplier?.note ?? "");
  const [active, setActive] = useState(supplier?.active ?? true);

  const canSave = name.trim().length > 1 && !pending;

  const submit = async () => {
    if (!canSave) return;
    const fields = { name, contactPerson, mobile, email, terms, note };
    const outcome = isEdit
      ? await update.mutate({ id: supplier!.id, ...fields, active })
      : await create.mutate(fields);

    if (outcome.data) {
      toast.success(isEdit ? "Supplier updated." : `${outcome.data.name} added.`);
      onSaved(outcome.data);
    } else if (outcome.error) {
      const { message, description } = toastError(
        outcome.error,
        "Could not save the supplier.",
      );
      toast.error(message, { description });
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Edit ${supplier!.name}` : "New supplier"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="supplier-name">Name</Label>
            <Input
              id="supplier-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Cebu Gadget Distributors"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="supplier-contact">Contact person</Label>
              <Input
                id="supplier-contact"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="supplier-mobile">Mobile</Label>
              <Input
                id="supplier-mobile"
                inputMode="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="supplier-email">Email</Label>
            <Input
              id="supplier-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="supplier-terms">Payment terms</Label>
            <Input
              id="supplier-terms"
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              placeholder="e.g. 30 days, or COD"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="supplier-note">Note</Label>
            <Textarea
              id="supplier-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Optional"
            />
          </div>

          {isEdit ? (
            <label className="flex items-center gap-2 text-sm text-ink">
              <Switch checked={active} onCheckedChange={setActive} />
              {active
                ? "Active — offered when receiving stock"
                : "Inactive — hidden from the receiving picker"}
            </label>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!canSave}>
              {pending ? "Saving…" : isEdit ? "Save changes" : "Add supplier"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
