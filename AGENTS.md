# Superpowers — Agent Instructions (NestJS Cashier System Backend)

This repository uses the **Superpowers** development framework (`https://github.com/obra/superpowers`).

<EXTREMELY-IMPORTANT>
If you think there is even a 1% chance a skill might apply to what you are doing, you ABSOLUTELY MUST invoke the skill.

IF A SKILL APPLIES TO YOUR TASK, YOU DO NOT HAVE A CHOICE. YOU MUST USE IT.

This is not negotiable. You cannot rationalize your way out of this.
</EXTREMELY-IMPORTANT>

## The Rule

**Invoke relevant or requested skills BEFORE any response or action** — including clarifying questions, exploring the codebase, or checking files. If it turns out wrong for the situation, you don't have to use it.

**Before entering plan mode:** if you haven't already brainstormed, invoke the brainstorming skill first.

Then announce "Using [skill] to [purpose]" and follow the skill exactly. If it has a checklist, create a todo per item.

## Skill Priority

When multiple skills apply, process skills come first — they set the approach, then implementation skills carry it out:

- "Let's build X" → `brainstorming` first, then implementation skills.
- "Fix this bug" → `systematic-debugging` first, then domain skills.
- Writing code / implementing features → `test-driven-development` first (write test, watch fail, write minimal code to pass).
- Complex multi-step task execution → `writing-plans` then `subagent-driven-development` or `executing-plans`.

## Backend Stack & Commands

- **Framework**: NestJS 11 (TypeScript)
- **Database / ORM**: Prisma ORM
- **Unit Testing**: `npm test` or `npx jest` (TDD: run specific spec with `npx jest src/<path>/<name>.spec.ts`)
- **E2E Testing**: `npm run test:e2e`
- **Linting**: `npm run lint`
- **Build Verification**: `npm run build`
- **Prisma Migrations/Client**: `npm run prisma:generate`, `npm run prisma:migrate`

## Antigravity Tool Mapping

| Action skills request | Antigravity equivalent |
|---|---|
| Dispatch a subagent (`Subagent (general-purpose):` template) | `invoke_subagent` with built-in `TypeName` — `self` for full-capability work, `research` for read-only |
| Task tracking ("create a todo", "mark complete") | a **task artifact** — `write_to_file` with `IsArtifact: true` and `ArtifactType: "task"` (or implementation plan / walkthrough). **Not** `manage_task`, which manages background processes. |
| Automated testing | `run_command` with test runners (`npm test`, `npm run test:e2e`, etc.) |
| Code review | `requesting-code-review` / `receiving-code-review` |
