import type React from "react";
import {
	HeadContent,
	Outlet,
	Scripts,
	createRootRoute,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { Sidebar } from "@/components/layout/Sidebar";
import { RecipeSelector } from "@/components/modals/RecipeSelector";
import { useCalculator } from "@/hooks/use-calculator";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "DSP Production Calculator" },
		],
		links: [{ rel: "stylesheet", href: appCss }],
	}),
	shellComponent: ShellComponent,
	component: RootComponent,
});

function ShellComponent({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				{children}
				<Scripts />
			</body>
		</html>
	);
}

function RootComponent() {
	const { selectedElementId, selectElement } = useCalculator();

	return (
		<div className="flex h-screen bg-gray-950">
			<Sidebar />
			<main className="flex-1 relative">
				<Outlet />
				<RecipeSelector
					elementId={selectedElementId}
					onClose={() => selectElement(null)}
				/>
				<TanStackRouterDevtools position="bottom-right" />
			</main>
		</div>
	);
}
