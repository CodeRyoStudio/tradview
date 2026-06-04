# ADR: PR-L7 — Three-Phase Grid Removal

| Field | Value |
|-------|-------|
| Status | **Accepted (L7a @ 1.1.2)**; L7b pending 2.0.0-rc.2 gate |
| Date | 2026-06-04 |
| Decision | Remove v1 **12×12 `createLayoutGrid`** public API; **compositor v2** is the sole layout model @ GA |
| Related | [LAYER-COMPOSITOR-PLAN.md](./LAYER-COMPOSITOR-PLAN.md), [MIGRATION-2.0.md](./MIGRATION-2.0.md) §5 |

---

## 1. Context

TradView 1.x exposed `createLayoutGrid`, `LayoutSchema`, and `DEFAULT_LAYOUT_SCHEMA` from `@coderyo/ui-shell`. Playground already uses `layerCompositorManaged: true`, but npm integrators may still mount the legacy grid path when the flag is false.

---

## 2. Decision — three phases

| Phase | PR | Version | Behavior |
|-------|-----|---------|----------|
| **L7a** | PR-L7a | `1.1.2+` | `@deprecated` JSDoc + **one-time** `console.warn` at legacy mount entry points (direct `createLayoutGrid`; legacy `mountChartLayout`) |
| **L7b** | PR-L7b | **`2.0.0-rc.2`** | **Delete** public grid exports; ship `@coderyo/ui-shell/migrate` with `layoutSchemaToPreset` |
| **L7c** | PR-L7c | **`2.0.0` GA** | `mountChartLayout` **requires** `layerCompositorManaged: true` |

---

## 3. Migration affordances

- `layoutSchemaToPreset` converts persisted 12×12 JSON → `LayoutPreset` v2
- [MIGRATION-2.0.md](./MIGRATION-2.0.md) §5 is the integrator checklist (**non-empty** gate for PR-L7b)

---

## 4. Architecture rule (unchanged)

`@coderyo/core` **must not** depend on `@coderyo/ui-shell` (enforced by `pnpm arch:boundary` / V2-00).

---

## 5. Consequences

- Breaking change for integrators still on grid API — must migrate before rc.2
- Reduced maintenance: single layout code path in `ui-shell/layer/*`
- PR-L7a optional on current `1.1.1` line — deferred to avoid noisy tests until 1.1.2

---

## 6. Status

**Accepted (L7a @ 1.1.2)** — shipped in `@coderyo/ui-shell@1.1.2`. **L7b** remains pending **2.0.0-rc.2** when migration doc gate satisfied (V2-00b ✓).