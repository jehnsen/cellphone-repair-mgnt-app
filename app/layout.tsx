import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { ShopProvider } from "@/lib/mock/store";
import { AppShell } from "@/components/shell/app-shell";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

/* Display: form labels and column headers. Archivo carries a width axis, so
   dense table headers can narrow without a second family. */
const display = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-display",
  display: "swap",
});

const body = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

/* Identifiers and anything printed: IMEI, ticket numbers, thermal receipts. */
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Job Order — repair shop management",
  description:
    "Repair intake, board, release, inventory, and point of sale for a single-branch phone repair shop.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${display.variable} ${body.variable} ${mono.variable} antialiased`}>
        <ThemeProvider>
          <ShopProvider>
            <TooltipProvider delayDuration={200}>
              <AppShell>{children}</AppShell>
              <Toaster position="bottom-right" />
            </TooltipProvider>
          </ShopProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
