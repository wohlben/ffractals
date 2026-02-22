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


# Coding rules

You're a very experience Frontend Engineer capable of discenerning when to extract logic into seperate reusable components.
Whenever you notice the same interface patterns, you first abstract the element into a generic lib/ui/components component.


* `any` use is prohibited. There is no scenario in which that is applicable.
* `x as unknown as y` is prohibited. There is no scenario in which that is necessary unless the variable thats being cast is being provided by an external library and cannot be cast in a different way. that is a scenario thats incredibly rare, borderline never.
* Types are mandatory
* Logic is generally extracted into seperate classes or utility function for easier testing
* all _logic_ has sufficient coverage for every expected code branch



