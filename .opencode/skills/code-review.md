# Code Review Agent

A specialized agent for conducting pre-commit code reviews. This agent challenges bad practices, identifies issues, and creates beads tickets that MUST be resolved before committing.

## When to Use

**Call this agent BEFORE committing any code changes.** It acts as a gatekeeper to ensure code quality.

## Usage

### Option 1: Via Task Tool (Recommended)

```bash
# Review all staged changes
task subagent_type=code-reviewer prompt="Review all staged changes before commit"

# Review with specific instructions  
task subagent_type=code-reviewer prompt="Review the changes in src/components/ for TypeScript issues and React best practices"
```

### Option 2: Direct Execution

```bash
# From project root
./.opencode/code-review

# Review staged changes only
./.opencode/code-review --staged

# Review unstaged changes
./.opencode/code-review --diff-only

# Auto-fix trivial issues
./.opencode/code-review --fix

# Show only blocking issues
./.opencode/code-review --list-blockers
```

### Option 3: Via Node

```bash
node .opencode/agents/code-reviewer.js [--staged] [--diff-only] [--fix]
```

## Review Checklist

The agent checks for these issues and creates beads tickets:

### TypeScript & Types
- [ ] No `any` types used
- [ ] No `as unknown as` casts (unless external library requires it)
- [ ] Proper generic constraints
- [ ] Return types explicitly declared for public functions
- [ ] No implicit `any` in callbacks

### Code Quality
- [ ] No console.log statements (use proper logging)
- [ ] No TODO/FIXME markers (create beads issues instead)
- [ ] No deep nesting (3+ levels) - use early returns
- [ ] Functions are pure when possible

### React Best Practices
- [ ] Components are focused and single-responsibility
- [ ] Props interfaces are defined
- [ ] useEffect dependencies are correct
- [ ] No prop drilling (use context/store)
- [ ] Keys are stable and unique

### Testing
- [ ] New logic has unit tests
- [ ] Edge cases are covered
- [ ] Tests are deterministic

### Performance
- [ ] No spread in reduce() accumulators (O(n²) complexity)
- [ ] No unnecessary re-renders
- [ ] useMemo/useCallback used appropriately

### Accessibility
- [ ] Interactive elements are focusable
- [ ] Proper ARIA labels
- [ ] Color contrast adequate

## Issue Creation

For each issue found, the agent creates a beads issue with:

1. **Title**: Clear, actionable (e.g., "Fix unsafe type cast in RecipeNode")
2. **Type**: `task` for refactors, `bug` for logic errors
3. **Priority**: 
   - P0 (0) - Critical, must fix before commit
   - P1 (1) - Warning, should fix
   - P2 (2) - Info, nice to have
4. **Description**: Includes file path, line numbers, and explanation
5. **Labels**: Critical issues get `pre-commit-blocker` label

## Critical Blocking Issues

These MUST be fixed before committing:

1. **Type safety violations** (`any`, unsafe casts) - P0
2. **Logic errors** that could cause runtime failures - P0
3. **Security issues** (XSS, injection vulnerabilities) - P0
4. **Test failures** in related code - P0
5. **Linting errors** (not warnings) - P0

## Workflow

```
Developer makes changes
    ↓
Run code review agent
    ↓
Issues found?
    ↓
    YES → Create beads tickets (P0 get pre-commit-blocker label)
        ↓
        Fix all P0 blockers
        ↓
        Re-run review
        ↓
        All clear? → Proceed
    ↓
    NO → Proceed to quality gates
    ↓
Run quality gates (tests, lint, typecheck)
    ↓
All pass? → Commit → Push
```

## Example Output

```
🔍 Code Review Agent

Getting changed files...

Reviewing 2 file(s):
  - src/components/graph/RecipeNode.tsx
  - src/lib/data/dsp-data.ts

src/components/graph/RecipeNode.tsx:
  ❌ Line 43: `any` type detected - use proper types instead
     Created: ffractals0-abc123 (P0, pre-commit-blocker)
  ⚠️  Line 89: Console statement - remove or use proper logging
     Created: ffractals0-def456 (P1)

src/lib/data/dsp-data.ts:
  ⚠️  Line 20: Spread in reduce accumulator - O(n²) complexity
     Created: ffractals0-ghi789 (P1)

============================================================
SUMMARY
============================================================
❌ 1 critical issue(s) - MUST FIX BEFORE COMMIT
⚠️  2 warning(s) - should be fixed

🚫 COMMIT BLOCKED - Fix critical issues first
```

## Integration with Git Hooks

To enforce code review before every commit, add to `.git/hooks/pre-commit`:

```bash
#!/bin/bash
./.opencode/code-review --staged
if [ $? -ne 0 ]; then
    echo "Commit blocked by code review issues"
    exit 1
fi
```

## Integration with CI/CD

Add to your CI pipeline:

```yaml
- name: Code Review
  run: |
    ./.opencode/code-review --staged
    if [ $? -ne 0 ]; then
      echo "::error::Code review found blocking issues"
      exit 1
    fi
```

## Checking for Blockers

Before committing, verify no blockers exist:

```bash
# List all open pre-commit blockers
bd list --status=open --label=pre-commit-blocker

# Check if any exist
if bd list --status=open --label=pre-commit-blocker --json | jq -e '.[]' >/dev/null; then
    echo "❌ Blocking issues found - cannot commit"
    exit 1
fi
```

## Customization

Edit `.opencode/agents/code-reviewer.js` to:
- Add new rules
- Adjust severity levels
- Modify patterns
- Add custom checks for your codebase

## Agent Behavior

The agent will:
1. Scan all changed files (staged + unstaged by default)
2. Apply review rules to find issues
3. Create beads issues for each problem found
4. Assign appropriate priority and labels
5. Exit with error code 1 if critical issues exist (blocking commit)
6. Exit with code 0 if only warnings/info exist

**DO NOT bypass the agent.** Critical issues (P0) represent real problems that will cause:
- Runtime errors
- Type safety violations
- Security vulnerabilities
- Failed CI/CD pipelines

Always fix blockers before committing.
