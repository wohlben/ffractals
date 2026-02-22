import { useStore } from "@tanstack/react-store";
import {
	calculateFacilitySummary,
	calculateRateBreakdown,
	calculateResourceNeeds,
} from "@/lib/calculator/utils";
import {
	addTarget,
	calculatorStore,
	clearElementSource,
	getPerFacilityRate,
	removeTarget,
	selectElement,
	setDefaultFacility,
	setDefaultProliferator,
	setElementRecipe,
	setElementToExtractionSource,
	setElementToMiningSource,
	setViewState,
	updateElementFacilityType,
	updateNodePosition,
	updateRootFacility,
	updateTargetRate,
	updateTotalsNodePosition,
} from "@/lib/stores/calculator-store";

export function useCalculator() {
	const state = useStore(calculatorStore);

	return {
		targets: state.targets,
		elements: state.elements,
		selectedElementId: state.selectedElementId,
		viewState: state.viewState,
		globalDefaults: state.globalDefaults,
		nodePositions: state.nodePositions,
		totalsNodePositions: state.totalsNodePositions,

		addTarget,
		clearElementSource,
		getPerFacilityRate,
		removeTarget,
		setElementRecipe,
		setElementToMining: setElementToMiningSource,
		setElementToExtraction: setElementToExtractionSource,
		setDefaultFacility,
		setDefaultProliferator,
		updateNodePosition,
		updateTotalsNodePosition,
		setViewState,
		selectElement,
		updateTargetRate,
		updateRootFacility,
		updateElementFacilityType,
	};
}

export function useResourceNeeds() {
	const state = useStore(calculatorStore);
	return calculateResourceNeeds(state.targets, state.elements);
}

export function useFacilitySummary() {
	const state = useStore(calculatorStore);
	return calculateFacilitySummary(state.targets, state.elements);
}

export function useRateBreakdown() {
	const state = useStore(calculatorStore);
	return calculateRateBreakdown(state.targets, state.elements);
}
