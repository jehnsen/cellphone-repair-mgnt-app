import { PenLine } from "lucide-react";

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
    <div className="p-4 sm:p-6">
      <div className="max-w-2xl border border-rule bg-copy">
        <div className="flex items-center gap-2 border-b border-rule px-4 py-2">
          <PenLine className="size-3.5 text-ink-faint" aria-hidden />
          <span className="label-pad">Not built yet</span>
          <span className="mono ml-auto text-xs text-ink-faint">STAGE {stage}</span>
        </div>
        <div className="px-4 py-5">
          <h1 className="font-display text-lg font-semibold text-ink">{title}</h1>
          <p className="mt-1 max-w-prose text-sm text-ink-soft">{summary}</p>
          <ul className="mt-4 space-y-1.5">
            {covers.map((line) => (
              <li key={line} className="flex gap-2 text-sm text-ink-soft">
                <span className="mt-[0.4rem] size-1 shrink-0 bg-rule" aria-hidden />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
