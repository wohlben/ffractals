import { createFileRoute } from "@tanstack/react-router";
import { CalculatorGraph } from "@/components/graph/CalculatorGraph";

export const Route = createFileRoute("/calculator")({
	component: CalculatorPage,
	ssr: false,
});

function CalculatorPage() {
	return (
		<div className="h-full">
			<CalculatorGraph />
		</div>
	);
}
