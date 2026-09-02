"use client";

import { BookOpen, Compass, Info, ListChecks } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NAV } from "@/components/shell/nav";
import { useShop } from "@/lib/shop/store";
import { PERMISSION_LABEL } from "@/lib/roles";
import type { Permission } from "@/lib/types";
import type { LucideIcon } from "lucide-react";

/**
 * The in-app guide, reached from the "Help & guide" button under the menu.
 * Task-first: what each menu item is for, and the step lists for the jobs the
 * counter actually does. Copy is written for the person at the counter, not
 * the codebase.
 */
export function HelpView() {
  return (
    <div className="page space-y-4 sm:space-y-5">
      <PageHeader
        eyebrow="Help"
        title="Operating the system"
        description="What each part of the menu is for, and how to work through the jobs that come across the counter."
      />

      <Tabs defaultValue="start">
        <TabsList>
          <TabsTrigger value="start">
            <Compass aria-hidden /> Start here
          </TabsTrigger>
          <TabsTrigger value="menu">
            <BookOpen aria-hidden /> The menu
          </TabsTrigger>
          <TabsTrigger value="flows">
            <ListChecks aria-hidden /> Workflows
          </TabsTrigger>
          <TabsTrigger value="notes">
            <Info aria-hidden /> Good to know
          </TabsTrigger>
        </TabsList>

        <TabsContent value="start" className="pt-4">
          <StartHere />
        </TabsContent>
        <TabsContent value="menu" className="pt-4">
          <TheMenu />
        </TabsContent>
        <TabsContent value="flows" className="pt-4">
          <Workflows />
        </TabsContent>
        <TabsContent value="notes" className="pt-4">
          <GoodToKnow />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ── Start here ──────────────────────────────────────────────────────── */

function StartHere() {
  const { user } = useShop();

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader>
          <PanelTitle>What this is</PanelTitle>
        </PanelHeader>
        <PanelBody className="max-w-[72ch] space-y-3 text-sm leading-relaxed text-ink">
          <p>
            This is the shop&rsquo;s front desk. Repairs come in as job orders,
            move across a status board while they&rsquo;re worked on, and are
            handed back at release. Alongside that sit the point of sale, the
            cash drawer, stock, the customer list, and the reports.
          </p>
          <p className="text-ink-soft">
            Nothing here is a practice mode. Every record is the live shop, and a
            save is a real save.
          </p>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>Signing in and your menu</PanelTitle>
        </PanelHeader>
        <PanelBody className="max-w-[72ch] space-y-3 text-sm leading-relaxed text-ink-soft">
          <p>
            Sign in with your shop account. You&rsquo;re signed in as{" "}
            <span className="font-medium text-ink">{user.name}</span> (
            <span className="capitalize">{user.role}</span>).
          </p>
          <p>
            Your role decides which menu items you see. The owner sees
            everything; a cashier gets the counter and the drawer; a technician
            gets the job queue and parts. If a page says{" "}
            <span className="font-medium text-ink">&ldquo;not permitted&rdquo;</span>,
            your account doesn&rsquo;t have that access &mdash; ask the owner.
          </p>
          <p>
            The left menu is grouped <b className="text-ink">Counter</b>,{" "}
            <b className="text-ink">Shop</b>, and <b className="text-ink">Office</b>.
            A number badge means: on <b className="text-ink">Repair board</b>, jobs
            past their promised date; on <b className="text-ink">Release</b>, units
            waiting to be claimed; on <b className="text-ink">Inventory</b>, items
            at or below their reorder point.
          </p>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>Before you can ring up a sale</PanelTitle>
        </PanelHeader>
        <PanelBody className="max-w-[72ch] text-sm leading-relaxed text-ink-soft">
          <p>
            Point of sale won&rsquo;t take anything until a shift is open. On the
            POS screen, enter the starting cash count and open the drawer. Close
            it at the end of the shift with a counted total &mdash; the screen
            shows whether you&rsquo;re over or short.
          </p>
        </PanelBody>
      </Panel>
    </div>
  );
}

/* ── The menu ────────────────────────────────────────────────────────── */

const MENU_COPY: Record<string, string> = {
  "/": "The day sheet. What's late, what's waiting on a customer, what's ready at the counter, and the drawer total — the numbers to check before the counter opens.",
  "/intake":
    "Take a unit in for repair. Find or add the customer, register the device by IMEI, write the fault, note the accessories and condition, set an estimate, take a downpayment, and print the claim stub.",
  "/board":
    "Every open job as a card in a status column. Assign a technician, move a job forward a step at a time, and add a note on the move. Search by name or IMEI.",
  "/release":
    "Hand a finished unit back. Scan the claim code, ticket number, or IMEI; settle the balance; record who collected it; print the receipt. The warranty starts here.",
  "/pos":
    "Sell handsets, accessories, and services over the counter, and run the cash drawer. Handles senior/PWD VAT relief, a trade-in as tender, a one-off custom service, and cash in/out.",
  "/inventory":
    "Stock on hand. Receive a delivery, adjust a count, retire a handset. Handsets are tracked one IMEI at a time; accessories by quantity; parts are consumed by repairs.",
  "/customers":
    "Everyone who's been through, searchable by name or IMEI. Their repairs by device, purchases, outstanding balances, warranties, and the store-credit ledger.",
  "/reports":
    "The figures of record: sales by what was sold, margin, technician throughput, dead stock, unclaimed aging. Computed over the whole shop, not just what's on screen.",
  "/settings":
    "The shop's own details and receipt text, branch configuration, the device brand and model catalog (Devices tab), and the message templates for customer notifications.",
};

function TheMenu() {
  const { can } = useShop();

  const rows: {
    href: string;
    label: string;
    icon: LucideIcon;
    permission: Permission | null;
    copy: string;
  }[] = [
    ...NAV.flatMap((section) => section.items).map((item) => ({
      href: item.href,
      label: item.label,
      icon: item.icon,
      permission: item.permission,
      copy: MENU_COPY[item.href] ?? "",
    })),
    {
      href: "/help",
      label: "Help & guide",
      icon: BookOpen,
      permission: null,
      copy: "This page.",
    },
  ];

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Every item in the menu</PanelTitle>
        <span className="mono ml-auto text-xs text-ink-faint">
          {rows.length} items
        </span>
      </PanelHeader>
      <ul className="divide-y divide-rule-soft">
        {rows.map((row) => {
          const Icon = row.icon;
          const allowed = row.permission === null || can(row.permission);
          return (
            <li
              key={row.href}
              className="flex flex-col gap-2 px-3 py-3.5 sm:flex-row sm:gap-4 sm:px-4"
            >
              <div className="flex items-start gap-2.5 sm:w-48 sm:shrink-0">
                <Icon
                  className="mt-0.5 size-4 shrink-0 text-ink-faint"
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{row.label}</p>
                  <p className="mono text-xs text-ink-faint">{row.href}</p>
                </div>
              </div>
              <div className="min-w-0 max-w-[68ch] flex-1 space-y-1.5">
                <p className="text-sm leading-relaxed text-ink-soft">{row.copy}</p>
                {row.permission === null ? (
                  <span className="text-xs text-ink-faint">
                    Open to every account.
                  </span>
                ) : allowed ? (
                  <span className="text-xs text-ink-faint">
                    Available to your account.
                  </span>
                ) : (
                  <Badge variant="ghost">
                    Needs &ldquo;{PERMISSION_LABEL[row.permission]}&rdquo;
                  </Badge>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/* ── Workflows ───────────────────────────────────────────────────────── */

const FLOWS: { title: string; when: string; steps: string[]; role?: string }[] = [
  {
    title: "Take in a repair",
    when: "A customer brings a unit to the counter.",
    steps: [
      "Menu → New job order.",
      "Search the customer by mobile or name. If they're new, fill in the name and mobile.",
      "Enter the device: brand, model, colour, and the IMEI (15 digits) or serial. A brand or model the shop hasn't seen before is created when you save.",
      "Write the reported problem. Tick the problem tags, the accessories turned over, and the intake condition checklist. Add photos of the unit as it came in.",
      "Set the estimate, and the downpayment and method if the customer pays now.",
      "Set the promised date — it means “by 5 pm that day” — and the warranty days offered.",
      "Save. Print the claim stub and give it to the customer.",
    ],
  },
  {
    title: "Move a job through the board",
    when: "A job order is open and being worked on.",
    steps: [
      "Menu → Repair board. Open the job card.",
      "Assign a technician.",
      "Record the diagnosis: a summary, the root cause, the defect areas, the resolution, and whether it passed QC.",
      "If the real cost is above the estimate, send a quote. The job then waits on the customer's reply.",
      "Take any payment now with Record a payment — it doesn't have to wait for release.",
      "Move the job forward one step. The board only offers legal moves; “in repair → ready” passes through QC on its own.",
      "Run the release-phase IMEI scan at QC.",
      "Mark it Ready for pickup. The customer is notified.",
    ],
  },
  {
    title: "Release a unit",
    when: "The repair is done and the customer has come to collect it.",
    steps: [
      "Menu → Release, or scan from the Ready list on the day sheet.",
      "Scan or type the claim code, ticket number, or IMEI.",
      "Check it against the intake photo and the IMEI on the unit.",
      "If a balance is owed, take the final payment. A unit can't be released while money is owed.",
      "Enter who is collecting it.",
      "Release, and print the receipt.",
    ],
  },
  {
    title: "Ring up a sale",
    when: "Selling goods or a counter service, not a repair.",
    steps: [
      "Menu → Point of sale. If the drawer is closed, open it with a starting cash count.",
      "Scan a barcode or search. Handsets are picked by IMEI; everything else adds by quantity.",
      "For labour, use Service — search the catalog, or add a custom one-off with its own name and price.",
      "Tick Senior citizen / PWD if it applies and enter the ID. VAT comes off first, then the 20% discount.",
      "To take a trade-in: tick Apply a trade-in and enter the completed acquisition's ID and value. It offsets the total and never goes in the drawer.",
      "Pick the payment method. For cash, enter what was tendered and the screen shows the change.",
      "Charge, and print the receipt on the 58 mm or 80 mm roll.",
    ],
  },
  {
    title: "Run the cash drawer",
    when: "Opening, topping up, or closing out a shift.",
    steps: [
      "Open: at the start of the shift, enter the starting cash count on the POS screen.",
      "Cash in / out: use it for a float top-up or a petty-cash payout — always with a reason.",
      "Close: at the end of the shift, count the cash and enter it. The screen shows over or short against the expected total. Add a note if it doesn't balance.",
    ],
  },
  {
    title: "Adjust a customer's store credit",
    when: "Granting goodwill credit, or correcting a mistaken refund.",
    role: "Manager or owner",
    steps: [
      "Menu → Customers. Open the customer.",
      "In the Store credit panel, choose Adjust.",
      "Grant or Deduct, then enter the amount and a reason. A deduction can't take the balance below zero.",
    ],
  },
  {
    title: "Keep the device catalog tidy",
    when: "Pre-seeding the brands and models the shop sees most.",
    steps: [
      "Menu → Settings → Devices.",
      "New brand or New model to add rows.",
      "Edit to rename a row or switch it off — an inactive row stays on past tickets but drops out of the intake picker.",
      "Delete only if nothing points at it. The server refuses otherwise — switch it off instead.",
    ],
  },
  {
    title: "Receive and adjust stock",
    when: "A delivery arrives, or a count needs correcting.",
    steps: [
      "Menu → Inventory → Receive to log a delivery against a supplier.",
      "Adjust for damage, loss, or a recount correction — pick the reason that fits.",
      "Retire a handset unit by its IMEI when it's written off.",
    ],
  },
];

function Workflows() {
  return (
    <div className="space-y-3">
      {FLOWS.map((flow, i) => (
        <details
          key={flow.title}
          open={i === 0}
          className="group rounded-sm border border-rule bg-copy shadow-panel [&_summary::-webkit-details-marker]:hidden"
        >
          <summary className="tap flex cursor-pointer list-none items-center gap-3 px-3 py-3 sm:px-4">
            <span className="mono text-xs font-semibold text-ink-faint">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink">
                {flow.title}
              </span>
              <span className="block text-xs text-ink-soft">{flow.when}</span>
            </span>
            {flow.role ? <Badge variant="bench">{flow.role}</Badge> : null}
            <span
              className="text-ink-faint transition-transform group-open:rotate-90"
              aria-hidden
            >
              &rsaquo;
            </span>
          </summary>
          <ol className="max-w-[74ch] space-y-2.5 border-t border-rule-soft px-3 py-3.5 sm:px-4">
            {flow.steps.map((step, n) => (
              <li key={n} className="flex gap-3 text-sm leading-relaxed">
                <span className="mono mt-px shrink-0 text-xs text-ink-faint">
                  {n + 1}.
                </span>
                <span className="text-ink-soft">{step}</span>
              </li>
            ))}
          </ol>
        </details>
      ))}
    </div>
  );
}

/* ── Good to know ────────────────────────────────────────────────────── */

const NOTES: { term: string; body: string }[] = [
  {
    term: "Your role sets your menu",
    body: "If a page shows “not permitted”, your account doesn't have that access. The page still exists by URL — it's the server that says no. Ask the owner if you need it.",
  },
  {
    term: "Statuses can't skip",
    body: "The board only ever offers the next legal move. If the step you want isn't there, an earlier one hasn't been done yet.",
  },
  {
    term: "A promised day means 5 pm",
    body: "“Promised Thursday” is close of business Thursday, Manila time — that's when a job counts as due.",
  },
  {
    term: "IMEI or serial",
    body: "Exactly 15 digits is treated as an IMEI and check-digit verified. Anything else is stored as a serial number.",
  },
  {
    term: "Repairs and sales are separate",
    body: "Money against a repair goes on the ticket, at any point in the job. The point of sale is for goods and counter services, and it has its own drawer.",
  },
  {
    term: "Reports are the real totals",
    body: "They're computed on the server over the whole shop. The other screens only show the records that have been loaded, so don't add those up for a figure that has to be right.",
  },
  {
    term: "A dropped session signs you out",
    body: "If the server stops trusting your session you're returned to sign-in. Sign in again and carry on — nothing in progress is lost on the server.",
  },
  {
    term: "If the server can't be reached",
    body: "The app says so and offers Try again. Nothing was lost — it just couldn't load. Check that the shop server is running.",
  },
];

function GoodToKnow() {
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Things that trip people up</PanelTitle>
      </PanelHeader>
      <dl className="divide-y divide-rule-soft">
        {NOTES.map((note) => (
          <div key={note.term} className="max-w-[74ch] px-3 py-3.5 sm:px-4">
            <dt className="text-sm font-semibold text-ink">{note.term}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-ink-soft">
              {note.body}
            </dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}
