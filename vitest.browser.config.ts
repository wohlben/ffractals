import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import viteReact from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
	plugins: [tsconfigPaths({ projects: ["./tsconfig.json"] }), viteReact()],
	test: {
		name: "browser",
		include: ["src/**/*.test.tsx"],
		exclude: ["node_modules", "agent-browser", ".opencode"],
		browser: {
			enabled: true,
			provider: playwright(),
			instances: [{ browser: "chromium" }],
		},
	},
});
