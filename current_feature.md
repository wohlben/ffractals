# Proliferator Per-Recipe Support - Implementation Plan

## Executive Summary

This document outlines the implementation plan for extending the DSP Factory Calculator to support **per-recipe proliferator configuration**. Currently, proliferators are only configured as global defaults. This feature will allow users to configure proliferator settings (mode and level) individually for each recipe node, with the proliferator consumption being properly calculated and propagated through the production chain.

### Key Capabilities

1. **Per-Recipe Proliferator Configuration**: Each recipe node can have its own proliferator mode (speed/product/none) and level (0-3)
2. **Input Rate Adjustment**: When a recipe uses "product" mode proliferators, the parent node's required input rate is reduced accordingly (e.g., 10 items → 8 items with T2 product proliferator at +20%)
3. **Proliferator Consumption Tracking**: Calculate and display how many proliferators are consumed per craft and per second for each recipe
4. **Cascading Updates**: Changes to proliferator settings properly recalculate the entire subtree

---

## Current Architecture Analysis

### Existing Proliferator Support

The codebase already has partial proliferator support:

**Files with Existing Proliferator Logic:**
- `src/lib/calculator/models.ts:8-159`: Defines `ProliferatorMode`, `ModifierConfig`, and multiplier constants
- `src/lib/calculator/utils.ts:24-46`: Uses proliferator multipliers in rate calculations
- `src/lib/stores/calculator-store.ts:368-379`: Global default proliferator configuration

**Current Multiplier Constants:**
```typescript
PROLIFERATOR_SPEED_MULTIPLIERS = { 0: 1, 1: 1.25, 2: 1.5, 3: 1.75 }
PROLIFERATOR_PRODUCT_MULTIPLIERS = { 0: 1, 1: 1.125, 2: 1.2, 3: 1.25 }
```

**Proliferator Item IDs (from protosets.json):**
- Mk.I: 1141
- Mk.II: 1142  
- Mk.III: 1143

### Data Flow Analysis

**Rate Calculation Flow:**
1. `calculateOutputRate()` - Applies speed/product multiplier to output
2. `calculateInputRate()` - Currently applies speed multiplier to inputs (BUG: should NOT apply product multiplier to inputs)
3. Child's `requiredRate` is calculated from parent's input rate

**Key Issue Identified:**
The current `calculateInputRate()` applies the proliferator multiplier to inputs, which is incorrect for "product" mode. Product mode should:
- Increase outputs (already done correctly)
- DECREASE required inputs (not yet implemented)

### Element Structure

```typescript
interface CalculationElement {
  id: string;
  itemId: number;
  requiredRate: number;      // Rate this node NEEDS from parent
  actualRate: number;        // Rate this node PRODUCES
  source: ElementSource | null;
  facility: FacilityConfig | null;  // Contains modifier config
  inputs: string[];          // Child element IDs
  byproducts: Byproduct[];
  depth: number;
  parentIds: string[];
}

interface FacilityConfig {
  itemId: number;
  count: number;
  speedMultiplier: number;
  modifier: ModifierConfig;  // { mode: "speed"|"product"|"none", level: 0-3 }
}
```

---

## Implementation Plan

### Phase 1: Fix Input Rate Calculation Logic

**Objective:** Correct the input rate calculation to properly handle product mode proliferators.

**Current Behavior:**
- `calculateInputRate()` applies the same multiplier to inputs regardless of mode
- This causes inputs to scale with speed mode (correct) but also with product mode (incorrect)

**Required Behavior:**
- **Speed Mode**: Input rate scales with speed multiplier (faster production = more inputs consumed)
- **Product Mode**: Input rate should be DIVIDED by product multiplier (fewer inputs needed for same output)

**Files to Modify:**

#### 1.1 `src/lib/calculator/utils.ts`

**Change `calculateInputRate()` function:**

```typescript
// CURRENT (lines 36-46):
export function calculateInputRate(
  inputCount: number,
  recipeTime: number,
  facilitySpeed: number,
  modifier: ModifierConfig,
): number {
  const baseRate = inputCount / (recipeTime / TICKS_PER_SECOND);
  const speedMultiplier =
    facilitySpeed * getProliferatorMultiplier(modifier.mode, modifier.level);
  return baseRate * speedMultiplier;
}

// NEW:
export function calculateInputRate(
  inputCount: number,
  recipeTime: number,
  facilitySpeed: number,
  modifier: ModifierConfig,
): number {
  const baseRate = inputCount / (recipeTime / TICKS_PER_SECOND);
  
  if (modifier.mode === "product") {
    // Product mode: inputs are reduced because we get more output per input
    // Input rate = baseRate * speed / productMultiplier
    const productMultiplier = getProliferatorMultiplier("product", modifier.level);
    return (baseRate * facilitySpeed) / productMultiplier;
  }
  
  // Speed mode (or none): inputs scale with speed
  const speedMultiplier = facilitySpeed * getProliferatorMultiplier("speed", modifier.level);
  return baseRate * speedMultiplier;
}
```

**Impact Assessment:**
- Changes rate calculations throughout the tree
- Requires recalculation of all existing calculations
- Backward compatibility: existing saves will recalculate correctly on load

### Phase 2: Add Proliferator Consumption Calculation

**Objective:** Calculate how many proliferators each recipe consumes.

**Proliferator Consumption Mechanics (from DSP wiki):**
- Each recipe input item that passes through a Spray Coater consumes 1 proliferator charge
- Charges per proliferator item: Mk.I = 12, Mk.II = ?, Mk.III = ?
- Consumption is per INPUT ITEM, not per craft
- If a recipe takes 2 Iron Ingots + 1 Copper Ingot per craft, that's 3 proliferator charges per craft

**New Constants to Add:**

#### 2.1 `src/lib/calculator/models.ts`

Add after line 142:

```typescript
// Proliferator charges per item (how many items can be sprayed per proliferator)
export const PROLIFERATOR_CHARGES: Record<number, number> = {
  1141: 12,  // Mk.I
  1142: 24,  // Mk.II (estimate - verify from game)
  1143: 48,  // Mk.III (estimate - verify from game)
};

// Default charges if specific level not found
export const DEFAULT_PROLIFERATOR_CHARGES = 12;

export interface ProliferatorConsumption {
  itemId: number;        // Which proliferator item (1141, 1142, 1143)
  chargesPerCraft: number;   // How many charges consumed per craft
  itemsPerCraft: number;     // How many proliferator ITEMS consumed per craft
  chargesPerSecond: number;  // Charges consumed per second at current rate
  itemsPerSecond: number;    // Proliferator ITEMS consumed per second
}
```

#### 2.2 `src/lib/calculator/utils.ts`

Add new function:

```typescript
export function calculateProliferatorConsumption(
  recipeInputs: Array<{ itemId: number; count: number }>,
  recipeTime: number,
  facilitySpeed: number,
  modifier: ModifierConfig,
  facilityCount: number,
  proliferatorItemId: number,
): ProliferatorConsumption | null {
  // No consumption if not using proliferators
  if (modifier.mode === "none" || modifier.level === 0) {
    return null;
  }

  // Calculate total input items per craft
  const totalInputsPerCraft = recipeInputs.reduce((sum, input) => sum + input.count, 0);
  
  if (totalInputsPerCraft === 0) {
    return null;
  }

  // Get charges for this proliferator level
  const chargesPerItem = PROLIFERATOR_CHARGES[proliferatorItemId] ?? DEFAULT_PROLIFERATOR_CHARGES;
  
  // Calculate crafts per second per facility
  const craftsPerSecondPerFacility = (TICKS_PER_SECOND / recipeTime) * facilitySpeed;
  const totalCraftsPerSecond = craftsPerSecondPerFacility * facilityCount;
  
  // Charges consumed per craft = total input items (each input item uses 1 charge)
  const chargesPerCraft = totalInputsPerCraft;
  
  // Charges consumed per second
  const chargesPerSecond = chargesPerCraft * totalCraftsPerSecond;
  
  // Items consumed per craft (fractional)
  const itemsPerCraft = chargesPerCraft / chargesPerItem;
  
  // Items consumed per second
  const itemsPerSecond = chargesPerSecond / chargesPerItem;

  return {
    itemId: proliferatorItemId,
    chargesPerCraft,
    itemsPerCraft,
    chargesPerSecond,
    itemsPerSecond,
  };
}
```

### Phase 3: Update Data Models

**Objective:** Add proliferator consumption data to element structure.

#### 3.1 `src/lib/calculator/models.ts`

**Update `CalculationElement` interface:**

```typescript
export interface CalculationElement {
  id: string;
  itemId: number;
  requiredRate: number;
  actualRate: number;
  source: ElementSource | null;
  facility: FacilityConfig | null;
  inputs: string[];
  byproducts: Byproduct[];
  depth: number;
  parentIds: string[];
  // NEW: Track proliferator consumption for this element
  proliferatorConsumption?: ProliferatorConsumption;
}
```

**Update `FacilityConfig` interface:**

```typescript
export interface FacilityConfig {
  itemId: number;
  count: number;
  speedMultiplier: number;
  modifier: ModifierConfig;
  // NEW: Explicitly track which proliferator item is being used
  proliferatorItemId?: number;
}
```

### Phase 4: Update Store Actions

**Objective:** Add actions to modify proliferator settings per element.

#### 4.1 `src/lib/stores/calculator-store.ts`

**Add new action after line 732:**

```typescript
export function updateElementProliferator(
  elementId: string,
  mode: ProliferatorMode,
  level: number,
  proliferatorItemId?: number,
): void {
  calculatorStore.setState((state) => {
    const element = state.elements[elementId];
    if (!element?.source || !element.facility) return state;
    if (element.source.type !== "recipe") return state;

    const recipeSource = element.source as RecipeSource;
    const recipe = getContext().getRecipeById(recipeSource.recipeId);
    if (!recipe) return state;

    // Determine which proliferator item to use based on level
    const prolifItemId = proliferatorItemId ?? getProliferatorItemIdForLevel(level);

    // Create updated modifier
    const newModifier: ModifierConfig = { mode, level };

    // Recalculate output rate with new modifier
    const targetOutput = recipe.outputs.find((o) => o.itemId === element.itemId);
    if (!targetOutput) return state;

    const outputRate = calculateOutputRate(
      targetOutput.count,
      recipe.timeSpend,
      element.facility.speedMultiplier,
      newModifier,
    );

    const facilitiesNeeded = calculateRequiredFacilities(
      element.requiredRate,
      outputRate,
    );

    // Calculate proliferator consumption
    const prolifConsumption = calculateProliferatorConsumption(
      recipe.inputs,
      recipe.timeSpend,
      element.facility.speedMultiplier,
      newModifier,
      facilitiesNeeded,
      prolifItemId,
    );

    // Update the element
    const updatedElement: CalculationElement = {
      ...element,
      facility: {
        ...element.facility,
        modifier: newModifier,
        proliferatorItemId: mode === "none" ? undefined : prolifItemId,
      },
      proliferatorConsumption: prolifConsumption || undefined,
    };

    // Recalculate children's required rates
    const elementsWithUpdate = { ...state.elements, [elementId]: updatedElement };
    
    for (let i = 0; i < element.inputs.length; i++) {
      const childId = element.inputs[i];
      const child = elementsWithUpdate[childId];
      if (!child) continue;

      const input = recipe.inputs[i];
      if (!input) continue;

      const inputRate =
        calculateInputRate(
          input.count,
          recipe.timeSpend,
          element.facility.speedMultiplier,
          newModifier,
        ) * facilitiesNeeded;

      elementsWithUpdate[childId] = { ...child, requiredRate: inputRate };
    }

    // Recalculate subtree
    const subtreeUpdates: Record<string, CalculationElement> = {};
    for (const childId of element.inputs) {
      const childSubtreeUpdates = recalculateSubtree(
        childId,
        elementsWithUpdate,
        getContext(),
      );
      Object.assign(subtreeUpdates, childSubtreeUpdates);
    }

    return {
      ...state,
      elements: { ...elementsWithUpdate, ...subtreeUpdates },
    };
  });
}

function getProliferatorItemIdForLevel(level: number): number {
  switch (level) {
    case 1: return 1141; // Mk.I
    case 2: return 1142; // Mk.II
    case 3: return 1143; // Mk.III
    default: return 1141;
  }
}
```

**Update `expandElementWithRecipe()` call site (line 106-193):**

Ensure proliferator consumption is calculated when creating new elements:

```typescript
// In expandElementWithRecipe, after calculating facilitiesNeeded:
const prolifConsumption = calculateProliferatorConsumption(
  recipe.inputs,
  recipe.timeSpend,
  facility.speedMultiplier,
  facility.modifier,
  facilitiesNeeded,
  facility.proliferatorItemId ?? getProliferatorItemIdForLevel(facility.modifier.level),
);

return {
  ...element,
  actualRate,
  source: { ... },
  facility: { ...facility, count: facilitiesNeeded },
  inputs,
  byproducts,
  proliferatorConsumption: prolifConsumption || undefined,  // NEW
};
```

### Phase 5: Create Proliferator Configuration UI

**Objective:** Build UI components for configuring proliferators per recipe.

#### 5.1 New Component: `src/components/graph/ProliferatorEditPopover.tsx`

Create a new popover component for editing proliferator settings:

```typescript
interface ProliferatorEditPopoverProps {
  currentMode: ProliferatorMode;
  currentLevel: number;
  currentItemId?: number;
  onConfirm: (mode: ProliferatorMode, level: number, itemId: number) => void;
  onClose: () => void;
}

export function ProliferatorEditPopover({
  currentMode,
  currentLevel,
  currentItemId,
  onConfirm,
  onClose,
}: ProliferatorEditPopoverProps) {
  // UI for selecting:
  // - Mode: None / Speed / Product (radio buttons or tabs)
  // - Level: 0-3 (slider or buttons)
  // - Proliferator Type: Auto (based on level) or explicit Mk.I/II/III
  
  // Show preview of:
  // - Multiplier effect
  // - Consumption per craft
  // - Consumption per second
}
```

**Key UI Elements:**
1. **Mode Selection**: Three-way toggle (None / Speed / Product)
2. **Level Selection**: 0-3 slider or buttons
3. **Item Selection**: Auto-select based on level, or manual override
4. **Preview Panel**: Show calculated effects before confirming

#### 5.2 Update `src/components/graph/RecipeNode.tsx`

Add proliferator display and edit capability:

**Add to RecipeNodeData interface:**
```typescript
interface RecipeNodeData {
  // ... existing fields
  proliferatorMode: ProliferatorMode;
  proliferatorLevel: number;
  proliferatorConsumption?: {
    itemId: number;
    itemsPerCraft: number;
    itemsPerSecond: number;
  };
}
```

**Add UI to display proliferator status:**
- Small icon/badge showing current proliferator mode/level
- Click to open ProliferatorEditPopover
- Show consumption info (items/sec) if applicable

**Location in node:**
- Place below facility count or in a dedicated "modifiers" row
- Use GameIcon for proliferator items

#### 5.3 Update `src/components/graph/TotalsNode.tsx`

Similarly add proliferator aggregation display:

**Add to TotalsNodeData interface:**
```typescript
interface TotalsNodeData {
  // ... existing fields
  proliferatorSummary?: Array<{
    itemId: number;
    totalItemsPerSecond: number;
  }>;
}
```

### Phase 6: Update Graph Data Builders

**Objective:** Pass proliferator data through to the UI components.

#### 6.1 `src/lib/graph/builder.ts`

**Update `createNodeData()` function:**

```typescript
function createNodeData(
  element: CalculationElement,
  elements: Record<string, CalculationElement>,
  rootElementIds: Set<string>,
  elementToTargetId: Map<string, string>,
) {
  // ... existing baseData
  
  return {
    ...baseData,
    // NEW: Proliferator data
    proliferatorMode: element.facility?.modifier.mode ?? "none",
    proliferatorLevel: element.facility?.modifier.level ?? 0,
    proliferatorConsumption: element.proliferatorConsumption
      ? {
          itemId: element.proliferatorConsumption.itemId,
          itemsPerCraft: element.proliferatorConsumption.itemsPerCraft,
          itemsPerSecond: element.proliferatorConsumption.itemsPerSecond,
        }
      : undefined,
  };
}
```

#### 6.2 `src/lib/graph/totals-builder.ts`

**Update aggregation logic:**

In Phase 1 aggregation, add:
```typescript
interface AggregatedItem {
  // ... existing fields
  proliferatorConsumption: Map<number, number>; // itemId -> items/sec
}

// In the aggregation loop:
if (element.proliferatorConsumption) {
  const current = agg.proliferatorConsumption.get(element.proliferatorConsumption.itemId) ?? 0;
  agg.proliferatorConsumption.set(
    element.proliferatorConsumption.itemId,
    current + element.proliferatorConsumption.itemsPerSecond
  );
}
```

**Pass to node data:**
```typescript
proliferatorSummary: Array.from(agg.proliferatorConsumption.entries()).map(
  ([itemId, rate]) => ({
    itemId,
    totalItemsPerSecond: rate,
  })
),
```

### Phase 7: Update Sidebar and Summary Views

**Objective:** Show proliferator consumption in resource summaries.

#### 7.1 `src/components/layout/Sidebar.tsx`

Add proliferator consumption section to the resources panel:

```typescript
// After facility summary, add:
{proliferatorConsumption.length > 0 && (
  <div className="mt-2">
    <div className="text-xs text-gray-400 mb-1">Proliferators</div>
    {proliferatorConsumption.map(({ itemId, rate }) => {
      const item = DSPData.getItemById(itemId);
      return (
        <div key={itemId} className="flex justify-between text-sm text-gray-300">
          <span>{item?.Name}</span>
          <span>{rate.toFixed(2)}/s</span>
        </div>
      );
    })}
  </div>
)}
```

**Add new hook or calculation function:**
```typescript
export function useProliferatorConsumption() {
  const state = useStore(calculatorStore);
  return calculateProliferatorConsumption(state.targets, state.elements);
}
```

### Phase 8: Persistence and State Management

**Objective:** Ensure proliferator settings are saved and restored.

**Current State Shape:**
```typescript
interface CalculatorState {
  targets: CalculationTarget[];
  globalDefaults: GlobalDefaults;
  elements: Record<string, CalculationElement>;
  // ... other fields
}
```

**Required Changes:**
- `proliferatorConsumption` is derived from other fields, so doesn't need to be stored
- `facility.proliferatorItemId` is already in `FacilityConfig` which is stored
- `CalculationElement` already includes `proliferatorConsumption` as optional

**Migration:**
- Existing saved states will load with `proliferatorConsumption: undefined`
- On first recalculation, it will be populated
- Add migration in `loadSavedState()` to recalculate if missing

### Phase 9: Testing Strategy

**Unit Tests to Add:**

#### 9.1 `src/lib/calculator/utils.test.ts` (new file)

```typescript
import { describe, expect, it } from "vitest";
import { calculateInputRate, calculateOutputRate, calculateProliferatorConsumption } from "./utils";

describe("calculateInputRate", () => {
  it("should scale inputs with speed mode", () => {
    const baseRate = 10;
    const result = calculateInputRate(10, 60, 1, { mode: "speed", level: 2 });
    expect(result).toBe(10 * 1.5); // 50% speed increase
  });

  it("should reduce inputs with product mode", () => {
    const baseRate = 10;
    const result = calculateInputRate(10, 60, 1, { mode: "product", level: 2 });
    expect(result).toBe(10 / 1.2); // 20% product increase = 16.7% less inputs
  });

  it("should return base rate with none mode", () => {
    const result = calculateInputRate(10, 60, 1, { mode: "none", level: 0 });
    expect(result).toBe(10);
  });
});

describe("calculateProliferatorConsumption", () => {
  it("should return null when mode is none", () => {
    const result = calculateProliferatorConsumption(
      [{ itemId: 1001, count: 2 }],
      60,
      1,
      { mode: "none", level: 0 },
      1,
      1141
    );
    expect(result).toBeNull();
  });

  it("should calculate charges per craft correctly", () => {
    const result = calculateProliferatorConsumption(
      [{ itemId: 1001, count: 2 }, { itemId: 1002, count: 3 }],
      60,
      1,
      { mode: "speed", level: 1 },
      1,
      1141
    );
    expect(result?.chargesPerCraft).toBe(5); // 2 + 3
  });
});
```

#### 9.2 Component Tests

Test `ProliferatorEditPopover`:
- Mode selection changes
- Level slider updates
- Preview calculations update
- Confirm/cancel behavior

Test updated `RecipeNode`:
- Proliferator badge displays correctly
- Click opens popover
- Updates propagate to UI

### Phase 10: Documentation and Polish

**Update README.md:**
- Document proliferator feature
- Explain how product mode reduces input requirements
- Show how to configure per-recipe

**Add Tooltips:**
- Explain proliferator modes in the UI
- Show formula calculations on hover

**Performance Considerations:**
- Proliferator consumption is calculated during recalculation (already optimized)
- No additional runtime overhead for idle state

---

## Implementation Order

**Recommended sequence:**

1. **Phase 1** (High Priority): Fix `calculateInputRate()` logic - this is the core requirement
2. **Phase 2** (High Priority): Add consumption calculation functions
3. **Phase 3** (Medium Priority): Update data models with new fields
4. **Phase 4** (High Priority): Add store action for updating proliferator settings
5. **Phase 5** (Medium Priority): Create ProliferatorEditPopover component
6. **Phase 6** (Medium Priority): Update graph builders to pass data
7. **Phase 7** (Low Priority): Update RecipeNode and TotalsNode to display proliferator info
8. **Phase 8** (Low Priority): Update Sidebar with consumption summary
9. **Phase 9** (Medium Priority): Add comprehensive tests
10. **Phase 10** (Low Priority): Documentation and polish

**Parallel Work:**
- Phases 5, 6, and 7 can be done in parallel after Phase 4
- Phase 9 should start once Phase 4 is complete

---

## Edge Cases and Considerations

### Edge Case: Mixed Proliferator Types in Totals View

When multiple elements of the same item use different proliferator types (e.g., some use Mk.I, some use Mk.II), the totals view should aggregate them separately.

**Solution:** `AggregatedItem.proliferatorConsumption` is a Map<itemId, rate>, so different proliferator types are tracked separately.

### Edge Case: Recipe with No Inputs

Some recipes (like mining, extraction, or gathering) have no inputs. Proliferator consumption should be null/undefined for these.

**Solution:** `calculateProliferatorConsumption` returns null when `totalInputsPerCraft === 0`.

### Edge Case: Fractional Facility Counts

When facility counts are fractional (e.g., 2.5 facilities), proliferator consumption should be calculated proportionally.

**Solution:** Already handled by using `facilitiesNeeded` directly in calculations.

### Edge Case: Global Defaults vs Per-Recipe

When a user changes global defaults, should existing recipes update?

**Recommendation:** No - per-recipe settings override globals. New recipes use globals as initial values.

### Edge Case: Save State Migration

Old saves won't have `proliferatorItemId` or `proliferatorConsumption` fields.

**Solution:** 
- Make all new fields optional with sensible defaults
- Recalculate on load if data is missing
- Consider adding a version field to state for future migrations

---

## Open Questions

1. **Proliferator Charges**: Need to verify actual charges per item for Mk.II and Mk.III from the game data
2. **Power Consumption**: Should we calculate and display increased power usage from speed mode?
3. **Spray Coaters**: Should we calculate how many spray coaters are needed based on belt speed?
4. **Fractionation Recipes**: Fractionators work differently - do they consume proliferators differently?

---

## Success Criteria

- [ ] Product mode correctly reduces parent input requirements (10 items → 8 with +20%)
- [ ] Speed mode correctly increases both output and input rates
- [ ] Proliferator consumption is calculated per craft and per second
- [ ] UI allows per-recipe configuration of proliferator mode and level
- [ ] Changes cascade through the production tree correctly
- [ ] Totals view aggregates proliferator consumption
- [ ] Sidebar shows total proliferator requirements
- [ ] All calculations are covered by unit tests
- [ ] UI components have component tests
- [ ] Existing save states load without errors
- [ ] Performance remains acceptable with large production trees

---

## Files Modified Summary

**Core Logic:**
- `src/lib/calculator/models.ts` - Add constants and update interfaces
- `src/lib/calculator/utils.ts` - Fix input rate, add consumption calculation

**State Management:**
- `src/lib/stores/calculator-store.ts` - Add update action

**Graph Builders:**
- `src/lib/graph/builder.ts` - Pass proliferator data
- `src/lib/graph/totals-builder.ts` - Aggregate proliferator consumption

**UI Components:**
- `src/components/graph/ProliferatorEditPopover.tsx` - NEW
- `src/components/graph/RecipeNode.tsx` - Add display and edit
- `src/components/graph/TotalsNode.tsx` - Add aggregated display
- `src/components/layout/Sidebar.tsx` - Add consumption summary

**Hooks:**
- `src/hooks/use-calculator.ts` - Export new action

**Tests:**
- `src/lib/calculator/utils.test.ts` - NEW
- `src/components/graph/ProliferatorEditPopover.test.tsx` - NEW
- `src/components/graph/RecipeNode.test.tsx` - Update existing

**Total:** ~10 files modified, 3 new files created

---

*Document Version: 1.0*
*Created: 2026-02-22*
*Status: Draft - Ready for Implementation*
