import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiURL = process.env.E2E_API_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": apiURL,
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./tests/setup.ts",
    include: ["tests/lab-02/**/*.test.tsx", "tests/lab-03/**/*.test.tsx"],
  },
});
