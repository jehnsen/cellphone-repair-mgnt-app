"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, UserPlus, X } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery } from "@/lib/shop/store";
import { formatMobile } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Customer } from "@/lib/types";

export interface NewCustomerDraft {
  name: string;
  mobile: string;
  email: string;
}

/**
 * Either an existing customer, found by name or mobile, or the three fields
 * needed to open a record for a walk-in. Intake never blocks on this — a
 * ticket can be created from either state.
 */
export function CustomerPicker({
  customer,
  onSelect,
  draft,
  onDraftChange,
  className,
}: {
  customer: Customer | null;
  onSelect: (customer: Customer | null) => void;
  draft: NewCustomerDraft;
  onDraftChange: (draft: NewCustomerDraft) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data: results, loading } = useQuery(
    (api) => api.getCustomers({ search }),
    [search],
  );

  if (customer) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-sm border border-rule bg-copy px-3 py-2.5",
          className,
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{customer.name}</p>
          <p className="mono text-xs text-ink-soft">{formatMobile(customer.mobile)}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => onSelect(null)}
          aria-label="Remove selected customer"
        >
          <X aria-hidden />
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal text-ink-soft"
          >
            Search an existing customer
            <ChevronsUpDown className="text-ink-faint" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Name or mobile number"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {!loading && !results?.length ? (
                <CommandEmpty>No customer matches.</CommandEmpty>
              ) : null}
              <CommandGroup>
                {(results ?? []).slice(0, 8).map((entry) => (
                  <CommandItem
                    key={entry.id}
                    value={entry.id}
                    onSelect={() => {
                      onSelect(entry);
                      setOpen(false);
                    }}
                  >
                    <Check className="opacity-0" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-ink">{entry.name}</p>
                      <p className="mono text-xs text-ink-faint">
                        {formatMobile(entry.mobile)}
                      </p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <div className="flex items-center gap-2">
        <span className="h-px flex-1 bg-rule-soft" aria-hidden />
        <span className="label-pad text-[0.625rem]">or new customer</span>
        <span className="h-px flex-1 bg-rule-soft" aria-hidden />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="new-customer-name">
            <UserPlus className="size-3.5 text-ink-faint" aria-hidden />
            Full name
          </Label>
          <Input
            id="new-customer-name"
            value={draft.name}
            onChange={(e) => onDraftChange({ ...draft, name: e.target.value })}
            placeholder="Juan Dela Cruz"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-customer-mobile">Mobile</Label>
          <Input
            id="new-customer-mobile"
            inputMode="numeric"
            value={draft.mobile}
            onChange={(e) => onDraftChange({ ...draft, mobile: e.target.value })}
            placeholder="0917 123 4567"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="new-customer-email">Email (optional)</Label>
          <Input
            id="new-customer-email"
            type="email"
            value={draft.email}
            onChange={(e) => onDraftChange({ ...draft, email: e.target.value })}
            placeholder="juan@email.com"
          />
        </div>
      </div>
    </div>
  );
}
