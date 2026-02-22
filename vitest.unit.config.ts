import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
	plugins: [tsconfigPaths({ projects: ["./tsconfig.json"] })],
	test: {
		name: "unit",
		include: ["src/**/*.test.ts"],
		exclude: ["node_modules", "agent-browser", ".opencode"],
		globals: true,
	},
});
