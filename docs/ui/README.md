# UI Architecture

## Overview

The UI layer connects the calculator state to the user through React components and xyflow/react for the graph visualization.

## Component Hierarchy

```
app/
├── components/               # Shared components
│   ├── ui/                  # Primitive components (shadcn/ui)
│   ├── icons/               # Item/Recipe icons
│   ├── graph/               # xyflow custom nodes/edges
│   └── layout/              # Layout components
├── routes/                  # TanStack Router routes
│   ├── __root.tsx          # Root layout with providers
│   ├── calculator.tsx      # Main graph interface
│   └── ...
└── hooks/                   # Custom React hooks
```

## xyflow Integration

### Node Types

Custom node components for different element types:

```typescript
// src/components/graph/RecipeNode.tsx
import { Handle, Position, type NodeProps } from '@xyflow/react'

interface RecipeNodeData {
  elementId: string
  itemId: number
  itemName: string
  requiredRate: number
  actualRate: number
  facilityItemId: number | null
  facilityCount: number
  hasSource: boolean
  sourceType: string
  onRecipeClick: () => void
  onFacilityClick: () => void
}

export function RecipeNode({ data, selected }: NodeProps<RecipeNodeData>) {
  return (
    <div className={cn(
      "rounded-lg border-2 bg-card p-3 shadow-lg w-[200px]",
      selected ? "border-primary" : "border-border",
      !data.hasSource && "border-amber-500"
    )}>
      {/* Input handle (left) */}
      <Handle type="target" position={Position.Left} />
      
      {/* Content */}
      <div className="flex items-center gap-2">
        <ItemIcon itemId={data.itemId} size={32} />
        <div className="flex-1 min-w-0">
          <div 
            className="font-medium truncate cursor-pointer hover:text-primary"
            onClick={data.onRecipeClick}
          >
            {data.itemName}
          </div>
          <div className="text-sm text-muted-foreground">
            {data.actualRate.toFixed(2)}/s
          </div>
        </div>
      </div>
      
      {/* Facility info */}
      {data.facilityItemId && (
        <div 
          className="mt-2 flex items-center gap-2 cursor-pointer"
          onClick={data.onFacilityClick}
        >
          <ItemIcon itemId={data.facilityItemId} size={20} />
          <span className="text-sm">×{data.facilityCount}</span>
        </div>
      )}
      
      {/* Output handle (right) */}
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
```

```typescript
// src/components/graph/MiningNode.tsx
interface MiningNodeData {
  elementId: string
  itemId: number
  itemName: string
  requiredRate: number
  actualRate: number
  miningDrillCount: number
}

export function MiningNode({ data, selected }: NodeProps<MiningNodeData>) {
  return (
    <div className={cn(
      "rounded-lg border-2 bg-green-950/50 p-3 shadow-lg w-[180px]",
      selected ? "border-green-500" : "border-green-800"
    )}>
      <Handle type="target" position={Position.Left} />
      
      <div className="flex items-center gap-2">
        <ItemIcon itemId={data.itemId} size={32} />
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{data.itemName}</div>
          <div className="text-xs text-green-400">Mining</div>
        </div>
      </div>
      
      <div className="mt-2 text-sm">
        <div className="text-muted-foreground">
          Rate: {data.actualRate.toFixed(2)}/s
        </div>
        <div className="text-muted-foreground">
          Drills: {data.miningDrillCount}
        </div>
      </div>
      
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
```

```typescript
// src/components/graph/ExtractionNode.tsx
interface ExtractionNodeData {
  elementId: string
  itemId: number
  itemName: string
  requiredRate: number
  actualRate: number
  collectorCount: number
}

export function ExtractionNode({ data, selected }: NodeProps<ExtractionNodeData>) {
  return (
    <div className={cn(
      "rounded-lg border-2 bg-blue-950/50 p-3 shadow-lg w-[180px]",
      selected ? "border-blue-500" : "border-blue-800"
    )}>
      <Handle type="target" position={Position.Left} />
      
      <div className="flex items-center gap-2">
        <ItemIcon itemId={data.itemId} size={32} />
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{data.itemName}</div>
          <div className="text-xs text-blue-400">Extraction</div>
        </div>
      </div>
      
      <div className="mt-2 text-sm text-muted-foreground">
        <div>Rate: {data.actualRate.toFixed(2)}/s</div>
        <div>Collectors: {data.collectorCount}</div>
      </div>
      
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
```

### Edge Component

```typescript
// src/components/graph/FlowEdge.tsx
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react'

interface FlowEdgeData {
  rate: number
  itemId: number
}

export function FlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data
}: EdgeProps<FlowEdgeData>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY
  })
  
  return (
    <>
      <BaseEdge 
        id={id} 
        path={edgePath}
        style={{ stroke: '#6b7280', strokeWidth: 2 }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            background: '#1f2937',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '12px',
            color: '#9ca3af'
          }}
          className="nodrag nopan"
        >
          {data?.rate.toFixed(2)}/s
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
```

### Graph Container

```typescript
// src/components/graph/CalculatorGraph.tsx
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { RecipeNode, MiningNode, ExtractionNode } from './nodes'
import { FlowEdge } from './FlowEdge'
import { useCalculator } from '@/hooks/use-calculator'
import { buildGraphFromState } from '@/lib/graph/builder'

const nodeTypes = {
  recipe: RecipeNode,
  mining: MiningNode,
  extraction: ExtractionNode
}

const edgeTypes = {
  flow: FlowEdge
}

export function CalculatorGraph() {
  const { targets, elements, updateNodePosition } = useCalculator()
  
  // Build xyflow nodes/edges from calculator state
  const { nodes: initialNodes, edges: initialEdges } = buildGraphFromState(
    targets,
    elements
  )
  
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  
  // Sync with calculator state
  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = buildGraphFromState(
      targets,
      elements
    )
    setNodes(newNodes)
    setEdges(newEdges)
  }, [targets, elements])
  
  // Handle node drag end - save positions
  const onNodeDragStop = useCallback((_: unknown, node: Node) => {
    updateNodePosition(node.id, node.position.x, node.position.y)
  }, [updateNodePosition])
  
  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        attributionPosition="bottom-right"
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  )
}
```

### Graph Builder

```typescript
// src/lib/graph/builder.ts
import type { Node, Edge } from '@xyflow/react'
import type { CalculationTarget, CalculationElement } from '@/lib/calculator/models'

export function buildGraphFromState(
  targets: CalculationTarget[],
  elements: Record<string, CalculationElement>
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []
  const visited = new Set<string>()
  
  // Process each target tree
  for (const target of targets) {
    const rootElement = elements[target.rootElementId]
    if (!rootElement) continue
    
    processElement(rootElement, null, 0, 0)
  }
  
  function processElement(
    element: CalculationElement,
    parentElement: CalculationElement | null,
    depth: number,
    siblingIndex: number
  ): void {
    if (visited.has(element.id)) {
      // Already processed - just add edge from parent
      if (parentElement) {
        edges.push(createEdge(parentElement, element))
      }
      return
    }
    visited.add(element.id)
    
    // Determine node type
    let nodeType = 'recipe'
    if (element.source?.type === 'mining') nodeType = 'mining'
    if (element.source?.type === 'extraction') nodeType = 'extraction'
    
    // Create node
    const node: Node = {
      id: element.id,
      type: nodeType,
      position: getNodePosition(element, depth, siblingIndex),
      data: createNodeData(element)
    }
    nodes.push(node)
    
    // Create edge from parent
    if (parentElement) {
      edges.push(createEdge(parentElement, element))
    }
    
    // Process children
    for (let i = 0; i < element.inputs.length; i++) {
      const childId = element.inputs[i]
      const child = elements[childId]
      if (child) {
        processElement(child, element, depth + 1, i)
      }
    }
  }
  
  return { nodes, edges }
}

function createNodeData(element: CalculationElement) {
  return {
    elementId: element.id,
    itemId: element.itemId,
    itemName: DSPData.getItemById(element.itemId)?.Name ?? 'Unknown',
    requiredRate: element.requiredRate,
    actualRate: element.actualRate,
    facilityItemId: element.facility?.itemId ?? null,
    facilityCount: element.facility?.count ?? 0,
    hasSource: !!element.source,
    sourceType: element.source?.type ?? ''
  }
}

function createEdge(parent: CalculationElement, child: CalculationElement): Edge {
  return {
    id: `${child.id}-${parent.id}`,
    source: child.id,
    target: parent.id,
    type: 'flow',
    data: { rate: child.actualRate, itemId: child.itemId }
  }
}
```

## Modals and Overlays

### Recipe Selector Modal

```typescript
// src/components/modals/RecipeSelector.tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useCalculator, useSettings } from '@/hooks'

interface RecipeSelectorProps {
  elementId: string | null
  onClose: () => void
}

export function RecipeSelector({ elementId, onClose }: RecipeSelectorProps) {
  const { elements, setElementRecipe, setElementToMining, setElementToExtraction } = useCalculator()
  const element = elementId ? elements[elementId] : null
  
  if (!element) return null
  
  const itemId = element.itemId
  const availableRecipes = DSPData.getRecipesProducing(itemId)
  const canMine = DSPData.canItemBeMined(itemId)
  const canExtract = DSPData.canItemBeExtracted(itemId)
  
  return (
    <Dialog open={!!elementId} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ItemIcon itemId={itemId} size={32} />
            Select Source for {DSPData.getItemById(itemId)?.Name}
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          {/* Recipe options */}
          {availableRecipes.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2">Recipes</h3>
              <div className="grid gap-2">
                {availableRecipes.map((recipe) => (
                  <button
                    key={recipe.ID}
                    onClick={() => {
                      setElementRecipe(elementId!, recipe.ID)
                      onClose()
                    }}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border text-left",
                      element.source?.type === 'recipe' && 
                      (element.source as RecipeSource).recipeId === recipe.ID
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <ItemIcon itemId={recipe.Results[0]} size={40} />
                    <div className="flex-1">
                      <div className="font-medium">{recipe.Name}</div>
                      <div className="text-sm text-muted-foreground">
                        {recipe.TimeSpend / 60}s | 
                        {recipe.Items.map((id, i) => (
                          <span key={id} className="ml-1">
                            {recipe.ItemCounts[i]}× {DSPData.getItemById(id)?.Name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* Mining option */}
          {canMine && (
            <button
              onClick={() => {
                setElementToMining(elementId!)
                onClose()
              }}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border",
                element.source?.type === 'mining'
                  ? "border-green-500 bg-green-500/5"
                  : "border-border hover:border-green-500/50"
              )}
            >
              <MineIcon className="w-10 h-10 text-green-500" />
              <div>
                <div className="font-medium">Mining</div>
                <div className="text-sm text-muted-foreground">
                  Extract from ore veins
                </div>
              </div>
            </button>
          )}
          
          {/* Extraction option */}
          {canExtract && (
            <button
              onClick={() => {
                setElementToExtraction(elementId!)
                onClose()
              }}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border",
                element.source?.type === 'extraction'
                  ? "border-blue-500 bg-blue-500/5"
                  : "border-border hover:border-blue-500/50"
              )}
            >
              <OrbitIcon className="w-10 h-10 text-blue-500" />
              <div>
                <div className="font-medium">Orbital Extraction</div>
                <div className="text-sm text-muted-foreground">
                  Collect from gas giants
                </div>
              </div>
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

### Facility Selector

```typescript
// src/components/modals/FacilitySelector.tsx
interface FacilitySelectorProps {
  elementId: string | null
  onClose: () => void
}

export function FacilitySelector({ elementId, onClose }: FacilitySelectorProps) {
  const { elements, setElementFacility, setDefaultFacility } = useCalculator()
  const element = elementId ? elements[elementId] : null
  
  if (!element || element.source?.type !== 'recipe') return null
  
  const recipeType = (element.source as RecipeSource).recipeType
  const availableFacilities = RECIPE_FACILITIES[recipeType] ?? []
  
  return (
    <Dialog open={!!elementId} onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select Facility</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-2 py-4">
          {availableFacilities.map((facilityItemId) => (
            <button
              key={facilityItemId}
              onClick={() => {
                setElementFacility(elementId!, facilityItemId)
                onClose()
              }}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border",
                element.facility?.itemId === facilityItemId
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}
            >
              <ItemIcon itemId={facilityItemId} size={40} />
              <div>
                <div className="font-medium">
                  {DSPData.getItemById(facilityItemId)?.Name}
                </div>
                <div className="text-sm text-muted-foreground">
                  Speed: {FACILITY_SPEEDS[facilityItemId]}×
                </div>
              </div>
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-2 pt-4 border-t">
          <input
            type="checkbox"
            id="setDefault"
            onChange={(e) => {
              if (e.target.checked) {
                setDefaultFacility(recipeType, element.facility?.itemId)
              }
            }}
          />
          <label htmlFor="setDefault">Set as default for {recipeType}</label>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

## Layout Components

### Sidebar

```typescript
// src/components/layout/Sidebar.tsx
export function Sidebar() {
  const { targets, addTarget, removeTarget } = useCalculator()
  const resourceNeeds = useResourceNeeds()
  const facilitySummary = useFacilitySummary()
  
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null)
  const [targetRate, setTargetRate] = useState(1)
  
  return (
    <aside className="w-80 border-r bg-card flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <h2 className="font-semibold">Production Targets</h2>
      </div>
      
      {/* Add Target Form */}
      <div className="p-4 border-b space-y-2">
        <ItemSelect 
          value={selectedItemId} 
          onChange={setSelectedItemId}
          placeholder="Select item..."
        />
        <div className="flex gap-2">
          <Input
            type="number"
            value={targetRate}
            onChange={(e) => setTargetRate(Number(e.target.value))}
            min={0.1}
            step={0.1}
          />
          <Button 
            onClick={() => {
              if (selectedItemId) {
                addTarget(selectedItemId, targetRate)
                setSelectedItemId(null)
                setTargetRate(1)
              }
            }}
            disabled={!selectedItemId}
          >
            Add
          </Button>
        </div>
      </div>
      
      {/* Targets List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {targets.map((target) => (
            <div 
              key={target.id}
              className="flex items-center gap-2 p-2 rounded-lg border"
            >
              <ItemIcon itemId={target.itemId} size={24} />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">
                  {DSPData.getItemById(target.itemId)?.Name}
                </div>
                <div className="text-sm text-muted-foreground">
                  {target.targetRate}/s
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => removeTarget(target.id)}
              >
                <XIcon className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>
      
      {/* Resource Summary */}
      <div className="p-4 border-t">
        <h3 className="font-medium mb-2">Resources</h3>
        
        {resourceNeeds.mined.size > 0 && (
          <div className="mb-2">
            <div className="text-xs text-muted-foreground mb-1">Mining</div>
            {Array.from(resourceNeeds.mined.entries()).map(([itemId, rate]) => (
              <div key={itemId} className="flex justify-between text-sm">
                <span>{DSPData.getItemById(itemId)?.Name}</span>
                <span>{rate.toFixed(2)}/s</span>
              </div>
            ))}
          </div>
        )}
        
        {resourceNeeds.extracted.size > 0 && (
          <div>
            <div className="text-xs text-muted-foreground mb-1">Extraction</div>
            {Array.from(resourceNeeds.extracted.entries()).map(([itemId, rate]) => (
              <div key={itemId} className="flex justify-between text-sm">
                <span>{DSPData.getItemById(itemId)?.Name}</span>
                <span>{rate.toFixed(2)}/s</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
```

### Main Layout

```typescript
// src/routes/__root.tsx
import { createRootRoute } from '@tanstack/react-router'
import { Sidebar } from '@/components/layout/Sidebar'
import { RecipeSelector } from '@/components/modals/RecipeSelector'
import { FacilitySelector } from '@/components/modals/FacilitySelector'
import { useCalculator } from '@/hooks'

export const Route = createRootRoute({
  component: RootComponent
})

function RootComponent() {
  const { selectedElementId, selectElement } = useCalculator()
  
  return (
    <div className="h-screen flex">
      <Sidebar />
      <main className="flex-1 relative">
        <Outlet />
        
        <RecipeSelector
          elementId={selectedElementId}
          onClose={() => selectElement(null)}
        />
        
        <FacilitySelector
          elementId={selectedElementId}
          onClose={() => selectElement(null)}
        />
      </main>
    </div>
  )
}
```

## Icon Components

```typescript
// src/components/icons/ItemIcon.tsx
import { cn } from '@/lib/utils'

interface ItemIconProps {
  itemId: number
  size?: number
  className?: string
}

export function ItemIcon({ itemId, size = 32, className }: ItemIconProps) {
  const item = DSPData.getItemById(itemId)
  if (!item) return <div className={cn("bg-muted", className)} style={{ width: size, height: size }} />
  
  const iconName = item.Name.replace(/ /g, '_')
  const src = `/assets/images/Icon_${iconName}.png`
  
  return (
    <img
      src={src}
      alt={item.Name}
      width={size}
      height={size}
      className={cn("object-contain", className)}
      onError={(e) => {
        (e.target as HTMLImageElement).src = '/assets/images/placeholder.png'
      }}
    />
  )
}
```

## Styling Guidelines

### Theme

Use CSS variables for theming:

```css
/* src/styles.css */
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
  }
 
  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 224.3 76.3% 48%;
  }
}
```

### Component Patterns

```typescript
// Use cn() for conditional classes
<div className={cn(
  "base-classes",
  condition && "conditional-class",
  isActive ? "active" : "inactive"
)} />

// Use semantic color classes
<div className="bg-card text-card-foreground border-border" />

// Use shadcn/ui primitives
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog } from '@/components/ui/dialog'
```
