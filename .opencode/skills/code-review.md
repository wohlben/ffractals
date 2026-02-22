# Code Review Agent

A specialized agent for conducting pre-commit code reviews. This agent challenges bad practices, verifies requirements are actually satisfied, identifies issues, and creates beads tickets that MUST be resolved before committing.

## Core Responsibility

**Challenge both the "how" AND the "what":**
1. **Quality Review** - Are we using best practices? (existing)
2. **Requirement Validation** - Do the changes actually satisfy the original requirements? (critical)

The agent must ask: "Does this code actually solve the problem it claims to solve?"

## When to Use

**Call this agent BEFORE committing any code changes.** It acts as a gatekeeper to ensure code quality.

## Usage

### Option 1: Via Task Tool (Recommended)

```bash
# Full review with requirement validation
task subagent_type=code-reviewer prompt="Review all staged changes. Challenge whether they actually solve the stated requirements. Check for over-engineering and missing edge cases."

# Focus on requirement validation
task subagent_type=code-reviewer prompt="Review if these changes actually solve the problem described in the issue. Is this the simplest solution? What edge cases are missing?"

# Technical review only
task subagent_type=code-reviewer prompt="Review the changes in src/components/ for TypeScript issues, React best practices, and code quality"

# Requirement-focused review
task subagent_type=code-reviewer prompt="Challenge the approach: Does this solve the root cause? Is there a simpler way? Are we at the right abstraction level?"
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

## Review Dimensions

### 1. Requirement Validation (CRITICAL)

**Ask these questions for every change:**

- [ ] **Does this actually solve the stated problem?**
  - Trace back to the original issue/requirement
  - Verify the solution addresses the root cause, not symptoms
  - Challenge: "What problem is this solving?"

- [ ] **Is this the simplest solution?**
  - Are we over-engineering?
  - Could this be done with less code?
  - Challenge: "Is there a simpler way?"

- [ ] **Are edge cases handled?**
  - What happens with empty/invalid data?
  - What about race conditions?
  - Challenge: "What could go wrong?"

- [ ] **Does the implementation match the design?**
  - Check against design docs or issue descriptions
  - Flag deviations without justification
  - Challenge: "Why deviate from the design?"

- [ ] **Are we solving the right problem?**
  - Not just "does it work" but "should we do this?"
  - Consider if there's a better architectural approach
  - Challenge: "Is this the right level of abstraction?"

### 2. Code Quality Review

The agent checks for these technical issues:

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

### Technical Blockers (P0)
1. **Type safety violations** (`any`, unsafe casts)
2. **Logic errors** that could cause runtime failures
3. **Security issues** (XSS, injection vulnerabilities)
4. **Test failures** in related code
5. **Linting errors** (not warnings)

### Requirement Validation Blockers (P1 - escalatable to P0)
1. **Solution doesn't solve the stated problem** - Changes don't address the root cause
2. **Over-engineering** - Solution is unnecessarily complex for the requirement
3. **Missing critical edge cases** - Core functionality breaks in common scenarios
4. **Wrong abstraction level** - Solving at wrong layer of architecture

**Note:** Requirement validation issues start at P1 but can be escalated to P0 if they represent fundamental misunderstandings of the problem.

## Workflow

```
Developer makes changes
    ↓
Run code review agent
    ↓
┌─────────────────────────────────────────────────────────────┐
│ REQUIREMENT VALIDATION (Challenge Phase)                    │
│ - Does this solve the stated problem?                       │
│ - Is this the simplest solution?                            │
│ - Are we solving the right problem?                         │
└─────────────────────────────────────────────────────────────┘
    ↓
Requirements questioned?
    ↓
    YES → Create P1 issue for review
        ↓
        Justify or revise approach
        ↓
        Does it actually solve the problem?
            NO → Redesign required
            YES → Continue
    ↓
    NO → Continue
    ↓
┌─────────────────────────────────────────────────────────────┐
│ CODE QUALITY REVIEW                                         │
│ - Type safety                                               │
│ - Best practices                                            │
│ - Performance                                               │
└─────────────────────────────────────────────────────────────┘
    ↓
Technical issues found?
    ↓
    YES → Create beads tickets (P0 get pre-commit-blocker)
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

============================================================
REQUIREMENT VALIDATION
============================================================

✓ src/components/graph/RecipeNode.tsx:
  ✓ Solves stated problem: Properly types RecipeNode data
  ✓ Simplest solution: Uses NodeProps<T> instead of casting
  
⚠️ src/lib/data/dsp-data.ts:
  ❓ Does this actually solve the performance issue?
     The reduce() optimization helps, but is the bottleneck actually here?
     → Consider profiling first before optimizing
     Created: ffractals0-xyz789 (P1)

============================================================
CODE QUALITY ISSUES
============================================================

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
⚠️  3 warning(s) - should be fixed
💭 1 requirement question(s) - review suggested

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

### Phase 1: Requirement Validation
1. **Analyze the changes** - What problem is being solved?
2. **Challenge assumptions** - Does this actually address the requirement?
3. **Question complexity** - Is this the simplest valid solution?
4. **Create tickets** for questionable approaches (P1, labeled `needs-validation`)

### Phase 2: Code Quality Review
5. Scan all changed files (staged + unstaged by default)
6. Apply review rules to find technical issues
7. Create beads issues for each problem found
8. Assign appropriate priority and labels

### Phase 3: Decision
9. Exit with error code 1 if critical issues exist (blocking commit)
10. Exit with code 0 if only warnings/info exist
11. Provide summary with action items

**DO NOT bypass the agent.** Critical issues (P0) represent real problems that will cause:
- Runtime errors
- Type safety violations
- Security vulnerabilities
- **Solutions that don't actually solve the problem**
- Failed CI/CD pipelines

**Requirement validation is not optional.** A technically perfect solution that doesn't solve the actual problem is worthless. The agent must challenge:
- "Are you sure this solves the issue?"
- "Is there a simpler way?"
- "What are you actually trying to accomplish?"

Always fix blockers before committing.
