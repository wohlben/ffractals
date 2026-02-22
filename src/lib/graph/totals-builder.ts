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
	supplierItemIds: Set<number>; // items that feed into this one
	recipeTypes: Set<string>; // recipe types used by elements of this item
	proliferatorConsumption: Map<number, number>; // proliferatorItemId → items/sec
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

	// Compute display rows via longest-path BFS from leaves upward.
	// Starting from leaves guarantees all raw materials share the same bottom row.
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

	// Compute per-node widths (mirrors TotalsNode.tsx sizing)
	const nodeWidths = new Map<number, number>();
	for (const agg of itemMap.values()) {
		nodeWidths.set(
			agg.itemId,
			Math.max(NODE_BASE_WIDTH, agg.supplierItemIds.size * 48 + 32),
		);
	}

	// Group by displayRow
	const depthGroups = new Map<number, AggregatedItem[]>();
	for (const agg of itemMap.values()) {
		const row = displayRow.get(agg.itemId) ?? 0;
		const group = depthGroups.get(row) ?? [];
		group.push(agg);
		depthGroups.set(row, group);
	}

	const sortedDepths = Array.from(depthGroups.keys()).sort((a, b) => a - b);

	// --- Bottom-up layout algorithm ---
	// 1. Form rigid 1:1 groups (vertical chains)
	// 2. Barycenter ordering with alternating sweeps
	// 3. X coordinate assignment with group alignment

	// Build suppliersOf map for symmetric graph access
	const suppliersOf = new Map<number, Set<number>>();
	for (const agg of itemMap.values()) {
		suppliersOf.set(agg.itemId, new Set(agg.supplierItemIds));
	}

	// Step 1: Form 1:1 groups (rigid vertical chains)
	// Chain continues while: item has exactly 1 consumer AND that consumer
	// has exactly 1 supplier. These items always share the same X position.
	const itemToGroup = new Map<number, number>();
	const groupVisited = new Set<number>();

	for (const depth of [...sortedDepths].reverse()) {
		const items = depthGroups.get(depth);
		if (!items) continue;
		for (const agg of items) {
			if (groupVisited.has(agg.itemId)) continue;

			const chain: number[] = [agg.itemId];
			groupVisited.add(agg.itemId);

			let current = agg.itemId;
			while (true) {
				const cons = consumersOf.get(current);
				if (!cons || cons.size !== 1) break;
				const consumer = cons.values().next().value;
				if (consumer === undefined) break;
				const consumerSupps = suppliersOf.get(consumer);
				if (!consumerSupps || consumerSupps.size !== 1) break;
				if (groupVisited.has(consumer)) break;
				chain.push(consumer);
				groupVisited.add(consumer);
				current = consumer;
			}

			if (chain.length >= 2) {
				const groupId = chain[0]; // bottommost item as group ID
				for (const id of chain) {
					itemToGroup.set(id, groupId);
				}
			}
		}
	}

	// Step 2: Barycenter ordering with alternating sweeps
	// Group members share a slot key so they maintain alignment across rows
	const orderKey = (itemId: number): string => {
		const gid = itemToGroup.get(itemId);
		return gid !== undefined ? `g-${gid}` : `f-${itemId}`;
	};
	const slotPos = new Map<string, number>();

	// Initialize bottom row: cluster items by shared consumer
	const bottomDepth = sortedDepths[sortedDepths.length - 1];
	const bottomItems = depthGroups.get(bottomDepth) ?? [];
	bottomItems.sort((a, b) => {
		const consA = consumersOf.get(a.itemId);
		const consB = consumersOf.get(b.itemId);
		const pA =
			consA && consA.size > 0 ? Math.min(...consA) : Number.MAX_SAFE_INTEGER;
		const pB =
			consB && consB.size > 0 ? Math.min(...consB) : Number.MAX_SAFE_INTEGER;
		if (pA !== pB) return pA - pB;
		const nameA = DSPData.getItemById(a.itemId)?.Name ?? "";
		const nameB = DSPData.getItemById(b.itemId)?.Name ?? "";
		return nameA.localeCompare(nameB);
	});
	for (let i = 0; i < bottomItems.length; i++) {
		slotPos.set(orderKey(bottomItems[i].itemId), i);
	}

	// Initialize other rows by name
	for (const depth of sortedDepths) {
		if (depth === bottomDepth) continue;
		const items = depthGroups.get(depth) ?? [];
		items.sort((a, b) => {
			const nameA = DSPData.getItemById(a.itemId)?.Name ?? "";
			const nameB = DSPData.getItemById(b.itemId)?.Name ?? "";
			return nameA.localeCompare(nameB);
		});
		for (let i = 0; i < items.length; i++) {
			slotPos.set(orderKey(items[i].itemId), i);
		}
	}

	// Alternating sweeps: 4 iterations of up + down
	for (let sweep = 0; sweep < 4; sweep++) {
		// Upward: order each row by barycenter of suppliers below
		for (let ri = sortedDepths.length - 2; ri >= 0; ri--) {
			const depth = sortedDepths[ri];
			const items = depthGroups.get(depth) ?? [];

			for (const agg of items) {
				const supps = suppliersOf.get(agg.itemId);
				if (!supps || supps.size === 0) continue;
				let sum = 0;
				let count = 0;
				for (const sId of supps) {
					const pos = slotPos.get(orderKey(sId));
					if (pos !== undefined) {
						sum += pos;
						count++;
					}
				}
				if (count > 0) slotPos.set(orderKey(agg.itemId), sum / count);
			}

			items.sort((a, b) => {
				const posA = slotPos.get(orderKey(a.itemId)) ?? 0;
				const posB = slotPos.get(orderKey(b.itemId)) ?? 0;
				if (posA !== posB) return posA - posB;
				const nameA = DSPData.getItemById(a.itemId)?.Name ?? "";
				const nameB = DSPData.getItemById(b.itemId)?.Name ?? "";
				return nameA.localeCompare(nameB);
			});
			for (let i = 0; i < items.length; i++) {
				slotPos.set(orderKey(items[i].itemId), i);
			}
		}

		// Downward: order each row by barycenter of consumers above
		for (let ri = 1; ri < sortedDepths.length; ri++) {
			const depth = sortedDepths[ri];
			const items = depthGroups.get(depth) ?? [];

			for (const agg of items) {
				const cons = consumersOf.get(agg.itemId);
				if (!cons || cons.size === 0) continue;
				let sum = 0;
				let count = 0;
				for (const cId of cons) {
					const pos = slotPos.get(orderKey(cId));
					if (pos !== undefined) {
						sum += pos;
						count++;
					}
				}
				if (count > 0) slotPos.set(orderKey(agg.itemId), sum / count);
			}

			items.sort((a, b) => {
				const posA = slotPos.get(orderKey(a.itemId)) ?? 0;
				const posB = slotPos.get(orderKey(b.itemId)) ?? 0;
				if (posA !== posB) return posA - posB;
				const nameA = DSPData.getItemById(a.itemId)?.Name ?? "";
				const nameB = DSPData.getItemById(b.itemId)?.Name ?? "";
				return nameA.localeCompare(nameB);
			});
			for (let i = 0; i < items.length; i++) {
				slotPos.set(orderKey(items[i].itemId), i);
			}
		}
	}

	// Step 3: X coordinate assignment — top-down from consumer positions
	const positionX = new Map<number, number>();

	// 3a: Place root row evenly spaced
	{
		const topDepth = sortedDepths[0];
		const topItems = depthGroups.get(topDepth) ?? [];
		let accX = START_X;
		for (const agg of topItems) {
			const w = nodeWidths.get(agg.itemId) ?? NODE_BASE_WIDTH;
			positionX.set(agg.itemId, accX + w / 2);
			accX += w + X_GAP;
		}
	}

	// 3b: For each subsequent row, place items directly below their consumer(s).
	// Single-consumer items ("anchored") get placement priority over multi-consumer
	// items ("floating") so they end up directly below their single consumer.
	for (let ri = 1; ri < sortedDepths.length; ri++) {
		const depth = sortedDepths[ri];
		const items = depthGroups.get(depth) ?? [];

		// Compute desired X for each item: center below consumer(s)
		const desiredX = new Map<number, number>();
		for (const agg of items) {
			const cons = consumersOf.get(agg.itemId);
			if (cons && cons.size > 0) {
				const xs: number[] = [];
				for (const cId of cons) {
					const cx = positionX.get(cId);
					if (cx !== undefined) xs.push(cx);
				}
				if (xs.length > 0) {
					desiredX.set(
						agg.itemId,
						xs.reduce((sum, x) => sum + x, 0) / xs.length,
					);
					continue;
				}
			}
			desiredX.set(agg.itemId, START_X);
		}

		// Separate into anchored (1 consumer, must be directly below) and floating
		const anchoredItems: AggregatedItem[] = [];
		const floatingItems: AggregatedItem[] = [];
		for (const agg of items) {
			const cons = consumersOf.get(agg.itemId);
			if (cons && cons.size === 1) {
				anchoredItems.push(agg);
			} else {
				floatingItems.push(agg);
			}
		}

		// Sort each group by desired X
		anchoredItems.sort(
			(a, b) => (desiredX.get(a.itemId) ?? 0) - (desiredX.get(b.itemId) ?? 0),
		);
		floatingItems.sort(
			(a, b) => (desiredX.get(a.itemId) ?? 0) - (desiredX.get(b.itemId) ?? 0),
		);

		// Phase 1: Place anchored items at their desired X with overlap resolution
		{
			let prevId: number | null = null;
			for (const agg of anchoredItems) {
				const w = nodeWidths.get(agg.itemId) ?? NODE_BASE_WIDTH;
				let cx = desiredX.get(agg.itemId) ?? START_X;
				if (prevId !== null) {
					const prevW = nodeWidths.get(prevId) ?? NODE_BASE_WIDTH;
					const prevCX = positionX.get(prevId) ?? START_X;
					const minCX = prevCX + prevW / 2 + X_GAP + w / 2;
					if (cx < minCX) cx = minCX;
				}
				positionX.set(agg.itemId, cx);
				prevId = agg.itemId;
			}
		}

		// Phase 2: Insert floating items at best available position
		for (const agg of floatingItems) {
			const w = nodeWidths.get(agg.itemId) ?? NODE_BASE_WIDTH;
			const desired = desiredX.get(agg.itemId) ?? START_X;

			// Collect all placed items on this row, sorted by X
			const placed = anchoredItems
				.filter((a) => positionX.has(a.itemId))
				.map((a) => ({
					itemId: a.itemId,
					cx: positionX.get(a.itemId) ?? 0,
					w: nodeWidths.get(a.itemId) ?? NODE_BASE_WIDTH,
				}));
			// Also include already-placed floating items
			for (const f of floatingItems) {
				if (f === agg) continue;
				if (!positionX.has(f.itemId)) continue;
				placed.push({
					itemId: f.itemId,
					cx: positionX.get(f.itemId) ?? 0,
					w: nodeWidths.get(f.itemId) ?? NODE_BASE_WIDTH,
				});
			}
			placed.sort((a, b) => a.cx - b.cx);

			// Find nearest non-overlapping position to desired
			const halfW = w / 2;
			const overlaps = (cx: number) => {
				for (const p of placed) {
					const pHalfW = p.w / 2;
					if (
						cx + halfW + X_GAP > p.cx - pHalfW &&
						cx - halfW - X_GAP < p.cx + pHalfW
					) {
						return true;
					}
				}
				return false;
			};

			if (!overlaps(desired)) {
				positionX.set(agg.itemId, desired);
			} else {
				// Try positions to the right of each placed item
				let bestX = desired;
				let bestDist = Number.MAX_SAFE_INTEGER;
				for (const p of placed) {
					const candidate = p.cx + p.w / 2 + X_GAP + halfW;
					if (!overlaps(candidate)) {
						const dist = Math.abs(candidate - desired);
						if (dist < bestDist) {
							bestDist = dist;
							bestX = candidate;
						}
					}
				}
				// Also try position before the first placed item
				if (placed.length > 0) {
					const first = placed[0];
					const candidate = first.cx - first.w / 2 - X_GAP - halfW;
					if (candidate >= START_X + halfW && !overlaps(candidate)) {
						const dist = Math.abs(candidate - desired);
						if (dist < bestDist) {
							bestDist = dist;
							bestX = candidate;
						}
					}
				}
				// Fallback: place after last item
				if (bestDist === Number.MAX_SAFE_INTEGER) {
					if (placed.length > 0) {
						const last = placed[placed.length - 1];
						bestX = last.cx + last.w / 2 + X_GAP + halfW;
					} else {
						bestX = START_X + halfW;
					}
				}
				positionX.set(agg.itemId, bestX);
			}
		}

		// Update items order to match final X positions
		items.sort(
			(a, b) => (positionX.get(a.itemId) ?? 0) - (positionX.get(b.itemId) ?? 0),
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
			const cx = positionX.get(agg.itemId) ?? START_X;

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
