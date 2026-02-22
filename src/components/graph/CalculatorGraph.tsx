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
import { buildGraphFromState } from "@/lib/graph/builder";
import { ExtractionNode } from "./ExtractionNode";
import { FlowEdge } from "./FlowEdge";
import { MiningNode } from "./MiningNode";
import { RecipeNode } from "./RecipeNode";

const nodeTypes = {
	recipe: RecipeNode,
	mining: MiningNode,
	extraction: ExtractionNode,
};

const edgeTypes = {
	flow: FlowEdge,
};

export function CalculatorGraph() {
	const { targets, elements, updateNodePosition } = useCalculator();

	const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
		return buildGraphFromState(targets, elements);
	}, [targets, elements]);

	const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
	const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

	useEffect(() => {
		const { nodes: newNodes, edges: newEdges } = buildGraphFromState(
			targets,
			elements,
		);
		setNodes(newNodes);
		setEdges(newEdges);
	}, [targets, elements, setNodes, setEdges]);

	const onNodeDragStop = useCallback(
		(_: unknown, node: { id: string; position: { x: number; y: number } }) => {
			updateNodePosition(node.id, node.position.x, node.position.y);
		},
		[updateNodePosition],
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
