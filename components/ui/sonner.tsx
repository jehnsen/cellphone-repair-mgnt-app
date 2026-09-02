"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

/**
 * Toasts, colour-coded on the shop palette.
 *
 * `richColors` is what makes sonner tint a toast by type at all; without it
 * every `toast.success` renders in the same neutral popover as an error, and
 * the only difference is the icon. The stock rich palette is sonner's own
 * green/red/amber, so each `--*-bg/border/text` below is re-pointed at a shop
 * token — a confirmation reads as `--go`, a failure as `--stamp`, and both
 * follow the theme instead of sitting outside it.
 *
 * Green against red is the one pairing colour-blind users cannot separate, so
 * type is never carried by hue alone: every variant also has its own icon
 * shape (a circle, an octagon, a triangle), which is why the `icons` map is
 * spelled out rather than left to the defaults.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      richColors
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",

          "--success-bg": "var(--go-fill)",
          "--success-text": "var(--go-ink)",
          "--success-border": "color-mix(in oklab, var(--go) 45%, transparent)",

          "--error-bg": "var(--stamp-fill)",
          "--error-text": "var(--stamp-ink)",
          "--error-border": "color-mix(in oklab, var(--stamp) 45%, transparent)",

          "--warning-bg": "var(--flag-fill)",
          "--warning-text": "var(--flag-ink)",
          "--warning-border": "color-mix(in oklab, var(--flag) 45%, transparent)",

          "--info-bg": "var(--bench-fill)",
          "--info-text": "var(--bench-ink)",
          "--info-border": "color-mix(in oklab, var(--bench) 45%, transparent)",

          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          /* The description is the server's own message; it has to stay
             readable against a tinted ground rather than inheriting the
             variant's saturated text colour. */
          description: "!text-ink-soft",
          toast: "shadow-float",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
