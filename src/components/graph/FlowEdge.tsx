import {
	BaseEdge,
	EdgeLabelRenderer,
	type EdgeProps,
	getBezierPath,
} from "@xyflow/react";
import { GameIcon } from "@/components/ui/GameIcon";
import { DSPData } from "@/lib/data/dsp-data";

const BELT_TIERS = [
	{ itemId: 2001, speed: 6, name: "Conveyor Belt Mk.I" },
	{ itemId: 2002, speed: 12, name: "Conveyor Belt Mk.II" },
	{ itemId: 2003, speed: 30, name: "Conveyor Belt Mk.III" },
] as const;

function getBeltRequirement(rate: number): { name: string; count: number } {
	// Find the cheapest belt tier that can handle the rate with a single belt,
	// otherwise use the best tier and show how many are needed
	for (const belt of BELT_TIERS) {
		if (rate <= belt.speed) {
			return { name: belt.name, count: 1 };
		}
	}
	const best = BELT_TIERS[BELT_TIERS.length - 1];
	return { name: best.name, count: Math.ceil(rate / best.speed) };
}

interface FlowEdgeData {
	rate: number;
	itemId: number;
	itemsPerCycle: number;
}

export function FlowEdge({
	id,
	sourceX,
	sourceY,
	sourcePosition,
	targetX,
	targetY,
	targetPosition,
	data,
}: EdgeProps) {
	const typedData = data as FlowEdgeData | undefined;

	const [edgePath, labelX, labelY] = getBezierPath({
		sourceX,
		sourceY,
		sourcePosition,
		targetX,
		targetY,
		targetPosition,
	});

	const rate = typedData?.rate ?? 0;
	const itemId = typedData?.itemId ?? 0;
	const itemsPerCycle = typedData?.itemsPerCycle ?? 0;
	const item = itemId ? DSPData.getItemById(itemId) : null;
	const belt = rate > 0 ? getBeltRequirement(rate) : null;

	return (
		<>
			<BaseEdge
				id={id}
				path={edgePath}
				style={{ stroke: "#6b7280", strokeWidth: 2 }}
			/>
			<EdgeLabelRenderer>
				<div
					style={{
						position: "absolute",
						transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
						background: "#1f2937",
						padding: "4px 8px",
						borderRadius: "6px",
						fontSize: "11px",
						color: "#9ca3af",
						pointerEvents: "none",
						border: "1px solid #374151",
					}}
					className="nodrag nopan"
				>
					<div
						style={{
							display: "grid",
							gridTemplateColumns: "auto 16px auto",
							alignItems: "center",
							gap: "2px 4px",
						}}
					>
						{/* Row 1: [icon] count */}
						{item && (
							<>
								<span />
								<GameIcon name={item.Name} size={16} />
								<span className="text-gray-300">
									{itemsPerCycle > 0
										? Number.isInteger(itemsPerCycle)
											? itemsPerCycle
											: itemsPerCycle.toFixed(2)
										: ""}
								</span>
							</>
						)}

						{/* Row 2: belt count + belt icon + rate/s */}
						{belt && (
							<>
								<span className="text-gray-300 text-right">
									{belt.count > 1 ? `${belt.count}x` : ""}
								</span>
								<GameIcon name={belt.name} size={16} />
								<span className="text-gray-400">{rate.toFixed(2)}/s</span>
							</>
						)}
					</div>
				</div>
			</EdgeLabelRenderer>
		</>
	);
}
