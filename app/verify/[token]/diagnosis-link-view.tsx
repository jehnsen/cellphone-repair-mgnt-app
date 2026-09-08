"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Scan, TriangleAlert } from "lucide-react";
import { PartsFallbackList } from "@/components/diagnosis/parts-fallback-list";
import { Badge } from "@/components/ui/badge";
import { LoadingRows } from "@/components/ui/states";
import { API_BASE_URL } from "@/lib/api/config";
import { toDevicePart } from "@/lib/api/mappers";
import { hasWebGL, PART_CATEGORY_LABEL, resolveParts } from "@/lib/diagnosis";
import type { DevicePartDto } from "@/lib/api/dto";
import type { DevicePart } from "@/lib/types";

/**
 * What the customer sees when the shop texts them a link.
 *
 * Deliberately not the technician's component with a `readOnly` prop bolted
 * on. It shares the scene, the parts list, and the fallback — the parts that
 * are genuinely the same — but it does not go anywhere near `ShopProvider`,
 * because the person opening this has no session and never will. Pulling the
 * authenticated store in here would mean a customer's phone tries to load the
 * shop, fails, and shows them a sign-in screen.
 *
 * The endpoint behind it is the API's redacted one: no pricing, no customer
 * details, no claim code, no technician identity, no bench notes.
 */

const PhoneScene = dynamic(
  () => import("@/components/diagnosis/phone-scene").then((m) => m.PhoneScene),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full place-items-center text-xs text-ink-faint">
        Loading…
      </div>
    ),
  },
);

interface PublicDiagnosis {
  ticket_number: string;
  status: string;
  device: { brand?: string | null; model?: string | null; color?: string | null };
  branch: { name?: string | null };
  issues: { source: string; key: string; label: string }[];
  implicated_part_keys: string[];
  parts: DevicePartDto[];
  finding: {
    summary?: string | null;
    details?: string | null;
    root_cause?: string | null;
    resolution?: string | null;
  } | null;
  diagnosed_at?: string | null;
}

export function DiagnosisLinkView({ token }: { token: string }) {
  const [data, setData] = useState<PublicDiagnosis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [webgl, setWebgl] = useState(false);

  useEffect(() => setWebgl(hasWebGL()), []);

  useEffect(() => {
    let cancelled = false;

    /* A plain fetch rather than the shared HttpClient: this route is
       unauthenticated, and the client's job is attaching a bearer token and a
       branch scope, neither of which exists here. */
    fetch(`${API_BASE_URL}/public/verify/${encodeURIComponent(token)}/diagnosis`, {
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(
            payload?.error?.message ??
              "This link is not valid. Ask the shop for a new one.",
          );
        }
        return payload.data as PublicDiagnosis;
      })
      .then((value) => {
        if (!cancelled) setData(value);
      })
      .catch((caught: Error) => {
        if (!cancelled) setError(caught.message);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const parts: DevicePart[] = useMemo(
    () => (data?.parts ?? []).map(toDevicePart),
    [data],
  );

  const implicated = useMemo(
    () => resolveParts(parts, data?.implicated_part_keys ?? []),
    [parts, data],
  );

  if (error) {
    return (
      <Shell>
        <div className="flex items-start gap-2.5 rounded-sm border border-stamp/40 bg-stamp-fill px-3 py-3">
          <TriangleAlert
            className="mt-0.5 size-4 shrink-0 text-stamp-ink"
            aria-hidden
          />
          <div>
            <p className="text-sm font-medium text-stamp-ink">
              This link cannot be opened.
            </p>
            <p className="mt-1 text-xs leading-relaxed text-stamp-ink">
              {error}
            </p>
          </div>
        </div>
      </Shell>
    );
  }

  if (!data) {
    return (
      <Shell>
        <LoadingRows rows={4} />
      </Shell>
    );
  }

  const device = [data.device.brand, data.device.model]
    .filter(Boolean)
    .join(" ");

  return (
    <Shell>
      <div className="space-y-1">
        <p className="label-pad">{data.branch.name ?? "Repair shop"}</p>
        <h1 className="font-display text-lg font-semibold text-ink">
          {device || "Your device"}
        </h1>
        <p className="font-mono text-xs text-ink-faint">{data.ticket_number}</p>
      </div>

      {data.issues.length ? (
        <div>
          <p className="label-pad mb-1.5">What we found</p>
          <div className="flex flex-wrap gap-1.5">
            {data.issues.map((issue) => (
              <Badge key={`${issue.source}-${issue.key}`} variant="tint">
                {issue.label}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      {data.finding?.summary ? (
        <p className="text-sm leading-relaxed text-ink">
          {data.finding.summary}
        </p>
      ) : null}

      {webgl && parts.length ? (
        <div className="h-[360px] overflow-hidden rounded-sm border border-rule bg-secondary/30">
          <PhoneScene
            parts={parts}
            mode="diagnosis"
            explode={0}
            highlightedPartKeys={data.implicated_part_keys}
            inspectedPartKey={null}
            categoryFilter="all"
            focusPart={implicated[0] ?? null}
            reframeId={0}
            /* Read-only: there is nothing to select and nothing to save. The
               customer can still turn it, which is the point. */
            onSelectPart={() => {}}
            onRequestReframe={() => {}}
          />
        </div>
      ) : (
        <PartsFallbackList
          parts={parts}
          highlightedPartKeys={data.implicated_part_keys}
          reason={parts.length ? "no-webgl" : "no-parts"}
        />
      )}

      {implicated.length ? (
        <div>
          <p className="label-pad mb-1.5">
            {implicated.length === 1
              ? "The part involved"
              : "The parts involved"}
          </p>
          <ul className="space-y-2">
            {implicated.map((part) => (
              <li
                key={part.key}
                className="rounded-sm border border-rule bg-copy px-2.5 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="size-1.5 shrink-0 bg-stamp" aria-hidden />
                  <span className="text-sm font-medium text-ink">
                    {part.label}
                  </span>
                  <Badge variant="outline" className="ml-auto">
                    {PART_CATEGORY_LABEL[part.category]}
                  </Badge>
                </div>
                {part.blurb ? (
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
                    {part.blurb}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-xs leading-relaxed text-ink-faint">
        This is a diagram of a typical phone, not a photograph of yours — it is
        here to show which part we mean. Questions about the price or the
        timing are best asked at the shop.
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-paper">
      {/* Single column and generously spaced: this is opened on a phone, in a
          hand, by somebody who is not in a hurry to learn an interface. */}
      <main className="mx-auto w-full max-w-lg space-y-4 px-4 py-6">
        <div className="flex items-center gap-2">
          <span className="brandmark grid size-6 place-items-center">
            <Scan className="size-3.5 text-white" aria-hidden />
          </span>
          <span className="label-bin text-ink">Repair diagnosis</span>
        </div>
        {children}
      </main>
    </div>
  );
}
