# Multi-chart playground demo (V2-MC3)

**Route:** `/multi-chart.html` (Vite input `multiChart`)

This demo exercises **`ChartWorkspace`** + **`createWorkspaceChartSlots`** programmatically. It is an **API-only** integrator sample for rc.3 — **not** a full native Bridge host flow.

For Bridge schema 3 workspace smoke (`host.workspace.createChart`, `chart.workspaceReady`), use unit tests in `@coderyo/core` (`workspace-bridge.test.ts`) or wire `ChartWorkspace` with a `BridgeAdapter` in your host (see `docs/MIGRATION-bridge-3.md`).

Full MC3 Bridge beta in Playground shell is scheduled for **rc.3** per DESIGN-v2 §13.