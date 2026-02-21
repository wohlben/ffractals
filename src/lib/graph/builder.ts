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

const X_SPACING = 250;
const Y_SPACING = 180;
const ROOT_START_X = 100;
const ROOT_START_Y = 100;

export function buildGraphFromState(
	targets: CalculationTarget[],
	elements: Record<string, CalculationElement>,
): { nodes: Node[]; edges: Edge[] } {
	const nodes: Node[] = [];
	const edges: Edge[] = [];
	const visited = new Set<string>();
	let rootIndex = 0;

	for (const target of targets) {
		const rootElement = elements[target.rootElementId];
		if (!rootElement) continue;

		const rootX = ROOT_START_X + rootIndex * (X_SPACING * 3);
		processElement(rootElement, null, rootX, ROOT_START_Y, 0);
		rootIndex++;
	}

	function processElement(
		element: CalculationElement,
		parentElement: CalculationElement | null,
		x: number,
		y: number,
		depth: number,
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

		const node: Node = {
			id: element.id,
			type: nodeType,
			position: { x, y },
			data: createNodeData(element, elements),
		};
		nodes.push(node);

		if (parentElement) {
			edges.push(createEdge(parentElement, element));
		}

		const childCount = element.inputs.length;
		const totalWidth = (childCount - 1) * X_SPACING;
		const startX = x - totalWidth / 2;

		for (let i = 0; i < childCount; i++) {
			const childId = element.inputs[i];
			const child = elements[childId];
			if (child) {
				const childX = startX + i * X_SPACING;
				const childY = y + Y_SPACING;
				processElement(child, element, childX, childY, depth + 1);
			}
		}
	}

	return { nodes, edges };
}

function createNodeData(
	element: CalculationElement,
	elements: Record<string, CalculationElement>,
) {
	const item = DSPData.getItemById(element.itemId);
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
