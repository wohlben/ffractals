import {
	BaseEdge,
	EdgeLabelRenderer,
	type EdgeProps,
	getBezierPath,
} from "@xyflow/react";

// Controls how the rate value is displayed on edges.
// "number" = plain numeric value (default), "rate" = value with /s suffix.
type EdgeDisplayMode = "number" | "rate";

const EDGE_DISPLAY_MODE: EdgeDisplayMode = "number";

function formatEdgeLabel(rate: number, mode: EdgeDisplayMode): string {
	if (mode === "rate") return `${rate.toFixed(2)}/s`;
	return rate.toFixed(2);
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
}: EdgeProps<FlowEdgeData>) {
	const [edgePath, labelX, labelY] = getBezierPath({
		sourceX,
		sourceY,
		sourcePosition,
		targetX,
		targetY,
		targetPosition,
	});

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
						padding: "2px 6px",
						borderRadius: "4px",
						fontSize: "11px",
						color: "#9ca3af",
						pointerEvents: "none",
					}}
					className="nodrag nopan"
				>
					{data?.itemsPerCycle > 0
						? data.itemsPerCycle
						: formatEdgeLabel(data?.rate ?? 0, EDGE_DISPLAY_MODE)}
				</div>
			</EdgeLabelRenderer>
		</>
	);
}
