"use client";

import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_BLURB, ROLE_LABEL } from "@/lib/roles";
import { useShop } from "@/lib/mock/store";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";

const ORDER: Role[] = ["owner", "manager", "cashier", "technician"];

/**
 * No auth in this build — this only changes which permissions the shell hands
 * out, so every role's version of a screen can be reviewed side by side.
 */
export function RoleSwitcher() {
  const { db, user, setUserId } = useShop();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-8 items-center gap-2 rounded-sm border border-rule bg-copy px-2 text-left hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        aria-label={`Signed in as ${user.name}, ${ROLE_LABEL[user.role]}. Switch user`}
      >
        <span className="mono grid size-5 place-items-center bg-ink text-[0.625rem] font-semibold text-paper">
          {user.initials}
        </span>
        <span className="hidden leading-none sm:block">
          <span className="block text-xs font-medium text-ink">{user.name}</span>
          <span className="label-pad block text-[0.625rem] leading-tight">
            {ROLE_LABEL[user.role]}
          </span>
        </span>
        <ChevronDown className="size-3.5 text-ink-faint" aria-hidden />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="label-pad">Switch user</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ORDER.map((role) => {
          const users = db.users.filter((entry) => entry.role === role && entry.active);
          if (!users.length) return null;
          return (
            <div key={role} className="py-1">
              <div className="px-2 pb-1">
                <p className="text-xs font-semibold text-ink">{ROLE_LABEL[role]}</p>
                <p className="text-[0.6875rem] leading-snug text-ink-soft">{ROLE_BLURB[role]}</p>
              </div>
              {users.map((entry) => (
                <DropdownMenuItem
                  key={entry.id}
                  onSelect={() => setUserId(entry.id)}
                  className="gap-2"
                >
                  <span
                    className={cn(
                      "mono grid size-5 place-items-center text-[0.625rem] font-semibold",
                      entry.id === user.id ? "bg-bench text-white" : "bg-secondary text-ink-soft",
                    )}
                  >
                    {entry.initials}
                  </span>
                  <span className="flex-1 text-sm">{entry.name}</span>
                  {entry.id === user.id ? (
                    <Check className="size-3.5 text-bench" aria-hidden />
                  ) : null}
                </DropdownMenuItem>
              ))}
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
