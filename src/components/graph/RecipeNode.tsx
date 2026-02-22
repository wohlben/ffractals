import { Handle, type NodeProps, Position } from "@xyflow/react";
import { useState } from "react";
import { FacilityEditPopover } from "@/components/graph/FacilityEditPopover";
import { RateEditPopover } from "@/components/graph/RateEditPopover";
import { GameIcon } from "@/components/ui/GameIcon";
import { useCalculator } from "@/hooks/use-calculator";
import { DSPData } from "@/lib/data/dsp-data";
import { cn } from "@/lib/utils";

interface InputHandle {
	elementId: string;
	itemId: number;
	itemName: string;
	rate: number;
}

interface RecipeNodeData {
	elementId: string;
	itemId: number;
	itemName: string;
	requiredRate: number;
	actualRate: number;
	facilityItemId: number | null;
	facilityCount: number;
	hasSource: boolean;
	sourceType: string;
	inputHandles: InputHandle[];
	cycleDuration: number;
	perCycleAmount: number;
	canCraft: boolean;
	isRoot: boolean;
	targetId: string | null;
	recipeType: string | null;
}

export function RecipeNode({ data, selected }: NodeProps<RecipeNodeData>) {
	const {
		selectElement,
		updateTargetRate,
		updateRootFacility,
		updateElementFacilityType,
	} = useCalculator();
	const item = DSPData.getItemById(data.itemId);
	const facility = data.facilityItemId
		? DSPData.getItemById(data.facilityItemId)
		: null;

	const [popover, setPopover] = useState<null | "rate" | "facility">(null);

	const inputHandles = data.inputHandles ?? [];
	const nodeWidth = Math.max(200, inputHandles.length * 48 + 32);

	return (
		<div
			className={cn(
				"relative rounded-lg border-2 bg-gray-800 shadow-lg cursor-pointer",
				selected ? "border-blue-500" : "border-gray-600",
			)}
			style={{ width: nodeWidth }}
			onClick={() => {
				if (!popover) selectElement(data.elementId);
			}}
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
							{data.isRoot && data.targetId ? (
								<button
									type="button"
									className="text-xs text-gray-400 hover:text-blue-400 hover:underline"
									onClick={(e) => {
										e.stopPropagation();
										setPopover(popover === "rate" ? null : "rate");
									}}
								>
									{data.hasSource ? `⏱️ ${data.cycleDuration}s ` : ""}(
									{data.actualRate.toFixed(2)}/s)
								</button>
							) : (
								<div className="text-xs text-gray-400">
									{data.hasSource ? `⏱️ ${data.cycleDuration}s ` : ""}(
									{data.actualRate.toFixed(2)}/s)
								</div>
							)}
							{popover === "rate" && data.targetId && (
								<RateEditPopover
									currentRate={data.requiredRate}
									onConfirm={(newRate) => {
										if (data.targetId) updateTargetRate(data.targetId, newRate);
										setPopover(null);
									}}
									onClose={() => setPopover(null)}
								/>
							)}
						</div>
					</div>
				</div>

				{(facility && data.facilityCount > 0) || !data.hasSource ? (
					<div className="mt-2 relative">
						{data.hasSource && data.recipeType ? (
							<button
								type="button"
								className="flex items-center gap-1 hover:bg-gray-700/50 rounded px-1 -mx-1"
								onClick={(e) => {
									e.stopPropagation();
									setPopover(popover === "facility" ? null : "facility");
								}}
							>
								{facility && data.facilityCount > 0 ? (
									<GameIcon name={facility.Name} size={18} />
								) : null}
								{data.facilityCount > 0 && (
									<span className="text-xs text-gray-400">
										×
										{Number.isInteger(data.facilityCount)
											? data.facilityCount
											: data.facilityCount.toFixed(2)}
									</span>
								)}
							</button>
						) : (
							<div className="flex items-center gap-1">
								{facility && data.facilityCount > 0 ? (
									<GameIcon name={facility.Name} size={18} />
								) : !data.hasSource ? (
									<GameIcon name="Interstellar_Logistics_Station" size={18} />
								) : null}
								{data.facilityCount > 0 && (
									<span className="text-xs text-gray-400">
										×
										{Number.isInteger(data.facilityCount)
											? data.facilityCount
											: data.facilityCount.toFixed(2)}
									</span>
								)}
							</div>
						)}
						{popover === "facility" && data.recipeType && (
							<FacilityEditPopover
								recipeType={data.recipeType}
								currentFacilityItemId={data.facilityItemId ?? 0}
								currentCount={data.facilityCount}
								isRoot={data.isRoot && !!data.targetId}
								onConfirm={(facilityItemId, count) => {
									if (data.isRoot && data.targetId) {
										updateRootFacility(data.targetId, facilityItemId, count);
									} else {
										updateElementFacilityType(data.elementId, facilityItemId);
									}
									setPopover(null);
								}}
								onClose={() => setPopover(null)}
							/>
						)}
					</div>
				) : null}

				{!data.hasSource && data.canCraft && (
					<div className="mt-1 text-xs text-gray-400">
						Click to select recipe
					</div>
				)}
			</div>

			{/* Input ingredients strip — icons centered on their handles */}
			{inputHandles.length > 0 && (
				<div
					className="relative border-t border-gray-700"
					style={{ height: 40 }}
				>
					{inputHandles.map((handle, i) => {
						const leftPercent = ((i + 1) / (inputHandles.length + 1)) * 100;
						return (
							<div
								key={handle.elementId}
								style={{
									position: "absolute",
									left: `${leftPercent}%`,
									top: "50%",
									transform: "translate(-50%, -50%)",
									pointerEvents: "none",
								}}
								title={`${handle.itemName}${handle.rate > 0 ? `: ${handle.rate.toFixed(2)}/s` : ""}`}
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
								key={`h-${handle.elementId}`}
								type="target"
								position={Position.Bottom}
								id={`input-${handle.elementId}`}
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
