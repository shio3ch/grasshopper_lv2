import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  site: "https://grasshopper-lv2.shio3ch.workers.dev",
  integrations: [sitemap()],
});
