"use client";

import { PlugZap, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { DataSourceNotice } from "@/components/shell/data-source-notice";
import { StageStub } from "@/components/shell/stage-stub";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { useShop } from "@/lib/shop/store";
import { count } from "@/lib/format";

/**
 * Settings is still mostly stage 9. The connection panel belongs here now:
 * it is where someone goes to ask "what is this app actually reading?".
 */
export function SettingsView() {
  const { apiBaseUrl, user, db, signOut } = useShop();

  return (
    <div className="page space-y-4 sm:space-y-5">
      <PageHeader
        eyebrow="Settings"
        title="Connection"
        description="Where this browser reads and writes the shop's records."
      />

      <DataSourceNotice />

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

      <StageStub
        stage={9}
        title="The rest of settings"
        summary="Users and roles, service catalog, warranty templates, shop profile, and notification templates."
        covers={[
          "Permission matrix by role",
          "Service catalog and price list",
          "Receipt header, footer, and BIR display toggle",
          "Viber and SMS templates with merge fields",
        ]}
      />
    </div>
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
