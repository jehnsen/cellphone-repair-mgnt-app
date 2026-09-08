"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Boxes, Crosshair, RotateCcw, Scan } from "lucide-react";
import {
  Panel,
  PanelBody,
  PanelHeader,
  PanelTitle,
} from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorState, LoadingRows } from "@/components/ui/states";
import { IssuePicker } from "@/components/diagnosis/issue-picker";
import { DiagnosisSummaryPanel } from "@/components/diagnosis/diagnosis-summary-panel";
import { ExploreControls } from "@/components/diagnosis/explore-controls";
import { SnapshotButton } from "@/components/diagnosis/snapshot-button";
import { ShareLinkButton } from "@/components/diagnosis/share-link-button";
import { PartsFallbackList } from "@/components/diagnosis/parts-fallback-list";
import { ConfirmDiagnosisDialog } from "@/components/diagnosis/confirm-diagnosis-dialog";
import { useDiagnosisState } from "@/components/diagnosis/use-diagnosis-state";
import type { PhoneSceneHandle } from "@/components/diagnosis/phone-scene";
import { useQuery, useShop } from "@/lib/shop/store";
import { hasWebGL, issuesForTicket, resolveParts } from "@/lib/diagnosis";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DiagnosisSnapshot, RepairFinding, Ticket } from "@/lib/types";

/**
 * "Your charging port is loose" — while pointing at the charging port.
 *
 * Lives on the ticket rather than at a route of its own: a technician reaches
 * for this mid-sentence with a customer at the counter, and anything that
 * costs a navigation gets used once and then not again.
 *
 * Two modes. Diagnosis picks an issue and isolates the part it implicates —
 * no explode, because the answer is "this one", not "here is everything".
 * Explore is the teardown, for walking a customer through the whole device or
 * showing a new technician where things sit.
 */

/* three.js is ~600KB and every byte of it is useless to a ticket nobody
   opens the visualizer on, so the scene is split out and loaded on demand.
   `ssr: false` is not an optimisation here: there is no WebGL context during
   SSR, and the whole component tree assumes one. */
const PhoneScene = dynamic(
  () => import("@/components/diagnosis/phone-scene").then((m) => m.PhoneScene),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full place-items-center text-xs text-ink-faint">
        Loading the phone diagram…
      </div>
    ),
  },
);

export function DiagnosisVisualizer({
  ticket,
  finding,
  readOnly,
  onFindingSaved,
}: {
  ticket: Ticket;
  finding: RepairFinding | null;
  readOnly?: boolean;
  onFindingSaved: (next: RepairFinding) => void;
}) {
  const { can } = useShop();
  const [open, setOpen] = useState(false);

  const {
    data: parts,
    loading: partsLoading,
    error: partsError,
    refetch: refetchParts,
  } = useQuery((api) => api.getDeviceParts());

  const { data: catalog } = useQuery((api) => api.getIssueCatalog());

  /* Checked once, on the client, before anything three.js is imported — a
     canvas that comes up blank on an old shop tablet is worse than a list,
     because nobody finds out until a customer is already looking at it. */
  const [webgl, setWebgl] = useState<boolean | null>(null);
  useEffect(() => setWebgl(hasWebGL()), []);

  const initial = useMemo(
    () => issuesForTicket(ticket, finding),
    [ticket, finding],
  );

  return (
    <Panel>
      <PanelHeader>
        <Scan className="size-3.5 text-ink-faint" aria-hidden />
        <PanelTitle>Show the customer</PanelTitle>

        <Button
          variant="outline"
          size="xs"
          className="ml-auto"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
          {open ? "Hide" : "Open 3D view"}
        </Button>
      </PanelHeader>

      {open ? (
        partsError ? (
          <PanelBody>
            <ErrorState error={partsError} onRetry={refetchParts} />
          </PanelBody>
        ) : partsLoading && !parts ? (
          <PanelBody>
            <LoadingRows rows={4} />
          </PanelBody>
        ) : (
          <VisualizerBody
            /* Remount when the finding first arrives. The picker seeds itself
               from the ticket once, on mount, and the finding is fetched on
               its own — so a technician who opens this before that request
               lands would otherwise be left on the intake vocabulary with no
               way to notice. Keyed on the finding's identity rather than the
               whole object, so ordinary edits to it do not wipe a selection
               mid-conversation. */
            key={finding?.id ?? "no-finding"}
            ticket={ticket}
            finding={finding}
            parts={parts ?? []}
            catalog={catalog ?? { problem_tag: [], defect: [] }}
            webgl={webgl === true}
            readOnly={readOnly || !can("ticket.edit")}
            initialSource={initial.source}
            initialKeys={initial.keys}
            onFindingSaved={onFindingSaved}
          />
        )
      ) : (
        <PanelBody>
          <p className="text-sm leading-relaxed text-ink-soft">
            Point at the part instead of naming it. Opens the phone in 3D,
            highlights what this ticket says is wrong, and can save the picture
            onto the ticket for the quote.
          </p>
        </PanelBody>
      )}
    </Panel>
  );
}

function VisualizerBody({
  ticket,
  finding,
  parts,
  catalog,
  webgl,
  readOnly,
  initialSource,
  initialKeys,
  onFindingSaved,
}: {
  ticket: Ticket;
  finding: RepairFinding | null;
  parts: React.ComponentProps<typeof PartsFallbackList>["parts"];
  catalog: Parameters<typeof IssuePicker>[0]["catalog"];
  webgl: boolean;
  readOnly: boolean;
  initialSource: ReturnType<typeof issuesForTicket>["source"];
  initialKeys: string[];
  onFindingSaved: (next: RepairFinding) => void;
}) {
  const { state, dispatch, highlightedPartKeys } = useDiagnosisState(catalog, {
    source: initialSource,
    keys: initialKeys,
  });

  const scene = useRef<PhoneSceneHandle>(null);
  const [reframeId, setReframeId] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [snapshots, setSnapshots] = useState<DiagnosisSnapshot[]>([]);

  const { data: fetchedSnapshots } = useQuery(
    (api) => api.getDiagnosisSnapshots(ticket.id),
    [ticket.id],
  );
  const allSnapshots = snapshots.length
    ? snapshots
    : (fetchedSnapshots ?? []);

  const implicatedParts = useMemo(
    () => resolveParts(parts, highlightedPartKeys),
    [parts, highlightedPartKeys],
  );

  /* The camera frames the first implicated part — the one the mapping ranks
     first, which is the one the technician means. */
  const focusPart = implicatedParts[0] ?? null;

  const inspectedPart =
    parts.find((part) => part.key === state.inspectedPartKey) ?? null;

  const noParts = parts.length === 0;
  const showScene = webgl && !noParts;

  /* Only the bench vocabulary can be written back: `defects` on the finding is
     what the picker maps onto, and an intake problem tag is the customer's
     word, not a diagnosis. Selecting from the intake list still drives the
     highlight — it just is not something to save. */
  const canConfirm =
    !readOnly && state.source === "defect" && state.selectedIssueKeys.length > 0;

  return (
    <>
      <div className="grid gap-4 border-t border-rule p-3 lg:grid-cols-[minmax(0,1fr)_320px] sm:p-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <ModeTab
              active={state.mode === "diagnosis"}
              icon={Crosshair}
              label="Diagnosis"
              onClick={() => dispatch({ type: "mode", mode: "diagnosis" })}
            />
            <ModeTab
              active={state.mode === "explore"}
              icon={Boxes}
              label="Explore"
              onClick={() => dispatch({ type: "mode", mode: "explore" })}
            />

            {showScene ? (
              <Button
                variant="ghost"
                size="xs"
                className="ml-auto"
                onClick={() => setReframeId((value) => value + 1)}
              >
                <RotateCcw aria-hidden /> Reset view
              </Button>
            ) : null}
          </div>

          {showScene ? (
            <div
              className={cn(
                "relative overflow-hidden rounded-sm border border-rule bg-secondary/30",
                /* Tall enough to read on a tablet held upright, capped so it
                   never pushes the picker off a laptop screen. */
                "h-[340px] sm:h-[420px]",
              )}
            >
              <PhoneScene
                handleRef={scene}
                parts={parts}
                mode={state.mode}
                explode={state.explode}
                highlightedPartKeys={highlightedPartKeys}
                inspectedPartKey={state.inspectedPartKey}
                categoryFilter={state.categoryFilter}
                focusPart={focusPart}
                reframeId={reframeId}
                onSelectPart={(key) =>
                  dispatch({
                    type: "inspect",
                    key: key === state.inspectedPartKey ? null : key,
                  })
                }
                onRequestReframe={() => setReframeId((value) => value + 1)}
              />
            </div>
          ) : (
            <PartsFallbackList
              parts={parts}
              highlightedPartKeys={highlightedPartKeys}
              reason={noParts ? "no-parts" : "no-webgl"}
            />
          )}

          {state.mode === "diagnosis" ? (
            <DiagnosisSummaryPanel
              catalog={catalog}
              source={state.source}
              selectedIssueKeys={state.selectedIssueKeys}
              implicatedParts={implicatedParts}
              customNote={state.customNote}
            />
          ) : null}
        </div>

        <div className="min-w-0 space-y-3 lg:border-l lg:border-rule lg:pl-4">
          {state.mode === "diagnosis" ? (
            <>
              <SourceToggle
                source={state.source}
                hasFinding={Boolean(finding)}
                onChange={(source) => dispatch({ type: "source", source })}
              />

              <IssuePicker
                catalog={catalog}
                source={state.source}
                selectedKeys={state.selectedIssueKeys}
                customNote={state.customNote}
                disabled={readOnly}
                onToggle={(key) => dispatch({ type: "toggleIssue", key })}
                onNoteChange={(value) => dispatch({ type: "note", value })}
              />

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={!canConfirm}
                  onClick={() => setConfirming(true)}
                >
                  Confirm diagnosis
                </Button>

                {showScene && !readOnly ? (
                  <SnapshotButton
                    ticketId={ticket.id}
                    scene={scene}
                    source={state.source}
                    issueKeys={state.selectedIssueKeys}
                    partKeys={highlightedPartKeys}
                    note={state.customNote}
                    disabled={state.selectedIssueKeys.length === 0}
                    onSaved={(snapshot) =>
                      setSnapshots((prev) => [snapshot, ...prev])
                    }
                  />
                ) : null}

                {/* Absent on a list-loaded ticket, and withheld by the server
                    from anyone who may not view tickets — so this is offered
                    only when there is really a link to send. */}
                {ticket.verificationToken ? (
                  <ShareLinkButton token={ticket.verificationToken} />
                ) : null}
              </div>

              {state.source === "problem_tag" &&
              state.selectedIssueKeys.length > 0 &&
              !readOnly ? (
                <p className="text-xs leading-relaxed text-ink-faint">
                  These are the customer&rsquo;s own words from intake, so they
                  are not saved as a diagnosis. Switch to the bench findings to
                  record what you actually found.
                </p>
              ) : null}

              {allSnapshots.length ? (
                <SnapshotList snapshots={allSnapshots} />
              ) : null}
            </>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="label-pad">Explore</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                  Nothing here is recorded. For walking a customer through the
                  whole device, or showing a new technician where things sit.
                </p>
              </div>

              {showScene ? (
                <ExploreControls
                  explode={state.explode}
                  categoryFilter={state.categoryFilter}
                  inspectedPart={inspectedPart}
                  onExplode={(value) => dispatch({ type: "explode", value })}
                  onCategory={(value) => dispatch({ type: "category", value })}
                />
              ) : null}
            </div>
          )}
        </div>
      </div>

      {confirming ? (
        <ConfirmDiagnosisDialog
          open={confirming}
          onOpenChange={setConfirming}
          ticket={ticket}
          finding={finding}
          catalog={catalog}
          selectedIssueKeys={state.selectedIssueKeys}
          customNote={state.customNote}
          onSaved={onFindingSaved}
        />
      ) : null}
    </>
  );
}

function ModeTab({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof Crosshair;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-sm border px-2.5 text-xs font-medium transition-colors",
        "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        active
          ? "border-bench/45 bg-bench-fill text-bench-ink"
          : "border-rule bg-copy text-ink-soft hover:border-bench/35 hover:text-ink",
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {label}
    </button>
  );
}

/**
 * Which vocabulary the picker is working from.
 *
 * Only offered once a finding exists — before that there is nothing at the
 * bench to choose, and a toggle that leads to an empty answer is worse than
 * no toggle.
 */
function SourceToggle({
  source,
  hasFinding,
  onChange,
}: {
  source: ReturnType<typeof issuesForTicket>["source"];
  hasFinding: boolean;
  onChange: (source: ReturnType<typeof issuesForTicket>["source"]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <ModeTab
        active={source === "defect"}
        icon={Crosshair}
        label="Bench findings"
        onClick={() => onChange("defect")}
      />
      <ModeTab
        active={source === "problem_tag"}
        icon={Scan}
        label="Reported at intake"
        onClick={() => onChange("problem_tag")}
      />
      {!hasFinding ? (
        <Badge variant="outline" className="self-center">
          No findings recorded yet
        </Badge>
      ) : null}
    </div>
  );
}

function SnapshotList({ snapshots }: { snapshots: DiagnosisSnapshot[] }) {
  return (
    <div>
      <p className="label-pad mb-1.5">Saved snapshots</p>
      <ul className="space-y-1.5">
        {snapshots.map((snapshot) => (
          <li
            key={snapshot.id}
            className="flex items-center gap-2 rounded-sm border border-rule px-2 py-1.5"
          >
            {snapshot.imageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element -- a
                 short-TTL signed URL from the API's own storage; next/image
                 would need the host allowlisted and would cache past the TTL. */
              <img
                src={snapshot.imageUrl}
                alt=""
                className="size-9 shrink-0 rounded-xs border border-rule object-cover"
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-ink">
                {snapshot.partKeys.length
                  ? `${snapshot.partKeys.length} part${snapshot.partKeys.length === 1 ? "" : "s"}`
                  : "No parts"}
                {snapshot.capturedByName ? ` · ${snapshot.capturedByName}` : ""}
              </p>
              <p className="truncate text-xs text-ink-faint">
                {formatDateTime(snapshot.createdAt)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
