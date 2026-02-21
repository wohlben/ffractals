import { Handle, type NodeProps, Position } from "@xyflow/react";
import type React from "react";
import { DSPData } from "@/lib/data/dsp-data";
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
}

const getIconPath = (name: string) =>
	`/assets/images/Icon_${name.replace(/ /g, "_")}.png`;

function onImgError(e: React.SyntheticEvent<HTMLImageElement>) {
	const img = e.target as HTMLImageElement;
	if (!img.dataset.retried) {
		img.dataset.retried = "1";
		const src = img.src;
		img.src = "";
		img.src = src;
	}
}

export function TotalsNode({ data, selected }: NodeProps<TotalsNodeData>) {
	const item = DSPData.getItemById(data.itemId);
	const inputHandles = data.inputHandles ?? [];
	const nodeWidth = Math.max(220, inputHandles.length * 48 + 32);

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
						<div className="text-xs text-gray-400">
							{data.actualRate.toFixed(2)}/s
						</div>
					</div>
				</div>

				{/* Facilities */}
				{data.facilities.length > 0 && (
					<div className="mt-2 flex flex-wrap items-center gap-2">
						{data.facilities.map((fac) => {
							const facItem = DSPData.getItemById(fac.itemId);
							return (
								<div key={fac.itemId} className="flex items-center gap-1">
									{facItem && (
										<img
											src={getIconPath(facItem.Name)}
											alt={facItem.Name}
											width={18}
											height={18}
											className="object-contain"
											onError={onImgError}
										/>
									)}
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
							>
								{handle.itemName ? (
									<img
										src={getIconPath(handle.itemName)}
										alt={handle.itemName}
										width={24}
										height={24}
										className="object-contain rounded-sm"
										title={handle.itemName}
										onError={onImgError}
									/>
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
