import type { Edge, Node } from "@xyflow/react";
import type {
	CalculationElement,
	CalculationTarget,
	ExtractionSource,
	MiningSource,
	RecipeSource,
} from "../calculator/models";
import { TICKS_PER_SECOND } from "../calculator/models";
import { DSPData } from "../data/dsp-data";

const MINING_NODE_WIDTH = 180;
const NODE_BASE_WIDTH = 200;
const X_GAP = 30;
const Y_SPACING = 180;
const ROOT_START_X = 100;
const ROOT_START_Y = 100;
const ROOT_GAP = 80;

function getNodeWidth(
	element: CalculationElement,
	elements: Record<string, CalculationElement>,
): number {
	if (
		element.source?.type === "mining" ||
		element.source?.type === "extraction"
	) {
		return MINING_NODE_WIDTH;
	}
	if (element.source?.type === "recipe" && element.inputs.length > 0) {
		return Math.max(NODE_BASE_WIDTH, element.inputs.length * 48 + 32);
	}
	return NODE_BASE_WIDTH;
}

function calculateSubtreeWidths(
	elementId: string,
	elements: Record<string, CalculationElement>,
	widths: Map<string, number>,
	visiting: Set<string>,
): number {
	if (widths.has(elementId)) return widths.get(elementId)!;

	const element = elements[elementId];
	if (!element) return NODE_BASE_WIDTH;

	const nodeWidth = getNodeWidth(element, elements);

	// Shared node (being visited by another branch) — count only its own width
	if (visiting.has(elementId)) {
		widths.set(elementId, nodeWidth);
		return nodeWidth;
	}
	visiting.add(elementId);

	const validChildren = element.inputs.filter((id) => elements[id]);
	if (validChildren.length === 0) {
		widths.set(elementId, nodeWidth);
		return nodeWidth;
	}

	let totalChildrenWidth = 0;
	for (let i = 0; i < validChildren.length; i++) {
		if (i > 0) totalChildrenWidth += X_GAP;
		totalChildrenWidth += calculateSubtreeWidths(
			validChildren[i],
			elements,
			widths,
			visiting,
		);
	}

	const subtreeWidth = Math.max(nodeWidth, totalChildrenWidth);
	widths.set(elementId, subtreeWidth);
	return subtreeWidth;
}

export function buildGraphFromState(
	targets: CalculationTarget[],
	elements: Record<string, CalculationElement>,
): { nodes: Node[]; edges: Edge[] } {
	const nodes: Node[] = [];
	const edges: Edge[] = [];
	const visited = new Set<string>();

	// Pass 1: calculate subtree widths bottom-up
	const subtreeWidths = new Map<string, number>();
	for (const target of targets) {
		if (elements[target.rootElementId]) {
			calculateSubtreeWidths(
				target.rootElementId,
				elements,
				subtreeWidths,
				new Set<string>(),
			);
		}
	}

	// Pass 2: position nodes top-down
	let rootOffset = ROOT_START_X;
	for (const target of targets) {
		const rootElement = elements[target.rootElementId];
		if (!rootElement) continue;

		const width = subtreeWidths.get(target.rootElementId) ?? NODE_BASE_WIDTH;
		const rootCenterX = rootOffset + width / 2;
		processElement(rootElement, null, rootCenterX, ROOT_START_Y);
		rootOffset += width + ROOT_GAP;
	}

	function processElement(
		element: CalculationElement,
		parentElement: CalculationElement | null,
		centerX: number,
		y: number,
	): void {
		if (visited.has(element.id)) {
			if (parentElement) {
				edges.push(createEdge(parentElement, element));
			}
			return;
		}
		visited.add(element.id);

		let nodeType = "recipe";
		if (element.source?.type === "mining") nodeType = "mining";
		if (element.source?.type === "extraction") nodeType = "extraction";

		const nodeWidth = getNodeWidth(element, elements);
		const node: Node = {
			id: element.id,
			type: nodeType,
			position: { x: centerX - nodeWidth / 2, y },
			data: createNodeData(element, elements),
		};
		nodes.push(node);

		if (parentElement) {
			edges.push(createEdge(parentElement, element));
		}

		const validChildren = element.inputs.filter((id) => elements[id]);
		if (validChildren.length === 0) return;

		// Sum children subtree widths
		const childWidths = validChildren.map(
			(id) => subtreeWidths.get(id) ?? NODE_BASE_WIDTH,
		);
		const totalWidth =
			childWidths.reduce((sum, w) => sum + w, 0) +
			(validChildren.length - 1) * X_GAP;

		let currentX = centerX - totalWidth / 2;
		for (let i = 0; i < validChildren.length; i++) {
			const child = elements[validChildren[i]];
			const childCenterX = currentX + childWidths[i] / 2;
			processElement(child, element, childCenterX, y + Y_SPACING);
			currentX += childWidths[i] + X_GAP;
		}
	}

	return { nodes, edges };
}

function createNodeData(
	element: CalculationElement,
	elements: Record<string, CalculationElement>,
) {
	const item = DSPData.getItemById(element.itemId);
	// Check if this item can be crafted (has recipes)
	const canCraft = DSPData.getRecipesProducing(element.itemId).length > 0;
	const baseData = {
		elementId: element.id,
		itemId: element.itemId,
		itemName: item?.Name ?? `Item ${element.itemId}`,
		requiredRate: element.requiredRate,
		actualRate: element.actualRate,
		facilityItemId: element.facility?.itemId ?? null,
		facilityCount: element.facility?.count ?? 0,
		hasSource: !!element.source,
		sourceType: element.source?.type ?? "",
		inputHandles: buildInputHandles(element, elements),
		cycleDuration: 0,
		perCycleAmount: 0,
		canCraft,
	};

	// Add cycle information based on source type
	if (element.source?.type === "recipe") {
		const recipeSource = element.source as RecipeSource;
		const recipe = DSPData.getRecipeById(recipeSource.recipeId);
		if (recipe) {
			const outputIndex = recipe.Results.indexOf(element.itemId);
			if (outputIndex !== -1) {
				baseData.perCycleAmount = recipe.ResultCounts[outputIndex] ?? 1;
			}
			baseData.cycleDuration = recipe.TimeSpend / TICKS_PER_SECOND;
		}
	} else if (element.source?.type === "mining") {
		const miningSource = element.source as MiningSource;
		baseData.cycleDuration = miningSource.miningTime; // Already in seconds
		baseData.perCycleAmount = 1;
	} else if (element.source?.type === "extraction") {
		const extractionSource = element.source as ExtractionSource;
		baseData.cycleDuration = 1; // 1 second
		baseData.perCycleAmount = extractionSource.extractionSpeed;
	}

	return baseData;
}

function buildInputHandles(
	element: CalculationElement,
	elements: Record<string, CalculationElement>,
): Array<{
	elementId: string;
	itemId: number;
	itemName: string;
	rate: number;
}> {
	if (!element.source || element.source.type !== "recipe") return [];

	const recipe = DSPData.getRecipeById(
		(element.source as RecipeSource).recipeId,
	);
	if (!recipe) return [];

	return element.inputs.map((childId, i) => {
		const child = elements[childId];
		// Use stored child's itemId if available, otherwise fall back to recipe item order
		const itemId = child?.itemId ?? recipe.Items[i] ?? 0;
		const childItem = DSPData.getItemById(itemId);
		return {
			elementId: childId,
			itemId,
			itemName: childItem?.Name ?? "",
			rate: child?.requiredRate ?? 0,
		};
	});
}

function createEdge(
	parent: CalculationElement,
	child: CalculationElement,
): Edge {
	// Calculate items per cycle if parent has a recipe
	let itemsPerCycle = 0;
	if (parent.source?.type === "recipe") {
		const recipeSource = parent.source as RecipeSource;
		const recipe = DSPData.getRecipeById(recipeSource.recipeId);
		if (recipe) {
			const inputIndex = recipe.Items.indexOf(child.itemId);
			if (inputIndex !== -1) {
				itemsPerCycle = recipe.ItemCounts[inputIndex] ?? 0;
			}
		}
	}

	return {
		id: `${child.id}-${parent.id}`,
		source: child.id,
		sourceHandle: "output",
		target: parent.id,
		targetHandle: `input-${child.id}`,
		type: "flow",
		data: {
			rate: child.requiredRate,
			itemId: child.itemId,
			itemsPerCycle,
		},
	};
}
