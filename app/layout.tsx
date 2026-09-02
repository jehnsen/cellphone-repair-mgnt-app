import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { ShopProvider } from "@/lib/shop/store";
import { AppShell } from "@/components/shell/app-shell";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

/* Display: headings, figures, and the micro labels. Space Grotesk's flat
   terminals and single-storey `a` read as hardware spec, not as stationery —
   it is what makes the shop look like it sells the devices it repairs. */
const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

/* Body: Inter, for the density this app runs at. */
const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

/* Identifiers and anything printed: IMEI, ticket numbers, thermal receipts. */
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nelson Cellphone & Computer Repair Shop",
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
