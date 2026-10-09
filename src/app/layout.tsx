import type { Metadata, Viewport } from "next";
import { SiteHeader } from "@/components/site/site-header";
import { carlito, notoSerif } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "DineFlow", template: "%s · DineFlow" },
  description: "Order ahead from campus restaurants, then collect when it’s ready.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1a2b" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-KE" className={`${notoSerif.variable} ${carlito.variable}`}>
      <body className="min-h-dvh bg-surface text-ink">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-10 focus:bg-surface focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <SiteHeader />
        <div id="main">{children}</div>
      </body>
    </html>
  );
}
