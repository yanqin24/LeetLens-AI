import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const fromRoot = (path: string) => decodeURIComponent(new URL(path, import.meta.url).pathname);

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        popup: fromRoot("popup.html"),
        dashboard: fromRoot("dashboard.html"),
        background: fromRoot("src/background/serviceWorker.ts"),
        pageNetworkBridge: fromRoot("src/content/pageNetworkBridge.ts"),
        contentScript: fromRoot("src/content/leetcodeContentScript.ts")
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (
            chunkInfo.name === "background" ||
            chunkInfo.name === "contentScript" ||
            chunkInfo.name === "pageNetworkBridge"
          ) {
            return "[name].js";
          }

          return "assets/[name]-[hash].js";
        },
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]"
      }
    }
  }
});
