"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
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
import { cn } from "@/lib/utils";

/**
 * Pick from a known list, or type a value that isn't on it. The free-text
 * entry is committed as-is; it's on the caller to decide what a new value
 * means (intake, for one, lets the API create the brand/model on save).
 *
 * Built on the same Popover + Command pair as `CustomerPicker`, so it reads
 * and behaves like the rest of the intake form.
 */
export function Combobox({
  value,
  onChange,
  options,
  placeholder = "Select or type…",
  emptyHint = "Type to add a new one.",
  disabled,
  id,
  className,
  "aria-invalid": ariaInvalid,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  emptyHint?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  "aria-invalid"?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const trimmed = query.trim();
  const filtered = useMemo(() => {
    if (!trimmed) return options;
    const needle = trimmed.toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(needle));
  }, [options, trimmed]);

  const exactMatch = options.some(
    (o) => o.toLowerCase() === trimmed.toLowerCase(),
  );
  const canAdd = trimmed.length > 0 && !exactMatch;

  const commit = (next: string) => {
    onChange(next);
    setQuery("");
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={ariaInvalid}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-ink-soft",
            className,
          )}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="text-ink-faint" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) p-0"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search or type a new value"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {!filtered.length && !canAdd ? (
              <CommandEmpty>{emptyHint}</CommandEmpty>
            ) : null}
            {filtered.length ? (
              <CommandGroup>
                {filtered.map((option) => (
                  <CommandItem
                    key={option}
                    value={option}
                    onSelect={() => commit(option)}
                  >
                    <Check
                      className={cn(
                        option === value ? "opacity-100" : "opacity-0",
                      )}
                      aria-hidden
                    />
                    <span className="truncate">{option}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {canAdd ? (
              <CommandGroup heading={filtered.length ? "Not listed?" : undefined}>
                <CommandItem value={`add:${trimmed}`} onSelect={() => commit(trimmed)}>
                  <Plus aria-hidden />
                  <span className="truncate">
                    Use &ldquo;{trimmed}&rdquo;
                  </span>
                </CommandItem>
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
