"use client";

import { useMemo, useState } from "react";
import {
  Building2,
  KeyRound,
  MessageSquareText,
  PlugZap,
  Plus,
  RefreshCw,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  Smartphone,
  Trash2,
  Truck,
  UserCog,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shell/page-header";
import { SupplierDialog } from "@/components/settings/supplier-dialog";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/states";
import { useMutation, useQuery, useShop } from "@/lib/shop/store";
import { ApiError, toastError } from "@/lib/api/errors";
import { mergeFieldsOf } from "@/lib/api/mappers";
import { count } from "@/lib/format";
import { ROLE_BLURB, ROLE_LABEL } from "@/lib/roles";
import { cn } from "@/lib/utils";
import type {
  BranchPatch,
  BranchRecordPatch,
  NewBranchInput,
  NewUserInput,
  SettingPatch,
  UserPatch,
} from "@/lib/shop/contract";
import type {
  BranchKind,
  BranchProfile,
  BranchSummary,
  DeviceBrand,
  DeviceModel,
  MessageChannel,
  MessageEventKey,
  MessageTemplate,
  Role,
  ShopSetting,
  Supplier,
  User,
} from "@/lib/types";

/**
 * Settings, in four parts:
 *   1. Connection — what this browser is reading and writing (was here already).
 *   2. Branch — the shop's own identity: name, address, contact, TIN, VAT
 *      registration, receipt header/footer (`PATCH /branches/{ulid}`).
 *   3. Configuration — the branch's key/value overrides against the shop
 *      defaults (`GET/PUT /settings`).
 *   4. Message templates — the Viber/SMS/email copy for each lifecycle hook
 *      (`/message-templates`).
 *
 * The last three need `settings.manage` server-side; a 403 is shown as a plain
 * "not permitted" state rather than an error.
 */
export function SettingsView() {
  const { can } = useShop();
  const canManageStaff = can("users.manage");

  return (
    <div className="page space-y-4 sm:space-y-5">
      <PageHeader
        eyebrow="Settings"
        title="Shop configuration"
        description="The connection, this branch's details and config overrides, and the message templates."
      />

      <Tabs defaultValue="connection">
        <TabsList>
          <TabsTrigger value="connection">
            <PlugZap aria-hidden /> Connection
          </TabsTrigger>
          <TabsTrigger value="branch">
            <Building2 aria-hidden /> Branch
          </TabsTrigger>
          {/* <TabsTrigger value="config">
            <SlidersHorizontal aria-hidden /> Configuration
          </TabsTrigger> */}
          <TabsTrigger value="devices">
            <Smartphone aria-hidden /> Devices
          </TabsTrigger>
          <TabsTrigger value="suppliers">
            <Truck aria-hidden /> Suppliers
          </TabsTrigger>
          <TabsTrigger value="templates">
            <MessageSquareText aria-hidden /> Message templates
          </TabsTrigger>
          {canManageStaff ? (
            <TabsTrigger value="staff">
              <UserCog aria-hidden /> Staff
            </TabsTrigger>
          ) : null}
          {canManageStaff ? (
            <TabsTrigger value="technicians">
              <Wrench aria-hidden /> Technicians
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="connection" className="space-y-4 pt-4 sm:space-y-5">
          <ConnectionTab />
        </TabsContent>
        <TabsContent value="branch" className="pt-4">
          <BranchTab />
        </TabsContent>
        <TabsContent value="config" className="pt-4">
          <ConfigTab />
        </TabsContent>
        <TabsContent value="devices" className="pt-4">
          <DevicesTab />
        </TabsContent>
        <TabsContent value="suppliers" className="pt-4">
          <SuppliersTab />
        </TabsContent>
        <TabsContent value="templates" className="pt-4">
          <TemplatesTab />
        </TabsContent>
        {canManageStaff ? (
          <TabsContent value="staff" className="pt-4">
            <StaffTab />
          </TabsContent>
        ) : null}
        {canManageStaff ? (
          <TabsContent value="technicians" className="pt-4">
            <TechniciansTab />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}

/* ── Connection ──────────────────────────────────────────────────────── */

function ConnectionTab() {
  const { apiBaseUrl, user, db, signOut } = useShop();
  const [editingProfile, setEditingProfile] = useState(false);

  return (
    <>
      <Panel>
        <PanelHeader>
          <PlugZap className="size-3.5 text-ink-faint" aria-hidden />
          <PanelTitle>Session</PanelTitle>
        </PanelHeader>
        <dl className="divide-y divide-rule-soft">
          <Row label="API" value={apiBaseUrl} mono />
          <Row label="Signed in as" value={user.name} />
          <Row label="Role" value={user.role} />
          <Row label="Shop" value={db.shop.name || "—"} />
          <Row label="Branch address" value={db.shop.addressLine || "—"} />
          <Row label="VAT registered" value={db.shop.vatRegistered ? "Yes" : "No"} />
        </dl>
        <PanelBody className="flex flex-wrap items-center gap-2 border-t border-rule">
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw aria-hidden /> Reload from server
          </Button>
          <Button variant="ghost" size="sm" onClick={signOut}>
            Sign out and revoke this token
          </Button>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <UserCog className="size-3.5 text-ink-faint" aria-hidden />
          <PanelTitle>Your account</PanelTitle>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => setEditingProfile(true)}
          >
            Edit profile
          </Button>
        </PanelHeader>
        <dl className="divide-y divide-rule-soft">
          <Row label="Name" value={user.name} />
          <Row label="Sign-in email" value={user.email || "—"} mono />
          <Row label="Password" value="••••••••" />
        </dl>
      </Panel>

      {editingProfile ? (
        <ProfileDialog user={user} onClose={() => setEditingProfile(false)} />
      ) : null}

      <Panel>
        <PanelHeader>
          <PanelTitle>Loaded from the database</PanelTitle>
        </PanelHeader>
        <dl className="divide-y divide-rule-soft">
          <Row label="Repair tickets" value={count(db.tickets.length)} mono />
          <Row label="Customers" value={count(db.customers.length)} mono />
          <Row label="Catalog items" value={count(db.items.length)} mono />
          <Row label="Services" value={count(db.services.length)} mono />
          <Row label="Staff" value={count(db.users.length)} mono />
        </dl>
      </Panel>
    </>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-3 py-2 sm:px-4">
      <dt className="shrink-0 text-sm text-ink-soft">{label}</dt>
      <dd
        className={`min-w-0 truncate text-sm font-medium text-ink${mono ? " mono" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

/* ── Your account ────────────────────────────────────────────────────── */

/**
 * Edit the signed-in user's own name, sign-in email, and password. The email
 * is the "username" — what `/auth/token` takes. The password fields stay empty
 * unless the user is changing it; leaving them blank leaves the password as-is.
 * The API asks for no current password, so this does not either.
 */
function ProfileDialog({ user, onClose }: { user: User; onClose: () => void }) {
  const { updateProfile } = useShop();

  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const changingPassword = password.length > 0 || confirm.length > 0;
  const nameChanged = name.trim() !== user.name;
  const emailChanged = email.trim() !== (user.email ?? "");
  const somethingChanged = nameChanged || emailChanged || changingPassword;

  const passwordMismatch = changingPassword && password !== confirm;
  const passwordTooShort = changingPassword && password.length < 8;

  const canSave =
    somethingChanged &&
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    !passwordMismatch &&
    !passwordTooShort &&
    !pending;

  const submit = async () => {
    setFieldErrors({});
    setPending(true);
    try {
      await updateProfile({
        ...(nameChanged ? { name: name.trim() } : {}),
        ...(emailChanged ? { email: email.trim() } : {}),
        ...(changingPassword ? { password } : {}),
      });
      toast.success(
        changingPassword ? "Profile and password updated." : "Profile updated.",
      );
      onClose();
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length) {
        setFieldErrors(error.fieldErrors);
      }
      const { message, description } = toastError(
        error,
        "Could not update your profile.",
      );
      toast.error(message, { description });
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Your account</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="pf-name">Name</Label>
            <Input
              id="pf-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={Boolean(fieldErrors.name) || undefined}
            />
            {fieldErrors.name ? (
              <p className="text-xs text-stamp-ink">{fieldErrors.name}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pf-email">Sign-in email</Label>
            <Input
              id="pf-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(fieldErrors.email) || undefined}
            />
            {fieldErrors.email ? (
              <p className="text-xs text-stamp-ink">{fieldErrors.email}</p>
            ) : (
              <p className="text-xs text-ink-faint">
                This is what you type to sign in.
              </p>
            )}
          </div>

          <div className="rounded-md border border-rule-soft p-3">
            <div className="flex items-center gap-2">
              <KeyRound className="size-3.5 text-ink-faint" aria-hidden />
              <span className="label-bin text-ink">Change password</span>
            </div>
            <p className="mt-1 text-xs text-ink-faint">
              Leave blank to keep your current password.
            </p>
            <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="pf-pass">New password</Label>
                <Input
                  id="pf-pass"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={
                    Boolean(fieldErrors.password) || passwordTooShort || undefined
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pf-confirm">Confirm</Label>
                <Input
                  id="pf-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  aria-invalid={passwordMismatch || undefined}
                />
              </div>
            </div>
            {passwordTooShort ? (
              <p className="mt-1.5 text-xs text-stamp-ink">
                Use at least 8 characters.
              </p>
            ) : passwordMismatch ? (
              <p className="mt-1.5 text-xs text-stamp-ink">
                The two passwords do not match.
              </p>
            ) : fieldErrors.password ? (
              <p className="mt-1.5 text-xs text-stamp-ink">{fieldErrors.password}</p>
            ) : null}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!canSave}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Branch profile ──────────────────────────────────────────────────── */

/** The editable fields, in the order the form lays them out. */
const BRANCH_FIELDS: {
  key: keyof BranchPatch;
  label: string;
  hint?: string;
  wide?: boolean;
  multiline?: boolean;
  type?: "email" | "tel";
}[] = [
  { key: "name", label: "Display name" },
  { key: "legalName", label: "Registered / legal name" },
  { key: "addressLine1", label: "Address line 1", wide: true },
  { key: "addressLine2", label: "Address line 2", wide: true },
  { key: "city", label: "City / municipality" },
  { key: "province", label: "Province" },
  { key: "postalCode", label: "Postal code" },
  { key: "contactPhone", label: "Contact phone", type: "tel" },
  { key: "contactEmail", label: "Contact email", type: "email" },
  { key: "tin", label: "TIN", hint: "Prints on official receipts." },
  { key: "birPermitNo", label: "BIR permit no." },
  {
    key: "receiptHeaderText",
    label: "Receipt header",
    hint: "Shown at the top of every printed receipt and claim stub.",
    wide: true,
    multiline: true,
  },
  {
    key: "receiptFooterText",
    label: "Receipt footer",
    hint: "Shown at the bottom — return policy, thanks, hotline.",
    wide: true,
    multiline: true,
  },
];

type BranchDraft = Record<keyof BranchPatch, string>;

function draftFromBranch(branch: BranchProfile): BranchDraft {
  return {
    name: branch.name,
    legalName: branch.legalName,
    addressLine1: branch.addressLine1,
    addressLine2: branch.addressLine2,
    city: branch.city,
    province: branch.province,
    postalCode: branch.postalCode,
    contactPhone: branch.contactPhone,
    contactEmail: branch.contactEmail,
    tin: branch.tin,
    birPermitNo: branch.birPermitNo,
    vatRegistered: String(branch.vatRegistered),
    receiptHeaderText: branch.receiptHeaderText,
    receiptFooterText: branch.receiptFooterText,
  };
}

function BranchTab() {
  const { can } = useShop();
  /* Same gate as Staff: the server grants branch writes to the owner alone. */
  const canManageBranches = can("users.manage");
  const query = useQuery((api) => api.getBranch(), []);
  const save = useMutation((api, patch: BranchPatch) => api.updateBranch(patch));

  const [draft, setDraft] = useState<BranchDraft | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const branch = query.data;
  const current = draft ?? (branch ? draftFromBranch(branch) : null);

  const dirtyKeys = useMemo(() => {
    if (!branch || !current) return [];
    const base = draftFromBranch(branch);
    return (Object.keys(base) as (keyof BranchDraft)[]).filter(
      (key) => current[key] !== base[key],
    );
  }, [branch, current]);

  const set = (key: keyof BranchDraft, value: string) => {
    setDraft((d) => ({ ...(d ?? draftFromBranch(branch!)), [key]: value }));
    setFieldErrors((e) => {
      if (!e[key]) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });
  };

  const submit = async () => {
    if (!branch || !current || dirtyKeys.length === 0) return;
    const patch: BranchPatch = {};
    for (const key of dirtyKeys) {
      if (key === "vatRegistered") patch.vatRegistered = current.vatRegistered === "true";
      else patch[key] = current[key];
    }

    const { data, error } = await save.mutate(patch);
    if (data) {
      toast.success("Branch details saved.");
      setDraft(null);
      setFieldErrors({});
      query.refetch();
    } else if (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length) {
        /* Wire snake_case field paths back onto the camelCase inputs. */
        const mapped: Record<string, string> = {};
        for (const [field, message] of Object.entries(error.fieldErrors)) {
          mapped[snakeToCamel(field)] = message;
        }
        setFieldErrors(mapped);
      }
      const { message, description } = toastError(error, "Could not save branch details.");
      toast.error(message, { description });
    }
  };

  if (query.loading) {
    return (
      <Panel>
        <LoadingRows rows={8} />
      </Panel>
    );
  }
  if (query.error || !branch || !current) {
    return permissionOr(
      query.error ?? new Error("Branch unavailable."),
      "view this branch's details",
      query.refetch,
    );
  }

  return (
    <div className="space-y-4">
      {/* Owner-only, like the server: adding a branch is a 403 for anyone
          else, so the roster is absent rather than shown broken. */}
      {canManageBranches ? <BranchRoster /> : null}

      <p className="text-xs leading-relaxed text-ink-soft">
        Below is {canManageBranches ? "your own branch's" : "the shop's own"} full
        record — its name, address, tax details, and the header and footer that
        print on every receipt. Changes take effect on the next print, no reload
        needed.
      </p>

      <Panel>
        <PanelHeader>
          <Building2 className="size-3.5 text-ink-faint" aria-hidden />
          <PanelTitle>{branch.name}</PanelTitle>
          <span className="mono ml-auto text-xs text-ink-faint">
            {branch.code} · {branch.timezone}
          </span>
        </PanelHeader>

        <PanelBody className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
          {BRANCH_FIELDS.map((field) => (
            <div
              key={field.key}
              className={cn("space-y-1.5", field.wide && "sm:col-span-2")}
            >
              <Label htmlFor={`br-${field.key}`}>{field.label}</Label>
              {field.multiline ? (
                <Textarea
                  id={`br-${field.key}`}
                  value={current[field.key]}
                  onChange={(e) => set(field.key, e.target.value)}
                  rows={2}
                  aria-invalid={Boolean(fieldErrors[field.key]) || undefined}
                />
              ) : (
                <Input
                  id={`br-${field.key}`}
                  type={field.type}
                  value={current[field.key]}
                  onChange={(e) => set(field.key, e.target.value)}
                  aria-invalid={Boolean(fieldErrors[field.key]) || undefined}
                />
              )}
              {fieldErrors[field.key] ? (
                <p className="text-xs text-stamp-ink">{fieldErrors[field.key]}</p>
              ) : field.hint ? (
                <p className="text-xs text-ink-faint">{field.hint}</p>
              ) : null}
            </div>
          ))}

          <label className="flex items-center gap-2 text-sm text-ink sm:col-span-2">
            <Switch
              checked={current.vatRegistered === "true"}
              onCheckedChange={(on) => set("vatRegistered", on ? "true" : "false")}
            />
            VAT-registered
            <span className="text-xs text-ink-faint">
              — changes receipt layout and how the senior/PWD discount is computed.
            </span>
          </label>
        </PanelBody>

        <div className="flex flex-wrap items-center gap-2 border-t border-rule px-3 py-2 sm:px-4">
          <span className="text-xs text-ink-soft">
            {dirtyKeys.length
              ? `${dirtyKeys.length} unsaved change${dirtyKeys.length === 1 ? "" : "s"}`
              : "No unsaved changes"}
          </span>
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDraft(null);
                setFieldErrors({});
              }}
              disabled={dirtyKeys.length === 0 || save.pending}
            >
              Discard
            </Button>
            <Button
              size="sm"
              onClick={submit}
              disabled={dirtyKeys.length === 0 || save.pending}
            >
              {save.pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function snakeToCamel(field: string): string {
  return field.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

/* ── Configuration ───────────────────────────────────────────────────── */

/**
 * A key's group is the segment before the first dot — `bir.display_on_receipt`
 * groups under "bir". Keys are open-ended, so this is presentation only.
 */
function groupOf(key: string): string {
  const dot = key.indexOf(".");
  return dot === -1 ? "general" : key.slice(0, dot);
}

const GROUP_LABEL: Record<string, string> = {
  bir: "BIR & receipts",
  notifications: "Notifications",
  pos: "Point of sale",
  tickets: "Repair tickets",
  general: "General",
};

/** What the user typed, before it goes back on the wire in the right type. */
type Draft = Record<string, string>;

function ConfigTab() {
  const query = useQuery((api) => api.getSettings(), []);
  const save = useMutation((api, patch: SettingPatch) => api.updateSettings(patch));

  const [draft, setDraft] = useState<Draft>({});

  const settings = query.data ?? [];
  const groups = useMemo(() => {
    const map = new Map<string, ShopSetting[]>();
    for (const setting of [...settings].sort((a, b) => a.key.localeCompare(b.key))) {
      const group = groupOf(setting.key);
      (map.get(group) ?? map.set(group, []).get(group)!).push(setting);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [settings]);

  const edited = Object.keys(draft).filter((key) => {
    const setting = settings.find((entry) => entry.key === key);
    return setting ? draft[key] !== stringifyValue(setting) : false;
  });

  const commit = async () => {
    const patch: SettingPatch = {};
    for (const key of edited) {
      const setting = settings.find((entry) => entry.key === key)!;
      const parsed = parseValue(draft[key]!, setting.type);
      if (parsed instanceof Error) {
        toast.error(`${key} is not valid ${setting.type}.`, {
          description: parsed.message,
        });
        return;
      }
      patch[key] = { value: parsed, type: setting.type };
    }

    const { data, error } = await save.mutate(patch);
    if (data) {
      toast.success(
        `${edited.length} setting${edited.length === 1 ? "" : "s"} saved.`,
      );
      setDraft({});
      query.refetch();
    } else if (error) {
      const { message, description } = toastError(error, "Could not save settings.");
      toast.error(message, { description });
    }
  };

  const resetToGlobal = async (key: string) => {
    const { data, error } = await save.mutate({ [key]: null });
    if (data) {
      toast.success(`${key} reset to the shop default.`);
      setDraft((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      query.refetch();
    } else if (error) {
      const { message, description } = toastError(error, "Could not reset the setting.");
      toast.error(message, { description });
    }
  };

  if (query.loading) {
    return (
      <Panel>
        <LoadingRows rows={6} />
      </Panel>
    );
  }

  if (query.error) {
    return permissionOr(query.error, "view this branch's configuration", query.refetch);
  }

  if (settings.length === 0) {
    return (
      <Panel>
        <EmptyState
          icon={Settings2}
          title="No configuration keys."
          body="This branch has no settings yet — they appear here once the shop defaults are seeded."
        />
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs leading-relaxed text-ink-soft">
        Each key shows its effective value. A key marked{" "}
        <Badge variant="bench" className="mx-0.5 align-middle">
          branch
        </Badge>{" "}
        has been overridden here; the rest fall back to the shop-wide default.
        Resetting an override restores the default.
      </p>

      {groups.map(([group, rows]) => (
        <Panel key={group}>
          <PanelHeader>
            <PanelTitle>{GROUP_LABEL[group] ?? group}</PanelTitle>
            <span className="mono ml-auto text-xs text-ink-faint">
              {rows.length} key{rows.length === 1 ? "" : "s"}
            </span>
          </PanelHeader>
          <ul className="divide-y divide-rule-soft">
            {rows.map((setting) => (
              <SettingRow
                key={setting.key}
                setting={setting}
                value={draft[setting.key] ?? stringifyValue(setting)}
                dirty={edited.includes(setting.key)}
                onChange={(next) =>
                  setDraft((current) => ({ ...current, [setting.key]: next }))
                }
                onReset={() => resetToGlobal(setting.key)}
                busy={save.pending}
              />
            ))}
          </ul>
        </Panel>
      ))}

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-2 rounded-sm border border-rule bg-copy px-3 py-2 shadow-float sm:px-4">
        <span className="text-xs text-ink-soft">
          {edited.length
            ? `${edited.length} unsaved change${edited.length === 1 ? "" : "s"}`
            : "No unsaved changes"}
        </span>
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDraft({})}
            disabled={edited.length === 0 || save.pending}
          >
            Discard
          </Button>
          <Button
            size="sm"
            onClick={commit}
            disabled={edited.length === 0 || save.pending}
          >
            {save.pending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SettingRow({
  setting,
  value,
  dirty,
  onChange,
  onReset,
  busy,
}: {
  setting: ShopSetting;
  value: string;
  dirty: boolean;
  onChange: (next: string) => void;
  onReset: () => void;
  busy: boolean;
}) {
  const leaf = setting.key.slice(setting.key.indexOf(".") + 1).replace(/[._]/g, " ");

  return (
    <li
      className={cn(
        "flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-4",
        dirty && "bg-flag-fill",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mono text-xs font-semibold text-ink">{setting.key}</span>
          {setting.source === "branch" ? (
            <Badge variant="bench">branch</Badge>
          ) : (
            <Badge variant="ghost">global</Badge>
          )}
          <span className="mono text-[0.6875rem] text-ink-faint">{setting.type}</span>
          {!setting.overridable ? (
            <span className="text-[0.6875rem] text-ink-faint">shop-wide only</span>
          ) : null}
        </div>
        <p className="mt-0.5 text-xs capitalize text-ink-soft">{leaf}</p>
      </div>

      <div className="flex items-center gap-2 sm:w-72 sm:shrink-0">
        <SettingField
          setting={setting}
          value={value}
          onChange={onChange}
          disabled={!setting.overridable}
        />
        {setting.source === "branch" ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Reset ${setting.key} to the shop default`}
            title="Reset to the shop default"
            onClick={onReset}
            disabled={busy}
          >
            <RotateCcw aria-hidden />
          </Button>
        ) : null}
      </div>
    </li>
  );
}

function SettingField({
  setting,
  value,
  onChange,
  disabled,
}: {
  setting: ShopSetting;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  if (setting.type === "bool") {
    return (
      <label className="flex flex-1 items-center gap-2 text-sm text-ink">
        <Switch
          checked={value === "true"}
          onCheckedChange={(on) => onChange(on ? "true" : "false")}
          disabled={disabled}
        />
        <span className="mono text-xs text-ink-soft">{value}</span>
      </label>
    );
  }

  if (setting.type === "json") {
    return (
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="mono flex-1 text-xs"
        spellCheck={false}
        disabled={disabled}
      />
    );
  }

  const numeric = setting.type === "int" || setting.type === "decimal";
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      inputMode={numeric ? "decimal" : undefined}
      className={cn("flex-1", numeric && "mono")}
      placeholder={setting.type === "string" ? "empty" : undefined}
      disabled={disabled}
    />
  );
}

/* Value <-> string, per type. `parseValue` returns an Error for a bad entry. */

function stringifyValue(setting: ShopSetting): string {
  return valueToString(setting.value, setting.type);
}

function valueToString(
  value: ShopSetting["value"],
  type: ShopSetting["type"],
): string {
  if (value === null || value === undefined) return type === "bool" ? "false" : "";
  if (type === "json") return JSON.stringify(value, null, 2);
  if (type === "bool") return value ? "true" : "false";
  return String(value);
}

function parseValue(
  raw: string,
  type: ShopSetting["type"],
): string | number | boolean | null | Record<string, unknown> | unknown[] | Error {
  const trimmed = raw.trim();
  switch (type) {
    case "bool":
      return trimmed === "true";
    case "int": {
      if (trimmed === "") return null;
      const n = Number(trimmed);
      return Number.isInteger(n) ? n : new Error("Whole numbers only.");
    }
    case "decimal": {
      if (trimmed === "") return null;
      const n = Number(trimmed);
      return Number.isFinite(n) ? n : new Error("Must be a number.");
    }
    case "json": {
      if (trimmed === "") return null;
      try {
        return JSON.parse(trimmed) as Record<string, unknown> | unknown[];
      } catch {
        return new Error("Not valid JSON.");
      }
    }
    default:
      return trimmed === "" ? null : raw;
  }
}

/* ── Message templates ───────────────────────────────────────────────── */

const CHANNELS: MessageChannel[] = ["sms", "viber", "email"];

const EVENT_KEYS: MessageEventKey[] = [
  "ticket.received",
  "ticket.ready_for_pickup",
  "ticket.released",
  "ticket.unclaimed_30",
  "ticket.unclaimed_60",
  "ticket.unclaimed_90",
  "quote.sent",
  "warranty.expiring_soon",
  "installment.due_reminder",
  "installment.overdue",
];

const EVENT_LABEL: Record<MessageEventKey, string> = {
  "ticket.received": "Job order received",
  "ticket.ready_for_pickup": "Ready for pickup",
  "ticket.released": "Unit released",
  "ticket.unclaimed_30": "Unclaimed — 30 days",
  "ticket.unclaimed_60": "Unclaimed — 60 days",
  "ticket.unclaimed_90": "Unclaimed — 90 days",
  "quote.sent": "Quote sent",
  "warranty.expiring_soon": "Warranty expiring soon",
  "installment.due_reminder": "Installment due reminder",
  "installment.overdue": "Installment overdue",
};

const CHANNEL_LABEL: Record<MessageChannel, string> = {
  sms: "SMS",
  viber: "Viber",
  email: "Email",
};

function eventLabelOf(key: string): string {
  return EVENT_LABEL[key as MessageEventKey] ?? key;
}

function TemplatesTab() {
  const query = useQuery((api) => api.getMessageTemplates(), []);
  const [editing, setEditing] = useState<MessageTemplate | null>(null);
  const [creating, setCreating] = useState(false);

  const templates = query.data ?? [];

  const byEvent = useMemo(() => {
    const map = new Map<string, MessageTemplate[]>();
    for (const template of templates) {
      (map.get(template.eventKey) ?? map.set(template.eventKey, []).get(template.eventKey)!)
        .push(template);
    }
    /* Known hooks first, in lifecycle order; anything unrecognised after. */
    const keys = [
      ...EVENT_KEYS.filter((key) => map.has(key)),
      ...[...map.keys()].filter((key) => !EVENT_KEYS.includes(key as MessageEventKey)),
    ];
    return keys.map((key) => ({
      key,
      rows: map
        .get(key)!
        .slice()
        .sort((a, b) => a.channel.localeCompare(b.channel)),
    }));
  }, [templates]);

  if (query.loading) {
    return (
      <Panel>
        <LoadingRows rows={6} />
      </Panel>
    );
  }

  if (query.error) {
    return permissionOr(query.error, "view message templates", query.refetch);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-ink-soft">
          One template per lifecycle hook per channel. Use{" "}
          <code className="mono rounded-sm bg-secondary px-1 text-[0.6875rem]">
            {"{{merge_field}}"}
          </code>{" "}
          placeholders — they are filled in when the message is sent. Retire a
          template by switching it off; there is no delete.
        </p>
        <Button size="sm" onClick={() => setCreating(true)}>
          <MessageSquareText aria-hidden /> New template
        </Button>
      </div>

      {templates.length === 0 ? (
        <Panel>
          <EmptyState
            icon={MessageSquareText}
            title="No templates yet."
            body="Add one for the hooks you want to notify customers on — ready for pickup is the usual first."
          />
        </Panel>
      ) : (
        byEvent.map(({ key, rows }) => (
          <Panel key={key}>
            <PanelHeader>
              <PanelTitle>{eventLabelOf(key)}</PanelTitle>
              <span className="mono ml-auto text-xs text-ink-faint">{key}</span>
            </PanelHeader>
            <ul className="divide-y divide-rule-soft">
              {rows.map((template) => (
                <li
                  key={template.id}
                  className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-start sm:gap-4 sm:px-4"
                >
                  <div className="flex items-center gap-2 sm:w-24 sm:shrink-0">
                    <Badge variant="tint">{CHANNEL_LABEL[template.channel]}</Badge>
                  </div>
                  <p
                    className={cn(
                      "min-w-0 flex-1 whitespace-pre-wrap text-sm leading-relaxed",
                      template.active ? "text-ink" : "text-ink-faint line-through",
                    )}
                  >
                    {template.body}
                  </p>
                  <div className="flex items-center gap-2 sm:shrink-0">
                    {!template.active ? (
                      <Badge variant="ghost">off</Badge>
                    ) : null}
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => setEditing(template)}
                    >
                      Edit
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        ))
      )}

      {editing ? (
        <TemplateDialog
          template={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            query.refetch();
          }}
        />
      ) : null}

      {creating ? (
        <TemplateDialog
          existing={templates}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            query.refetch();
          }}
        />
      ) : null}
    </div>
  );
}

function TemplateDialog({
  template,
  existing,
  onClose,
  onSaved,
}: {
  template?: MessageTemplate;
  existing?: MessageTemplate[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(template);
  const create = useMutation((api, ...[input]: Parameters<typeof api.createMessageTemplate>) =>
    api.createMessageTemplate(input),
  );
  const update = useMutation((api, ...[input]: Parameters<typeof api.updateMessageTemplate>) =>
    api.updateMessageTemplate(input),
  );
  const pending = create.pending || update.pending;

  const [channel, setChannel] = useState<MessageChannel>(template?.channel ?? "sms");
  const [eventKey, setEventKey] = useState<MessageEventKey>(
    template?.eventKey ?? "ticket.ready_for_pickup",
  );
  const [body, setBody] = useState(template?.body ?? "");
  const [active, setActive] = useState(template?.active ?? true);

  const taken = useMemo(() => {
    const pairs = new Set(
      (existing ?? []).map((entry) => `${entry.channel}:${entry.eventKey}`),
    );
    return pairs;
  }, [existing]);

  const collision =
    !isEdit && taken.has(`${channel}:${eventKey}`);
  const mergeFields = mergeFieldsOf(body);
  const canSave = body.trim().length > 0 && !collision && !pending;

  const submit = async () => {
    const outcome = isEdit
      ? await update.mutate({ id: template!.id, body: body.trim(), active })
      : await create.mutate({ channel, eventKey, body: body.trim(), active });

    if (outcome.data) {
      toast.success(isEdit ? "Template updated." : "Template created.");
      onSaved();
    } else if (outcome.error) {
      const { message, description } = toastError(
        outcome.error,
        "Could not save the template.",
      );
      toast.error(message, { description });
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? `Edit ${CHANNEL_LABEL[template!.channel]} — ${eventLabelOf(template!.eventKey)}`
              : "New message template"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Channel</Label>
              <Select
                value={channel}
                onValueChange={(v) => setChannel(v as MessageChannel)}
                disabled={isEdit}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANNELS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {CHANNEL_LABEL[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Lifecycle hook</Label>
              <Select
                value={eventKey}
                onValueChange={(v) => setEventKey(v as MessageEventKey)}
                disabled={isEdit}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_KEYS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {EVENT_LABEL[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {collision ? (
            <p className="rounded-sm border border-stamp bg-stamp-fill px-2.5 py-1.5 text-xs text-stamp-ink">
              A {CHANNEL_LABEL[channel]} template already exists for this hook.
              Edit that one instead.
            </p>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="tmpl-body">Message</Label>
            <Textarea
              id="tmpl-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Hi {{customer_name}}, your {{device_model}} (JO# {{ticket_number}}) is ready for pickup."
            />
            {mergeFields.length ? (
              <p className="flex flex-wrap items-center gap-1 text-xs text-ink-soft">
                <span className="text-ink-faint">Merge fields:</span>
                {mergeFields.map((field) => (
                  <code
                    key={field}
                    className="mono rounded-sm bg-secondary px-1 text-[0.6875rem]"
                  >
                    {field}
                  </code>
                ))}
              </p>
            ) : null}
          </div>

          <label className="flex items-center gap-2 text-sm text-ink">
            <Switch checked={active} onCheckedChange={setActive} />
            {active ? "Active" : "Retired (off)"}
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!canSave}>
              {pending ? "Saving…" : isEdit ? "Save changes" : "Create template"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Devices ─────────────────────────────────────────────────────────── */

/**
 * Brands and models the intake picker offers.
 *
 * Intake still accepts a device the shop has never seen — it creates the
 * brand and model on save — so this tab is for tidying and pre-seeding, not a
 * gate. Deleting is real; switching a row off keeps it on old tickets while
 * dropping it from the picker, which is the safer move when the server refuses
 * a delete because something still points at it.
 */
function DevicesTab() {
  const brandsQuery = useQuery((api) => api.getDeviceBrands(), []);
  const modelsQuery = useQuery((api) => api.getDeviceModels(), []);

  const [brandDialog, setBrandDialog] = useState<
    { mode: "new" } | { mode: "edit"; brand: DeviceBrand } | null
  >(null);
  const [modelDialog, setModelDialog] = useState<
    { mode: "new" } | { mode: "edit"; model: DeviceModel } | null
  >(null);
  const [removing, setRemoving] = useState<
    { kind: "brand"; row: DeviceBrand } | { kind: "model"; row: DeviceModel } | null
  >(null);

  const remove = useMutation(
    (
      api,
      target:
        | { kind: "brand"; row: DeviceBrand }
        | { kind: "model"; row: DeviceModel },
    ) =>
      target.kind === "brand"
        ? api.deleteDeviceBrand(target.row.id)
        : api.deleteDeviceModel(target.row.id),
  );

  const brands = brandsQuery.data ?? [];
  const models = modelsQuery.data ?? [];

  const refetch = () => {
    brandsQuery.refetch();
    modelsQuery.refetch();
  };

  /* Models under each brand that actually has one; brands with none are still
     managed in the Brands panel above. */
  const modelGroups = useMemo(() => {
    const map = new Map<string, DeviceModel[]>();
    for (const model of [...models].sort((a, b) => a.name.localeCompare(b.name))) {
      const key = model.brandName || "Unassigned";
      (map.get(key) ?? map.set(key, []).get(key)!).push(model);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [models]);

  if (brandsQuery.loading || modelsQuery.loading) {
    return (
      <Panel>
        <LoadingRows rows={8} />
      </Panel>
    );
  }
  if (brandsQuery.error) {
    return permissionOr(brandsQuery.error, "manage device brands", refetch);
  }
  if (modelsQuery.error) {
    return permissionOr(modelsQuery.error, "manage device models", refetch);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-ink-soft">
          The brands and models intake offers as a tap. A device that is not on
          the list can still be typed in — it is created on save — so this is for
          tidying and pre-seeding the units you see most. An inactive row stays
          on past tickets but drops out of the picker.
        </p>
        <Button size="sm" variant="outline" onClick={() => setBrandDialog({ mode: "new" })}>
          <Plus aria-hidden /> New brand
        </Button>
        <Button
          size="sm"
          onClick={() => setModelDialog({ mode: "new" })}
          disabled={brands.length === 0}
        >
          <Plus aria-hidden /> New model
        </Button>
      </div>

      <Panel>
        <PanelHeader>
          <Smartphone className="size-3.5 text-ink-faint" aria-hidden />
          <PanelTitle>Brands</PanelTitle>
          <span className="mono ml-auto text-xs text-ink-faint">
            {brands.length} brand{brands.length === 1 ? "" : "s"}
          </span>
        </PanelHeader>

        {brands.length === 0 ? (
          <EmptyState
            icon={Smartphone}
            title="No brands yet."
            body="Add the brands you see most — Apple, Samsung, Xiaomi, realme — so intake is a tap, not a type."
          />
        ) : (
          <ul className="divide-y divide-rule-soft">
            {brands.map((brand) => {
              const count = models.filter((m) => m.brandId === brand.id).length;
              return (
                <li
                  key={brand.id}
                  className="flex items-center gap-3 px-3 py-2 sm:px-4"
                >
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-sm",
                      brand.active ? "text-ink" : "text-ink-faint line-through",
                    )}
                  >
                    {brand.name}
                  </span>
                  {!brand.active ? <Badge variant="ghost">off</Badge> : null}
                  <span className="mono text-xs text-ink-faint">
                    {count} model{count === 1 ? "" : "s"}
                  </span>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => setBrandDialog({ mode: "edit", brand })}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Delete ${brand.name}`}
                    onClick={() => setRemoving({ kind: "brand", row: brand })}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {models.length === 0 ? (
        <Panel>
          <PanelHeader>
            <PanelTitle>Models</PanelTitle>
          </PanelHeader>
          <EmptyState
            icon={Smartphone}
            title="No models yet."
            body={
              brands.length === 0
                ? "Add a brand first, then its models."
                : "Add the models you handle often under each brand."
            }
          />
        </Panel>
      ) : (
        modelGroups.map(([brandName, rows]) => (
          <Panel key={brandName}>
            <PanelHeader>
              <PanelTitle>{brandName}</PanelTitle>
              <span className="mono ml-auto text-xs text-ink-faint">
                {rows.length} model{rows.length === 1 ? "" : "s"}
              </span>
            </PanelHeader>
            <ul className="divide-y divide-rule-soft">
              {rows.map((model) => (
                <li
                  key={model.id}
                  className="flex items-center gap-3 px-3 py-2 sm:px-4"
                >
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-sm",
                      model.active ? "text-ink" : "text-ink-faint line-through",
                    )}
                  >
                    {model.name}
                  </span>
                  {model.releaseYear ? (
                    <span className="mono text-xs text-ink-faint">
                      {model.releaseYear}
                    </span>
                  ) : null}
                  {!model.active ? <Badge variant="ghost">off</Badge> : null}
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => setModelDialog({ mode: "edit", model })}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Delete ${model.name}`}
                    onClick={() => setRemoving({ kind: "model", row: model })}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          </Panel>
        ))
      )}

      {brandDialog ? (
        <BrandDialog
          brand={brandDialog.mode === "edit" ? brandDialog.brand : undefined}
          onClose={() => setBrandDialog(null)}
          onSaved={() => {
            setBrandDialog(null);
            refetch();
          }}
        />
      ) : null}

      {modelDialog ? (
        <ModelDialog
          model={modelDialog.mode === "edit" ? modelDialog.model : undefined}
          brands={brands}
          onClose={() => setModelDialog(null)}
          onSaved={() => {
            setModelDialog(null);
            refetch();
          }}
        />
      ) : null}

      {removing ? (
        <Dialog open onOpenChange={(open) => !open && setRemoving(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>
                Delete {removing.kind === "brand" ? "brand" : "model"}?
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm leading-relaxed text-ink-soft">
              {removing.kind === "brand"
                ? `“${removing.row.name}” leaves the intake picker. Past tickets keep the name they were saved with. If models still point at it the server will refuse — switch it off instead.`
                : `“${removing.row.name}” leaves the intake picker. Past tickets are unaffected.`}
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="outline"
                onClick={() => setRemoving(null)}
                disabled={remove.pending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={remove.pending}
                onClick={async () => {
                  const { error } = await remove.mutate(removing);
                  if (error) {
                    const { message, description } = toastError(
                      error,
                      "Could not delete it.",
                    );
                    toast.error(message, { description });
                  } else {
                    toast.success(`${removing.row.name} deleted.`);
                    setRemoving(null);
                    refetch();
                  }
                }}
              >
                {remove.pending ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

function BrandDialog({
  brand,
  onClose,
  onSaved,
}: {
  brand?: DeviceBrand;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(brand);
  const create = useMutation((api, name: string) => api.createDeviceBrand({ name }));
  const update = useMutation(
    (api, input: { id: string; name: string; active: boolean }) =>
      api.updateDeviceBrand(input),
  );
  const pending = create.pending || update.pending;

  const [name, setName] = useState(brand?.name ?? "");
  const [active, setActive] = useState(brand?.active ?? true);

  const canSave = name.trim().length > 0 && !pending;

  const submit = async () => {
    if (!canSave) return;
    const outcome = isEdit
      ? await update.mutate({ id: brand!.id, name: name.trim(), active })
      : await create.mutate(name.trim());

    if (outcome.data) {
      toast.success(isEdit ? "Brand updated." : `${outcome.data.name} added.`);
      onSaved();
    } else if (outcome.error) {
      const { message, description } = toastError(
        outcome.error,
        "Could not save the brand.",
      );
      toast.error(message, { description });
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${brand!.name}` : "New brand"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="brand-name">Name</Label>
            <Input
              id="brand-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Apple"
            />
          </div>

          {isEdit ? (
            <label className="flex items-center gap-2 text-sm text-ink">
              <Switch checked={active} onCheckedChange={setActive} />
              {active ? "Active — shown in the intake picker" : "Inactive — hidden from the picker"}
            </label>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!canSave}>
              {pending ? "Saving…" : isEdit ? "Save changes" : "Add brand"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ModelDialog({
  model,
  brands,
  onClose,
  onSaved,
}: {
  model?: DeviceModel;
  brands: DeviceBrand[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(model);
  const create = useMutation(
    (api, input: { brandId: string; name: string; releaseYear?: number }) =>
      api.createDeviceModel(input),
  );
  const update = useMutation(
    (
      api,
      input: {
        id: string;
        name: string;
        brandId: string;
        releaseYear: number | null;
        active: boolean;
      },
    ) => api.updateDeviceModel(input),
  );
  const pending = create.pending || update.pending;

  /* Fall back to the first active brand for a new model. */
  const [brandId, setBrandId] = useState(
    model?.brandId ?? brands.find((b) => b.active)?.id ?? brands[0]?.id ?? "",
  );
  const [name, setName] = useState(model?.name ?? "");
  const [year, setYear] = useState(model?.releaseYear ? String(model.releaseYear) : "");
  const [active, setActive] = useState(model?.active ?? true);

  const yearNum = year.trim() === "" ? null : Number(year.trim());
  const yearValid =
    yearNum === null || (Number.isInteger(yearNum) && yearNum >= 1990 && yearNum <= 2100);
  const canSave = name.trim().length > 0 && brandId !== "" && yearValid && !pending;

  const submit = async () => {
    if (!canSave) return;
    const outcome = isEdit
      ? await update.mutate({
          id: model!.id,
          name: name.trim(),
          brandId,
          releaseYear: yearNum,
          active,
        })
      : await create.mutate({
          brandId,
          name: name.trim(),
          releaseYear: yearNum ?? undefined,
        });

    if (outcome.data) {
      toast.success(isEdit ? "Model updated." : `${outcome.data.name} added.`);
      onSaved();
    } else if (outcome.error) {
      const { message, description } = toastError(
        outcome.error,
        "Could not save the model.",
      );
      toast.error(message, { description });
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${model!.name}` : "New model"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Brand</Label>
            <Select value={brandId} onValueChange={setBrandId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pick a brand" />
              </SelectTrigger>
              <SelectContent>
                {brands.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                    {!b.active ? " (inactive)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
            <div className="space-y-1.5">
              <Label htmlFor="model-name">Model</Label>
              <Input
                id="model-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="iPhone 13 Pro"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="model-year">Year</Label>
              <Input
                id="model-year"
                inputMode="numeric"
                value={year}
                onChange={(e) => setYear(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="2021"
                aria-invalid={!yearValid || undefined}
              />
            </div>
          </div>
          {!yearValid ? (
            <p className="text-xs text-stamp-ink">Release year looks off.</p>
          ) : null}

          {isEdit ? (
            <label className="flex items-center gap-2 text-sm text-ink">
              <Switch checked={active} onCheckedChange={setActive} />
              {active ? "Active — shown in the intake picker" : "Inactive — hidden from the picker"}
            </label>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!canSave}>
              {pending ? "Saving…" : isEdit ? "Save changes" : "Add model"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Suppliers ───────────────────────────────────────────────────────── */

/**
 * Who the shop buys stock from. The receiving picker and supplier returns
 * both draw on this list. A supplier is deactivated, never removed — past
 * goods receipts and returns keep theirs.
 */
function SuppliersTab() {
  const query = useQuery((api) => api.getSuppliers({ includeInactive: true }), []);
  const [dialog, setDialog] = useState<
    { mode: "new" } | { mode: "edit"; supplier: Supplier } | null
  >(null);

  const suppliers = useMemo(
    () => [...(query.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [query.data],
  );

  if (query.loading) {
    return (
      <Panel>
        <LoadingRows rows={6} />
      </Panel>
    );
  }
  if (query.error) {
    return permissionOr(query.error, "manage suppliers", query.refetch);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-ink-soft">
          The suppliers offered when you receive a delivery or send a unit back.
          Switching one off keeps it on past receipts and returns but drops it
          from the pickers.
        </p>
        <Button size="sm" onClick={() => setDialog({ mode: "new" })}>
          <Plus aria-hidden /> New supplier
        </Button>
      </div>

      <Panel>
        <PanelHeader>
          <Truck className="size-3.5 text-ink-faint" aria-hidden />
          <PanelTitle>Suppliers</PanelTitle>
          <span className="mono ml-auto text-xs text-ink-faint">
            {suppliers.length} supplier{suppliers.length === 1 ? "" : "s"}
          </span>
        </PanelHeader>

        {suppliers.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="No suppliers yet."
            body="Add the distributors and wholesalers you buy stock from, so receiving a delivery is a pick, not a type."
          />
        ) : (
          <ul className="divide-y divide-rule-soft">
            {suppliers.map((supplier) => {
              const contact = [supplier.contactPerson, supplier.mobile, supplier.email]
                .filter(Boolean)
                .join(" · ");
              return (
                <li
                  key={supplier.id}
                  className="flex items-center gap-3 px-3 py-2.5 sm:px-4"
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "truncate text-sm",
                        supplier.active
                          ? "text-ink"
                          : "text-ink-faint line-through",
                      )}
                    >
                      {supplier.name}
                    </p>
                    {contact ? (
                      <p className="truncate text-xs text-ink-faint">{contact}</p>
                    ) : null}
                  </div>
                  {!supplier.active ? <Badge variant="ghost">off</Badge> : null}
                  {supplier.terms ? (
                    <span className="mono hidden text-xs text-ink-faint sm:inline">
                      {supplier.terms}
                    </span>
                  ) : null}
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => setDialog({ mode: "edit", supplier })}
                  >
                    Edit
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {dialog ? (
        <SupplierDialog
          supplier={dialog.mode === "edit" ? dialog.supplier : undefined}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            query.refetch();
          }}
        />
      ) : null}
    </div>
  );
}

/* ── Shared ──────────────────────────────────────────────────────────── */

/**
 * A 403 on these tabs means the account lacks `settings.manage` — a fact of
 * the sign-in, not a fault to retry. Anything else is a real error.
 */

/* ── Staff ───────────────────────────────────────────────────────────── */

/**
 * Who can sign in, and as what.
 *
 * Deliberately reaches across both branches rather than following the branch
 * switcher: the owner manages the sales floor's cashiers from here, and a list
 * that changed under the switcher would hide half the staff without saying so.
 * `getUsers` asks for every branch; the server refuses anyone without
 * `branches.view_all`, which the "not permitted" state below reports plainly.
 *
 * Deleting is a soft delete server-side — the person stops signing in, and the
 * tickets and sales they handled keep their name.
 */
function StaffTab() {
  const { user: self, branches } = useShop();
  const usersQuery = useQuery((api) => api.getUsers(), []);
  const [dialog, setDialog] = useState<
    { mode: "new" } | { mode: "edit"; staff: User } | null
  >(null);
  const [removing, setRemoving] = useState<User | null>(null);

  const remove = useMutation((api, id: string) => api.deleteUser(id));

  const users = usersQuery.data ?? [];

  /* Grouped by branch, so "who works at the sales floor" is one glance. */
  const groups = useMemo(() => {
    const map = new Map<string, User[]>();
    for (const row of [...users].sort((a, b) => a.name.localeCompare(b.name))) {
      const key = row.branchName || "No branch";
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [users]);

  if (usersQuery.loading && !usersQuery.data) {
    return (
      <Panel>
        <LoadingRows rows={6} />
      </Panel>
    );
  }
  if (usersQuery.error) {
    return permissionOr(usersQuery.error, "manage staff", usersQuery.refetch);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-ink-soft">
          Everyone who can sign in, at either branch. A cashier sees only the
          branch they are assigned to — moving them here moves what they can
          reach. Removing someone stops the sign-in; the work they already
          handled keeps their name.
        </p>
        <Button size="sm" onClick={() => setDialog({ mode: "new" })}>
          <Plus aria-hidden /> New staff account
        </Button>
      </div>

      {users.length === 0 ? (
        <Panel>
          <EmptyState
            icon={UserCog}
            title="No staff accounts yet."
            body="Add an account for each person who works the counter, so their sales and job orders are filed under their own name."
          />
        </Panel>
      ) : (
        groups.map(([branchName, rows]) => (
          <Panel key={branchName}>
            <PanelHeader>
              <PanelTitle>{branchName}</PanelTitle>
              <span className="mono ml-auto text-xs text-ink-faint">
                {count(rows.length)}
              </span>
            </PanelHeader>
            <ul className="divide-y divide-rule-soft">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 sm:px-4"
                >
                  <span className="mono grid size-7 shrink-0 place-items-center rounded-sm bg-ink text-[0.625rem] font-semibold text-paper">
                    {row.initials}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {row.name}
                      {row.id === self.id ? (
                        <span className="ml-1.5 text-xs font-normal text-ink-faint">
                          (you)
                        </span>
                      ) : null}
                    </p>
                    <p className="mono truncate text-xs text-ink-faint">
                      {row.employeeCode ? `${row.employeeCode} · ` : ""}
                      {row.email ?? "no email"}
                    </p>
                  </div>

                  <Badge variant={row.active ? "outline" : "secondary"}>
                    {ROLE_LABEL[row.role]}
                  </Badge>
                  {!row.active ? (
                    <span className="text-xs text-ink-faint">Inactive</span>
                  ) : null}

                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => setDialog({ mode: "edit", staff: row })}
                    >
                      Edit
                    </Button>
                    {/* Never offer to delete the account you are signed in as:
                        it would end the session mid-edit. */}
                    {row.id !== self.id ? (
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => setRemoving(row)}
                        aria-label={`Remove ${row.name}`}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        ))
      )}

      {dialog ? (
        <StaffDialog
          staff={dialog.mode === "edit" ? dialog.staff : undefined}
          branches={branches}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            usersQuery.refetch();
          }}
        />
      ) : null}

      {removing ? (
        <Dialog open onOpenChange={(open) => !open && setRemoving(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Remove {removing.name}?</DialogTitle>
            </DialogHeader>
            <p className="text-sm leading-relaxed text-ink-soft">
              They stop being able to sign in. The job orders and sales they
              handled keep their name, so the shop&rsquo;s history is unchanged.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="outline"
                onClick={() => setRemoving(null)}
                disabled={remove.pending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={remove.pending}
                onClick={async () => {
                  const { error } = await remove.mutate(removing.id);
                  if (error) {
                    const { message, description } = toastError(
                      error,
                      "Could not remove the account.",
                    );
                    toast.error(message, { description });
                  } else {
                    toast.success(`${removing.name} removed.`);
                    setRemoving(null);
                    usersQuery.refetch();
                  }
                }}
              >
                {remove.pending ? "Removing…" : "Remove"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

/* ── Technicians ─────────────────────────────────────────────────────── */

/**
 * The repair bench, on its own.
 *
 * A technician is a staff account whose role is `technician` (`isTechnician`
 * mirrors that) — the people a job order can be assigned to, and the names that
 * show up on the board and in throughput reports. This is the same
 * `createUser` / `updateUser` / `deleteUser` the Staff tab uses, filtered to
 * that role and with the role locked, so the owner can run the bench roster
 * without wading through every cashier. Changing someone's role still happens
 * on the Staff tab.
 *
 * Owner-only, same gate as Staff: the cross-branch `/users` read is a 403 for
 * anyone else, reported plainly.
 */
function TechniciansTab() {
  const { user: self, branches } = useShop();
  const usersQuery = useQuery((api) => api.getUsers(), []);
  const [dialog, setDialog] = useState<
    { mode: "new" } | { mode: "edit"; staff: User } | null
  >(null);
  const [removing, setRemoving] = useState<User | null>(null);

  const remove = useMutation((api, id: string) => api.deleteUser(id));

  const technicians = useMemo(
    () =>
      (usersQuery.data ?? [])
        .filter((row) => row.isTechnician)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [usersQuery.data],
  );

  if (usersQuery.loading && !usersQuery.data) {
    return (
      <Panel>
        <LoadingRows rows={6} />
      </Panel>
    );
  }
  if (usersQuery.error) {
    return permissionOr(usersQuery.error, "manage staff", usersQuery.refetch);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-ink-soft">
          The people a job order can be assigned to. Each is a staff account with
          the technician role — they appear on the repair board and in throughput
          reports. Removing one stops the sign-in; the jobs they worked keep
          their name.
        </p>
        <Button size="sm" onClick={() => setDialog({ mode: "new" })}>
          <Plus aria-hidden /> New technician
        </Button>
      </div>

      {technicians.length === 0 ? (
        <Panel>
          <EmptyState
            icon={Wrench}
            title="No technicians yet."
            body="Add an account with the technician role for each person on the repair bench, so job orders can be assigned to them by name."
          />
        </Panel>
      ) : (
        <Panel>
          <PanelHeader>
            <Wrench className="size-3.5 text-ink-faint" aria-hidden />
            <PanelTitle>Repair bench</PanelTitle>
            <span className="mono ml-auto text-xs text-ink-faint">
              {count(technicians.length)}
            </span>
          </PanelHeader>
          <ul className="divide-y divide-rule-soft">
            {technicians.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 sm:px-4"
              >
                <span className="mono grid size-7 shrink-0 place-items-center rounded-sm bg-ink text-[0.625rem] font-semibold text-paper">
                  {row.initials}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {row.name}
                    {row.id === self.id ? (
                      <span className="ml-1.5 text-xs font-normal text-ink-faint">
                        (you)
                      </span>
                    ) : null}
                  </p>
                  <p className="mono truncate text-xs text-ink-faint">
                    {row.employeeCode ? `${row.employeeCode} · ` : ""}
                    {row.email ?? "no email"}
                  </p>
                </div>

                {row.branchName ? (
                  <Badge variant="outline">{row.branchName}</Badge>
                ) : null}
                {!row.active ? (
                  <span className="text-xs text-ink-faint">Inactive</span>
                ) : null}

                <div className="flex shrink-0 gap-1">
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => setDialog({ mode: "edit", staff: row })}
                  >
                    Edit
                  </Button>
                  {/* Never offer to delete the account you are signed in as. */}
                  {row.id !== self.id ? (
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => setRemoving(row)}
                      aria-label={`Remove ${row.name}`}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {dialog ? (
        <StaffDialog
          staff={dialog.mode === "edit" ? dialog.staff : undefined}
          branches={branches}
          lockRole="technician"
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            usersQuery.refetch();
          }}
        />
      ) : null}

      {removing ? (
        <Dialog open onOpenChange={(open) => !open && setRemoving(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Remove {removing.name}?</DialogTitle>
            </DialogHeader>
            <p className="text-sm leading-relaxed text-ink-soft">
              They stop being able to sign in, and drop off the list of
              technicians a job can be assigned to. The jobs they already worked
              keep their name.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="outline"
                onClick={() => setRemoving(null)}
                disabled={remove.pending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={remove.pending}
                onClick={async () => {
                  const { error } = await remove.mutate(removing.id);
                  if (error) {
                    const { message, description } = toastError(
                      error,
                      "Could not remove the account.",
                    );
                    toast.error(message, { description });
                  } else {
                    toast.success(`${removing.name} removed.`);
                    setRemoving(null);
                    usersQuery.refetch();
                  }
                }}
              >
                {remove.pending ? "Removing…" : "Remove"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

/** The roles this screen can assign, in the order they read on the floor. */
const ASSIGNABLE_ROLES: Role[] = ["cashier", "technician", "manager", "owner"];

function StaffDialog({
  staff,
  branches,
  lockRole,
  onClose,
  onSaved,
}: {
  staff?: User;
  branches: BranchSummary[];
  /** Fixes the role and hides the picker — used by the Technicians tab. */
  lockRole?: Role;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(staff);
  const create = useMutation((api, input: NewUserInput) => api.createUser(input));
  const update = useMutation((api, input: { id: string; patch: UserPatch }) =>
    api.updateUser(input.id, input.patch),
  );
  const pending = create.pending || update.pending;

  const [name, setName] = useState(staff?.name ?? "");
  const [email, setEmail] = useState(staff?.email ?? "");
  const [employeeCode, setEmployeeCode] = useState(staff?.employeeCode ?? "");
  const [role, setRole] = useState<Role>(staff?.role ?? lockRole ?? "cashier");
  const [branchId, setBranchId] = useState(staff?.branchId ?? branches[0]?.id ?? "");
  const [password, setPassword] = useState("");
  const [active, setActive] = useState(staff?.active ?? true);

  /* The API enforces 8 characters; say so before the round trip rather than
     surfacing a validation error the user could have avoided. */
  const passwordTooShort = password.length > 0 && password.length < 8;
  const canSave =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    employeeCode.trim().length > 0 &&
    branchId.length > 0 &&
    !passwordTooShort &&
    (isEdit || password.length >= 8) &&
    !pending;

  const submit = async () => {
    if (!canSave) return;

    const outcome = isEdit
      ? await update.mutate({
          id: staff!.id,
          patch: {
            name: name.trim(),
            email: email.trim(),
            employeeCode: employeeCode.trim(),
            role,
            branchId,
            active,
            /* Blank means "leave the current password alone". */
            ...(password ? { password } : {}),
          },
        })
      : await create.mutate({
          name: name.trim(),
          email: email.trim(),
          password,
          role,
          employeeCode: employeeCode.trim(),
          branchId,
        });

    if (outcome.data) {
      toast.success(isEdit ? "Account updated." : `${outcome.data.name} added.`);
      onSaved();
    } else if (outcome.error) {
      const { message, description } = toastError(
        outcome.error,
        "Could not save the account.",
      );
      toast.error(message, { description });
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? `Edit ${staff!.name}`
              : lockRole
                ? `New ${ROLE_LABEL[lockRole].toLowerCase()}`
                : "New staff account"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="staff-name">Name</Label>
            <Input
              id="staff-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Rosa Delgado"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="staff-email">Email</Label>
              <Input
                id="staff-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="rosa@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="staff-code">Employee code</Label>
              <Input
                id="staff-code"
                value={employeeCode}
                onChange={(e) => setEmployeeCode(e.target.value)}
                placeholder="EMP-0042"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="staff-role">Role</Label>
              {lockRole ? (
                <div
                  id="staff-role"
                  className="flex h-9 items-center rounded-md border border-rule bg-secondary px-3 text-sm text-ink-soft"
                >
                  {ROLE_LABEL[role]}
                </div>
              ) : (
                <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                  <SelectTrigger id="staff-role" className="w-full min-w-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSIGNABLE_ROLES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {ROLE_LABEL[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="staff-branch">Branch</Label>
              <Select value={branchId} onValueChange={setBranchId}>
                {/* `w-full` + `min-w-0`: a long branch name must truncate
                    inside its grid column, not push past the chevron. */}
                <SelectTrigger id="staff-branch" className="w-full min-w-0">
                  <SelectValue className="truncate" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-ink-soft">
            {ROLE_BLURB[role]}
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="staff-password">
              {isEdit ? "New password" : "Password"}
            </Label>
            <Input
              id="staff-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isEdit ? "Leave blank to keep the current one" : "At least 8 characters"}
            />
            {passwordTooShort ? (
              <p className="text-xs text-stamp-ink">
                At least 8 characters.
              </p>
            ) : null}
          </div>

          {isEdit ? (
            <label className="flex items-center gap-2 text-sm text-ink">
              <Switch checked={active} onCheckedChange={setActive} />
              {active ? "Active — can sign in" : "Inactive — cannot sign in"}
            </label>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!canSave}>
              {pending
                ? "Saving…"
                : isEdit
                  ? "Save changes"
                  : lockRole
                    ? `Add ${ROLE_LABEL[lockRole].toLowerCase()}`
                    : "Add account"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


/**
 * Every branch the shop runs, and the way to add another.
 *
 * Owner-only, mirroring the server: `POST /branches` is a 403 for a manager,
 * so the panel is absent rather than shown broken. Branches are never deleted
 * — the API answers 405 — because a closed site's tickets and sales still have
 * to resolve. Closing one deactivates it: it drops out of the branch switcher
 * and the staff form, and its history stays intact.
 *
 * Only the shop's own record is editable in full (name, address, tax details,
 * receipt text) in the panel below; this one covers what makes a branch a
 * branch — what it is called, its ticket code, and whether it repairs.
 */
function BranchRoster() {
  const { branch: ownBranch } = useShop();
  const query = useQuery((api) => api.getBranches({ includeInactive: true }), []);
  const [dialog, setDialog] = useState<
    { mode: "new" } | { mode: "edit"; branch: BranchSummary } | null
  >(null);

  const branches = query.data ?? [];

  if (query.loading && !query.data) {
    return (
      <Panel>
        <LoadingRows rows={3} />
      </Panel>
    );
  }
  if (query.error) {
    return permissionOr(query.error, "manage branches", query.refetch);
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-ink-soft">
          The sites this shop runs. A sales-only branch has no repair bench, so
          it takes no job orders. A branch is never deleted — closing one hides
          it from the switcher and from new staff, and its past work keeps
          resolving.
        </p>
        <Button size="sm" onClick={() => setDialog({ mode: "new" })}>
          <Plus aria-hidden /> New branch
        </Button>
      </div>

      <Panel>
        <PanelHeader>
          <Building2 className="size-3.5 text-ink-faint" aria-hidden />
          <PanelTitle>Branches</PanelTitle>
          <span className="mono ml-auto text-xs text-ink-faint">
            {count(branches.length)}
          </span>
        </PanelHeader>

        {branches.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No branches yet."
            body="Add the shop's first site so job orders and sales have somewhere to be filed."
          />
        ) : (
          <ul className="divide-y divide-rule-soft">
            {branches.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 sm:px-4"
              >
                <span className="mono grid size-7 shrink-0 place-items-center rounded-sm border border-rule text-[0.625rem] font-semibold text-ink-soft">
                  {row.code}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {row.name}
                    {row.id === ownBranch?.ulid ? (
                      <span className="ml-1.5 text-xs font-normal text-ink-faint">
                        (yours)
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-ink-faint">
                    {row.offersRepairs ? "Repairs and sales" : "Sales only"}
                  </p>
                </div>

                {!row.active ? (
                  <Badge variant="secondary">Closed</Badge>
                ) : null}

                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => setDialog({ mode: "edit", branch: row })}
                >
                  Edit
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {dialog ? (
        <BranchDialog
          branch={dialog.mode === "edit" ? dialog.branch : undefined}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            query.refetch();
          }}
        />
      ) : null}
    </>
  );
}

function BranchDialog({
  branch,
  onClose,
  onSaved,
}: {
  branch?: BranchSummary;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(branch);
  const create = useMutation((api, input: NewBranchInput) => api.createBranch(input));
  const update = useMutation((api, input: { id: string; patch: BranchRecordPatch }) =>
    api.updateBranchById(input.id, input.patch),
  );
  const pending = create.pending || update.pending;

  const [name, setName] = useState(branch?.name ?? "");
  const [code, setCode] = useState(branch?.code ?? "");
  const [kind, setKind] = useState<BranchKind>(branch?.kind ?? "sales_only");
  const [active, setActive] = useState(branch?.active ?? true);

  const canSave = name.trim().length > 0 && code.trim().length > 0 && !pending;

  const submit = async () => {
    if (!canSave) return;
    const outcome = isEdit
      ? await update.mutate({
          id: branch!.id,
          patch: { name: name.trim(), code: code.trim().toUpperCase(), kind, active },
        })
      : await create.mutate({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          kind,
        });

    if (outcome.data) {
      toast.success(isEdit ? "Branch saved." : `${outcome.data.name} added.`);
      onSaved();
    } else if (outcome.error) {
      const { message, description } = toastError(
        outcome.error,
        "Could not save the branch.",
      );
      toast.error(message, { description });
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${branch!.name}` : "New branch"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="branch-name">Name</Label>
            <Input
              id="branch-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nelson Sales Center"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="branch-code">Code</Label>
            <Input
              id="branch-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="SC"
              className="mono"
            />
            <p className="text-xs text-ink-faint">
              Prints inside every ticket number — <span className="mono">JO-{code || "SC"}-202609-0001</span>. Must be unique.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="branch-kind">What it does</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as BranchKind)}>
              <SelectTrigger id="branch-kind" className="w-full min-w-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="repair_and_sales">Repairs and sales</SelectItem>
                <SelectItem value="sales_only">Sales only</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-ink-faint">
              {kind === "sales_only"
                ? "A shop floor: appliances, handsets, laptops, accessories. Takes no job orders."
                : "A full site: takes units in at the counter and repairs them."}
            </p>
          </div>

          {isEdit ? (
            <label className="flex items-center gap-2 text-sm text-ink">
              <Switch checked={active} onCheckedChange={setActive} />
              {active
                ? "Open — staff can be assigned here"
                : "Closed — hidden from the switcher; past work is kept"}
            </label>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!canSave}>
              {pending ? "Saving…" : isEdit ? "Save changes" : "Add branch"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function permissionOr(error: Error, action: string, onRetry: () => void) {
  if (error instanceof ApiError && error.code === "FORBIDDEN") {
    return (
      <Panel>
        <EmptyState
          icon={Settings2}
          title="Not permitted."
          body={`Your account cannot ${action}. Ask the shop owner, who has settings access.`}
        />
      </Panel>
    );
  }
  return <ErrorState error={error} onRetry={onRetry} />;
}
