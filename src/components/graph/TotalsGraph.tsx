import {
	Background,
	Controls,
	MiniMap,
	ReactFlow,
	useEdgesState,
	useNodesState,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo } from "react";
import "@xyflow/react/dist/style.css";

import { useCalculator } from "@/hooks/use-calculator";
import { buildTotalsGraphFromState } from "@/lib/graph/totals-builder";
import { FlowEdge } from "./FlowEdge";
import { TotalsNode } from "./TotalsNode";

const nodeTypes = {
	totals: TotalsNode,
};

const edgeTypes = {
	flow: FlowEdge,
};

export function TotalsGraph() {
	const { targets, elements, updateTotalsNodePosition, totalsNodePositions } =
		useCalculator();

	const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
		const graph = buildTotalsGraphFromState(targets, elements);

		// Apply saved positions
		for (const node of graph.nodes) {
			const itemId = Number(node.id.replace("totals-", ""));
			const saved = totalsNodePositions.find((np) => np.itemId === itemId);
			if (saved) {
				node.position = { x: saved.x, y: saved.y };
			}
		}

		return graph;
	}, [targets, elements, totalsNodePositions]);

	const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
	const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

	useEffect(() => {
		const graph = buildTotalsGraphFromState(targets, elements);

		// Apply saved positions
		for (const node of graph.nodes) {
			const itemId = Number(node.id.replace("totals-", ""));
			const saved = totalsNodePositions.find((np) => np.itemId === itemId);
			if (saved) {
				node.position = { x: saved.x, y: saved.y };
			}
		}

		setNodes(graph.nodes);
		setEdges(graph.edges);
	}, [targets, elements, totalsNodePositions, setNodes, setEdges]);

	const onNodeDragStop = useCallback(
		(_: unknown, node: { id: string; position: { x: number; y: number } }) => {
			const itemId = Number(node.id.replace("totals-", ""));
			updateTotalsNodePosition(itemId, node.position.x, node.position.y);
		},
		[updateTotalsNodePosition],
	);

	return (
		<div className="h-full w-full">
			<ReactFlow
				nodes={nodes}
				edges={edges}
				onNodesChange={onNodesChange}
				onEdgesChange={onEdgesChange}
				onNodeDragStop={onNodeDragStop}
				nodeTypes={nodeTypes}
				edgeTypes={edgeTypes}
				fitView
				attributionPosition="bottom-right"
			>
				<Background />
				<Controls />
				<MiniMap />
			</ReactFlow>
		</div>
	);
}
