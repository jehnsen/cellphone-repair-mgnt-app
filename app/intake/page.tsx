"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ClipboardPen, Plus, Printer } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shell/page-header";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Input, InputMono } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CustomerPicker, type NewCustomerDraft } from "@/components/intake/customer-picker";
import { TagHead } from "@/components/tag/tag-head";
import { PrintDocument } from "@/components/print/print-document";
import { ClaimStub } from "@/components/print/claim-stub";
import { useQuery, useShop } from "@/lib/shop/store";
import { formatDate, isValidImei, peso } from "@/lib/format";
import { ApiError } from "@/lib/api/errors";
import { agingOf } from "@/lib/status";
import { cn } from "@/lib/utils";
import { PROBLEM_LABEL, PROBLEM_TAGS } from "@/lib/problems";
import type {
  Customer,
  ConditionCheck,
  DeviceType,
  ProblemTag,
  Ticket,
  TurnedOverAccessory,
  UnlockMethod,
} from "@/lib/types";

const DEVICE_TYPES: { value: DeviceType; label: string }[] = [
  { value: "phone", label: "Phone" },
  { value: "tablet", label: "Tablet" },
  { value: "smartwatch", label: "Smartwatch" },
  { value: "laptop", label: "Laptop" },
];

const UNLOCK_METHODS: { value: UnlockMethod; label: string }[] = [
  { value: "none", label: "None" },
  { value: "pin", label: "PIN" },
  { value: "password", label: "Password" },
  { value: "pattern", label: "Pattern" },
];

const TURNED_OVER: { value: TurnedOverAccessory; label: string }[] = [
  { value: "sim", label: "SIM card" },
  { value: "sd_card", label: "SD card" },
  { value: "case", label: "Case" },
  { value: "charger", label: "Charger" },
  { value: "box", label: "Box" },
];

const CONDITION: { value: ConditionCheck; label: string }[] = [
  { value: "screen_cracked", label: "Screen cracked" },
  { value: "back_cracked", label: "Back cracked" },
  { value: "dents", label: "Dents" },
  { value: "scratches", label: "Scratches" },
  { value: "water_indicator", label: "Water indicator tripped" },
  { value: "missing_screws", label: "Missing screws" },
  { value: "prior_repair", label: "Signs of prior repair" },
  { value: "powers_on", label: "Powers on" },
  { value: "buttons_ok", label: "Buttons OK" },
  { value: "camera_ok", label: "Camera OK" },
];

const WARRANTY_OPTIONS = [0, 7, 15, 30, 60, 90];

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function IntakePage() {
  const router = useRouter();
  const { db, user, api } = useShop();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [draft, setDraft] = useState<NewCustomerDraft>({ name: "", mobile: "", email: "" });

  const [deviceType, setDeviceType] = useState<DeviceType>("phone");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [color, setColor] = useState("");
  const [imei, setImei] = useState("");
  const [unlockMethod, setUnlockMethod] = useState<UnlockMethod>("none");
  const [unlockValue, setUnlockValue] = useState("");

  const [reportedProblem, setReportedProblem] = useState("");
  const [problemTags, setProblemTags] = useState<ProblemTag[]>([]);
  const [turnedOver, setTurnedOver] = useState<TurnedOverAccessory[]>([]);
  const [conditionChecks, setConditionChecks] = useState<ConditionCheck[]>([]);

  const [estimatedCost, setEstimatedCost] = useState("");
  const [downpayment, setDownpayment] = useState("");
  const [downpaymentMethod, setDownpaymentMethod] = useState<"cash" | "gcash" | "maya">("cash");
  const [promisedAt, setPromisedAt] = useState(todayPlus(2));
  const [warrantyDays, setWarrantyDays] = useState(30);

  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<Ticket | null>(null);

  /* Brands and models come from the shop's own catalog. A device the shop has
     never seen is still accepted: intake creates the brand and model on save. */
  const { data: catalog } = useQuery((api) => api.getDeviceCatalog());
  const brandModels = useMemo(() => catalog?.brands ?? [], [catalog]);
  const modelsForBrand = useMemo(
    () =>
      (catalog?.models ?? [])
        .filter((entry) => entry.brand === brand)
        .map((entry) => entry.model),
    [catalog, brand],
  );

  const toggle = <T,>(list: T[], value: T, set: (next: T[]) => void) => {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  /* Mirror the API's rule: exactly 15 digits is an IMEI and must satisfy the
     Luhn check digit; anything else is stored as a serial. Catching this here
     turns a rejected submission into a caught typo. */
  const imeiDigits = imei.replace(/\D/g, "");
  const looksLikeImei = imeiDigits.length === 15 && imei.trim() === imeiDigits;
  const imeiProblem =
    !imei.trim()
      ? null
      : looksLikeImei && !isValidImei(imeiDigits)
        ? "That is 15 digits but the check digit is wrong — re-read the IMEI."
        : /^\d+$/.test(imei.trim()) && imei.trim().length !== 15
          ? `An all-digit identifier must be a 15-digit IMEI (this is ${imei.trim().length}).`
          : null;

  const hasCustomer = customer || (draft.name.trim() && draft.mobile.trim());
  const hasDevice = brand.trim() && model.trim() && imei.trim().length > 0 && !imeiProblem;
  const hasProblem = reportedProblem.trim().length > 0;
  const canSubmit = Boolean(hasCustomer && hasDevice && hasProblem && estimatedCost && !submitting);

  const resetForm = () => {
    setCustomer(null);
    setDraft({ name: "", mobile: "", email: "" });
    setDeviceType("phone");
    setBrand("");
    setModel("");
    setColor("");
    setImei("");
    setUnlockMethod("none");
    setUnlockValue("");
    setReportedProblem("");
    setProblemTags([]);
    setTurnedOver([]);
    setConditionChecks([]);
    setEstimatedCost("");
    setDownpayment("");
    setDownpaymentMethod("cash");
    setPromisedAt(todayPlus(2));
    setWarrantyDays(30);
  };

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const ticket = await api.createTicket({
        customerId: customer?.id,
        newCustomer: customer
          ? undefined
          : { name: draft.name.trim(), mobile: draft.mobile.trim(), email: draft.email.trim() || undefined },
        device: {
          type: deviceType,
          brand: brand.trim(),
          model: model.trim(),
          color: color.trim() || "Unspecified",
          imei: imei.trim(),
          unlockMethod,
          unlockValue: unlockMethod === "none" ? undefined : unlockValue.trim() || undefined,
        },
        reportedProblem: reportedProblem.trim(),
        problemTags,
        turnedOver,
        conditionChecks,
        photos: [],
        estimatedCost: Number(estimatedCost) || 0,
        downpayment: Number(downpayment) || 0,
        downpaymentMethod,
        promisedAt: new Date(promisedAt).toISOString(),
        warrantyDays,
        technicianId: user.id,
        createdBy: user.id,
      });
      setCreated(ticket);
      toast.success(`Job order ${ticket.ticketNo} created.`);
    } catch (error) {
      /* A 422 names the field it rejected; show that rather than the generic
         "The given data was invalid", which tells the counter nothing. */
      if (error instanceof ApiError) {
        const fields = error.fieldSummary;
        toast.error(fields || error.message, {
          description: fields ? error.hint : undefined,
        });
      } else {
        toast.error(
          error instanceof Error ? error.message : "Could not create the job order.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const createdCustomer = created
    ? db.customers.find((c) => c.id === created.customerId)
    : null;

  return (
    <div className="page space-y-4 sm:space-y-5">
      <PageHeader
        eyebrow="Counter"
        title="New job order"
        description="Take a unit in: customer, device, reported problem, condition, then commercials."
        actions={
          <span className="mono text-xs text-ink-faint">
            {formatDate(new Date())}
          </span>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] sm:gap-5">
        <div className="space-y-4 sm:space-y-5">
          <Panel>
            <PanelHeader>
              <PanelTitle>1. Customer</PanelTitle>
            </PanelHeader>
            <PanelBody>
              <CustomerPicker
                customer={customer}
                onSelect={setCustomer}
                draft={draft}
                onDraftChange={setDraft}
              />
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle>2. Device</PanelTitle>
            </PanelHeader>
            <PanelBody className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select
                    value={deviceType}
                    onValueChange={(v) => {
                      setDeviceType(v as DeviceType);
                      setBrand("");
                      setModel("");
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DEVICE_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="imei">IMEI / serial</Label>
                  <InputMono
                    id="imei"
                    value={imei}
                    onChange={(e) => setImei(e.target.value.trimStart().slice(0, 32))}
                    placeholder="15-digit IMEI, or a serial"
                    aria-invalid={Boolean(imeiProblem)}
                    aria-describedby="imei-hint"
                  />
                  <p
                    id="imei-hint"
                    className={cn(
                      "text-xs leading-relaxed",
                      imeiProblem ? "text-stamp-ink" : "text-ink-faint",
                    )}
                  >
                    {imeiProblem ??
                      (looksLikeImei
                        ? "Checks out."
                        : "Phones: dial *#06# on the unit. Laptops and watches: use the serial.")}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>Brand</Label>
                  <Select value={brand} onValueChange={(v) => { setBrand(v); setModel(""); }}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select brand" />
                    </SelectTrigger>
                    <SelectContent>
                      {brandModels.map((b) => (
                        <SelectItem key={b} value={b}>
                          {b}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Model</Label>
                  <Select value={model} onValueChange={setModel} disabled={!brand}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={brand ? "Select model" : "Pick a brand first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {modelsForBrand.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="color">Color</Label>
                  <Input
                    id="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="e.g. Midnight"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Unlock method</Label>
                  <Select value={unlockMethod} onValueChange={(v) => setUnlockMethod(v as UnlockMethod)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNLOCK_METHODS.map((u) => (
                        <SelectItem key={u.value} value={u.value}>
                          {u.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {unlockMethod !== "none" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="unlock-value">
                    {unlockMethod === "pattern" ? "Pattern (dot indices, e.g. 0-1-2-5-8)" : "Value"}
                  </Label>
                  <InputMono
                    id="unlock-value"
                    value={unlockValue}
                    onChange={(e) => setUnlockValue(e.target.value)}
                    placeholder={unlockMethod === "pattern" ? "0-1-2-5-8" : "••••"}
                  />
                </div>
              ) : null}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle>3. Reported problem</PanelTitle>
            </PanelHeader>
            <PanelBody className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="problem">What the customer said</Label>
                <Textarea
                  id="problem"
                  value={reportedProblem}
                  onChange={(e) => setReportedProblem(e.target.value)}
                  placeholder="Nabagsak, basag ang screen pero gumagana pa raw."
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Problem tags</Label>
                <div className="flex flex-wrap gap-1.5">
                  {PROBLEM_TAGS.map((tag) => {
                    const active = problemTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggle(problemTags, tag, setProblemTags)}
                        aria-pressed={active}
                        className={cn(
                          "tap rounded-full border px-3 text-xs font-medium transition-colors",
                          active
                            ? "border-bench bg-bench-fill text-bench-ink"
                            : "border-rule bg-copy text-ink-soft hover:bg-secondary",
                        )}
                      >
                        {PROBLEM_LABEL[tag]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle>4. Condition at intake</PanelTitle>
            </PanelHeader>
            <PanelBody className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Turned over with the unit</Label>
                <div className="space-y-2">
                  {TURNED_OVER.map((item) => (
                    <label key={item.value} className="flex items-center gap-2 text-sm text-ink">
                      <Checkbox
                        checked={turnedOver.includes(item.value)}
                        onCheckedChange={() => toggle(turnedOver, item.value, setTurnedOver)}
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Condition checklist</Label>
                <div className="space-y-2">
                  {CONDITION.map((item) => (
                    <label key={item.value} className="flex items-center gap-2 text-sm text-ink">
                      <Checkbox
                        checked={conditionChecks.includes(item.value)}
                        onCheckedChange={() => toggle(conditionChecks, item.value, setConditionChecks)}
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
              </div>
            </PanelBody>
          </Panel>
        </div>

        <div className="space-y-4 sm:space-y-5">
          <Panel className="xl:sticky xl:top-16">
            <PanelHeader>
              <PanelTitle>5. Commercials</PanelTitle>
            </PanelHeader>
            <PanelBody className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="estimate">Estimated cost</Label>
                <InputMono
                  id="estimate"
                  inputMode="decimal"
                  value={estimatedCost}
                  onChange={(e) => setEstimatedCost(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="0.00"
                />
              </div>

              <div className="grid gap-3 grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="downpayment">Downpayment</Label>
                  <InputMono
                    id="downpayment"
                    inputMode="decimal"
                    value={downpayment}
                    onChange={(e) => setDownpayment(e.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Method</Label>
                  <Select
                    value={downpaymentMethod}
                    onValueChange={(v) => setDownpaymentMethod(v as typeof downpaymentMethod)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="gcash">GCash</SelectItem>
                      <SelectItem value="maya">Maya</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="promised">Promise date</Label>
                <Input
                  id="promised"
                  type="date"
                  value={promisedAt}
                  min={todayPlus(0)}
                  onChange={(e) => setPromisedAt(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Warranty on repair</Label>
                <RadioGroup
                  value={String(warrantyDays)}
                  onValueChange={(v) => setWarrantyDays(Number(v))}
                  className="grid grid-cols-3 gap-2"
                >
                  {WARRANTY_OPTIONS.map((days) => (
                    <label
                      key={days}
                      className={cn(
                        "tap flex cursor-pointer items-center justify-center gap-1.5 rounded-md border px-2 text-xs font-medium transition-colors",
                        warrantyDays === days
                          ? "border-bench bg-bench-fill text-bench-ink"
                          : "border-rule bg-copy text-ink-soft hover:bg-secondary",
                      )}
                    >
                      <RadioGroupItem value={String(days)} className="sr-only" />
                      {days === 0 ? "None" : `${days}d`}
                    </label>
                  ))}
                </RadioGroup>
              </div>

              <div className="border-t border-rule-soft pt-3">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-ink-soft">Balance due at intake</span>
                  <span className="mono font-semibold text-ink">
                    {peso((Number(estimatedCost) || 0) - (Number(downpayment) || 0))}
                  </span>
                </div>
              </div>

              <Button className="w-full" size="lg" onClick={submit} disabled={!canSubmit}>
                <ClipboardPen aria-hidden />
                {submitting ? "Creating…" : "Create job order"}
              </Button>
              {!hasCustomer || !hasDevice || !hasProblem || !estimatedCost ? (
                <p className="text-center text-xs text-ink-faint">
                  Customer, device with an IMEI or serial, reported problem, and an
                  estimate are required.
                </p>
              ) : null}
            </PanelBody>
          </Panel>
        </div>
      </div>

      <Dialog
        open={Boolean(created)}
        onOpenChange={(open) => {
          if (!open) {
            setCreated(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-bench" aria-hidden />
              Job order created
            </DialogTitle>
          </DialogHeader>

          {created ? (
            <TagHead
              ticketNo={created.ticketNo}
              claimCode={created.claimCode}
              aging={agingOf(created)}
              title={createdCustomer?.name}
              subtitle={`${created.device.brand} ${created.device.model}`}
              meta={[
                { label: "Promised", value: formatDate(created.promisedAt) },
                { label: "Balance", value: peso(created.balance) },
              ]}
            />
          ) : null}

          {/* Mounted only while the dialog is open, so `window.print()` has a
              document to print instead of the page behind it. */}
          {created ? (
            <PrintDocument>
              <ClaimStub ticket={created} customer={createdCustomer} shop={db.shop} />
            </PrintDocument>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="outline" onClick={() => window.print()}>
              <Printer aria-hidden /> Print claim stub
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setCreated(null);
                resetForm();
              }}
            >
              <Plus aria-hidden /> Start another
            </Button>
            <Button className="ml-auto" onClick={() => router.push("/board")}>
              Go to board
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
