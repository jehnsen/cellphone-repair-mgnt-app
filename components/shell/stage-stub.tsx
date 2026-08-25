import { PenLine } from "lucide-react";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/panel";

/**
 * Placeholder for a screen whose build stage has not landed yet. It states
 * what is coming rather than pretending to be empty.
 */
export function StageStub({
  stage,
  title,
  summary,
  covers,
}: {
  stage: number;
  title: string;
  summary: string;
  covers: string[];
}) {
  return (
    <div className="page">
      <Panel className="max-w-2xl">
        <PanelHeader>
          <PenLine className="size-3.5 text-ink-faint" aria-hidden />
          <PanelTitle className="text-ink-soft">Not built yet</PanelTitle>
          <span className="mono ml-auto text-xs text-ink-faint">STAGE {stage}</span>
        </PanelHeader>
        <PanelBody className="sm:p-5">
          <h1 className="display-md">{title}</h1>
          <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-ink-soft">
            {summary}
          </p>
          <ul className="mt-4 space-y-2">
            {covers.map((line) => (
              <li key={line} className="flex gap-2.5 text-sm text-ink-soft">
                <span
                  className="mt-[0.45rem] size-1 shrink-0 rounded-full bg-rule-strong"
                  aria-hidden
                />
                <span className="leading-relaxed">{line}</span>
              </li>
            ))}
          </ul>
        </PanelBody>
      </Panel>
    </div>
  );
}
