# Vitest Component Testing Skill

Create comprehensive component tests using `vitest-browser-react` for React components in Vitest Browser Mode.

## When to Use

Create component tests for:
- UI components with user interactions
- Components with conditional rendering
- Components with state changes
- Form components
- Modal/dropdown components
- Complex components with multiple states

## Prerequisites

Already installed in this project:
- `vitest` 4.0.0+
- `vitest-browser-react` 2.0.5
- `@vitejs/plugin-react`

## Basic Setup

### File Structure

```
src/
  components/
    Button.tsx
    Button.test.tsx          # Component test (adjacent to component)
    graph/
      RecipeNode.tsx
      RecipeNode.test.tsx    # Component test
```

### Test File Template

```tsx
import { render } from 'vitest-browser-react'
import { expect, test, describe } from 'vitest'
import { ComponentName } from './ComponentName'

describe('ComponentName', () => {
  test('renders correctly', async () => {
    const screen = await render(<ComponentName />)
    
    await expect.element(screen.getByRole('button')).toBeVisible()
  })
})
```

## Core API

### `render(component)`

Renders a React component and returns a screen object with locators.

```tsx
import { render } from 'vitest-browser-react'

const screen = await render(<Button label="Click me" />)
```

### Locators

Use locators to find elements (built-in retry mechanism):

```tsx
// By role (preferred)
await screen.getByRole('button', { name: 'Submit' })

// By text
await screen.getByText('Hello World')

// By label
await screen.getByLabelText('Email')

// By placeholder
await screen.getByPlaceholderText('Enter name')

// By test ID
await screen.getByTestId('user-card')
```

### User Interactions

```tsx
// Click
await screen.getByRole('button').click()

// Type
await screen.getByRole('textbox').fill('Hello')

// Clear and type
await screen.getByRole('textbox').clear()
await screen.getByRole('textbox').fill('New text')

// Select option
await screen.getByRole('combobox').selectOption('option-value')

// Hover
await screen.getByRole('button').hover()

// Focus
await screen.getByRole('textbox').focus()
```

### Assertions

```tsx
// Visibility
await expect.element(screen.getByRole('button')).toBeVisible()
await expect.element(screen.getByText('Loading...')).toBeInTheDocument()

// Content
await expect.element(screen.getByRole('heading')).toHaveTextContent('Title')

// Attributes
await expect.element(screen.getByRole('button')).toHaveAttribute('disabled')

// Class
await expect.element(screen.getByRole('button')).toHaveClass('btn-primary')
```

## Testing Patterns

### Pattern 1: Basic Component Rendering

Test that the component renders with correct content:

```tsx
import { render } from 'vitest-browser-react'
import { expect, test, describe } from 'vitest'
import { GameIcon } from './GameIcon'

describe('GameIcon', () => {
  test('renders icon with correct name', async () => {
    const screen = await render(<GameIcon name="Iron_Ingot" size={32} />)
    
    const img = screen.getByRole('img')
    await expect.element(img).toBeVisible()
    await expect.element(img).toHaveAttribute('alt', 'Iron_Ingot')
  })

  test('renders fallback for unknown items', async () => {
    const screen = await render(<GameIcon name="Unknown_Item" size={32} />)
    
    const placeholder = screen.getByTestId('icon-placeholder')
    await expect.element(placeholder).toBeVisible()
  })
})
```

### Pattern 2: User Interactions

Test click handlers and state changes:

```tsx
import { render } from 'vitest-browser-react'
import { expect, test, describe, vi } from 'vitest'
import { CopyButton } from './CopyButton'

describe('CopyButton', () => {
  test('calls onCopy when clicked', async () => {
    const onCopy = vi.fn()
    const screen = await render(<CopyButton code="test" onCopy={onCopy} />)
    
    await screen.getByRole('button', { name: 'Copy' }).click()
    
    expect(onCopy).toHaveBeenCalledWith('test')
  })

  test('shows copied state after click', async () => {
    const screen = await render(<CopyButton code="test" />)
    
    await screen.getByRole('button', { name: 'Copy' }).click()
    
    await expect.element(
      screen.getByRole('button', { name: 'Copied!' })
    ).toBeVisible()
  })
})
```

### Pattern 3: Conditional Rendering

Test components that render differently based on props:

```tsx
import { render } from 'vitest-browser-react'
import { expect, test, describe } from 'vitest'
import { RecipeNode } from './RecipeNode'

describe('RecipeNode', () => {
  const mockData = {
    elementId: 'test-1',
    itemId: 1101,
    itemName: 'Iron Ingot',
    requiredRate: 1,
    actualRate: 1,
    facilityItemId: null,
    facilityCount: 0,
    hasSource: true,
    sourceType: 'recipe',
    inputHandles: [],
    cycleDuration: 1,
    perCycleAmount: 1,
    canCraft: true,
    isRoot: false,
    targetId: null,
    recipeType: 'Smelt',
  }

  test('renders item name and rate', async () => {
    const screen = await render(
      <RecipeNode data={mockData} selected={false} />
    )
    
    await expect.element(screen.getByText('Iron Ingot')).toBeVisible()
    await expect.element(screen.getByText(/1\.00\/s/)).toBeVisible()
  })

  test('shows selected state', async () => {
    const screen = await render(
      <RecipeNode data={mockData} selected={true} />
    )
    
    const node = screen.getByTestId('recipe-node')
    await expect.element(node).toHaveClass('border-blue-500')
  })

  test('shows facility count when present', async () => {
    const dataWithFacility = {
      ...mockData,
      facilityItemId: 2302,
      facilityCount: 2,
    }
    
    const screen = await render(
      <RecipeNode data={dataWithFacility} selected={false} />
    )
    
    await expect.element(screen.getByText('×2')).toBeVisible()
  })
})
```

### Pattern 4: Async Operations

Test components that load data or have async state:

```tsx
import { render } from 'vitest-browser-react'
import { expect, test, describe } from 'vitest'
import { RecipeSelector } from './RecipeSelector'

describe('RecipeSelector', () => {
  test('shows loading state initially', async () => {
    const screen = await render(<RecipeSelector elementId="test" />)
    
    await expect.element(screen.getByText('Loading...')).toBeVisible()
  })

  test('shows recipes after loading', async () => {
    const screen = await render(<RecipeSelector elementId="test" />)
    
    // Built-in retry mechanism waits for content
    await expect.element(
      screen.getByRole('button', { name: 'Iron Ingot' })
    ).toBeVisible()
  })
})
```

### Pattern 5: Form Validation

Test form inputs and validation:

```tsx
import { render } from 'vitest-browser-react'
import { expect, test, describe } from 'vitest'
import { RateEditPopover } from './RateEditPopover'

describe('RateEditPopover', () => {
  test('allows entering valid rate', async () => {
    const onConfirm = vi.fn()
    const screen = await render(
      <RateEditPopover currentRate={1} onConfirm={onConfirm} onClose={vi.fn()} />
    )
    
    const input = screen.getByRole('spinbutton')
    await input.clear()
    await input.fill('5.5')
    
    await screen.getByRole('button', { name: 'Confirm' }).click()
    
    expect(onConfirm).toHaveBeenCalledWith(5.5)
  })

  test('shows error for invalid rate', async () => {
    const screen = await render(
      <RateEditPopover currentRate={1} onConfirm={vi.fn()} onClose={vi.fn()} />
    )
    
    const input = screen.getByRole('spinbutton')
    await input.clear()
    await input.fill('-1')
    
    await screen.getByRole('button', { name: 'Confirm' }).click()
    
    await expect.element(
      screen.getByText('Rate must be positive')
    ).toBeVisible()
  })
})
```

### Pattern 6: Components with Context/Hooks

Test components that use context or custom hooks:

```tsx
import { render } from 'vitest-browser-react'
import { expect, test, describe } from 'vitest'
import { CalculatorProvider } from '@/hooks/use-calculator'
import { RecipeNode } from './RecipeNode'

describe('RecipeNode with context', () => {
  test('renders within calculator context', async () => {
    const screen = await render(
      <CalculatorProvider>
        <RecipeNode data={mockData} selected={false} />
      </CalculatorProvider>
    )
    
    await expect.element(screen.getByText('Iron Ingot')).toBeVisible()
  })
})
```

## Best Practices

### 1. Prefer Role-Based Queries

```tsx
// ✅ Good - uses semantic role
await screen.getByRole('button', { name: 'Submit' })

// ❌ Bad - uses implementation detail
await screen.getByTestId('submit-btn')
```

### 2. Test User Behavior, Not Implementation

```tsx
// ✅ Good - tests what user sees and does
await screen.getByRole('button', { name: 'Increment' }).click()
await expect.element(screen.getByText('Count: 1')).toBeVisible()

// ❌ Bad - tests implementation details
expect(component.state.count).toBe(1)
```

### 3. Use Built-in Retry Mechanism

Don't manually wait for elements - locators auto-retry:

```tsx
// ✅ Good - locator retries automatically
await expect.element(screen.getByText('Loaded')).toBeVisible()

// ❌ Bad - manual waiting
await new Promise(r => setTimeout(r, 100))
expect(screen.getByText('Loaded')).toBeVisible()
```

### 4. Test Accessibility

Include accessibility checks in your tests:

```tsx
test('button is accessible', async () => {
  const screen = await render(<Button>Click me</Button>)
  
  const button = screen.getByRole('button')
  await expect.element(button).toBeVisible()
  await expect.element(button).toHaveAttribute('aria-label', 'Click me')
})
```

### 5. Group Related Tests

Use `describe` blocks to organize tests:

```tsx
describe('RecipeNode', () => {
  describe('rendering', () => {
    test('renders item name', async () => { /* ... */ })
    test('renders rate', async () => { /* ... */ })
  })

  describe('interactions', () => {
    test('click opens popover', async () => { /* ... */ })
    test('click selects element', async () => { /* ... */ })
  })

  describe('states', () => {
    test('selected state', async () => { /* ... */ })
    test('disabled state', async () => { /* ... */ })
  })
})
```

## Mocking Dependencies

### Mock Custom Hooks

```tsx
import { vi } from 'vitest'

vi.mock('@/hooks/use-calculator', () => ({
  useCalculator: () => ({
    selectElement: vi.fn(),
    updateTargetRate: vi.fn(),
  }),
}))
```

### Mock External Libraries

```tsx
vi.mock('@xyflow/react', () => ({
  Handle: ({ id }: { id: string }) => <div data-testid={`handle-${id}`} />,
  Position: { Top: 'top', Bottom: 'bottom' },
}))
```

## Testing Edge Cases

### Empty States

```tsx
test('shows placeholder when no data', async () => {
  const screen = await render(<RecipeNode data={null} />)
  
  await expect.element(screen.getByText('No recipe selected')).toBeVisible()
})
```

### Error States

```tsx
test('shows error when loading fails', async () => {
  vi.mocked(fetchRecipe).mockRejectedValue(new Error('Failed'))
  
  const screen = await render(<RecipeSelector elementId="test" />)
  
  await expect.element(screen.getByText('Failed to load recipes')).toBeVisible()
})
```

### Boundary Values

```tsx
test('handles maximum rate', async () => {
  const screen = await render(
    <RateEditPopover currentRate={9999} onConfirm={vi.fn()} onClose={vi.fn()} />
  )
  
  const input = screen.getByRole('spinbutton')
  await expect.element(input).toHaveValue('9999')
})
```

## Running Tests

```bash
# Run all component tests
npm test

# Run specific test file
npm test -- src/components/Button.test.tsx

# Run in watch mode
npm test -- --watch

# Run with UI
npm test -- --ui
```

## Common Pitfalls

### 1. Forgetting `await`

All interactions and assertions are async:

```tsx
// ❌ Bad
screen.getByRole('button').click()

// ✅ Good
await screen.getByRole('button').click()
```

### 2. Testing Implementation Details

Focus on user-visible behavior:

```tsx
// ❌ Bad - tests internal state
expect(componentRef.current.isOpen).toBe(true)

// ✅ Good - tests visible result
await expect.element(screen.getByRole('dialog')).toBeVisible()
```

### 3. Not Testing Error Cases

Always test failure paths:

```tsx
test('handles error gracefully', async () => {
  // Mock failure
  vi.mocked(api.fetch).mockRejectedValue(new Error('Network error'))
  
  const screen = await render(<Component />)
  
  await expect.element(screen.getByText('Error loading data')).toBeVisible()
})
```

## Quick Reference

| Task | Code |
|------|------|
| Render component | `const screen = await render(<Component />)` |
| Click element | `await screen.getByRole('button').click()` |
| Type text | `await screen.getByRole('textbox').fill('text')` |
| Assert visible | `await expect.element(el).toBeVisible()` |
| Assert text | `await expect.element(el).toHaveTextContent('text')` |
| Assert attribute | `await expect.element(el).toHaveAttribute('disabled')` |
| Find by role | `screen.getByRole('button', { name: 'Label' })` |
| Find by text | `screen.getByText('Hello')` |
| Find by test ID | `screen.getByTestId('my-id')` |

## Example: Complete Test Suite

```tsx
// src/components/graph/RecipeNode.test.tsx
import { render } from 'vitest-browser-react'
import { expect, test, describe, vi } from 'vitest'
import { RecipeNode } from './RecipeNode'

// Mock dependencies
vi.mock('@/hooks/use-calculator', () => ({
  useCalculator: () => ({
    selectElement: vi.fn(),
    updateTargetRate: vi.fn(),
    updateRootFacility: vi.fn(),
    updateElementFacilityType: vi.fn(),
  }),
}))

vi.mock('@/lib/data/dsp-data', () => ({
  DSPData: {
    getItemById: (id: number) => ({
      1101: { Name: 'Iron_Ingot', ID: 1101 },
      2302: { Name: 'Arc_Smelter', ID: 2302 },
    })[id],
  },
}))

describe('RecipeNode', () => {
  const baseData = {
    elementId: 'test-1',
    itemId: 1101,
    itemName: 'Iron Ingot',
    requiredRate: 1,
    actualRate: 1,
    facilityItemId: null,
    facilityCount: 0,
    hasSource: true,
    sourceType: 'recipe',
    inputHandles: [],
    cycleDuration: 1,
    perCycleAmount: 1,
    canCraft: true,
    isRoot: false,
    targetId: null,
    recipeType: 'Smelt',
  }

  test('renders item name', async () => {
    const screen = await render(<RecipeNode data={baseData} selected={false} />)
    await expect.element(screen.getByText('Iron Ingot')).toBeVisible()
  })

  test('renders production rate', async () => {
    const screen = await render(<RecipeNode data={baseData} selected={false} />)
    await expect.element(screen.getByText(/1\.00\/s/)).toBeVisible()
  })

  test('shows cycle duration', async () => {
    const screen = await render(<RecipeNode data={baseData} selected={false} />)
    await expect.element(screen.getByText(/1s/)).toBeVisible()
  })

  test('applies selected styling when selected', async () => {
    const screen = await render(<RecipeNode data={baseData} selected={true} />)
    const node = screen.getByTestId('recipe-node')
    await expect.element(node).toHaveClass('border-blue-500')
  })
})
```
