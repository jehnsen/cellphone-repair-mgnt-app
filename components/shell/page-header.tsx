import { cn } from "@/lib/utils";

/**
 * A ruled caption, not a hero. Screens that carry a tag head (ticket detail,
 * release) skip this entirely — the tag is their title.
 */
export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
  className,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-rule pb-2.5",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? <p className="label-pad">{eyebrow}</p> : null}
        <h1 className="display-md mt-0.5 truncate">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink-soft">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">{actions}</div>
      ) : null}
    </div>
  );
}
