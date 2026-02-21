# Agent-Browser Skill

Use this skill when you need to interact with a web browser for testing webapps, navigating websites, or automating browser tasks.

## Overview

The `agent-browser` package provides a headless browser automation tool with a client-daemon architecture. It uses Playwright under the hood and is optimized for AI agent interactions through a snapshot-ref pattern.

## Basic Setup

```typescript
import { BrowserManager } from 'agent-browser';

const browser = new BrowserManager();
```

## Standard Workflow

### 1. Launch Browser

```typescript
await browser.launch({
  id: 'launch-1',
  action: 'launch',
  headless: true,  // Set to false to see the browser window
  browser: 'chromium',  // 'chromium' | 'firefox' | 'webkit'
  viewport: { width: 1280, height: 720 },
});
```

**Common Options:**
- `headless: false` - Show browser window (useful for debugging)
- `profile: '/path/to/profile'` - Use persistent profile
- `storageState: '/path/to/state.json'` - Load cookies/localStorage
- `proxy: { server: '...', username: '...', password: '...' }` - Use proxy

### 2. Navigate to URL

```typescript
await browser.launch({
  id: 'nav-1',
  action: 'navigate',
  url: 'https://example.com',
  waitUntil: 'load',  // 'load' | 'domcontentloaded' | 'networkidle'
});
```

### 3. Get Page Snapshot (AI-Optimized)

This returns an accessibility tree with numbered refs (`@e1`, `@e2`, etc.) for interactive elements:

```typescript
const result = await browser.launch({
  id: 'snap-1',
  action: 'snapshot',
  interactive: true,   // Only interactive elements
  cursor: true,        // Include cursor-interactive elements
  compact: true,       // Remove empty structural elements
});

// Returns: refs like @e1, @e2 that map to specific elements
```

### 4. Interact with Elements

Use the refs from the snapshot for reliable element targeting:

```typescript
// Click
await browser.launch({ action: 'click', id: 'c1', selector: '@e1' });

// Type text (append to existing)
await browser.launch({ action: 'type', id: 't1', selector: '@e2', text: 'Hello' });

// Fill input (clear + type)
await browser.launch({ action: 'fill', id: 'f1', selector: '@e3', value: 'test@example.com' });

// Press key
await browser.launch({ action: 'press', id: 'p1', key: 'Enter', selector: '@e4' });

// Check/Uncheck checkbox
await browser.launch({ action: 'check', id: 'ch1', selector: '@checkbox' });
await browser.launch({ action: 'uncheck', id: 'uch1', selector: '@checkbox' });

// Select from dropdown
await browser.launch({ action: 'select', id: 's1', selector: '@dropdown', values: ['option1'] });

// Hover
await browser.launch({ action: 'hover', id: 'h1', selector: '@element' });

// Upload files
await browser.launch({ action: 'upload', id: 'u1', selector: '@fileInput', files: ['/path/to/file.pdf'] });
```

### 5. Extract Content

```typescript
// Get page HTML
await browser.launch({ action: 'content', id: 'gc1' });

// Get element HTML
await browser.launch({ action: 'content', id: 'gc2', selector: '#main' });

// Get text content
await browser.launch({ action: 'gettext', id: 'gt1', selector: '@e1' });

// Get input value
await browser.launch({ action: 'inputvalue', id: 'iv1', selector: '@input' });
```

### 6. Take Screenshots

```typescript
// Full page screenshot
await browser.launch({
  action: 'screenshot',
  id: 'ss1',
  path: '/path/to/screenshot.png',
  fullPage: true,
  format: 'png',  // 'png' | 'jpeg'
  annotate: true,  // Overlay numbered element labels
});

// Element screenshot
await browser.launch({
  action: 'screenshot',
  id: 'ss2',
  selector: '@element',
  path: '/path/to/element.png',
});
```

### 7. Wait for Elements

```typescript
// Wait for element to appear
await browser.launch({
  action: 'wait',
  id: 'w1',
  selector: '@loading',
  state: 'visible',
  timeout: 5000,
});

// Wait for element to disappear
await browser.launch({
  action: 'wait',
  id: 'w2',
  selector: '@spinner',
  state: 'hidden',
});
```

### 8. Execute JavaScript

```typescript
const result = await browser.launch({
  action: 'evaluate',
  id: 'eval1',
  script: 'document.title',
});

// With arguments
const result = await browser.launch({
  action: 'evaluate',
  id: 'eval2',
  script: '(args) => document.querySelector(args.selector).textContent',
  args: { selector: '#header' },
});
```

### 9. Scroll

```typescript
// Scroll page
await browser.launch({ action: 'scroll', id: 'sc1', direction: 'down', amount: 500 });

// Scroll element
await browser.launch({ action: 'scroll', id: 'sc2', selector: '@scrollable', direction: 'up', amount: 300 });
```

### 10. Close Browser

```typescript
await browser.launch({ action: 'close', id: 'close1' });
```

## Complete Example

```typescript
import { BrowserManager } from 'agent-browser';

async function testLogin() {
  const browser = new BrowserManager();
  
  try {
    // Launch
    await browser.launch({ id: '1', action: 'launch', headless: true });
    
    // Navigate
    await browser.launch({ id: '2', action: 'navigate', url: 'https://example.com/login' });
    
    // Get snapshot to find elements
    const snapshot = await browser.launch({ 
      id: '3', 
      action: 'snapshot', 
      interactive: true 
    });
    
    // Interact using refs from snapshot
    await browser.launch({ action: 'fill', id: '4', selector: '@e1', value: 'user@example.com' });
    await browser.launch({ action: 'fill', id: '5', selector: '@e2', value: 'password123' });
    await browser.launch({ action: 'click', id: '6', selector: '@e3' });  // Login button
    
    // Wait for redirect
    await browser.launch({ action: 'wait', id: '7', selector: '@welcome', state: 'visible' });
    
    // Take screenshot
    await browser.launch({ 
      action: 'screenshot', 
      id: '8', 
      path: './login-success.png',
      fullPage: true 
    });
    
    console.log('Login test passed!');
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await browser.launch({ action: 'close', id: '9' });
  }
}
```

## Best Practices

1. **Always use snapshots before interacting** - Get refs with `@e1`, `@e2` notation for reliable element targeting
2. **Use try/finally** - Ensure browser closes even if tests fail
3. **Take screenshots on failure** - Helps debug issues
4. **Use descriptive IDs** - Makes debugging command sequences easier
5. **Wait for elements** - Don't assume elements are immediately available after navigation
6. **Use `fill` over `type`** - `fill` clears the field first, more reliable for form inputs

## CLI Quick Reference

If you prefer CLI over programmatic API:

```bash
# Install browsers
agent-browser install

# Basic workflow
agent-browser open example.com
agent-browser snapshot -i
agent-browser click @e1
agent-browser screenshot page.png
agent-browser close

# Options
agent-browser --headed open example.com      # Visible window
agent-browser --session myapp open example.com  # Isolated session
```

## Common Issues

- **Element not found**: Use snapshot to get current refs, page may have changed
- **Timeout**: Increase timeout or wait for element to be ready
- **Headless issues**: Try `headless: false` to see what's happening
- **Navigation failed**: Check URL and waitUntil option
