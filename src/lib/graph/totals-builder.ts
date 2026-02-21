import type { Edge, Node } from "@xyflow/react";
import type {
	CalculationElement,
	CalculationTarget,
	SourceType,
} from "../calculator/models";
import { DSPData } from "../data/dsp-data";

const NODE_WIDTH = 220;
const X_GAP = 40;
const Y_SPACING = 180;
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

		for (const childId of element.inputs) {
			const child = elements[childId];
			if (!child) continue;

			// Skip self-loops
			if (child.itemId === element.itemId) continue;

			const key = `${child.itemId}-${element.itemId}`;
			const existing = edgeMap.get(key);
			if (existing) {
				existing.totalRate += child.requiredRate;
			} else {
				edgeMap.set(key, {
					sourceItemId: child.itemId,
					targetItemId: element.itemId,
					totalRate: child.requiredRate,
				});
			}

			// Track supplier relationships for input handles
			const targetAgg = itemMap.get(element.itemId);
			if (targetAgg) {
				targetAgg.supplierItemIds.add(child.itemId);
			}
		}
	}

	// Phase 3: Layout + create xyflow nodes/edges
	// Group by minDepth, lay out in rows
	const depthGroups = new Map<number, AggregatedItem[]>();
	for (const agg of itemMap.values()) {
		const group = depthGroups.get(agg.minDepth) ?? [];
		group.push(agg);
		depthGroups.set(agg.minDepth, group);
	}

	const sortedDepths = Array.from(depthGroups.keys()).sort((a, b) => a - b);

	const nodes: Node[] = [];
	for (const depth of sortedDepths) {
		const group = depthGroups.get(depth);
		if (!group) continue;
		// Sort items by name for consistent ordering
		group.sort((a, b) => {
			const nameA = DSPData.getItemById(a.itemId)?.Name ?? "";
			const nameB = DSPData.getItemById(b.itemId)?.Name ?? "";
			return nameA.localeCompare(nameB);
		});

		const row = sortedDepths.indexOf(depth);
		for (let col = 0; col < group.length; col++) {
			const agg = group[col];
			const item = DSPData.getItemById(agg.itemId);

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

			nodes.push({
				id: `totals-${agg.itemId}`,
				type: "totals",
				position: {
					x: START_X + col * (NODE_WIDTH + X_GAP),
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
				itemsPerCycle: 0,
			},
		});
	}

	return { nodes, edges };
}
