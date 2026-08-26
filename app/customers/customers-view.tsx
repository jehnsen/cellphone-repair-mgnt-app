"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  Pencil,
  Search,
  ShieldCheck,
  Smartphone,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shell/page-header";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Input, InputMono } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/states";
import { StatusChip } from "@/components/tag/status-chip";
import { useMutation, useShop } from "@/lib/mock/store";
import { STATUS_META } from "@/lib/status";
import { formatDate, formatImei, formatMobile, peso } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Customer, Sale, Ticket } from "@/lib/types";

export function CustomersView() {
  const { db } = useShop();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [creating, setCreating] = useState(false);

  /** Search reaches into tickets so an IMEI finds its owner. */
  const results = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const rows = [...db.customers].sort((a, b) => a.name.localeCompare(b.name));
    if (!needle) return rows;

    const imeiOwners = new Set(
      db.tickets
        .filter((ticket) => ticket.device.imei.toLowerCase().includes(needle))
        .map((ticket) => ticket.customerId),
    );

    return rows.filter((customer) => {
      if (imeiOwners.has(customer.id)) return true;
      return [customer.name, customer.mobile, customer.email ?? "", customer.seniorPwdId ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [db.customers, db.tickets, search]);

  const selected = selectedId
    ? db.customers.find((entry) => entry.id === selectedId) ?? null
    : null;

  return (
    <div className="page space-y-4 sm:space-y-5">
      <PageHeader
        eyebrow="Shop"
        title="Customers"
        description="Every unit that has passed through the shop, by owner and by IMEI."
        actions={
          <Button size="sm" onClick={() => setCreating(true)}>
            <UserPlus aria-hidden /> New customer
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] sm:gap-5">
        {/* Directory */}
        <div className={cn("space-y-3", selected && "hidden lg:block")}>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-faint"
              aria-hidden
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, mobile, or IMEI"
              className="pl-8"
              aria-label="Search customers"
            />
          </div>

          <Panel>
            {results.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No customer matches."
                body="Try a mobile number, or the IMEI printed on the unit."
              />
            ) : (
              <ul className="max-h-[70vh] divide-y divide-rule-soft overflow-y-auto">
                {results.map((customer) => {
                  const openCount = db.tickets.filter(
                    (t) => t.customerId === customer.id && !STATUS_META[t.status].terminal,
                  ).length;
                  return (
                    <li key={customer.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(customer.id)}
                        aria-current={selectedId === customer.id ? "true" : undefined}
                        className={cn(
                          "tap flex w-full items-center gap-3 px-3 py-2 text-left transition-colors",
                          selectedId === customer.id
                            ? "bg-bench-fill"
                            : "hover:bg-secondary",
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">
                            {customer.name}
                          </p>
                          <p className="mono truncate text-xs text-ink-soft">
                            {formatMobile(customer.mobile)}
                          </p>
                        </div>
                        {customer.seniorPwdId ? (
                          <BadgeCheck className="size-3.5 text-bench" aria-label="Senior/PWD on file" />
                        ) : null}
                        {openCount > 0 ? (
                          <span className="mono rounded-full bg-secondary px-1.5 text-[0.6875rem] text-ink-soft">
                            {openCount}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>

        {/* Detail */}
        {selected ? (
          <CustomerDetail
            customer={selected}
            onBack={() => setSelectedId(null)}
            onEdit={() => setEditing(selected)}
          />
        ) : (
          <Panel className="hidden lg:flex">
            <EmptyState
              icon={Users}
              title="Pick a customer."
              body="Their repairs, purchases, balances, and warranties show up here."
            />
          </Panel>
        )}
      </div>

      {editing ? (
        <CustomerDialog customer={editing} onClose={() => setEditing(null)} />
      ) : null}

      {creating ? (
        <CustomerDialog
          onClose={() => setCreating(false)}
          onCreated={(customer) => setSelectedId(customer.id)}
        />
      ) : null}
    </div>
  );
}

/* ── Detail ──────────────────────────────────────────────────────────── */

function CustomerDetail({
  customer,
  onBack,
  onEdit,
}: {
  customer: Customer;
  onBack: () => void;
  onEdit: () => void;
}) {
  const { db } = useShop();

  const tickets = useMemo(
    () =>
      db.tickets
        .filter((t) => t.customerId === customer.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [db.tickets, customer.id],
  );

  const sales = useMemo(
    () =>
      db.sales
        .filter((s) => s.customerId === customer.id)
        .sort((a, b) => new Date(b.soldAt).getTime() - new Date(a.soldAt).getTime()),
    [db.sales, customer.id],
  );

  /* Repairs grouped by the device they came in on. */
  const devices = useMemo(() => {
    const map = new Map<string, { imei: string; label: string; tickets: Ticket[] }>();
    tickets.forEach((ticket) => {
      const key = ticket.device.imei || `${ticket.device.brand} ${ticket.device.model}`;
      const existing = map.get(key);
      if (existing) existing.tickets.push(ticket);
      else
        map.set(key, {
          imei: ticket.device.imei,
          label: `${ticket.device.brand} ${ticket.device.model}`,
          tickets: [ticket],
        });
    });
    return [...map.values()];
  }, [tickets]);

  const repairSpend = tickets.reduce((sum, t) => sum + t.amountPaid, 0);
  const purchaseSpend = sales.reduce((sum, s) => sum + s.totalDue, 0);
  const outstanding = tickets.reduce((sum, t) => sum + Math.max(0, t.balance), 0);

  const warranties = useMemo(
    () =>
      tickets
        .filter((t) => t.warranty && new Date(t.warranty.expiresAt) > new Date())
        .map((t) => ({ ticket: t, warranty: t.warranty! })),
    [tickets],
  );

  return (
    <div className="space-y-4 sm:space-y-5">
      <Button variant="ghost" size="sm" className="lg:hidden" onClick={onBack}>
        <ArrowLeft aria-hidden /> All customers
      </Button>

      <Panel>
        <PanelBody className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="display-md truncate">{customer.name}</h2>
              {customer.seniorPwdId ? (
                <Badge variant="bench">
                  {customer.seniorPwdType === "pwd" ? "PWD" : "Senior"}
                </Badge>
              ) : null}
            </div>
            <p className="mono mt-1 text-sm text-ink-soft">
              {formatMobile(customer.mobile)}
            </p>
            {customer.email ? (
              <p className="text-sm text-ink-soft">{customer.email}</p>
            ) : null}
            {customer.address ? (
              <p className="mt-1 text-sm text-ink-soft">{customer.address}</p>
            ) : null}
            <p className="mt-2 text-xs text-ink-faint">
              Customer since {formatDate(customer.createdAt)}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil aria-hidden /> Edit
          </Button>
        </PanelBody>

        <div className="grid grid-cols-2 divide-x divide-rule-soft border-t border-rule-soft sm:grid-cols-4">
          <Stat label="Repairs" value={String(tickets.length)} />
          <Stat label="Purchases" value={String(sales.length)} />
          <Stat label="Lifetime value" value={peso(repairSpend + purchaseSpend, { whole: true })} />
          <Stat
            label="Outstanding"
            value={peso(outstanding, { whole: true })}
            alert={outstanding > 0}
          />
        </div>
      </Panel>

      {warranties.length > 0 ? (
        <Panel>
          <PanelHeader>
            <ShieldCheck className="size-3.5 text-bench" aria-hidden />
            <PanelTitle>Active warranties</PanelTitle>
          </PanelHeader>
          <ul className="divide-y divide-rule-soft">
            {warranties.map(({ ticket, warranty }) => (
              <li key={ticket.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 sm:px-4">
                <span className="mono text-xs font-semibold text-ink">{ticket.ticketNo}</span>
                <span className="truncate text-sm text-ink-soft">
                  {ticket.device.brand} {ticket.device.model}
                </span>
                <Badge variant="bench" className="ml-auto">
                  {warranty.periodDays}d
                </Badge>
                <span className="mono text-xs text-ink-faint">
                  until {formatDate(warranty.expiresAt)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel>
        <PanelHeader>
          <Smartphone className="size-3.5 text-ink-faint" aria-hidden />
          <PanelTitle>Repairs by device</PanelTitle>
          <span className="mono ml-auto text-xs text-ink-faint">
            {devices.length} device{devices.length === 1 ? "" : "s"}
          </span>
        </PanelHeader>

        {devices.length === 0 ? (
          <EmptyState
            icon={Smartphone}
            title="No repairs yet."
            body="Units this customer brings in will be grouped here by IMEI."
            action={
              <Button asChild size="sm">
                <Link href="/intake">New job order</Link>
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-rule">
            {devices.map((device) => (
              <li key={device.imei || device.label} className="px-3 py-2.5 sm:px-4">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <span className="text-sm font-medium text-ink">{device.label}</span>
                  {device.imei ? (
                    <span className="mono text-xs text-ink-faint">
                      {formatImei(device.imei)}
                    </span>
                  ) : null}
                  <span className="mono ml-auto text-xs text-ink-soft">
                    {device.tickets.length} job{device.tickets.length === 1 ? "" : "s"}
                  </span>
                </div>

                <ul className="mt-2 space-y-1.5">
                  {device.tickets.map((ticket) => (
                    <li
                      key={ticket.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
                    >
                      <span className="mono font-semibold text-ink">{ticket.ticketNo}</span>
                      <StatusChip status={ticket.status} showLabel={false} />
                      <span className="min-w-0 flex-1 truncate text-ink-soft">
                        {ticket.reportedProblem}
                      </span>
                      <span className="mono text-ink-faint">
                        {formatDate(ticket.createdAt)}
                      </span>
                      <span
                        className={cn(
                          "mono w-20 text-right font-medium",
                          ticket.balance > 0 ? "text-stamp-ink" : "text-ink-soft",
                        )}
                      >
                        {ticket.balance > 0 ? peso(ticket.balance) : peso(ticket.totalDue)}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>Purchases</PanelTitle>
          <span className="mono ml-auto text-xs text-ink-faint">
            {peso(purchaseSpend, { whole: true })}
          </span>
        </PanelHeader>

        {sales.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No purchases on record."
            body="Sales rung up against this customer at the counter will appear here."
          />
        ) : (
          <ul className="divide-y divide-rule-soft">
            {sales.slice(0, 10).map((sale) => (
              <SaleRow key={sale.id} sale={sale} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function SaleRow({ sale }: { sale: Sale }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm sm:px-4">
      <span className="mono text-xs font-semibold text-ink">{sale.saleNo}</span>
      <span className="min-w-0 flex-1 truncate text-ink-soft">
        {sale.lines.map((line) => line.name).join(", ")}
      </span>
      <span className="mono text-xs text-ink-faint">{formatDate(sale.soldAt)}</span>
      <span className="mono w-24 text-right font-medium text-ink">{peso(sale.totalDue)}</span>
    </li>
  );
}

function Stat({
  label,
  value,
  alert,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className={cn("px-3 py-2.5", alert && "bg-stamp-fill")}>
      <p className="label-pad text-[0.625rem]">{label}</p>
      <p
        className={cn(
          "mono mt-0.5 text-sm font-semibold",
          alert ? "text-stamp-ink" : "text-ink",
        )}
      >
        {value}
      </p>
    </div>
  );
}

/* ── Create / edit ───────────────────────────────────────────────────── */

type CustomerDraft = Omit<Customer, "id" | "createdAt">;

function CustomerDialog({
  customer,
  onClose,
  onCreated,
}: {
  customer?: Customer;
  onClose: () => void;
  onCreated?: (customer: Customer) => void;
}) {
  const isEdit = Boolean(customer);
  const save = useMutation((api, draft: CustomerDraft, id?: string) =>
    id ? api.updateCustomer({ id, ...draft }) : api.createCustomer(draft),
  );

  const [name, setName] = useState(customer?.name ?? "");
  const [mobile, setMobile] = useState(customer?.mobile ?? "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [address, setAddress] = useState(customer?.address ?? "");
  const [seniorPwdId, setSeniorPwdId] = useState(customer?.seniorPwdId ?? "");
  const [seniorPwdType, setSeniorPwdType] = useState<"senior" | "pwd" | "">(
    customer?.seniorPwdType ?? "",
  );
  const [notes, setNotes] = useState(customer?.notes ?? "");

  const canSave = name.trim().length > 0 && mobile.trim().length > 0 && !save.pending;

  const submit = async () => {
    const draft: CustomerDraft = {
      name: name.trim(),
      mobile: mobile.trim(),
      email: email.trim() || undefined,
      address: address.trim() || undefined,
      seniorPwdId: seniorPwdId.trim() || undefined,
      seniorPwdType: seniorPwdId.trim() && seniorPwdType ? seniorPwdType : undefined,
      notes: notes.trim() || undefined,
    };

    const result = await save.mutate(draft, customer?.id);
    if (result) {
      toast.success(isEdit ? `${result.name} updated.` : `${result.name} added.`);
      onCreated?.(result);
      onClose();
    } else if (save.error) {
      toast.error(save.error.message);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${customer!.name}` : "New customer"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cust-name">Full name</Label>
              <Input
                id="cust-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Juan Dela Cruz"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cust-mobile">Mobile</Label>
              <InputMono
                id="cust-mobile"
                inputMode="numeric"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="09171234567"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cust-email">Email (optional)</Label>
            <Input
              id="cust-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cust-address">Address (optional)</Label>
            <Input
              id="cust-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cust-id">Senior / PWD ID</Label>
              <InputMono
                id="cust-id"
                value={seniorPwdId}
                onChange={(e) => setSeniorPwdId(e.target.value)}
                placeholder="ID number"
              />
            </div>
            <div className="space-y-1.5">
              <Label>ID type</Label>
              <Select
                value={seniorPwdType}
                onValueChange={(v) => setSeniorPwdType(v as "senior" | "pwd")}
                disabled={!seniorPwdId.trim()}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Not applicable" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="senior">Senior citizen</SelectItem>
                  <SelectItem value="pwd">PWD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cust-notes">Notes (optional)</Label>
            <Textarea
              id="cust-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!canSave}>
              {save.pending ? "Saving…" : isEdit ? "Save changes" : "Add customer"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
