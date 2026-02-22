import type { Edge, Node } from "@xyflow/react";
import type {
	CalculationElement,
	CalculationTarget,
	RecipeSource,
	SourceType,
} from "../calculator/models";
import { DSPData } from "../data/dsp-data";
import {
	placeManyConsumerItems,
	placeSingleConsumerItems,
	placeThreeConsumerItems,
	placeTwoConsumerItems,
	refineLayout,
} from "./layout-algorithm";
import {
	type LayoutContext,
	START_X,
	START_Y,
	Y_SPACING,
} from "./layout-utils";

const NODE_BASE_WIDTH = 220;

export interface AggregatedItem {
	itemId: number;
	requiredRate: number;
	actualRate: number;
	facilities: Map<number, number>; // facilityItemId → total count
	sourceTypes: Set<SourceType>;
	elementCount: number;
	supplierItemIds: Set<number>; // items that feed into this one
	recipeTypes: Set<string>; // recipe types used by elements of this item
	proliferatorConsumption: Map<number, number>; // proliferatorItemId → items/sec
}

export interface AggregatedEdge {
	sourceItemId: number;
	targetItemId: number;
	totalRate: number;
	totalItemsPerCycle: number;
}

function collectReachableElementIds(
	targets: CalculationTarget[],
	elements: Record<string, CalculationElement>,
): Set<string> {
	const ids = new Set<string>();

	function walk(elementId: string): void {
		if (ids.has(elementId)) return;
		ids.add(elementId);
		const element = elements[elementId];
		if (element) {
			for (const childId of element.inputs) {
				walk(childId);
			}
		}
	}

	for (const target of targets) {
		walk(target.rootElementId);
	}
	return ids;
}

export function buildTotalsGraphFromState(
	targets: CalculationTarget[],
	elements: Record<string, CalculationElement>,
): { nodes: Node[]; edges: Edge[] } {
	if (targets.length === 0) return { nodes: [], edges: [] };

	// Build root itemId → targetIds mapping
	const rootItemTargets = new Map<number, string[]>();
	const rootElementIds = new Set<string>();
	for (const target of targets) {
		rootElementIds.add(target.rootElementId);
		const rootEl = elements[target.rootElementId];
		if (rootEl) {
			const existing = rootItemTargets.get(rootEl.itemId) ?? [];
			existing.push(target.id);
			rootItemTargets.set(rootEl.itemId, existing);
		}
	}

	// Phase 1: Group elements by itemId
	const reachableIds = collectReachableElementIds(targets, elements);
	const itemMap = new Map<number, AggregatedItem>();

	for (const elementId of reachableIds) {
		const element = elements[elementId];
		if (!element) continue;

		let agg = itemMap.get(element.itemId);
		if (!agg) {
			agg = {
				itemId: element.itemId,
				requiredRate: 0,
				actualRate: 0,
				facilities: new Map(),
				sourceTypes: new Set(),
				elementCount: 0,
				supplierItemIds: new Set(),
				recipeTypes: new Set(),
				proliferatorConsumption: new Map(),
			};
			itemMap.set(element.itemId, agg);
		}

		agg.requiredRate += element.requiredRate;
		agg.actualRate += element.actualRate;
		agg.elementCount += 1;

		if (element.source) {
			agg.sourceTypes.add(element.source.type);
			if (element.source.type === "recipe") {
				const recipeSource = element.source as RecipeSource;
				if (recipeSource.recipeType) {
					agg.recipeTypes.add(recipeSource.recipeType);
				}
			}
		}

		if (element.facility) {
			const prev = agg.facilities.get(element.facility.itemId) ?? 0;
			agg.facilities.set(
				element.facility.itemId,
				prev + element.facility.count,
			);
		}

		// Aggregate proliferator consumption
		if (element.proliferatorConsumption) {
			const current =
				agg.proliferatorConsumption.get(
					element.proliferatorConsumption.itemId,
				) ?? 0;
			agg.proliferatorConsumption.set(
				element.proliferatorConsumption.itemId,
				current + element.proliferatorConsumption.itemsPerSecond,
			);
		}
	}

	// Phase 2: Build deduplicated edges
	const edgeMap = new Map<string, AggregatedEdge>();

	for (const elementId of reachableIds) {
		const element = elements[elementId];
		if (!element) continue;

		// Look up items-per-cycle from the parent's recipe
		let recipeItemCounts: number[] = [];
		let recipeItems: number[] = [];
		if (element.source?.type === "recipe") {
			const recipe = DSPData.getRecipeById(
				(element.source as RecipeSource).recipeId,
			);
			if (recipe) {
				recipeItems = recipe.Items;
				recipeItemCounts = recipe.ItemCounts;
			}
		}

		for (const childId of element.inputs) {
			const child = elements[childId];
			if (!child) continue;

			// Skip self-loops
			if (child.itemId === element.itemId) continue;

			// Get total items-per-cycle across all facilities
			let itemsPerCycle = 0;
			const inputIndex = recipeItems.indexOf(child.itemId);
			if (inputIndex !== -1) {
				const perFacility = recipeItemCounts[inputIndex] ?? 0;
				const facilityCount = element.facility?.count ?? 1;
				itemsPerCycle = perFacility * facilityCount;
			}

			const key = `${child.itemId}-${element.itemId}`;
			const existing = edgeMap.get(key);
			if (existing) {
				existing.totalRate += child.requiredRate;
				existing.totalItemsPerCycle += itemsPerCycle;
			} else {
				edgeMap.set(key, {
					sourceItemId: child.itemId,
					targetItemId: element.itemId,
					totalRate: child.requiredRate,
					totalItemsPerCycle: itemsPerCycle,
				});
			}

			// Track supplier relationships for input handles
			const targetAgg = itemMap.get(element.itemId);
			if (targetAgg) {
				targetAgg.supplierItemIds.add(child.itemId);
			}
		}
	}

	// Phase 3: NEW iterative connection-first layout

	// Build consumersOf map: itemId → set of item IDs that consume it
	const consumersOf = new Map<number, Set<number>>();
	for (const aggEdge of edgeMap.values()) {
		let consumers = consumersOf.get(aggEdge.sourceItemId);
		if (!consumers) {
			consumers = new Set();
			consumersOf.set(aggEdge.sourceItemId, consumers);
		}
		consumers.add(aggEdge.targetItemId);
	}

	// Build suppliersOf map: itemId → set of supplier item IDs
	const suppliersOf = new Map<number, Set<number>>();
	for (const agg of itemMap.values()) {
		suppliersOf.set(agg.itemId, new Set(agg.supplierItemIds));
	}

	// Compute display rows via longest-path BFS from leaves upward
	const leafItemIds: number[] = [];
	for (const agg of itemMap.values()) {
		if (agg.supplierItemIds.size === 0) {
			leafItemIds.push(agg.itemId);
		}
	}

	const distFromLeaf = new Map<number, number>();
	for (const leafId of leafItemIds) {
		distFromLeaf.set(leafId, 0);
	}
	const queue: number[] = [...leafItemIds];
	while (queue.length > 0) {
		const currentItemId = queue.shift();
		if (currentItemId === undefined) continue;
		const currentDist = distFromLeaf.get(currentItemId);
		if (currentDist === undefined) continue;
		const consumers = consumersOf.get(currentItemId);
		if (!consumers) continue;
		for (const consumerId of consumers) {
			const newDist = currentDist + 1;
			if (newDist > (distFromLeaf.get(consumerId) ?? -1)) {
				distFromLeaf.set(consumerId, newDist);
				queue.push(consumerId);
			}
		}
	}

	// Invert so roots (highest distance from leaves) end up at row 0 (top)
	const maxDist = Math.max(0, ...distFromLeaf.values());
	const displayRow = new Map<number, number>();
	for (const [itemId, dist] of distFromLeaf) {
		displayRow.set(itemId, maxDist - dist);
	}
	// Force root items to row 0 in case multiple chains have different depths
	for (const rootItemId of rootItemTargets.keys()) {
		displayRow.set(rootItemId, 0);
	}

	// Compute consumer count for each item
	const consumerCount = new Map<number, number>();
	for (const [itemId, consumers] of consumersOf) {
		consumerCount.set(itemId, consumers.size);
	}

	// Build LayoutContext
	const connections = Array.from(edgeMap.values());
	const context: LayoutContext = {
		itemMap,
		edgeMap,
		connections,
		consumersOf,
		suppliersOf,
		itemDepth: distFromLeaf,
		displayRow,
		consumerCount,
		rootItemTargets,
	};

	// Phase 3.1: Place single-consumer items (highest priority)
	let positions = placeSingleConsumerItems(context);

	// Phase 3.2: Place two-consumer items
	positions = placeTwoConsumerItems(context, positions);

	// Phase 3.3: Place three-consumer items
	positions = placeThreeConsumerItems(context, positions);

	// Phase 3.4: Place 4+ consumer items
	positions = placeManyConsumerItems(context, positions);

	// Phase 3.5: Refinement pass
	positions = refineLayout(context, positions);

	// Group by displayRow for node creation
	const depthGroups = new Map<number, AggregatedItem[]>();
	for (const agg of itemMap.values()) {
		const row = displayRow.get(agg.itemId) ?? 0;
		const group = depthGroups.get(row) ?? [];
		group.push(agg);
		depthGroups.set(row, group);
	}

	const sortedDepths = Array.from(depthGroups.keys()).sort((a, b) => a - b);

	// Compute per-node widths (mirrors TotalsNode.tsx sizing)
	const nodeWidths = new Map<number, number>();
	for (const agg of itemMap.values()) {
		nodeWidths.set(
			agg.itemId,
			Math.max(NODE_BASE_WIDTH, agg.supplierItemIds.size * 48 + 32),
		);
	}

	// Create xyflow nodes using computed positions
	const nodes: Node[] = [];
	for (const depth of sortedDepths) {
		const group = depthGroups.get(depth);
		if (!group) continue;

		const row = sortedDepths.indexOf(depth);
		for (const agg of group) {
			const item = DSPData.getItemById(agg.itemId);
			const w = nodeWidths.get(agg.itemId) ?? NODE_BASE_WIDTH;
			const pos = positions.get(agg.itemId);
			const cx = pos?.x ?? START_X;
			const cy = pos?.y ?? START_Y + row * Y_SPACING;

			const supplierArray = Array.from(agg.supplierItemIds).sort((a, b) => {
				const nameA = DSPData.getItemById(a)?.Name ?? "";
				const nameB = DSPData.getItemById(b)?.Name ?? "";
				return nameA.localeCompare(nameB);
			});

			const facilityEntries: Array<{
				itemId: number;
				count: number;
				name: string;
			}> = [];
			for (const [facItemId, count] of agg.facilities) {
				const facItem = DSPData.getItemById(facItemId);
				facilityEntries.push({
					itemId: facItemId,
					count,
					name: facItem?.Name ?? "",
				});
			}

			const isRoot = rootItemTargets.has(agg.itemId);
			const targetIds = rootItemTargets.get(agg.itemId) ?? [];
			const recipeType =
				agg.recipeTypes.size === 1 ? Array.from(agg.recipeTypes)[0] : null;

			// Convert proliferator consumption map to array for the node data
			const proliferatorSummary = Array.from(
				agg.proliferatorConsumption.entries(),
			).map(([prolifItemId, rate]) => ({
				itemId: prolifItemId,
				totalItemsPerSecond: rate,
			}));

			nodes.push({
				id: `totals-${agg.itemId}`,
				type: "totals",
				position: {
					x: cx - w / 2,
					y: cy,
				},
				data: {
					itemId: agg.itemId,
					itemName: item?.Name ?? `Item ${agg.itemId}`,
					requiredRate: agg.requiredRate,
					actualRate: agg.actualRate,
					facilities: facilityEntries,
					sourceTypes: Array.from(agg.sourceTypes),
					elementCount: agg.elementCount,
					isRoot,
					targetIds,
					recipeType,
					inputHandles: supplierArray.map((supplierId) => {
						const suppItem = DSPData.getItemById(supplierId);
						return {
							itemId: supplierId,
							itemName: suppItem?.Name ?? "",
						};
					}),
					proliferatorSummary,
				},
			});
		}
	}

	const edges: Edge[] = [];
	for (const aggEdge of edgeMap.values()) {
		edges.push({
			id: `totals-${aggEdge.sourceItemId}-${aggEdge.targetItemId}`,
			source: `totals-${aggEdge.sourceItemId}`,
			sourceHandle: "output",
			target: `totals-${aggEdge.targetItemId}`,
			targetHandle: `input-item-${aggEdge.sourceItemId}`,
			type: "flow",
			data: {
				rate: aggEdge.totalRate,
				itemId: aggEdge.sourceItemId,
				itemsPerCycle: aggEdge.totalItemsPerCycle,
			},
		});
	}

	return { nodes, edges };
}
