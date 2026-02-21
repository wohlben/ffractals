# Calculator Engine Architecture

## Overview

The calculator engine is a pure, functional module for computing production requirements. It has no dependencies on React, the UI, or external state - it operates purely on data transformations.

## Design Principles

1. **Pure Functions**: All calculations are deterministic with no side effects
2. **Immutable**: Input data is never mutated; new objects are returned
3. **Testable**: Each function can be unit tested in isolation
4. **Composable**: Complex calculations built from simple, reusable functions

## Core Concepts

### CalculationElement

A node in the production graph representing one step:

```typescript
interface CalculationElement {
  id: string;                    // Unique identifier
  itemId: number;                // Item being produced
  requiredRate: number;          // Rate needed (items/sec)
  actualRate: number;            // Actual output rate
  source: ElementSource | null;  // How obtained
  facility: FacilityConfig | null;
  inputs: string[];              // Child element IDs
  byproducts: Byproduct[];       // Surplus outputs
  depth: number;                 // Graph depth
  parentIds: string[];           // Support multiple parents
}
```

### Element Sources

```typescript
type ElementSource = 
  | RecipeSource
  | MiningSource  
  | ExtractionSource
  | GatheringSource

interface RecipeSource {
  type: 'recipe'
  recipeId: number
}

interface MiningSource {
  type: 'mining'
  veinId: number
  miningTime: number  // Ticks per operation
}

interface ExtractionSource {
  type: 'extraction'
  themeId: number
  extractionSpeed: number  // Items per second
  isGas: boolean
}

interface GatheringSource {
  type: 'gathering'
  note: string
}
```

### Facility Configuration

```typescript
interface FacilityConfig {
  itemId: number;               // Building item ID
  count: number;                // Number of buildings
  speedMultiplier: number;      // Building speed (e.g., 1.0, 1.5, 3.0)
  modifier: ModifierConfig;     // Proliferator settings
}

interface ModifierConfig {
  mode: 'speed' | 'product' | 'none'
  level: number  // 0-3
}
```

## Calculation Functions

### Rate Calculations

```typescript
// Calculate output rate for a single facility
function calculateOutputRate(
  outputCount: number,        // Items per recipe
  recipeTime: number,         // TimeSpend in ticks
  facilitySpeed: number,      // Building speed multiplier
  modifier: ModifierConfig
): number {
  const baseRate = outputCount / (recipeTime / TICKS_PER_SECOND)
  const multiplier = facilitySpeed * getProliferatorMultiplier(modifier)
  return baseRate * multiplier
}

// Calculate required facilities to meet demand
function calculateRequiredFacilities(
  requiredRate: number,
  outputRate: number
): number {
  if (outputRate <= 0) return 0
  return Math.ceil(requiredRate / outputRate)
}
```

### Proliferator Multipliers

```typescript
const PROLIFERATOR_SPEED_MULTIPLIERS: Record<number, number> = {
  0: 1,
  1: 1.25,   // MK.I
  2: 1.5,    // MK.II  
  3: 1.75    // MK.III
}

const PROLIFERATOR_PRODUCT_MULTIPLIERS: Record<number, number> = {
  0: 1,
  1: 1.125,  // MK.I
  2: 1.2,    // MK.II
  3: 1.25    // MK.III
}
```

### Special Source Rates

```typescript
// Mining: 1 item per miningTime ticks
function calculateMiningRate(miningTime: number): number {
  return 1 / miningTime * TICKS_PER_SECOND
}

// Extraction: Direct items per second from theme
function calculateExtractionRate(extractionSpeed: number): number {
  return extractionSpeed
}

// Gathering: Manual collection
function calculateGatheringRate(): number {
  return 1 / 60  // 1 per second baseline
}
```

## Building Calculation Elements

### Creating Base Elements

```typescript
function createBaseElement(
  itemId: number,
  requiredRate: number,
  parentId: string | null,
  depth: number
): CalculationElement {
  return {
    id: generateElementId(),
    itemId,
    requiredRate,
    actualRate: 0,
    source: null,
    facility: null,
    inputs: [],
    byproducts: [],
    depth,
    parentIds: parentId ? [parentId] : []
  }
}
```

### Expanding with Recipe

```typescript
function expandElementWithRecipe(
  element: CalculationElement,
  recipeId: number,
  context: CalculationContext,
  defaults: GlobalDefaults
): CalculationElement {
  const recipe = context.getRecipeById(recipeId)
  if (!recipe) return element
  
  // Get the output we're targeting
  const targetOutput = recipe.outputs.find(o => o.itemId === element.itemId)
  if (!targetOutput) return element
  
  // Create facility config
  const facility = createFacilityConfig(recipe.type, context, defaults)
  
  // Calculate rates
  const outputRate = calculateOutputRate(
    targetOutput.count,
    recipe.timeSpend,
    facility.speedMultiplier,
    facility.modifier
  )
  
  const facilitiesNeeded = calculateRequiredFacilities(
    element.requiredRate,
    outputRate
  )
  
  const actualRate = outputRate * facilitiesNeeded
  
  // Build child elements for inputs
  const inputs: CalculationElement[] = []
  for (const input of recipe.inputs) {
    const inputRate = calculateInputRate(
      input.count,
      recipe.timeSpend,
      facility.speedMultiplier,
      facility.modifier
    ) * facilitiesNeeded
    
    const childElement = createBaseElement(
      input.itemId,
      inputRate,
      element.id,
      element.depth + 1
    )
    inputs.push(childElement)
  }
  
  // Track byproducts
  const byproducts: Byproduct[] = []
  for (const output of recipe.outputs) {
    if (output.itemId !== element.itemId) {
      const byproductRate = calculateOutputRate(
        output.count,
        recipe.timeSpend,
        facility.speedMultiplier,
        facility.modifier
      ) * facilitiesNeeded
      
      byproducts.push({
        itemId: output.itemId,
        rate: byproductRate,
        consumedBy: []
      })
    }
  }
  
  return {
    ...element,
    actualRate,
    source: { type: 'recipe', recipeId },
    facility: { ...facility, count: facilitiesNeeded },
    inputs: inputs.map(i => i.id),
    byproducts
  }
}
```

### Setting Mining/Extraction

```typescript
function setElementToMining(
  element: CalculationElement,
  miningTime: number
): CalculationElement {
  const rate = calculateMiningRate(miningTime)
  const facilitiesNeeded = Math.ceil(element.requiredRate / rate)
  
  return {
    ...element,
    actualRate: rate * facilitiesNeeded,
    source: { type: 'mining', veinId: 0, miningTime },
    facility: {
      itemId: MINING_DRILL_ITEM_ID,
      count: facilitiesNeeded,
      speedMultiplier: 1,
      modifier: { mode: 'none', level: 0 }
    },
    inputs: [],
    byproducts: []
  }
}
```

## Byproduct Resolution

Graphs allow byproducts from one branch to satisfy requirements in another:

```typescript
function resolveByproducts(
  elements: CalculationElement[]
): CalculationElement[] {
  // Build map of all requirements
  const requirements = new Map<number, RequirementInfo[]>()
  
  for (const element of elements) {
    const list = requirements.get(element.itemId) ?? []
    list.push({
      elementId: element.id,
      rate: element.requiredRate,
      satisfied: false
    })
    requirements.set(element.itemId, list)
  }
  
  // Match byproducts to requirements
  for (const element of elements) {
    for (const byproduct of element.byproducts) {
      const reqs = requirements.get(byproduct.itemId)
      if (!reqs) continue
      
      // Find unsatisfied requirement from different element
      const match = reqs.find(r => 
        !r.satisfied && r.elementId !== element.id
      )
      
      if (match) {
        byproduct.consumedBy.push(match.elementId)
        match.satisfied = true
      }
    }
  }
  
  return elements
}
```

## Aggregation Functions

### Resource Needs

```typescript
function calculateResourceNeeds(
  elements: CalculationElement[]
): ResourceNeeds {
  const mined = new Map<number, number>()
  const extracted = new Map<number, number>()
  const gathered = new Map<number, number>()
  
  for (const element of elements) {
    if (!element.source) continue
    
    switch (element.source.type) {
      case 'mining':
        mined.set(element.itemId, 
          (mined.get(element.itemId) ?? 0) + element.requiredRate)
        break
      case 'extraction':
        extracted.set(element.itemId,
          (extracted.get(element.itemId) ?? 0) + element.requiredRate)
        break
      case 'gathering':
        gathered.set(element.itemId,
          (gathered.get(element.itemId) ?? 0) + element.requiredRate)
        break
    }
  }
  
  return { mined, extracted, gathered }
}
```

### Facility Summary

```typescript
function calculateFacilitySummary(
  elements: CalculationElement[]
): FacilitySummary[] {
  const facilityMap = new Map<number, { count: number; recipeType?: string }>()
  
  for (const element of elements) {
    if (element.source?.type !== 'recipe') continue
    if (!element.facility || element.facility.itemId === 0) continue
    
    const current = facilityMap.get(element.facility.itemId)
    if (current) {
      current.count += element.facility.count
    } else {
      facilityMap.set(element.facility.itemId, {
        count: element.facility.count,
        recipeType: element.source.type
      })
    }
  }
  
  return Array.from(facilityMap.entries()).map(([itemId, data]) => ({
    itemId,
    count: data.count,
    recipeType: data.recipeType
  }))
}
```

### Rate Breakdown

```typescript
function calculateRateBreakdown(
  elements: CalculationElement[]
): RateBreakdown[] {
  const itemMap = new Map<
    number,
    { required: number; produced: number }
  >()
  
  for (const element of elements) {
    const current = itemMap.get(element.itemId) ?? { required: 0, produced: 0 }
    current.required += element.requiredRate
    
    if (element.source) {
      current.produced += element.actualRate
    }
    
    itemMap.set(element.itemId, current)
    
    // Add byproduct production
    for (const byproduct of element.byproducts) {
      const bpCurrent = itemMap.get(byproduct.itemId) ?? { required: 0, produced: 0 }
      bpCurrent.produced += byproduct.rate
      itemMap.set(byproduct.itemId, bpCurrent)
    }
  }
  
  return Array.from(itemMap.entries()).map(([itemId, data]) => ({
    itemId,
    requiredRate: data.required,
    producedRate: data.produced,
    surplusRate: Math.max(0, data.produced - data.required)
  }))
}
```

## Graph Operations

### Flattening

```typescript
function flattenGraph(
  rootElements: CalculationElement[]
): CalculationElement[] {
  const flat: CalculationElement[] = []
  const visited = new Set<string>()
  
  function visit(element: CalculationElement) {
    if (visited.has(element.id)) return
    visited.add(element.id)
    flat.push(element)
    
    for (const childId of element.inputs) {
      const child = findElementById(childId) // From store
      if (child) visit(child)
    }
  }
  
  for (const root of rootElements) {
    visit(root)
  }
  
  return flat
}
```

### Finding Elements

```typescript
function findElementById(
  id: string,
  elements: CalculationElement[]
): CalculationElement | undefined {
  for (const element of elements) {
    if (element.id === id) return element
    
    for (const childId of element.inputs) {
      const found = findElementById(childId, elements)
      if (found) return found
    }
  }
  return undefined
}
```

## Constants

```typescript
const TICKS_PER_SECOND = 60

const RECIPE_FACILITIES: Record<RecipeType, number[]> = {
  Smelt: [2302, 2315, 2319],        // Arc, Plane, Smelter MK.III
  Assemble: [2303, 2304, 2305, 2318], // MK.I, MK.II, MK.III, Re-combiner
  Research: [2901, 2902],           // Lab, Lab MK.II
  Chemical: [2309, 2317],           // Plant, Plant MK.II
  Refine: [2308],                   // Refinery
  Particle: [2310],                 // Collider
  Fractionate: [2314],              // Fractionator
  Proliferator: [0]                 // No facility needed
}

const FACILITY_SPEEDS: Record<number, number> = {
  2302: 1,    // Arc Smelter
  2315: 2,    // Plane Smelter
  2319: 3,    // Smelter MK.III
  2303: 0.75, // Assembler MK.I
  2304: 1,    // Assembler MK.II
  2305: 1.5,  // Assembler MK.III
  2318: 3,    // Re-combiner
  // ... etc
}
```

## Testing Strategy

The calculator engine should have comprehensive unit tests:

```typescript
// Example tests
describe('calculateOutputRate', () => {
  it('calculates base rate correctly', () => {
    const rate = calculateOutputRate(1, 60, 1, { mode: 'none', level: 0 })
    expect(rate).toBe(1) // 1 item per second
  })
  
  it('applies speed modifier', () => {
    const rate = calculateOutputRate(1, 60, 1.5, { mode: 'none', level: 0 })
    expect(rate).toBe(1.5)
  })
  
  it('applies proliferator speed bonus', () => {
    const rate = calculateOutputRate(1, 60, 1, { mode: 'speed', level: 3 })
    expect(rate).toBe(1.75)
  })
})
```

## Integration with State

The calculator engine doesn't manage state - it performs calculations. State management (adding targets, updating elements) happens in the TanStack Store, which calls these pure functions to compute new state.
