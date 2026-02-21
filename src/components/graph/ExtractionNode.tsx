import { Handle, type NodeProps, Position } from "@xyflow/react";
import type React from "react";
import { DSPData } from "@/lib/data/dsp-data";
import { cn } from "@/lib/utils";

function onImgError(e: React.SyntheticEvent<HTMLImageElement>) {
	const img = e.target as HTMLImageElement;
	if (!img.dataset.retried) {
		img.dataset.retried = "1";
		const src = img.src;
		img.src = "";
		img.src = src;
	}
}

interface ExtractionNodeData {
	elementId: string;
	itemId: number;
	itemName: string;
	requiredRate: number;
	actualRate: number;
	facilityCount: number;
	cycleDuration: number;
	perCycleAmount: number;
}

export function ExtractionNode({
	data,
	selected,
}: NodeProps<ExtractionNodeData>) {
	const item = DSPData.getItemById(data.itemId);

	const getIconPath = (itemName: string) =>
		`/assets/images/Icon_${itemName.replace(/ /g, "_")}.png`;

	return (
		<div
			className={cn(
				"rounded-lg border-2 bg-blue-900/30 p-3 shadow-lg w-[180px]",
				selected ? "border-blue-500" : "border-blue-700",
			)}
		>
			{/* Output handle — top center */}
			<Handle
				type="source"
				position={Position.Top}
				id="output"
				className="w-3 h-3"
			/>

			<div className="flex items-center gap-2">
				{item && (
					<img
						src={getIconPath(item.Name)}
						alt={item.Name}
						width={32}
						height={32}
						className="object-contain"
						onError={onImgError}
					/>
				)}
				<div className="flex-1 min-w-0">
					<div className="font-medium text-sm text-gray-100 truncate">
						{data.itemName}
					</div>
					<div className="text-xs text-blue-400">Extraction</div>
				</div>
			</div>

			<div className="mt-2 text-xs text-gray-400 space-y-1">
				<div>
					⏱️ {data.cycleDuration}s ({data.actualRate.toFixed(2)}/s)
				</div>
				{data.facilityCount > 0 && (
					<div>
						×
						{Number.isInteger(data.facilityCount)
							? data.facilityCount
							: data.facilityCount.toFixed(2)}{" "}
						collectors
					</div>
				)}
			</div>
		</div>
	);
}
