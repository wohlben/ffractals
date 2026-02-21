import { createFileRoute, Link } from "@tanstack/react-router";
import { useCalculator } from "@/hooks/use-calculator";

export const Route = createFileRoute("/")({
	component: HomePage,
});

function HomePage() {
	const { targets, addTarget } = useCalculator();

	return (
		<div className="h-full flex items-center justify-center p-8">
			<div className="text-center max-w-2xl">
				<h1 className="text-4xl font-bold text-gray-100 mb-4">
					DSP Production Calculator
				</h1>

				<p className="text-lg text-gray-400 mb-8">
					Plan your production chains for Dyson Sphere Program. Visualize
					recipes, calculate resource requirements, and optimize your factory
					layout.
				</p>

				{targets.length > 0 ? (
					<div className="space-y-4">
						<Link
							to="/calculator"
							className="inline-block px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
						>
							Open Calculator
						</Link>

						<div className="text-gray-400">
							You have {targets.length} production target
							{targets.length !== 1 ? "s" : ""} configured
						</div>
					</div>
				) : (
					<div className="space-y-4">
						<button
							onClick={() => {
								// Add a default target - Iron Ingot
								addTarget(1101, 1);
							}}
							className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
						>
							Get Started
						</button>

						<p className="text-sm text-gray-500">
							Start with Iron Ingot production
						</p>
					</div>
				)}

				<div className="mt-12 grid grid-cols-3 gap-4 text-sm text-gray-500">
					<div className="p-4 bg-gray-900 rounded-lg">
						<div className="text-2xl mb-2">📊</div>
						<div className="font-medium text-gray-300">Graph Visualization</div>
						<div>Interactive production chains</div>
					</div>

					<div className="p-4 bg-gray-900 rounded-lg">
						<div className="text-2xl mb-2">⚡</div>
						<div className="font-medium text-gray-300">Rate Calculations</div>
						<div>Items per second precision</div>
					</div>

					<div className="p-4 bg-gray-900 rounded-lg">
						<div className="text-2xl mb-2">🏭</div>
						<div className="font-medium text-gray-300">Facility Planning</div>
						<div>Building counts & types</div>
					</div>
				</div>
			</div>
		</div>
	);
}
