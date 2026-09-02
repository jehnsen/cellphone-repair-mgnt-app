"use client";

import { Building2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { useShop } from "@/lib/shop/store";

/** The API's own literal for "every branch at once". */
const ALL = "all";

/**
 * Which branch the app is pointed at.
 *
 * Only rendered for an account that can actually see more than one branch —
 * an owner or manager. A cashier is scoped to the branch they work at, so
 * there is nothing here to offer them and the control is absent entirely
 * rather than shown disabled.
 *
 * Switching re-reads the shop: the board, POS, inventory and the day sheet all
 * follow it, not just the dashboard. "All branches" is a reading view; writes
 * still land on the user's own branch, which is why the trigger keeps naming
 * the branch rather than going blank.
 */
export function BranchSwitcher() {
  const { branches, branchScope, setBranchScope, canSwitchBranch } = useShop();

  if (!canSwitchBranch) return null;

  /* The trigger is narrow, so it shows the branch's short code rather than
     mirroring the option's full name + code row. */
  const current = branches.find((branch) => branch.id === branchScope);
  const label =
    !branchScope || branchScope === ALL
      ? "All branches"
      : (current?.code ?? current?.name ?? "Branch");

  return (
    <Select
      value={branchScope ?? ALL}
      onValueChange={setBranchScope}
    >
      <SelectTrigger
        aria-label="Branch"
        className="h-9 w-auto gap-1.5 rounded-sm border-rule pl-2.5 pr-2 text-xs font-medium sm:h-8"
      >
        <Building2 className="size-3.5 shrink-0 text-ink-soft" aria-hidden />
        {/* The label is rendered here rather than through `SelectValue`: the
            trigger is narrow and shows the branch's short code, not the full
            name + code row the open menu lists. (`SelectValue asChild` would
            render a Fragment, which cannot take the `data-slot` prop.) */}
        <span className="truncate">{label}</span>
      </SelectTrigger>

      {/* `position="popper"` is required whenever `align` is given: the
          default `item-aligned` mode ignores alignment and leans on CSS vars
          Radix only sets in popper mode, which lands the menu off-screen and
          unclickable. */}
      <SelectContent position="popper" align="end" sideOffset={6}>
        <SelectItem value={ALL}>All branches</SelectItem>
        {branches.map((branch) => (
          <SelectItem key={branch.id} value={branch.id}>
            <span className="flex items-center gap-2">
              <span className="mono text-[0.625rem] text-ink-faint">
                {branch.code}
              </span>
              <span>{branch.name}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
