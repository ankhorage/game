# AGENTS.md

<!-- This file is managed by @ankhorage/devtools. -->

## Repository

Package: `@ankhorage/game`

Platform-neutral config-driven game semantics and runtime primitives for Ankhorage apps.

## Current architecture only

Only the current Ankhorage architecture is valid. Do not add or retain deprecated APIs, compatibility aliases, shims, dual old/new paths, historical-state fallbacks, or migrations whose sole purpose is supporting obsolete states. Remove superseded implementations instead.

When a canonical change affects another repository, update that repository to the latest released public API instead of preserving compatibility locally. Cross-package usage must go through published public APIs and declared dependencies, never sibling source files.

## Required repository instructions

Before changing any file, read this `AGENTS.md` completely and inspect `.agents/skills/`.
Treat skill selection as a mandatory precondition to editing, then follow every selected skill through validation and delivery.

- Load `.agents/skills/ankhorage-coding-rules/SKILL.md` for implementation, refactoring, testing, review, or pull-request delivery work.
- Load `.agents/skills/ankhorage-project-structure/SKILL.md` for ownership, boundaries, public entrypoints, type placement, or source architecture.
- Load every additional repository-local skill whose description or requirements match the task.

## Documentation

`README.md` and the configured Paradox output are generated release artifacts. Never edit them manually and do not regenerate or commit them in ordinary feature pull requests.

## Pull requests

Before creating a pull request, run: `bun run build`, `bun run check-types`, `bun run lint`, `bun run knip:check`, `bun run changeset`, and `bun run format`.
