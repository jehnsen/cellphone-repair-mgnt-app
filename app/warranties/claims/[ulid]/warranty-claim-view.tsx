"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ScrollText, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shell/page-header";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation, useQuery, useShop } from "@/lib/shop/store";
import { toastError } from "@/lib/api/errors";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  CLAIM_HANDLING_META,
  CLAIM_RESOLUTIONS,
  humanizeWarrantyEnum,
} from "@/lib/warranty";
import type { ClaimResolution } from "@/lib/types";
import {
  BackLink,
  ClaimStatusBadge,
  CoverageBadge,
  InfoRow,
  unitIdentifier,
} from "../../_components/warranty-ui";
import { SupplierReturnDialog } from "../../_components/supplier-return-dialog";

export function WarrantyClaimView({ ulid }: { ulid: string }) {
  const router = useRouter();
  const { can } = useShop();
  const [resolving, setResolving] = useState(false);
  const [returning, setReturning] = useState(false);

  const { data: claim, loading, error, refetch } = useQuery(
    (api) => api.getWarrantyClaim(ulid),
    [ulid],
  );

  const open = claim?.status === "open";
  const mayResolve = can("sales_warranty.manage");
  const mayReturn = can("supplier_returns.manage");

  return (
    <div className="page space-y-4 sm:space-y-5">
      <BackLink href="/warranties?tab=claims" label="Warranty claims" />

      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : loading || !claim ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <PageHeader
            eyebrow="Warranty claim"
            title={`Filed ${formatDate(claim.createdAt)}`}
            actions={
              open ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  {mayReturn && !claim.supplierReturnId ? (
                    <Button variant="outline" onClick={() => setReturning(true)}>
                      <Undo2 aria-hidden /> Send unit to supplier
                    </Button>
                  ) : null}
                  {mayResolve ? (
                    <Button onClick={() => setResolving(true)}>
                      <CheckCircle2 aria-hidden /> Resolve
                    </Button>
                  ) : null}
                </div>
              ) : undefined
            }
          />

          <div className="flex flex-wrap items-center gap-2">
            <ClaimStatusBadge status={claim.status} />
            <CoverageBadge within={claim.withinCoverage} />
            <Badge variant={CLAIM_HANDLING_META[claim.handling].badge}>
              {CLAIM_HANDLING_META[claim.handling].label}
            </Badge>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 sm:gap-5">
            <Panel>
              <PanelHeader>
                <ScrollText className="size-3.5 text-ink-faint" aria-hidden />
                <PanelTitle>Claim</PanelTitle>
              </PanelHeader>
              <PanelBody className="text-sm text-ink-soft">
                {claim.reportedDefect}
              </PanelBody>
              <div className="divide-y divide-rule-soft border-t border-rule-soft">
                <InfoRow label="Handling">
                  {humanizeWarrantyEnum(claim.handling)}
                </InfoRow>
                {claim.filedBy ? (
                  <InfoRow label="Filed by">{claim.filedBy.name}</InfoRow>
                ) : null}
                {claim.status !== "open" ? (
                  <>
                    <InfoRow label="Resolution">
                      {humanizeWarrantyEnum(claim.resolution)}
                    </InfoRow>
                    {claim.resolvedAt ? (
                      <InfoRow label="Resolved">
                        {formatDateTime(claim.resolvedAt)}
                      </InfoRow>
                    ) : null}
                    {claim.outcomeNotes ? (
                      <InfoRow label="Notes">{claim.outcomeNotes}</InfoRow>
                    ) : null}
                  </>
                ) : null}
              </div>
            </Panel>

            <div className="space-y-4 sm:space-y-5">
              <Panel>
                <PanelHeader>
                  <PanelTitle>Unit</PanelTitle>
                </PanelHeader>
                <div className="divide-y divide-rule-soft">
                  <InfoRow label="Product">
                    {claim.unit?.productName ?? "—"}
                  </InfoRow>
                  <InfoRow label="IMEI / serial">
                    <span className="mono text-xs">
                      {unitIdentifier(claim.unit)}
                    </span>
                  </InfoRow>
                  <InfoRow label="Unit status">
                    {humanizeWarrantyEnum(claim.unit?.status)}
                  </InfoRow>
                </div>
              </Panel>

              <Panel>
                <PanelHeader>
                  <PanelTitle>Linked records</PanelTitle>
                </PanelHeader>
                <div className="divide-y divide-rule-soft">
                  <InfoRow label="Warranty">
                    {claim.warranty ? (
                      <Link
                        href={`/warranties/sale/${claim.warranty.id}`}
                        className="mono text-xs text-bench-ink hover:underline"
                      >
                        {claim.warranty.warrantyCode}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </InfoRow>
                  <InfoRow label="Repair ticket">
                    {claim.repairTicketId ? (
                      <Link
                        href={`/board/${claim.repairTicketId}`}
                        className="mono text-xs text-bench-ink hover:underline"
                      >
                        Open the ticket
                      </Link>
                    ) : (
                      "—"
                    )}
                  </InfoRow>
                  <InfoRow label="Supplier return">
                    {claim.supplierReturnId ? (
                      <Link
                        href={`/warranties/returns/${claim.supplierReturnId}`}
                        className="text-xs text-bench-ink hover:underline"
                      >
                        View the return
                      </Link>
                    ) : (
                      "—"
                    )}
                  </InfoRow>
                </div>
              </Panel>
            </div>
          </div>

          {!open && !mayResolve ? (
            <EmptyState
              icon={CheckCircle2}
              title={`This claim is ${claim.status}.`}
              body="Resolved and rejected claims are read-only."
            />
          ) : null}
        </>
      )}

      {resolving && claim ? (
        <ResolveClaimDialog
          claimId={claim.id}
          onClose={() => setResolving(false)}
        />
      ) : null}

      {returning && claim ? (
        <SupplierReturnDialog
          claimId={claim.id}
          presetUnit={claim.unit}
          defaultReason="factory_defect"
          onClose={() => setReturning(false)}
          onCreated={(created) =>
            router.push(`/warranties/returns/${created.id}`)
          }
        />
      ) : null}
    </div>
  );
}

/* ── Resolve ─────────────────────────────────────────────────────────── */

function ResolveClaimDialog({
  claimId,
  onClose,
}: {
  claimId: string;
  onClose: () => void;
}) {
  const resolve = useMutation((api, input: Parameters<typeof api.resolveWarrantyClaim>[0]) =>
    api.resolveWarrantyClaim(input),
  );
  const [resolution, setResolution] = useState<ClaimResolution | "">("");
  const [notes, setNotes] = useState("");

  const canSave = resolution !== "" && !resolve.pending;

  const submit = async () => {
    if (!canSave) return;
    const { data: result, error } = await resolve.mutate({
      claimId,
      resolution: resolution as ClaimResolution,
      outcomeNotes: notes.trim() || undefined,
    });
    if (result) {
      toast.success("Claim resolved.");
      onClose();
    } else if (error) {
      const { message, description } = toastError(error, "Could not resolve the claim.");
      toast.error(message, { description });
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-ink-faint" aria-hidden />
            Resolve claim
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Resolution</Label>
            <Select
              value={resolution}
              onValueChange={(v) => setResolution(v as ClaimResolution)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="How was it settled?" />
              </SelectTrigger>
              <SelectContent>
                {CLAIM_RESOLUTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="resolve-notes">Outcome notes (optional)</Label>
            <Textarea
              id="resolve-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 2000))}
              rows={3}
              placeholder="Reflashed firmware, tested 24h."
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!canSave}>
              {resolve.pending ? "Saving…" : "Resolve claim"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
