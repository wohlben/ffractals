# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git
```

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds - there are no preexisting issues. everything needs to be sufficiently resolved!
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

# Project Goals

The goal of this Webapp is to provide a calculator for easier planning of factories in the game Dyson Sphere Program.
Core Mechanics of the calculation include things like
* Time a recipe takes to finish, and how its modified by different fabs
* How many inputs a recipee takes per craft and second, in oder to figure out what other fabs or gathering is necessary to complete the process
* How to optimize the production wrt delivery chains and how many items can be shipped via conveyor
* Reducing the amount of ingredients by utillizing Proliferators, and how many ingredients _these_ will consume to save on the final outputs


# Pre-Commit Code Review Workflow

**BEFORE committing any code, you MUST run the code review agent.**

The code review agent will:
1. **Challenge requirements** - Verify changes actually solve the stated problem
2. **Question approach** - Check for over-engineering and simpler solutions
3. **Analyze code quality** - Find bad practices and technical issues
4. **Create beads issues** - Track problems that MUST be resolved
5. **Block commits** - Prevent commits with critical issues

```bash
# Full review with requirement validation (RECOMMENDED)
task subagent_type=code-reviewer prompt="Review all staged changes. Challenge whether they actually solve the stated requirements. Check for over-engineering and missing edge cases."

# Check for blocking issues
bd list --status=open --label=pre-commit-blocker
```

**DO NOT commit if:**
- Any P0 (critical) technical issues exist
- Solution doesn't actually solve the stated problem
- Type safety violations are present
- Tests are failing
- Linting errors remain

## Code Review Agent

See `.opencode/skills/code-review.md` for detailed review criteria.

The agent challenges TWO dimensions:

### 1. Requirement Validation (Critical)
- Does this actually solve the stated problem?
- Is this the simplest solution?
- Are we solving the right problem?
- What edge cases are missing?

### 2. Technical Quality
- Type safety (no `any`, proper generics)
- Code quality (pure functions, error handling)
- React best practices (proper hooks, memoization)
- Testing coverage
- Performance optimizations
- Accessibility compliance

## Blocking Issues

### Technical Blockers (P0)
1. `any` types or unsafe casts
2. Logic errors causing runtime failures
3. Security vulnerabilities
4. Test failures
5. Lint errors

### Requirement Validation Blockers (P1, escalatable)
1. Solution doesn't solve the stated problem
2. Over-engineering for the requirement
3. Missing critical edge cases
4. Wrong level of abstraction

## Workflow

```
Make changes
    ↓
Run code review with requirement validation
    ↓
Does it actually solve the problem?
    ↓
NO → Redesign and retry
    ↓
YES → Check for technical issues
    ↓
Issues found?
    ↓
YES → Create beads tickets → Fix blockers → Re-review
    ↓
NO issues → Run quality gates → Commit → Push
```

# Coding rules

You're a very experience Frontend Engineer capable of discenerning when to extract logic into seperate reusable components.
Whenever you notice the same interface patterns, you first abstract the element into a generic lib/ui/components component.


* `any` use is prohibited. There is no scenario in which that is applicable.
* `x as unknown as y` is prohibited. There is no scenario in which that is necessary unless the variable thats being cast is being provided by an external library and cannot be cast in a different way. that is a scenario thats incredibly rare, borderline never.
* Types are mandatory
* Logic is generally extracted into seperate classes or utility function for easier testing
* all _logic_ has sufficient coverage for every expected code branch



