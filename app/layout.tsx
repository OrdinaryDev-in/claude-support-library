import type { Metadata } from "next";
import { Fraunces, Inter, IBM_Plex_Mono } from "next/font/google";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-fraunces",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

const TITLE = "DevAtlas — The Library";
const DESCRIPTION =
  "Structured, elaborate prompt templates and reference material for building fast and correctly.";

export const metadata: Metadata = {
  // Absolute URLs (og:image, canonical links, etc.) resolve against this —
  // without it Next can only guess from the deploy environment. See
  // lib/site.ts for how SITE_URL is derived.
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: "%s — DevAtlas" },
  description: DESCRIPTION,
  // No explicit `images` — Next's file-convention detection picks up
  // app/opengraph-image.tsx automatically for both openGraph and
  // (via the twitter block below) the Twitter card.
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "DevAtlas",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} ${plexMono.variable} h-full`}
      style={{
        // next/font variables feed the design tokens defined in globals.css
        ["--font-display" as string]: "var(--font-fraunces), Georgia, serif",
        ["--font-body" as string]: "var(--font-inter), system-ui, sans-serif",
        ["--font-mono" as string]: "var(--font-plex-mono), ui-monospace, monospace",
      }}
    >
      <body className="min-h-full flex flex-col font-[family-name:var(--font-body)] antialiased">
        {children}
      </body>
    </html>
  );
}
