# CLAUDE.md

This file is for Claude Code (claude.ai/code) when working in this repository.

**Read `AGENTS.md` first.** It is the canonical repository guideline, structure,
validation commands, and agent workflow rules. Do not maintain a second full
architecture document here; this file only records Claude-specific notes.

## Claude-specific notes

- This is a zero-dependency, single-file browser app. The production artifact is
  `NutriFlow.html`; `index.html` is the demo/PWA entry with seed data.
- There is no build step. Most production changes must be applied to **both**
  `NutriFlow.html` and `index.html`; the only allowed differences are demo seed,
  manifest link, and service-worker registration.
- Validation commands (run after changes):
  - `node test-reliability.js`
  - `node test-parity.js`
  - `node check-html-syntax.js`
  - `node check-repo-structure.js`
- Keep UI text in Chinese, code in camelCase, storage keys in UPPER_SNAKE_CASE,
  and preserve `dailyDietRecordsV1`, `dailyDietTargetsV1`, and
  `dailyDietThemeV1` for backward compatibility.
- Do not add frameworks, npm dependencies, backends, telemetry, or cloud features.
