import { Store } from "@tanstack/store";
import type {
	CalculationElement,
	CalculationTarget,
	CalculatorState,
	NodePosition,
	ProliferatorMode,
	RecipeType,
	TotalsNodePosition,
	ViewState,
} from "../calculator/models";
import {
	createBaseElement,
	expandElementWithRecipe,
	generateElementId,
	setElementToExtraction,
	setElementToMining,
} from "../calculator/utils";
import { BuildingDetailsService } from "../data/building-details-service";
import { DSPData } from "../data/dsp-data";

const STORAGE_KEY = "dsp-calculator-state-v1";

function loadSavedState(): Partial<CalculatorState> | null {
	if (typeof window === "undefined") return null;
	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		return saved ? JSON.parse(saved) : null;
	} catch (e) {
		console.warn("Failed to load calculator state:", e);
		return null;
	}
}

function saveState(state: CalculatorState): void {
	if (typeof window === "undefined") return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch (e) {
		console.warn("Failed to save calculator state:", e);
	}
}

const initialState: CalculatorState = {
	targets: [],
	globalDefaults: {
		facilities: {
			Smelt: 2302,
			Assemble: 2303,
			Chemical: 2309,
			Refine: 2308,
			Research: 2901,
			Particle: 2310,
			Fractionate: 2314,
			Proliferator: 0,
		},
		proliferator: { mode: "none", level: 0 },
	},
	elements: {},
	nodePositions: [],
	totalsNodePositions: [],
	selectedElementId: null,
	viewState: { scale: 1, translateX: 0, translateY: 0 },
};

// Initialize with default state - hydration-safe
export const calculatorStore = new Store<CalculatorState>(initialState);

// Subscribe to save state changes
calculatorStore.subscribe(() => {
	saveState(calculatorStore.state);
});

// Load saved state after hydration (client-side only)
if (typeof window !== "undefined") {
	const savedState = loadSavedState();
	if (savedState) {
		calculatorStore.setState((state) => ({
			...state,
			...savedState,
		}));
	}
}

export function addTarget(itemId: number, targetRate: number): string {
	const targetId = generateElementId();
	const elementId = generateElementId();

	let element = createBaseElement(itemId, targetRate, null, 0);
	element.id = elementId;

	const miningTime = DSPData.getMiningTime(itemId);
	const extractionSpeed = DSPData.getExtractionSpeed(itemId);

	if (miningTime !== undefined) {
		element = setElementToMining(element, miningTime);
	} else if (extractionSpeed !== undefined) {
		element = setElementToExtraction(element, extractionSpeed);
	} else {
		const recipes = DSPData.getRecipesProducing(itemId);
		if (recipes.length > 0) {
			const childElements: Record<string, CalculationElement> = {};
			element = expandElementWithRecipe(
				element,
				recipes[0].ID,
				getContext(),
				calculatorStore.state.globalDefaults,
				(child) => {
					childElements[child.id] = autoAssignSource(child);
				},
			);
			Object.assign(childElements, { [elementId]: element });

			const target: CalculationTarget = {
				id: targetId,
				itemId,
				targetRate,
				rootElementId: elementId,
			};
			calculatorStore.setState((state) => ({
				...state,
				targets: [...state.targets, target],
				elements: { ...state.elements, ...childElements },
			}));
			return targetId;
		}
	}

	const target: CalculationTarget = {
		id: targetId,
		itemId,
		targetRate,
		rootElementId: elementId,
	};

	calculatorStore.setState((state) => ({
		...state,
		targets: [...state.targets, target],
		elements: { ...state.elements, [elementId]: element },
	}));

	return targetId;
}

export function removeTarget(targetId: string): void {
	calculatorStore.setState((state) => {
		const target = state.targets.find((t) => t.id === targetId);
		if (!target) return state;

		const elementsToRemove = new Set<string>();
		collectElementIds(target.rootElementId, state.elements, elementsToRemove);

		const newElements = { ...state.elements };
		for (const id of elementsToRemove) {
			delete newElements[id];
		}

		return {
			...state,
			targets: state.targets.filter((t) => t.id !== targetId),
			elements: newElements,
		};
	});
}

function collectElementIds(
	elementId: string,
	elements: Record<string, CalculationElement>,
	ids: Set<string>,
): void {
	if (ids.has(elementId)) return;
	ids.add(elementId);

	const element = elements[elementId];
	if (element) {
		for (const childId of element.inputs) {
			collectElementIds(childId, elements, ids);
		}
	}
}

export function setElementRecipe(
	elementId: string,
	recipeId: number,
	fromScratch = false,
): void {
	calculatorStore.setState((state) => {
		const element = state.elements[elementId];
		if (!element) return state;

		const childElements: Record<string, CalculationElement> = {};
		const expanded = expandElementWithRecipe(
			element,
			recipeId,
			getContext(),
			state.globalDefaults,
			(child) => {
				if (!state.elements[child.id] && !childElements[child.id]) {
					if (fromScratch) {
						// Recursively expand the entire chain
						const expandedChild = expandElementRecursively(
							child,
							state.globalDefaults,
							childElements,
						);
						childElements[child.id] = expandedChild;
					} else {
						// Just auto-assign mining/extraction if available
						childElements[child.id] = autoAssignSource(child);
					}
				}
			},
		);

		return {
			...state,
			elements: { ...state.elements, ...childElements, [elementId]: expanded },
		};
	});
}

function expandElementRecursively(
	element: CalculationElement,
	globalDefaults: CalculatorState["globalDefaults"],
	childElements: Record<string, CalculationElement>,
): CalculationElement {
	// First check if this item can be mined or extracted
	const miningTime = DSPData.getMiningTime(element.itemId);
	if (miningTime !== undefined) {
		return setElementToMining(element, miningTime);
	}

	const extractionSpeed = DSPData.getExtractionSpeed(element.itemId);
	if (extractionSpeed !== undefined) {
		return setElementToExtraction(element, extractionSpeed);
	}

	// Otherwise, try to find a recipe
	const recipes = DSPData.getRecipesProducing(element.itemId);
	if (recipes.length === 0) {
		// No recipe available, return as-is
		return element;
	}

	// Use the first (default) recipe
	const recipeId = recipes[0].ID;

	return expandElementWithRecipe(
		element,
		recipeId,
		getContext(),
		globalDefaults,
		(child) => {
			if (!childElements[child.id]) {
				const expandedChild = expandElementRecursively(
					child,
					globalDefaults,
					childElements,
				);
				childElements[child.id] = expandedChild;
			}
		},
	);
}

export function setElementToMiningSource(elementId: string): void {
	calculatorStore.setState((state) => {
		const element = state.elements[elementId];
		if (!element) return state;

		const miningTime = DSPData.getMiningTime(element.itemId);
		if (!miningTime) return state;

		const updated = setElementToMining(element, miningTime);

		return {
			...state,
			elements: { ...state.elements, [elementId]: updated },
		};
	});
}

export function setElementToExtractionSource(elementId: string): void {
	calculatorStore.setState((state) => {
		const element = state.elements[elementId];
		if (!element) return state;

		const extractionSpeed = DSPData.getExtractionSpeed(element.itemId);
		if (!extractionSpeed) return state;

		const updated = setElementToExtraction(element, extractionSpeed);

		return {
			...state,
			elements: { ...state.elements, [elementId]: updated },
		};
	});
}

export function clearElementSource(elementId: string): void {
	calculatorStore.setState((state) => {
		const element = state.elements[elementId];
		if (!element) return state;

		// Collect all child element IDs to remove
		const childrenToRemove = new Set<string>();
		collectChildIds(elementId, state.elements, childrenToRemove);

		// Remove children and update the element
		const newElements = { ...state.elements };
		for (const id of childrenToRemove) {
			delete newElements[id];
		}

		// Reset the element to have no source
		newElements[elementId] = {
			...element,
			source: null,
			facility: null,
			inputs: [],
			byproducts: [],
			actualRate: 0,
		};

		return {
			...state,
			elements: newElements,
		};
	});
}

function collectChildIds(
	elementId: string,
	elements: Record<string, CalculationElement>,
	ids: Set<string>,
): void {
	const element = elements[elementId];
	if (!element) return;

	for (const childId of element.inputs) {
		if (!ids.has(childId)) {
			ids.add(childId);
			collectChildIds(childId, elements, ids);
		}
	}
}

export function setDefaultFacility(
	recipeType: RecipeType,
	facilityItemId: number | undefined,
): void {
	calculatorStore.setState((state) => ({
		...state,
		globalDefaults: {
			...state.globalDefaults,
			facilities: {
				...state.globalDefaults.facilities,
				[recipeType]: facilityItemId,
			},
		},
	}));
}

export function setDefaultProliferator(
	mode: ProliferatorMode,
	level: number,
): void {
	calculatorStore.setState((state) => ({
		...state,
		globalDefaults: {
			...state.globalDefaults,
			proliferator: { mode, level },
		},
	}));
}

export function updateNodePosition(
	elementId: string,
	x: number,
	y: number,
): void {
	calculatorStore.setState((state) => {
		const existingIndex = state.nodePositions.findIndex(
			(np) => np.elementId === elementId,
		);

		let newPositions: NodePosition[];
		if (existingIndex >= 0) {
			newPositions = [...state.nodePositions];
			newPositions[existingIndex] = { elementId, x, y };
		} else {
			newPositions = [...state.nodePositions, { elementId, x, y }];
		}

		return { ...state, nodePositions: newPositions };
	});
}

export function updateTotalsNodePosition(
	itemId: number,
	x: number,
	y: number,
): void {
	calculatorStore.setState((state) => {
		const existingIndex = state.totalsNodePositions.findIndex(
			(np) => np.itemId === itemId,
		);

		let newPositions: TotalsNodePosition[];
		if (existingIndex >= 0) {
			newPositions = [...state.totalsNodePositions];
			newPositions[existingIndex] = { itemId, x, y };
		} else {
			newPositions = [...state.totalsNodePositions, { itemId, x, y }];
		}

		return { ...state, totalsNodePositions: newPositions };
	});
}

export function setViewState(viewState: ViewState): void {
	calculatorStore.setState((state) => ({ ...state, viewState }));
}

export function selectElement(elementId: string | null): void {
	calculatorStore.setState((state) => ({
		...state,
		selectedElementId: elementId,
	}));
}

export function getPerFacilityRate(itemId: number): number {
	const miningTime = DSPData.getMiningTime(itemId);
	if (miningTime !== undefined) {
		return (1 / miningTime) * 60; // calculateMiningRate inline
	}

	const extractionSpeed = DSPData.getExtractionSpeed(itemId);
	if (extractionSpeed !== undefined) {
		return extractionSpeed;
	}

	const recipes = DSPData.getRecipesProducing(itemId);
	if (recipes.length === 0) return 0;
	const recipe = recipes[0];
	const outputIndex = recipe.Results.indexOf(itemId);
	if (outputIndex === -1) return 0;
	const outputCount = recipe.ResultCounts[outputIndex] ?? 0;
	const { globalDefaults } = calculatorStore.state;
	const facilityItemId = globalDefaults.facilities[recipe.Type] ?? 0;
	const speedMultiplier =
		BuildingDetailsService.getSpeedMultiplier(facilityItemId) ?? 1;
	const baseRate = outputCount / (recipe.TimeSpend / 60);
	return baseRate * speedMultiplier;
}

function autoAssignSource(element: CalculationElement): CalculationElement {
	const miningTime = DSPData.getMiningTime(element.itemId);
	if (miningTime !== undefined) return setElementToMining(element, miningTime);

	const extractionSpeed = DSPData.getExtractionSpeed(element.itemId);
	if (extractionSpeed !== undefined)
		return setElementToExtraction(element, extractionSpeed);

	return element;
}

function getContext() {
	return {
		getRecipeById: (id: number) => {
			const recipe = DSPData.getRecipeById(id);
			if (!recipe) return undefined;
			return {
				id: recipe.ID,
				type: recipe.Type,
				timeSpend: recipe.TimeSpend,
				inputs: recipe.Items.map((itemId, index) => ({
					itemId,
					count: recipe.ItemCounts[index] ?? 0,
				})),
				outputs: recipe.Results.map((itemId, index) => ({
					itemId,
					count: recipe.ResultCounts[index] ?? 0,
				})),
			};
		},
		getItemById: (id: number) => DSPData.getItemById(id),
		getDefaultRecipeForItem: (itemId: number) => {
			const recipes = DSPData.getRecipesProducing(itemId);
			return recipes.length > 0 ? recipes[0].ID : undefined;
		},
		getDefaultFacilityForRecipeType: (recipeType: string) =>
			calculatorStore.state.globalDefaults.facilities[recipeType],
		getFacilityData: (itemId: number) => {
			const speedMultiplier = BuildingDetailsService.getSpeedMultiplier(itemId);
			if (speedMultiplier !== undefined) {
				return { itemId, speedMultiplier };
			}
			return undefined;
		},
		getMiningTime: (itemId: number) => DSPData.getMiningTime(itemId),
		getExtractionSpeed: (itemId: number) => DSPData.getExtractionSpeed(itemId),
	};
}
