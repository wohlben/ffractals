# FF Fractals 0 - Architecture Overview

## Project Goal

A production calculator and planner for Dyson Sphere Program (DSP) recipes, utilizing a graph-based UI with xyflow/react. This is a clean-room re-implementation learning from the prototypes `factory-fractals` (Svelte/tree-based) and `ffractals` (Angular/graph-based).

## Why Graph-Based?

Previous tree-based implementations hit limitations:

1. **Shared Resources**: Items like Iron Ingots or Circuits are used by many recipes - trees duplicate these
2. **Byproduct Loops**: Plasma Refining produces Hydrogen as a byproduct, which can be used elsewhere
3. **Visual Clarity**: Graphs show production flow more naturally than nested trees
4. **Interactive Editing**: Users can rearrange nodes, merge production lines

## Key Differences from Prototypes

| Feature | factory-fractals | ffractals | ffractals0 |
|---------|-----------------|-----------|------------|
| Framework | Svelte | Angular | React + TanStack |
| UI Type | Tree | Graph (MaxGraph) | Graph (xyflow/react) |
| State | Svelte Stores | NgRx Signals | TanStack Store |
| Recipe Selection | Auto-expand per tier | Interactive per node | Interactive per node |
| Multi-target | Single root | Multiple targets | Multiple targets |
| Persistence | localStorage | sessionStorage | localStorage |

## Technology Stack

- **Framework**: React 19 + TanStack Start
- **Router**: TanStack Router (file-based)
- **State**: TanStack Store
- **Graph UI**: xyflow/react (@xyflow/react)
- **Styling**: Tailwind CSS v4
- **Build**: Vite
- **Linting**: Biome

## Architecture Principles

1. **Clean Separation**: Data layer, calculator engine, state management, and UI are distinct layers
2. **Pure Functions**: Calculation logic is pure, making it testable and predictable
3. **Immutable Updates**: State updates follow immutable patterns
4. **Lazy Loading**: Game data loaded once and cached
5. **Persistence**: User preferences and calculator state persist across sessions

## Project Structure

```
src/
├── assets/                    # Static assets
│   ├── protoset.json         # Game data (from DSP Wiki)
│   └── images/               # Item/Recipe icons
├── lib/
│   ├── data/                 # Data layer
│   │   ├── dsp-data.ts       # Game data service
│   │   ├── models.ts         # TypeScript interfaces
│   │   └── procurement.md    # Data update procedures
│   ├── calculator/           # Calculator engine
│   │   ├── models.ts         # Calculation types
│   │   ├── utils.ts          # Pure calculation functions
│   │   └── README.md         # Calculator documentation
│   ├── stores/               # State management
│   │   ├── calculator-store.ts
│   │   └── settings-store.ts
│   └── utils.ts              # General utilities
├── components/               # Shared UI components
│   ├── ui/                   # Primitive components (shadcn)
│   ├── icons/                # Item/Recipe icon components
│   └── graph/                # xyflow node/edge components
├── hooks/                    # Custom React hooks
├── routes/                   # TanStack Router routes
│   ├── __root.tsx           # Root layout
│   ├── index.tsx            # Home page
│   ├── calculator.tsx       # Main graph calculator
│   ├── items.tsx            # Item browser
│   ├── items.$id.tsx        # Item detail
│   ├── recipes.tsx          # Recipe browser
│   ├── recipes.$id.tsx      # Recipe detail
│   └── settings.tsx         # Settings page
└── styles.css               # Global styles
```

## Core Concepts

### CalculationElement

The fundamental unit representing one step in a production chain:

```typescript
interface CalculationElement {
  id: string;                    // Unique identifier for graph node
  itemId: number;                // Item being produced
  requiredRate: number;          // Rate needed by parent (items/sec)
  actualRate: number;            // Actual output rate with facilities
  source: ElementSource | null;  // How obtained (recipe/mining/extraction)
  facility: FacilityConfig | null;
  inputs: string[];              // IDs of child elements (graph edges)
  byproducts: Byproduct[];       // Surplus outputs
  depth: number;                 // Nesting level for auto-layout
  parentIds: string[];           // Support multiple parents (graph vs tree)
}
```

### Element Sources

Items can be obtained through:

- **Recipe**: Crafted in facilities (assemblers, smelters, etc.)
- **Mining**: Extracted from ore veins (Iron Ore, Copper Ore)
- **Extraction**: Pumped from gas giants (Hydrogen, Deuterium)
- **Gathering**: Manual collection or special methods

### Byproduct Resolution

Multi-output recipes (e.g., Plasma Refining → Hydrogen + Refined Oil) produce byproducts. The calculator:

1. Tracks all byproducts across the entire graph
2. Matches them against requirements in other branches
3. Marks byproducts as "consumed" when used
4. Enables optimization recommendations

## Next Steps

See detailed documentation:
- [Data Layer](../data/README.md) - Game data models and procurement
- [Calculator Engine](../calculator/README.md) - Calculation algorithms
- [State Management](../state-management.md) - Store architecture
- [UI Components](../ui/README.md) - xyflow integration
- [Routes](../routes/README.md) - Page specifications
