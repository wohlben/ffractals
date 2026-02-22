import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import { useState } from "react";
import { RateEditPopover } from "@/components/graph/RateEditPopover";
import { GameIcon } from "@/components/ui/GameIcon";
import { useCalculator } from "@/hooks/use-calculator";
import { DSPData } from "@/lib/data/dsp-data";
import { cn } from "@/lib/utils";

interface MiningNodeData extends Record<string, unknown> {
	elementId: string;
	itemId: number;
	itemName: string;
	requiredRate: number;
	actualRate: number;
	facilityCount: number;
	cycleDuration: number;
	perCycleAmount: number;
	isRoot: boolean;
	targetId: string | null;
}

type MiningNode = Node<MiningNodeData, "mining">;

export function MiningNode({ data, selected }: NodeProps<MiningNode>) {
	const { updateTargetRate } = useCalculator();
	const item = DSPData.getItemById(data.itemId);
	const [showRate, setShowRate] = useState(false);

	return (
		<div
			className={cn(
				"rounded-lg border-2 bg-green-900/30 p-3 shadow-lg w-[180px]",
				selected ? "border-green-500" : "border-green-700",
			)}
		>
			{/* Output handle — top center */}
			{/* biome-ignore lint/correctness/useUniqueElementIds: React Flow handle identifier */}
			<Handle
				type="source"
				position={Position.Top}
				id="output"
				className="w-3 h-3"
			/>

			<div className="flex items-center gap-2">
				{item && <GameIcon name={item.Name} size={32} />}
				<div className="flex-1 min-w-0">
					<div className="font-medium text-sm text-gray-100 truncate">
						{data.itemName}
					</div>
					<div className="text-xs text-green-400">Mining</div>
				</div>
			</div>

			<div className="mt-2 text-xs text-gray-400 space-y-1">
				<div className="relative">
					{data.isRoot && data.targetId ? (
						<button
							type="button"
							className="hover:text-blue-400 hover:underline"
							onClick={(e) => {
								e.stopPropagation();
								setShowRate(!showRate);
							}}
						>
							⏱️ {data.cycleDuration}s ({data.actualRate.toFixed(2)}/s)
						</button>
					) : (
						<span>
							⏱️ {data.cycleDuration}s ({data.actualRate.toFixed(2)}/s)
						</span>
					)}
					{showRate && data.targetId && (
						<RateEditPopover
							currentRate={data.requiredRate}
							onConfirm={(newRate) => {
								if (data.targetId) updateTargetRate(data.targetId, newRate);
								setShowRate(false);
							}}
							onClose={() => setShowRate(false)}
						/>
					)}
				</div>
				{data.facilityCount > 0 && (
					<div>
						×
						{Number.isInteger(data.facilityCount)
							? data.facilityCount
							: data.facilityCount.toFixed(2)}{" "}
						veins
					</div>
				)}
			</div>
		</div>
	);
}
