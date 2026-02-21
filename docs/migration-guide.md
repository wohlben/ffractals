# Migration Guide from Prototypes

## Overview

This document outlines what to carry over from the previous prototypes (`factory-fractals` and `ffractals`) and what to rebuild.

## What to Migrate

### From factory-fractals (Svelte)

**Keep**:
- ✓ Game data file (`protosets.json`)
- ✓ Icon images and naming conventions
- ✓ Data procurement scripts (adapt for Node/bun)
- ✓ Recipe calculation logic (adapt to pure functions)
- ✓ Item/Recipe type definitions

**Rebuild**:
- ✗ Svelte components → React components
- ✗ Svelte stores → TanStack Store
- ✗ Tree-based UI → Graph-based UI

### From ffractals (Angular)

**Keep**:
- ✓ Calculator engine architecture (`calculator.utils.ts`)
- ✓ Data models (`calculator.model.ts`)
- ✓ ProtoSets service logic (adapt to vanilla TS)
- ✓ Graph-based interaction patterns
- ✓ Byproduct resolution algorithm
- ✓ Rate calculation formulas

**Rebuild**:
- ✗ Angular components → React components
- ✗ NgRx Signal Store → TanStack Store
- ✗ MaxGraph → xyflow/react
- ✗ Angular services → Vanilla TS modules

## Code Migration Examples

### Calculator Engine

**From** (`ffractals/src/app/core/stores/calculator/calculator.utils.ts`):
```typescript
// Angular/NgRx version with injection
export function expandElementWithRecipe(
  element: CalculationElement,
  recipeId: number,
  context: CalculationContext,  // Injected services
  defaults: GlobalDefaults
): CalculationElement { ... }
```

**To** (`src/lib/calculator/utils.ts`):
```typescript
// Pure function - no framework dependencies
export function expandElementWithRecipe(
  element: CalculationElement,
  recipeId: number,
  context: CalculationContext,  // Plain interface
  defaults: GlobalDefaults
): CalculationElement { ... }
```

**Changes**:
- Remove Angular decorators (`@Injectable`)
- Convert to plain TypeScript functions
- Keep all calculation logic identical
- Add comprehensive unit tests

### Data Service

**From** (`ffractals/src/app/core/services/protosets.service.ts`):
```typescript
@Injectable({ providedIn: 'root' })
export class ProtoSetsService {
  readonly items = protoSetsData.ItemProtoSet.dataArray
  // ...
}
```

**To** (`src/lib/data/dsp-data.ts`):
```typescript
// Static class - no instantiation needed
export class DSPData {
  static items = (protosetsData as ProtoSets).ItemProtoSet.dataArray
  // ...
}
```

### State Management

**From** (`ffractals/src/app/core/stores/calculator/calculator.store.ts`):
```typescript
// NgRx Signal Store
export const CalculatorStore = signalStore(
  { providedIn: 'root' },
  withState(() => loadSavedState() ?? initialState),
  withComputed((store) => ({ ... })),
  withMethods((store) => ({ ... }))
)
```

**To** (`src/lib/stores/calculator-store.ts`):
```typescript
// TanStack Store
export const calculatorStore = new Store<CalculatorState>({
  ...initialState,
  ...loadSavedState()
})

// Actions as plain functions
export function addTarget(itemId: number, targetRate: number) { ... }
export function setElementRecipe(elementId: string, recipeId: number) { ... }
```

### Graph UI

**From** (`ffractals/src/app/features/calculator/calculator-layout.component.ts`):
```typescript
// MaxGraph with Angular
private graph: Graph | null = null

private initializeGraph(): void {
  this.graph = new Graph(container)
  this.graph.setPanning(true)
  // ...
}
```

**To** (`src/components/graph/CalculatorGraph.tsx`):
```typescript
// xyflow/react with React
import { ReactFlow, useNodesState, useEdgesState } from '@xyflow/react'

function CalculatorGraph() {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
    />
  )
}
```

## Data Files Checklist

Copy these files from `ffractals`:

- [ ] `src/assets/protosets.json` → `src/assets/protosets.json`
- [ ] `src/assets/images/*.png` → `src/assets/images/*.png`
- [ ] `docs/data-procurement.md` → `docs/data/procurement.md` (adapt)

## Implementation Order

1. **Data Layer** (Day 1)
   - Copy `protosets.json`
   - Create `dsp-data.ts` service
   - Set up icon assets

2. **Calculator Engine** (Day 1-2)
   - Port `calculator.utils.ts`
   - Port `calculator.model.ts`
   - Write unit tests

3. **State Management** (Day 2)
   - Set up TanStack Store
   - Implement calculator store
   - Implement settings store

4. **Graph UI** (Day 3-4)
   - Set up xyflow/react
   - Create custom node types
   - Implement graph builder
   - Add interactions

5. **Routes** (Day 4-5)
   - Create route files
   - Implement pages
   - Add navigation

6. **Polish** (Day 5-6)
   - Styling with Tailwind
   - Modals and UI components
   - Testing and bug fixes

## Key Improvements Over Prototypes

1. **Framework Agnostic Core**: Calculator engine has zero framework dependencies
2. **Better Testing**: Pure functions are easy to unit test
3. **Graph vs Tree**: True graph structure allows shared resources
4. **Modern Stack**: React 19, TanStack Router, xyflow/react
5. **Performance**: Flat element map for O(1) lookups
6. **Persistence**: localStorage for calculator state
7. **Type Safety**: Full TypeScript coverage throughout

## Gotchas

1. **Element References**: Store uses element IDs, not direct references (for serialization)
2. **Graph Direction**: xyflow edges go source → target, but production flows child → parent
3. **Position Persistence**: Node positions stored separately from elements
4. **Multiple Parents**: Graph supports multiple parents, but byproduct logic needs care
5. **Icon Paths**: Use same naming convention: `Icon_${name.replace(/ /g, '_')}.png`
