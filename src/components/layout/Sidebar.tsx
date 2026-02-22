import { Link, useLocation } from "@tanstack/react-router";
import { useState } from "react";
import { GameIcon } from "@/components/ui/GameIcon";
import {
	useCalculator,
	useFacilitySummary,
	useResourceNeeds,
} from "@/hooks/use-calculator";
import { DSPData } from "@/lib/data/dsp-data";

export function Sidebar() {
	const {
		targets,
		addTarget,
		getPerFacilityRate,
		removeTarget,
		clearTotalsNodePositions,
	} = useCalculator();
	const resourceNeeds = useResourceNeeds();
	const facilitySummary = useFacilitySummary();
	const location = useLocation();

	const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
	const [facilityCount, setFacilityCount] = useState(1);

	return (
		<aside className="w-80 border-r border-gray-700 bg-gray-900 flex flex-col h-screen">
			<div className="p-4 border-b border-gray-700">
				<h2 className="font-semibold text-gray-100">Production Targets</h2>
				<div className="mt-2 flex gap-1">
					<Link
						to="/calculator"
						className="px-3 py-1 text-xs rounded"
						activeProps={{
							className: "px-3 py-1 text-xs rounded bg-blue-600 text-white",
						}}
						inactiveProps={{
							className:
								"px-3 py-1 text-xs rounded bg-gray-800 text-gray-400 hover:text-gray-200",
						}}
					>
						Tree View
					</Link>
					<Link
						to="/totals"
						className="px-3 py-1 text-xs rounded"
						activeProps={{
							className: "px-3 py-1 text-xs rounded bg-amber-600 text-white",
						}}
						inactiveProps={{
							className:
								"px-3 py-1 text-xs rounded bg-gray-800 text-gray-400 hover:text-gray-200",
						}}
					>
						Totals View
					</Link>
					{location.pathname === "/totals" && (
						<button
							type="button"
							onClick={clearTotalsNodePositions}
							className="px-3 py-1 text-xs rounded bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700"
						>
							Recalculate
						</button>
					)}
				</div>
			</div>

			<div className="p-4 border-b border-gray-700 space-y-2">
				<select
					value={selectedItemId ?? ""}
					onChange={(e) => {
						const value = e.target.value;
						setSelectedItemId(Number(value) || null);
					}}
					className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-100"
				>
					<option value="">Select item...</option>
					{DSPData.items
						.filter(
							(item) =>
								DSPData.getRecipesProducing(item.ID).length > 0 ||
								DSPData.canItemBeMined(item.ID) ||
								DSPData.canItemBeExtracted(item.ID),
						)
						.sort((a, b) => a.Name.localeCompare(b.Name))
						.map((item) => (
							<option key={item.ID} value={item.ID}>
								{item.Name}
							</option>
						))}
				</select>

				<div className="flex gap-2 items-center">
					<span className="text-gray-400 text-sm">x</span>
					<input
						type="number"
						value={facilityCount}
						onChange={(e) => setFacilityCount(Number(e.target.value))}
						min={0.1}
						step={0.1}
						className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-100"
					/>
					<button
						type="button"
						onClick={() => {
							if (selectedItemId) {
								const rate = getPerFacilityRate(selectedItemId);
								addTarget(selectedItemId, rate * facilityCount);
								setSelectedItemId(null);
								setFacilityCount(1);
							}
						}}
						disabled={!selectedItemId}
						className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-700 disabled:text-gray-500"
					>
						Add
					</button>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto p-4 space-y-2">
				{targets.map((target) => {
					const item = DSPData.getItemById(target.itemId);
					return (
						<div
							key={target.id}
							className="flex items-center gap-2 p-2 rounded-lg border border-gray-700 bg-gray-800"
						>
							{item && <GameIcon name={item.Name} size={24} />}
							<div className="flex-1 min-w-0">
								<div className="font-medium text-sm text-gray-100 truncate">
									{item?.Name}
								</div>
								<div className="text-xs text-gray-400">
									{target.targetRate.toFixed(3)}/s
								</div>
							</div>
							<button
								type="button"
								onClick={() => removeTarget(target.id)}
								className="text-gray-400 hover:text-red-400"
							>
								✕
							</button>
						</div>
					);
				})}
			</div>

			<div className="p-4 border-t border-gray-700 max-h-48 overflow-y-auto">
				<h3 className="font-medium text-gray-100 mb-2">Resources</h3>

				{resourceNeeds.mined.size > 0 && (
					<div className="mb-2">
						<div className="text-xs text-gray-400 mb-1">Mining</div>
						{Array.from(resourceNeeds.mined.entries()).map(([itemId, rate]) => {
							const item = DSPData.getItemById(itemId);
							return (
								<div
									key={itemId}
									className="flex justify-between text-sm text-gray-300"
								>
									<span>{item?.Name}</span>
									<span>{rate.toFixed(2)}/s</span>
								</div>
							);
						})}
					</div>
				)}

				{resourceNeeds.extracted.size > 0 && (
					<div>
						<div className="text-xs text-gray-400 mb-1">Extraction</div>
						{Array.from(resourceNeeds.extracted.entries()).map(
							([itemId, rate]) => {
								const item = DSPData.getItemById(itemId);
								return (
									<div
										key={itemId}
										className="flex justify-between text-sm text-gray-300"
									>
										<span>{item?.Name}</span>
										<span>{rate.toFixed(2)}/s</span>
									</div>
								);
							},
						)}
					</div>
				)}

				{facilitySummary.length > 0 && (
					<div className="mt-2">
						<div className="text-xs text-gray-400 mb-1">Facilities</div>
						{facilitySummary.map(({ itemId, count }) => {
							const item = DSPData.getItemById(itemId);
							return (
								<div
									key={itemId}
									className="flex justify-between text-sm text-gray-300"
								>
									<span>{item?.Name}</span>
									<span>
										x{Number.isInteger(count) ? count : count.toFixed(2)}
									</span>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</aside>
	);
}
