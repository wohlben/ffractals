import { Handle, type NodeProps, Position } from "@xyflow/react";
import type React from "react";
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

export function RecipeNode({ data, selected }: NodeProps<RecipeNodeData>) {
	const { selectElement } = useCalculator();
	const item = DSPData.getItemById(data.itemId);
	const facility = data.facilityItemId
		? DSPData.getItemById(data.facilityItemId)
		: null;

	const inputHandles = data.inputHandles ?? [];
	const nodeWidth = Math.max(200, inputHandles.length * 48 + 32);

	return (
		<div
			className={cn(
				"relative rounded-lg border-2 bg-gray-800 shadow-lg cursor-pointer",
				selected ? "border-blue-500" : "border-gray-600",
			)}
			style={{ width: nodeWidth }}
			onClick={() => selectElement(data.elementId)}
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
							{data.hasSource ? `⏱️ ${data.cycleDuration}s ` : ""}(
							{data.actualRate.toFixed(2)}/s)
						</div>
					</div>
				</div>

				{(facility && data.facilityCount > 0) || !data.hasSource ? (
					<div className="mt-2 flex items-center gap-1">
						{facility && data.facilityCount > 0 ? (
							<img
								src={getIconPath(facility.Name)}
								alt={facility.Name}
								width={18}
								height={18}
								className="object-contain"
								onError={onImgError}
							/>
						) : !data.hasSource ? (
							<img
								src={"/assets/images/Icon_Interstellar_Logistics_Station.png"}
								alt="Interstellar Logistics Station"
								width={18}
								height={18}
								className="object-contain"
								onError={onImgError}
							/>
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
							>
								{handle.itemName ? (
									<img
										src={getIconPath(handle.itemName)}
										alt={handle.itemName}
										width={24}
										height={24}
										className="object-contain rounded-sm"
										title={`${handle.itemName}${handle.rate > 0 ? `: ${handle.rate.toFixed(2)}/s` : ""}`}
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
