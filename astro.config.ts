import { defineConfig, fontProviders } from "astro/config";

// Set SITE_BASE (e.g. "/my-website") when deploying under a sub-path such as GitHub project pages.
const base = (process.env.SITE_BASE ?? "/").replace(/\/+$/, "") || "/";

export default defineConfig({
  output: "static",
  site: process.env.SITE_URL ?? "https://example.com",
  base,
  build: { inlineStylesheets: "auto" },
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: "Space Grotesk",
      cssVariable: "--font-sans",
      weights: ["300 700"],
      styles: ["normal"],
      subsets: ["latin"],
      fallbacks: ["system-ui", "Segoe UI", "Arial", "sans-serif"],
    },
    {
      provider: fontProviders.fontsource(),
      name: "Pixelify Sans",
      cssVariable: "--font-pixel",
      weights: ["400 700"],
      styles: ["normal"],
      subsets: ["latin"],
      fallbacks: ["ui-monospace", "Menlo", "monospace"],
    },
    {
      provider: fontProviders.fontsource(),
      name: "DM Mono",
      cssVariable: "--font-mono",
      weights: ["400"],
      styles: ["normal"],
      subsets: ["latin"],
      fallbacks: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
    },
  ],
});
