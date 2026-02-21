# Data Layer Architecture

## Overview

The data layer provides type-safe access to Dyson Sphere Program game data sourced from the [DSP Wiki](https://dsp-wiki.com).

## Data Sources

### Primary Source: protoset.json

**Origin**: https://dsp-wiki.com/Module:GameData/protosets.json

Contains:
- **ItemProtoSet**: Item definitions (174 items)
- **RecipeProtoSet**: Recipe definitions (~150 recipes)
- **TechProtoSet**: Technology tree
- **ThemeProtoSet**: Planet themes with gas extraction data
- **VeinProtoSet**: Mining vein data

## Service Architecture

### DSPData Service

Singleton service providing O(1) access to game data:

```typescript
// src/lib/data/dsp-data.ts
export class DSPData {
  // Raw data arrays
  static items: Item[]
  static recipes: Recipe[]
  static themes: Theme[]
  static veins: Vein[]
  
  // Lookup maps
  static itemsById: Record<number, Item>
  static recipesById: Record<number, Recipe>
  
  // Relationship mappings
  static producedVia: Record<number, Recipe[]>     // itemId -> recipes producing it
  static relatedRecipes: Record<number, Set<number>> // itemId -> related recipe IDs
  static canBeMined: Record<number, number>        // itemId -> mining time
  static canBeExtracted: Record<number, number>    // itemId -> extraction speed
  
  // Helper methods
  static getItemById(id: number): Item | undefined
  static getRecipeById(id: number): Recipe | undefined
  static getRecipesProducing(itemId: number): Recipe[]
  static getMiningTime(itemId: number): number | undefined
  static getExtractionSpeed(itemId: number): number | undefined
  static isFluid(itemId: number): boolean
}
```

### Key Derived Data

Computed once at startup for performance:

```typescript
// Fluid items (piped)
static fluidItems = new Set(
  items.filter(i => i.IsFluid).map(i => i.ID)
)

// Buildable items (placed in world)
static buildableItems = new Set(
  items.filter(i => i.CanBuild).map(i => i.ID)
)

// Recipes involving fluids
static fluidRecipes = new Set(
  recipes.filter(r => 
    r.Items.some(i => fluidItems.has(i)) ||
    r.Results.some(i => fluidItems.has(i))
  ).map(r => r.ID)
)

// Alternative recipes sorted by complexity
static alternativeRecipes: Record<number, number[]> = 
  Object.entries(producedVia).reduce((acc, [itemId, recipes]) => {
    acc[Number(itemId)] = recipes
      .sort((a, b) => a.Items.length - b.Items.length)
      .map(r => r.ID)
    return acc
  }, {})
```

## Data Models

### Item

```typescript
interface Item {
  ID: number
  Name: string                    // "Iron Ore"
  SID: string                     // "1001"
  Type: string                    // Item type category
  IsFluid: boolean               // Determines if piped
  IsEntity: boolean              // Can be placed in world
  CanBuild: boolean              // Player can build this
  IconPath: string               // "Icons/ItemRecipe/iron-ore"
  StackSize: number
  Description: string
  // ... additional fields
}
```

### Recipe

```typescript
interface Recipe {
  ID: number
  Name: string                    // "Iron Ingot"
  SID: string                     // "1101"
  Type: RecipeType               // "Smelt", "Assemble", etc.
  TimeSpend: number              // Ticks (60 ticks = 1 second)
  Items: number[]                // Input item IDs
  ItemCounts: number[]           // Input quantities
  Results: number[]              // Output item IDs
  ResultCounts: number[]         // Output quantities
  Handcraft: boolean             // Can craft by hand
  // ... additional fields
}
```

### Recipe Types

```typescript
type RecipeType =
  | 'Smelt'        // Smelters
  | 'Assemble'     // Assemblers
  | 'Research'     // Matrix Labs
  | 'Chemical'     // Chemical Plants
  | 'Refine'       // Refineries
  | 'Particle'     // Particle Colliders
  | 'Fractionate'  // Fractionators
  | 'Proliferator' // Proliferators
  | string         // Future recipe types
```

### Theme (Gas Extraction)

```typescript
interface Theme {
  ID: number
  Name: string
  GasItems: number[]             // Item IDs extractable from gas giants
  GasSpeeds: number[]            // Extraction speeds
  WaterItemId: number           // Water extractable from this theme
  // ... additional fields
}
```

### Vein (Mining)

```typescript
interface Vein {
  ID: number
  Name: string
  MiningItem: number            // Item ID mined from this vein
  MiningTime: number            // Ticks per mining operation
  // ... additional fields
}
```

## Data Procurement

See [procurement.md](./procurement.md) for detailed update procedures.

### Quick Commands

```bash
# Update all game data
npm run update:data

# Check icon coverage
npm run check:icons

# Download missing icons
npm run download:icons
```

### Update Workflow

1. Check [DSP Patch Notes](https://dsp-wiki.com/Patch_Notes) for updates
2. Run `npm run update:data` to fetch latest protoset.json
3. Run `npm run check:icons` to identify missing icons
4. Run `npm run download:icons` to fetch new icons
5. Verify application loads without errors
6. Update version number in package.json

## Caching Strategy

- **Build-time**: protoset.json imported as module (bundled)
- **Runtime**: Lookup maps computed once on first access
- **Browser**: No API calls needed - all data is static

## Type Safety

All game data is fully typed with TypeScript interfaces. Type checking ensures:
- No missing required fields
- Correct field types (number, string, boolean, arrays)
- Proper handling of optional fields

## Icon Assets

Icons follow naming convention:
```
Icon_${itemName.replace(/ /g, '_')}.png
```

Examples:
- "Iron Ore" → `Icon_Iron_Ore.png`
- "Depot Mk.I" → `Icon_Depot_Mk.I.png`
- "Accumulator (full)" → `Icon_Accumulator_(full).png`

Resolution: 64x64 PNG from DSP Wiki media server
