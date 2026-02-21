import type { Edge, Node } from "@xyflow/react";
import type {
	CalculationElement,
	CalculationTarget,
	RecipeSource,
	SourceType,
} from "../calculator/models";
import { DSPData } from "../data/dsp-data";

const NODE_BASE_WIDTH = 220;
const X_GAP = 80;
const Y_SPACING = 360;
const START_X = 100;
const START_Y = 100;

interface AggregatedItem {
	itemId: number;
	requiredRate: number;
	actualRate: number;
	facilities: Map<number, number>; // facilityItemId → total count
	sourceTypes: Set<SourceType>;
	elementCount: number;
	minDepth: number;
	supplierItemIds: Set<number>; // items that feed into this one
}

interface AggregatedEdge {
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
				minDepth: element.depth,
				supplierItemIds: new Set(),
			};
			itemMap.set(element.itemId, agg);
		}

		agg.requiredRate += element.requiredRate;
		agg.actualRate += element.actualRate;
		agg.elementCount += 1;
		agg.minDepth = Math.min(agg.minDepth, element.depth);

		if (element.source) {
			agg.sourceTypes.add(element.source.type);
		}

		if (element.facility) {
			const prev = agg.facilities.get(element.facility.itemId) ?? 0;
			agg.facilities.set(
				element.facility.itemId,
				prev + element.facility.count,
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

			// Get items-per-cycle for this input from the recipe
			let itemsPerCycle = 0;
			const inputIndex = recipeItems.indexOf(child.itemId);
			if (inputIndex !== -1) {
				itemsPerCycle = recipeItemCounts[inputIndex] ?? 0;
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

	// Phase 3: Consumer-aware layout + create xyflow nodes/edges

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

	// Compute per-node widths (mirrors TotalsNode.tsx sizing)
	const nodeWidths = new Map<number, number>();
	for (const agg of itemMap.values()) {
		nodeWidths.set(
			agg.itemId,
			Math.max(NODE_BASE_WIDTH, agg.supplierItemIds.size * 48 + 32),
		);
	}

	// Group by minDepth
	const depthGroups = new Map<number, AggregatedItem[]>();
	for (const agg of itemMap.values()) {
		const group = depthGroups.get(agg.minDepth) ?? [];
		group.push(agg);
		depthGroups.set(agg.minDepth, group);
	}

	const sortedDepths = Array.from(depthGroups.keys()).sort((a, b) => a - b);

	// positionX stores center-X for each itemId
	const positionX = new Map<number, number>();

	// Helper: get suppliers of a given item (items that feed into it)
	const suppliersOf = (itemId: number): number[] => {
		const agg = itemMap.get(itemId);
		return agg ? Array.from(agg.supplierItemIds) : [];
	};

	// Helper: get the depth row index for an item
	const depthRowOf = (itemId: number): number => {
		const agg = itemMap.get(itemId);
		if (!agg) return 0;
		return sortedDepths.indexOf(agg.minDepth);
	};

	for (const depth of sortedDepths) {
		const group = depthGroups.get(depth);
		if (!group) continue;

		// Sort items by name as initial ordering
		group.sort((a, b) => {
			const nameA = DSPData.getItemById(a.itemId)?.Name ?? "";
			const nameB = DSPData.getItemById(b.itemId)?.Name ?? "";
			return nameA.localeCompare(nameB);
		});

		const row = sortedDepths.indexOf(depth);

		if (row === 0) {
			// Depth 0: lay out left-to-right using actual widths
			let currentX = START_X;
			for (const agg of group) {
				const w = nodeWidths.get(agg.itemId) ?? NODE_BASE_WIDTH;
				positionX.set(agg.itemId, currentX + w / 2);
				currentX += w + X_GAP;
			}
		} else {
			// Compute ideal center-X for each node based on consumers
			const idealX = new Map<number, number>();

			for (const agg of group) {
				const consumers = consumersOf.get(agg.itemId);
				if (!consumers || consumers.size === 0) {
					// Orphan — will be placed at the right end
					idealX.set(agg.itemId, Number.MAX_SAFE_INTEGER);
				} else if (consumers.size === 1) {
					// Single consumer — align with it
					const consumerId = consumers.values().next().value!;
					idealX.set(
						agg.itemId,
						positionX.get(consumerId) ?? START_X,
					);
				} else {
					// Multiple consumers — align with deepest; if tied, average
					let maxRow = -1;
					const candidates: number[] = [];
					for (const cId of consumers) {
						const cRow = depthRowOf(cId);
						if (cRow > maxRow) {
							maxRow = cRow;
							candidates.length = 0;
							candidates.push(cId);
						} else if (cRow === maxRow) {
							candidates.push(cId);
						}
					}
					const avgX =
						candidates.reduce(
							(sum, cId) => sum + (positionX.get(cId) ?? START_X),
							0,
						) / candidates.length;
					idealX.set(agg.itemId, avgX);
				}
			}

			// Sibling spreading: group nodes that share the same single consumer
			// (and that consumer has >1 supplier). Spread each group evenly
			// centered under their shared consumer.
			const consumerGroups = new Map<number, AggregatedItem[]>();
			const ungrouped: AggregatedItem[] = [];

			for (const agg of group) {
				const consumers = consumersOf.get(agg.itemId);
				if (consumers && consumers.size === 1) {
					const consumerId = consumers.values().next().value!;
					const consumerSupplierCount = suppliersOf(consumerId).length;
					if (consumerSupplierCount > 1) {
						const siblings = consumerGroups.get(consumerId) ?? [];
						siblings.push(agg);
						consumerGroups.set(consumerId, siblings);
						continue;
					}
				}
				ungrouped.push(agg);
			}

			// Apply sibling spreading
			for (const [consumerId, siblings] of consumerGroups) {
				const consumerCX = positionX.get(consumerId) ?? START_X;
				// Sort siblings by their ideal position for consistent ordering
				siblings.sort((a, b) => {
					const nameA = DSPData.getItemById(a.itemId)?.Name ?? "";
					const nameB = DSPData.getItemById(b.itemId)?.Name ?? "";
					return nameA.localeCompare(nameB);
				});

				// Compute total width of sibling group
				let totalWidth = 0;
				for (let i = 0; i < siblings.length; i++) {
					if (i > 0) totalWidth += X_GAP;
					totalWidth +=
						nodeWidths.get(siblings[i].itemId) ?? NODE_BASE_WIDTH;
				}

				// Spread evenly centered under consumer
				let cx = consumerCX - totalWidth / 2;
				for (const sib of siblings) {
					const w = nodeWidths.get(sib.itemId) ?? NODE_BASE_WIDTH;
					idealX.set(sib.itemId, cx + w / 2);
					cx += w + X_GAP;
				}
			}

			// Build sorted list of all nodes at this depth by ideal X
			const allAtDepth = [...group].sort(
				(a, b) =>
					(idealX.get(a.itemId) ?? 0) - (idealX.get(b.itemId) ?? 0),
			);

			// Overlap resolution: sweep left-to-right
			let prevId: number | null = null;
			for (const agg of allAtDepth) {
				const w = nodeWidths.get(agg.itemId) ?? NODE_BASE_WIDTH;
				let cx = idealX.get(agg.itemId) ?? START_X;

				if (prevId !== null) {
					const prevW = nodeWidths.get(prevId) ?? NODE_BASE_WIDTH;
					const prevCX = positionX.get(prevId) ?? START_X;
					const minCX = prevCX + prevW / 2 + X_GAP + w / 2;
					if (cx < minCX) {
						cx = minCX;
					}
				}

				positionX.set(agg.itemId, cx);
				prevId = agg.itemId;
			}

			// Place orphans at the right end
			for (const agg of allAtDepth) {
				if (idealX.get(agg.itemId) === Number.MAX_SAFE_INTEGER) {
					// Already handled by overlap resolution pushing them right
				}
			}
		}
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
			const cx = positionX.get(agg.itemId) ?? START_X;

			const supplierArray = Array.from(agg.supplierItemIds).sort(
				(a, b) => {
					const nameA = DSPData.getItemById(a)?.Name ?? "";
					const nameB = DSPData.getItemById(b)?.Name ?? "";
					return nameA.localeCompare(nameB);
				},
			);

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

			nodes.push({
				id: `totals-${agg.itemId}`,
				type: "totals",
				position: {
					x: cx - w / 2,
					y: START_Y + row * Y_SPACING,
				},
				data: {
					itemId: agg.itemId,
					itemName: item?.Name ?? `Item ${agg.itemId}`,
					requiredRate: agg.requiredRate,
					actualRate: agg.actualRate,
					facilities: facilityEntries,
					sourceTypes: Array.from(agg.sourceTypes),
					elementCount: agg.elementCount,
					inputHandles: supplierArray.map((supplierId) => {
						const suppItem = DSPData.getItemById(supplierId);
						return {
							itemId: supplierId,
							itemName: suppItem?.Name ?? "",
						};
					}),
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
