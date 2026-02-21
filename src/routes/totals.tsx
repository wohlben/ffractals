import { createFileRoute } from "@tanstack/react-router";
import { TotalsGraph } from "@/components/graph/TotalsGraph";

export const Route = createFileRoute("/totals")({
	component: TotalsPage,
	ssr: false,
});

function TotalsPage() {
	return (
		<div className="h-full">
			<TotalsGraph />
		</div>
	);
}
