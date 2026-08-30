"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Tabs as TabsPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

/**
 * Filing-cabinet tabs: the active one sits on the paper and joins it, the rest
 * stay behind the rule. `variant="line"` is the quieter version for a panel
 * header where a raised tab would be too much furniture.
 */

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "group/tabs flex gap-0 data-[orientation=horizontal]:flex-col",
        className,
      )}
      {...props}
    />
  );
}

const tabsListVariants = cva(
  /* `overflow-x-auto` alone forces `overflow-y` to compute to `auto` (a
     `visible` cross axis is coerced), and the active tab's -mb-px border box
     spills 1px past the list — so a phantom vertical scrollbar appears. `clip`
     is the one value that co-exists with `auto` on the other axis; it stops
     the scrollbar while still allowing horizontal scrolling, and only clips
     that 1px border overhang, which sits on the bottom rule anyway. */
  "group/tabs-list flex items-end gap-1 overflow-x-auto overflow-y-clip text-ink-soft group-data-[orientation=vertical]/tabs:flex-col group-data-[orientation=vertical]/tabs:items-stretch group-data-[orientation=vertical]/tabs:overflow-visible",
  {
    variants: {
      variant: {
        default: "border-b border-rule",
        line: "gap-3 border-b border-rule",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "label-bin relative -mb-px inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap px-3 py-2 text-ink-soft transition-colors sm:min-h-9",
        "hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
        "disabled:pointer-events-none disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",

        /* Raised tab: joins the paper below it by covering the rule. */
        "group-data-[variant=default]/tabs-list:border group-data-[variant=default]/tabs-list:border-transparent",
        "group-data-[variant=default]/tabs-list:data-[state=active]:border-rule group-data-[variant=default]/tabs-list:data-[state=active]:border-b-copy group-data-[variant=default]/tabs-list:data-[state=active]:bg-copy group-data-[variant=default]/tabs-list:data-[state=active]:text-ink",

        /* Line tab: a rule under the label, nothing else. */
        "group-data-[variant=line]/tabs-list:px-0.5 group-data-[variant=line]/tabs-list:data-[state=active]:text-ink",
        "group-data-[variant=line]/tabs-list:after:absolute group-data-[variant=line]/tabs-list:after:inset-x-0 group-data-[variant=line]/tabs-list:after:bottom-0 group-data-[variant=line]/tabs-list:after:h-[2px] group-data-[variant=line]/tabs-list:after:bg-bench group-data-[variant=line]/tabs-list:after:opacity-0 group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };
