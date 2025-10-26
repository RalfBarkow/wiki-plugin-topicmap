# WORKLOG — compact & authoritative

## 2025-10-26
- Insight: inline plugin’s page-wide mouse event handling is a **feature discovery**, not a bug.
- Decision: introduce explicit **Input Modes**:
  - **Scoped (default):** strictly in-viewport.
  - **Ambient (opt-in):** global listeners with guard rails (no interference with inputs/editors), visible indicator, `Esc` to exit.
- Kept: security hardening for `postMessage`, lifecycle cleanup for observers/timers, overlay anchoring.
- SPEC/PLAN updated to reflect modes, UX affordances, and tests.

## 2025-10-24 … 2025-10-25
- Confirmed Node versions (dev 20+, build 22).
- Nix dev shell drafted; acceptance criteria skeleton created.
- Identified cleanup: Stylelint glob (`theme/**`), `.direnv` in VCS.

> Rule: This WORKLOG supersedes prior chat; keep terse and collapse resolved items.
