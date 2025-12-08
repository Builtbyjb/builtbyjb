// @ts-check
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
  markdown: {
    shikiConfig: {
      theme: "catppuccin-latte",
      // themes: {
      //   light: "github-light",
      //   dark: "github-dark",
      // },
    },
  },
});
