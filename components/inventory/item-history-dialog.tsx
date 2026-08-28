"use client";

/* Aliased: bare `History` is a DOM global that TypeScript resolves first. */
import { History as HistoryIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/states";
import { useQuery } from "@/lib/shop/store";
import { formatDateTime, peso } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { InventoryItem, MovementReason } from "@/lib/types";

/**
 * Every movement that ever touched this item, newest first.
 *
 * The ledger is the source of truth for stock — the quantity on the list is
 * derived from it — so this is where a count that looks wrong gets explained:
 * what came in, what went out, against which sale or job order.
 */

const REASON_LABEL: Record<MovementReason, string> = {
  receiving: "Received",
  sale: "Sold",
  repair_consumption: "Used on a repair",
  return_customer: "Customer return",
  return_supplier: "Returned to supplier",
  damaged: "Damaged",
  lost: "Lost",
  count_correction: "Count correction",
  trade_in: "Trade-in",
  reserved: "Reserved",
  unreserved: "Unreserved",
};

export function ItemHistoryDialog({
  item,
  onOpenChange,
}: {
  item: InventoryItem | null;
  onOpenChange: (open: boolean) => void;
}) {
  /* Keyed on the item so switching rows refetches rather than showing the
     previous item's ledger. */
  const {
    data: movements,
    loading,
    error,
    refetch,
  } = useQuery(
    (api) => (item ? api.getMovements(item.id) : Promise.resolve([])),
    [item?.id],
  );

  const rows = (movements ?? []).slice().sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );

  return (
    <Dialog open={Boolean(item)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HistoryIcon className="size-4 text-ink-faint" aria-hidden />
            Movement history
          </DialogTitle>
        </DialogHeader>

        {item ? (
          <div className="rounded-lg border border-rule bg-paper px-3 py-2">
            <p className="text-sm font-medium text-ink">{item.name}</p>
            <p className="mono text-xs text-ink-soft">
              {item.sku} · {item.quantityOnHand} on hand
            </p>
          </div>
        ) : null}

        <div className="max-h-[55vh] overflow-y-auto">
          {error ? (
            <ErrorState error={error} onRetry={refetch} />
          ) : loading && !movements ? (
            <LoadingRows rows={4} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={HistoryIcon}
              title="Nothing has moved yet."
              body="Receiving stock, selling it, or using it on a repair will show up here."
            />
          ) : (
            <ul className="divide-y divide-rule-soft">
              {rows.map((movement) => {
                const incoming = movement.quantity > 0;
                return (
                  <li key={movement.id} className="flex items-baseline gap-3 py-2">
                    <span
                      className={cn(
                        "mono w-12 shrink-0 text-right text-sm font-semibold",
                        incoming ? "text-bench-ink" : "text-stamp-ink",
                      )}
                    >
                      {incoming ? "+" : ""}
                      {movement.quantity}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink">
                        {REASON_LABEL[movement.reason] ?? movement.reason}
                      </p>
                      <p className="mono text-xs text-ink-faint">
                        {formatDateTime(movement.at)}
                        {movement.reference ? ` · ${movement.reference}` : ""}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      {movement.unitCost !== undefined ? (
                        <p className="mono text-xs text-ink-soft">
                          {peso(movement.unitCost)}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* The API filters movements by internal id, which it never exposes,
            so the ledger is fetched whole and narrowed here. */}
        <p className="text-xs leading-relaxed text-ink-faint">
          Stock on hand is derived from this ledger, not stored separately.
        </p>
      </DialogContent>
    </Dialog>
  );
}
