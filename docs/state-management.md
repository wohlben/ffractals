# State Management Architecture

## Overview

State is managed using TanStack Store, providing a lightweight, reactive state management solution that works seamlessly with React and TanStack Router.

## Store Structure

```
stores/
├── calculator-store.ts      # Main calculator state
├── settings-store.ts        # User preferences
└── graph-store.ts          # xyflow-specific state
```

## Calculator Store

### State Shape

```typescript
interface CalculatorState {
  // Array of production targets (root nodes)
  targets: CalculationTarget[]
  
  // Global defaults for new elements
  globalDefaults: GlobalDefaults
  
  // All elements in the graph (flat map for O(1) access)
  elements: Record<string, CalculationElement>
  
  // Node positions for xyflow
  nodePositions: NodePosition[]
  
  // UI state
  selectedElementId: string | null
  viewState: ViewState
}

interface CalculationTarget {
  id: string
  itemId: number
  targetRate: number
  rootElementId: string
}

interface GlobalDefaults {
  facilities: Record<RecipeType, number | undefined>  // Default facility per recipe type
  proliferator: ModifierConfig
}

interface NodePosition {
  elementId: string
  x: number
  y: number
}

interface ViewState {
  scale: number
  translateX: number
  translateY: number
}
```

### Store Implementation

```typescript
// src/lib/stores/calculator-store.ts
import { Store } from '@tanstack/store'
import type { CalculatorState, CalculationTarget, CalculationElement } from '../calculator/models'

const STORAGE_KEY = 'dsp-calculator-state-v1'

// Load from localStorage
function loadSavedState(): Partial<CalculatorState> | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : null
  } catch (e) {
    console.warn('Failed to load calculator state:', e)
    return null
  }
}

// Save to localStorage
function saveState(state: CalculatorState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (e) {
    console.warn('Failed to save calculator state:', e)
  }
}

const initialState: CalculatorState = {
  targets: [],
  globalDefaults: {
    facilities: {
      Smelt: 2302,      // Arc Smelter
      Assemble: 2303,   // Assembler MK.I
      Chemical: 2309,   // Chemical Plant
      Refine: 2308,     // Refinery
      Research: 2901,   // Matrix Lab
      Particle: 2310,   // Particle Collider
      Fractionate: 2314 // Fractionator
    },
    proliferator: { mode: 'none', level: 0 }
  },
  elements: {},
  nodePositions: [],
  selectedElementId: null,
  viewState: { scale: 1, translateX: 0, translateY: 0 }
}

export const calculatorStore = new Store<CalculatorState>({
  ...initialState,
  ...loadSavedState()
})

// Auto-save on changes
calculatorStore.subscribe(() => {
  saveState(calculatorStore.state)
})
```

### Actions

```typescript
// Target Management
export function addTarget(itemId: number, targetRate: number): string {
  const targetId = generateElementId()
  const elementId = generateElementId()
  
  // Create root element
  const element = createBaseElement(itemId, targetRate, null, 0)
  element.id = elementId
  
  // Try to auto-expand with default recipe
  const defaultRecipeId = getDefaultRecipeForItem(itemId)
  if (defaultRecipeId) {
    const expanded = expandElementWithRecipe(
      element,
      defaultRecipeId,
      getContext(),
      calculatorStore.state.globalDefaults
    )
    updateStoreWithElement(expanded)
  } else {
    updateStoreWithElement(element)
  }
  
  const target: CalculationTarget = {
    id: targetId,
    itemId,
    targetRate,
    rootElementId: elementId
  }
  
  calculatorStore.setState((state) => ({
    ...state,
    targets: [...state.targets, target]
  }))
  
  return targetId
}

export function removeTarget(targetId: string): void {
  calculatorStore.setState((state) => {
    const target = state.targets.find(t => t.id === targetId)
    if (!target) return state
    
    // Remove all elements in this target's tree
    const elementsToRemove = new Set<string>()
    collectElementIds(target.rootElementId, state.elements, elementsToRemove)
    
    const newElements = { ...state.elements }
    for (const id of elementsToRemove) {
      delete newElements[id]
    }
    
    return {
      ...state,
      targets: state.targets.filter(t => t.id !== targetId),
      elements: newElements
    }
  })
}

// Element Updates
export function setElementRecipe(
  elementId: string,
  recipeId: number
): void {
  calculatorStore.setState((state) => {
    const element = state.elements[elementId]
    if (!element) return state
    
    const expanded = expandElementWithRecipe(
      element,
      recipeId,
      getContext(),
      state.globalDefaults
    )
    
    return {
      ...state,
      elements: {
        ...state.elements,
        [elementId]: expanded,
        // Add new child elements
        ...expanded.inputs.reduce((acc, childId) => {
          if (!state.elements[childId]) {
            // Child was newly created
            const child = findChildInElement(expanded, childId)
            if (child) acc[childId] = child
          }
          return acc
        }, {} as Record<string, CalculationElement>)
      }
    }
  })
}

export function setElementToMining(elementId: string): void {
  calculatorStore.setState((state) => {
    const element = state.elements[elementId]
    if (!element) return state
    
    const miningTime = DSPData.getMiningTime(element.itemId)
    if (!miningTime) return state
    
    const updated = setElementToMining(element, miningTime)
    
    return {
      ...state,
      elements: { ...state.elements, [elementId]: updated }
    }
  })
}

export function updateElementRate(
  elementId: string,
  newRate: number
): void {
  calculatorStore.setState((state) => {
    const element = state.elements[elementId]
    if (!element) return state
    
    // Recalculate with new rate
    const updated = recalculateElement({
      ...element,
      requiredRate: newRate
    }, state)
    
    return {
      ...state,
      elements: { ...state.elements, [elementId]: updated }
    }
  })
}

// Default Settings
export function setDefaultFacility(
  recipeType: RecipeType,
  facilityItemId: number | undefined
): void {
  calculatorStore.setState((state) => ({
    ...state,
    globalDefaults: {
      ...state.globalDefaults,
      facilities: {
        ...state.globalDefaults.facilities,
        [recipeType]: facilityItemId
      }
    }
  }))
}

export function setDefaultProliferator(
  mode: ProliferatorMode,
  level: number
): void {
  calculatorStore.setState((state) => ({
    ...state,
    globalDefaults: {
      ...state.globalDefaults,
      proliferator: { mode, level }
    }
  }))
}

// Node Positions (for xyflow)
export function updateNodePosition(
  elementId: string,
  x: number,
  y: number
): void {
  calculatorStore.setState((state) => {
    const existingIndex = state.nodePositions.findIndex(
      np => np.elementId === elementId
    )
    
    let newPositions: NodePosition[]
    if (existingIndex >= 0) {
      newPositions = [...state.nodePositions]
      newPositions[existingIndex] = { elementId, x, y }
    } else {
      newPositions = [...state.nodePositions, { elementId, x, y }]
    }
    
    return { ...state, nodePositions: newPositions }
  })
}

// View State
export function setViewState(viewState: ViewState): void {
  calculatorStore.setState((state) => ({ ...state, viewState }))
}

export function selectElement(elementId: string | null): void {
  calculatorStore.setState((state) => ({
    ...state,
    selectedElementId: elementId
  }))
}
```

### Computed Values

```typescript
// Derived stores for computed values
import { Derived } from '@tanstack/store'

// All elements flattened
export const allElements = new Derived({
  deps: [calculatorStore],
  fn: () => Object.values(calculatorStore.state.elements)
})

// Resource needs
export const resourceNeeds = new Derived({
  deps: [allElements],
  fn: () => calculateResourceNeeds(allElements.state)
})

// Facility summary
export const facilitySummary = new Derived({
  deps: [allElements],
  fn: () => calculateFacilitySummary(allElements.state)
})

// Rate breakdown
export const rateBreakdown = new Derived({
  deps: [allElements],
  fn: () => calculateRateBreakdown(allElements.state)
})

// Elements with byproducts that can be consumed
export const availableByproducts = new Derived({
  deps: [allElements],
  fn: () => {
    const byproducts: Array<{ itemId: number; rate: number; elementId: string }> = []
    
    for (const element of allElements.state) {
      for (const bp of element.byproducts) {
        if (bp.consumedBy.length === 0) {
          byproducts.push({
            itemId: bp.itemId,
            rate: bp.rate,
            elementId: element.id
          })
        }
      }
    }
    
    return byproducts
  }
})
```

## Settings Store

User preferences separate from calculator state:

```typescript
// src/lib/stores/settings-store.ts
interface SettingsState {
  // Default recipes per item (user can override)
  defaultRecipes: Record<number, number | null>
  
  // UI preferences
  sidebarCollapsed: boolean
  showRatesAsPerMinute: boolean
  
  // Graph preferences
  autoLayout: boolean
  snapToGrid: boolean
}

const SETTINGS_KEY = 'dsp-settings-v1'

export const settingsStore = new Store<SettingsState>({
  defaultRecipes: {},
  sidebarCollapsed: false,
  showRatesAsPerMinute: false,
  autoLayout: true,
  snapToGrid: false,
  ...loadSettings()
})

export function setDefaultRecipe(itemId: number, recipeId: number | null): void {
  settingsStore.setState((state) => ({
    ...state,
    defaultRecipes: { ...state.defaultRecipes, [itemId]: recipeId }
  }))
}

export function toggleSidebar(): void {
  settingsStore.setState((state) => ({
    ...state,
    sidebarCollapsed: !state.sidebarCollapsed
  }))
}
```

## React Hooks

```typescript
// src/hooks/use-calculator.ts
import { useStore } from '@tanstack/store'

export function useCalculator() {
  const state = useStore(calculatorStore)
  
  return {
    targets: state.targets,
    elements: state.elements,
    selectedElementId: state.selectedElementId,
    viewState: state.viewState,
    
    // Actions
    addTarget,
    removeTarget,
    setElementRecipe,
    setElementToMining,
    updateNodePosition,
    selectElement
  }
}

export function useResourceNeeds() {
  return useStore(resourceNeeds)
}

export function useFacilitySummary() {
  return useStore(facilitySummary)
}
```

## Persistence Strategy

1. **Calculator State**: localStorage (survives browser restart)
2. **Settings**: localStorage (user preferences)
3. **Graph Positions**: localStorage (node layout)
4. **Session State**: Not persisted (selections, temporary UI state)

## State Flow

```
User Action
    ↓
React Component calls Store Action
    ↓
Action computes new state (pure calculations)
    ↓
Store updates (triggers subscribers)
    ↓
React re-renders with new state
    ↓
localStorage auto-saves
    ↓
xyflow receives new nodes/edges
```

## Best Practices

1. **Keep actions simple**: Each action does one thing
2. **Compute in derived stores**: Don't store computed values
3. **Use flat state**: Elements as Record<string, T> for O(1) access
4. **Normalize data**: Avoid nested objects, use references (IDs)
5. **Batch updates**: Multiple changes in one setState call
6. **Type everything**: Full TypeScript coverage
