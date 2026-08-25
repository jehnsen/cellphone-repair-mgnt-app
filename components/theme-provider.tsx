"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/** Defaults to the system setting; the strip's toggle overrides per browser. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
