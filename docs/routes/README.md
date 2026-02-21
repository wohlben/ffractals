# Route Structure

## Overview

Routes are defined using TanStack Router's file-based routing convention. Each route file corresponds to a URL path.

## Route Tree

```
src/routes/
├── __root.tsx              # Root layout (wraps all routes)
├── index.tsx               # / - Home/Landing
├── calculator.tsx          # /calculator - Main graph calculator
├── items.tsx               # /items - Item browser
├── items.$id.tsx           # /items/:id - Item detail page
├── recipes.tsx             # /recipes - Recipe browser
├── recipes.$id.tsx         # /recipes/:id - Recipe detail page
└── settings.tsx            # /settings - User settings
```

## Route Specifications

### Root Layout (`/__root.tsx`)

**Path**: Wraps all routes

**Purpose**: 
- Provides app shell (sidebar, modals)
- Sets up global providers
- Handles navigation and layout

**Components**:
- Sidebar (production targets, resource summary)
- RecipeSelector modal
- FacilitySelector modal
- Global settings

### Home Page (`/index.tsx`)

**Path**: `/`

**Purpose**: Landing page with quick-start options

**Features**:
- Hero section with app description
- Quick target selector (dropdown + rate input)
- Recent calculations (from localStorage)
- Quick links to common items
- "Get Started" button → /calculator

**Components**:
- Hero
- QuickCalculator
- RecentTargets
- PopularItems

### Calculator Page (`/calculator.tsx`)

**Path**: `/calculator`

**Purpose**: Main graph-based production calculator

**Features**:
- Interactive xyflow graph
- Add/remove production targets
- Click nodes to select recipes/facilities
- Pan/zoom graph
- Auto-layout or manual positioning
- Export/import calculation state

**State**:
- Calculator store (targets, elements, positions)
- Selected element ID (for modals)
- View state (zoom, pan)

**Components**:
- CalculatorGraph (xyflow wrapper)
- GraphControls (zoom, layout, etc.)
- TargetList (sidebar)
- ResourceSummary (sidebar)

### Item Browser (`/items.tsx`)

**Path**: `/items`

**Purpose**: Browse all items in the game

**Features**:
- Grid/list view of all items
- Search/filter by name
- Filter by category (fluids, buildings, etc.)
- Sort by name, ID, or usage frequency

**Components**:
- ItemGrid
- ItemCard
- SearchBar
- FilterChips

### Item Detail (`/items.$id.tsx`)

**Path**: `/items/:id`

**Purpose**: Detailed view of a specific item

**Parameters**:
- `id`: Item ID (number)

**Features**:
- Item icon and description
- List of recipes producing this item
- List of recipes using this item
- "Add to Calculator" button
- Quick stats (stack size, is fluid, etc.)

**Data Loading**:
```typescript
export const Route = createFileRoute('/items/$id')({
  loader: ({ params }) => {
    const itemId = parseInt(params.id)
    return {
      item: DSPData.getItemById(itemId),
      producedBy: DSPData.getRecipesProducing(itemId),
      usedIn: Array.from(DSPData.relatedRecipes[itemId] || [])
        .map(id => DSPData.getRecipeById(id))
        .filter((r): r is Recipe => !!r)
    }
  }
})
```

**Components**:
- ItemHeader
- RecipeList (producing)
- RecipeList (consuming)
- AddToCalculatorButton

### Recipe Browser (`/recipes.tsx`)

**Path**: `/recipes`

**Purpose**: Browse all recipes in the game

**Features**:
- Grid/list view of all recipes
- Search/filter by name or type
- Filter by recipe type (Smelt, Assemble, etc.)
- Sort by complexity (input count)

**Components**:
- RecipeGrid
- RecipeCard
- SearchBar
- TypeFilter

### Recipe Detail (`/recipes.$id.tsx`)

**Path**: `/recipes/:id`

**Purpose**: Detailed view of a specific recipe

**Parameters**:
- `id`: Recipe ID (number)

**Features**:
- Recipe inputs/outputs visualization
- Crafting time and facility info
- List of alternate recipes
- "Calculate This" button (adds to calculator)

**Components**:
- RecipeHeader
- IngredientList
- FacilityInfo
- RelatedRecipes

### Settings Page (`/settings.tsx`)

**Path**: `/settings`

**Purpose**: User preferences and defaults

**Features**:
- Default facility per recipe type
- Default proliferator settings
- Import/export calculator state
- Clear all data
- Theme toggle (light/dark)

**Components**:
- FacilityDefaultsForm
- ProliferatorSettings
- DataManagement
- ThemeToggle

## Route Implementation Examples

### Basic Route

```typescript
// src/routes/calculator.tsx
import { createFileRoute } from '@tanstack/react-router'
import { CalculatorGraph } from '@/components/graph/CalculatorGraph'

export const Route = createFileRoute('/calculator')({
  component: CalculatorPage
})

function CalculatorPage() {
  return (
    <div className="h-full">
      <CalculatorGraph />
    </div>
  )
}
```

### Route with Loader

```typescript
// src/routes/items.$id.tsx
import { createFileRoute } from '@tanstack/react-router'
import { DSPData } from '@/lib/data/dsp-data'

export const Route = createFileRoute('/items/$id')({
  loader: ({ params }) => {
    const itemId = parseInt(params.id)
    const item = DSPData.getItemById(itemId)
    
    if (!item) {
      throw new Error(`Item ${itemId} not found`)
    }
    
    return {
      item,
      recipes: DSPData.getRecipesProducing(itemId)
    }
  },
  component: ItemDetailPage
})

function ItemDetailPage() {
  const { item, recipes } = Route.useLoaderData()
  
  return (
    <div>
      <h1>{item.Name}</h1>
      <p>{item.Description}</p>
      {/* ... */}
    </div>
  )
}
```

### Route with Search Params

```typescript
// src/routes/items.tsx
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const itemSearchSchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  sort: z.enum(['name', 'id', 'usage']).default('name')
})

export const Route = createFileRoute('/items')({
  validateSearch: itemSearchSchema,
  component: ItemsPage
})

function ItemsPage() {
  const { search, category, sort } = Route.useSearch()
  
  // Filter items based on search params
  const filteredItems = useMemo(() => {
    let items = [...DSPData.items]
    
    if (search) {
      items = items.filter(i => 
        i.Name.toLowerCase().includes(search.toLowerCase())
      )
    }
    
    if (category) {
      items = items.filter(i => i.Type === category)
    }
    
    // Sort
    items.sort((a, b) => {
      if (sort === 'name') return a.Name.localeCompare(b.Name)
      if (sort === 'id') return a.ID - b.ID
      return 0
    })
    
    return items
  }, [search, category, sort])
  
  return (
    <div>
      <SearchBar value={search} />
      <ItemGrid items={filteredItems} />
    </div>
  )
}
```

## Navigation

### Programmatic Navigation

```typescript
import { useNavigate } from '@tanstack/react-router'

function MyComponent() {
  const navigate = useNavigate()
  
  const goToCalculator = () => {
    navigate({ to: '/calculator' })
  }
  
  const goToItem = (itemId: number) => {
    navigate({ to: '/items/$id', params: { id: itemId.toString() } })
  }
  
  return (
    <button onClick={goToCalculator}>
      Open Calculator
    </button>
  )
}
```

### Link Component

```typescript
import { Link } from '@tanstack/react-router'

function Navigation() {
  return (
    <nav>
      <Link to="/" className="[&.active]:font-bold">
        Home
      </Link>
      <Link to="/calculator" className="[&.active]:font-bold">
        Calculator
      </Link>
      <Link to="/items" className="[&.active]:font-bold">
        Items
      </Link>
      <Link to="/recipes" className="[&.active]:font-bold">
        Recipes
      </Link>
    </nav>
  )
}
```

## Route Guards

```typescript
// Redirect if no targets
export const Route = createFileRoute('/calculator')({
  beforeLoad: ({ context }) => {
    if (context.calculatorStore.state.targets.length === 0) {
      throw redirect({ to: '/' })
    }
  }
})
```

## Layout Routes

For nested layouts, use layout routes:

```
src/routes/
├── __root.tsx
├── (app)/                    # Layout group
│   ├── __layout.tsx         # App layout with sidebar
│   ├── calculator.tsx
│   ├── items.tsx
│   └── recipes.tsx
└── index.tsx                # Landing page (no sidebar)
```

```typescript
// src/routes/(app)/__layout.tsx
export const Route = createFileRoute('/(app)')({
  component: AppLayout
})

function AppLayout() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
```
