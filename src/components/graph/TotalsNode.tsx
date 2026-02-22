import { Handle, type NodeProps, Position } from "@xyflow/react";
import { useState } from "react";
import { FacilityEditPopover } from "@/components/graph/FacilityEditPopover";
import { RateEditPopover } from "@/components/graph/RateEditPopover";
import { GameIcon } from "@/components/ui/GameIcon";
import { useCalculator } from "@/hooks/use-calculator";
import { DSPData } from "@/lib/data/dsp-data";
import { calculatorStore } from "@/lib/stores/calculator-store";
import { cn } from "@/lib/utils";

interface InputHandle {
	itemId: number;
	itemName: string;
}

interface FacilityEntry {
	itemId: number;
	count: number;
	name: string;
}

interface TotalsNodeData {
	itemId: number;
	itemName: string;
	requiredRate: number;
	actualRate: number;
	facilities: FacilityEntry[];
	sourceTypes: string[];
	elementCount: number;
	inputHandles: InputHandle[];
	isRoot: boolean;
	targetIds: string[];
	recipeType: string | null;
}

export function TotalsNode({ data, selected }: NodeProps<TotalsNodeData>) {
	const { updateTargetRate, updateRootFacility } = useCalculator();
	const item = DSPData.getItemById(data.itemId);
	const inputHandles = data.inputHandles ?? [];
	const nodeWidth = Math.max(220, inputHandles.length * 48 + 32);

	const [popover, setPopover] = useState<null | "rate" | "facility">(null);

	const isEditable = data.isRoot && data.targetIds.length > 0;

	function handleRateConfirm(newRate: number) {
		if (data.targetIds.length === 1) {
			updateTargetRate(data.targetIds[0], newRate);
		} else if (data.targetIds.length > 1 && data.requiredRate > 0) {
			const factor = newRate / data.requiredRate;
			const { targets } = calculatorStore.state;
			for (const targetId of data.targetIds) {
				const target = targets.find((t) => t.id === targetId);
				if (target) {
					updateTargetRate(targetId, target.targetRate * factor);
				}
			}
		}
		setPopover(null);
	}

	function handleFacilityConfirm(facilityItemId: number, count?: number) {
		for (const targetId of data.targetIds) {
			updateRootFacility(targetId, facilityItemId, count);
		}
		setPopover(null);
	}

	return (
		<div
			className={cn(
				"relative rounded-lg border-2 bg-gray-800 shadow-lg",
				selected ? "border-amber-400" : "border-amber-600/50",
			)}
			style={{ width: nodeWidth }}
		>
			{/* Output handle — top center */}
			<Handle
				type="source"
				position={Position.Top}
				id="output"
				className="w-3 h-3"
			/>

			{/* Node body */}
			<div className="p-3">
				<div className="flex items-center gap-2">
					{item && <GameIcon name={item.Name} size={32} />}
					<div className="flex-1 min-w-0">
						<div className="font-medium text-sm text-gray-100 truncate">
							{data.itemName}
						</div>
						<div className="relative">
							{isEditable ? (
								<button
									type="button"
									className="text-xs text-gray-400 hover:text-blue-400 hover:underline"
									onClick={(e) => {
										e.stopPropagation();
										setPopover(popover === "rate" ? null : "rate");
									}}
								>
									{data.actualRate.toFixed(2)}/s
								</button>
							) : (
								<div className="text-xs text-gray-400">
									{data.actualRate.toFixed(2)}/s
								</div>
							)}
							{popover === "rate" && (
								<RateEditPopover
									currentRate={data.requiredRate}
									onConfirm={handleRateConfirm}
									onClose={() => setPopover(null)}
								/>
							)}
						</div>
					</div>
				</div>

				{/* Facilities */}
				{data.facilities.length > 0 && (
					<div className="mt-2 relative">
						{isEditable && data.recipeType ? (
							<button
								type="button"
								className="flex flex-wrap items-center gap-2 hover:bg-gray-700/50 rounded px-1 -mx-1"
								onClick={(e) => {
									e.stopPropagation();
									setPopover(popover === "facility" ? null : "facility");
								}}
							>
								{data.facilities.map((fac) => {
									const facItem = DSPData.getItemById(fac.itemId);
									return (
										<div key={fac.itemId} className="flex items-center gap-1">
											{facItem && <GameIcon name={facItem.Name} size={18} />}
											<span className="text-xs text-gray-400">
												x
												{Number.isInteger(fac.count)
													? fac.count
													: fac.count.toFixed(2)}
											</span>
										</div>
									);
								})}
							</button>
						) : (
							<div className="flex flex-wrap items-center gap-2">
								{data.facilities.map((fac) => {
									const facItem = DSPData.getItemById(fac.itemId);
									return (
										<div key={fac.itemId} className="flex items-center gap-1">
											{facItem && <GameIcon name={facItem.Name} size={18} />}
											<span className="text-xs text-gray-400">
												x
												{Number.isInteger(fac.count)
													? fac.count
													: fac.count.toFixed(2)}
											</span>
										</div>
									);
								})}
							</div>
						)}
						{popover === "facility" && data.recipeType && (
							<FacilityEditPopover
								recipeType={data.recipeType}
								currentFacilityItemId={data.facilities[0]?.itemId ?? 0}
								currentCount={data.facilities.reduce(
									(sum, f) => sum + f.count,
									0,
								)}
								isRoot={true}
								onConfirm={handleFacilityConfirm}
								onClose={() => setPopover(null)}
							/>
						)}
					</div>
				)}

				{/* Merged count badge */}
				{data.elementCount > 1 && (
					<div className="mt-1 text-xs text-amber-500/70">
						{data.elementCount} nodes merged
					</div>
				)}
			</div>

			{/* Input ingredients strip */}
			{inputHandles.length > 0 && (
				<div
					className="relative border-t border-gray-700"
					style={{ height: 40 }}
				>
					{inputHandles.map((handle, i) => {
						const leftPercent = ((i + 1) / (inputHandles.length + 1)) * 100;
						return (
							<div
								key={handle.itemId}
								style={{
									position: "absolute",
									left: `${leftPercent}%`,
									top: "50%",
									transform: "translate(-50%, -50%)",
									pointerEvents: "none",
								}}
								title={handle.itemName}
							>
								{handle.itemName ? (
									<GameIcon name={handle.itemName} size={24} />
								) : (
									<div className="w-4 h-4 rounded-full bg-gray-600" />
								)}
							</div>
						);
					})}

					{/* Per-ingredient target handles on bottom edge */}
					{inputHandles.map((handle, i) => {
						const leftPercent = ((i + 1) / (inputHandles.length + 1)) * 100;
						return (
							<Handle
								key={`h-item-${handle.itemId}`}
								type="target"
								position={Position.Bottom}
								id={`input-item-${handle.itemId}`}
								style={{ left: `${leftPercent}%` }}
								className="w-3 h-3"
							/>
						);
					})}
				</div>
			)}
		</div>
	);
}
