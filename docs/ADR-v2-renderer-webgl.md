# ADR: V2 Renderer — WebGL `phase_full`

| Field | Value |
|-------|-------|
| Status | **Proposed** (`phase_alpha` landed — V2-R1–R4b) |
| Date | 2026-06-04 |
| Decision | `@coderyo/renderer-webgl` becomes the **primary** chart backend @ TradView **2.0.0 GA** |
| Related | [DESIGN-v2.md](./DESIGN-v2.md) §4.2, [MIGRATION-2.0.md](./MIGRATION-2.0.md) §4 |

---

## 1. Context

v1.1.x renders via `@coderyo/renderer-lite` (N× Lightweight Charts + `PaneOrchestrator`). `renderer-webgl` exists as a **stub**. V2 delivers **`phase_full`**: main + volume + indicators + drawing overlay on WebGL.

---

## 2. Decision

| Topic | Choice |
|-------|--------|
| GA default | `ChartFeatures.renderer` defaults to **`'webgl'`** |
| LWC path | `@coderyo/renderer-lite` remains as **optional peer**; `features.renderer: 'lite'` **RC-only** through rc.4, explicit opt-in @ GA |
| Core dependency | `@coderyo/core` **hard-depends** on `renderer-webgl@2` @ GA (not in 1.1.1) |
| Playground rc.1 | **Standalone** `webgl-demo.html` — **no** `createChart` + webgl requirement |
| CI | `check:lwc-size` **skipped** for `VERSION` matching `2.0.0` / `2.0.0-rc.N` (V2-00) |
| CDN | See **§6** — UMD still includes lite/ui-shell @ rc.4; size gate **400 KB** passes |

---

## 6. CDN bundle @ 2.0.0-rc.4 (V2-R14)

| Gate | Command | rc.4 observed |
|------|---------|---------------|
| Full UMD (`tradview.min.js`) | `pnpm check:cdn-size` | **~230 KB** gzip (limit 400 KB) |
| WebGL package only | `pnpm check:webgl-size` | **~53 KB** raw cap 170 KB |

**Decision @ rc.4:** Keep single UMD entry (`bundle/cdn`) embedding `mountChartLayout` + lite + webgl for integrator one-script embed. **Not** LWC-free @ rc.4 — documented exception until `2.1` split entry (`tradview-webgl.min.js` tree-shake).

**CI:** `check:rc` runs `check:cdn-size` + `check:webgl-size`; skips `check:lwc-size` per `rc-version-gates.mjs`.

---

## 3. Phases

| Phase | PR range | Deliverable |
|-------|----------|-------------|
| `phase_alpha` | V2-R1–R4b | Independent WebGL demo |
| `phase_beta` | V2-R5–R8 | Indicator panes + LOD |
| `phase_gamma` | V2-R9–R11 | Drawing overlay |
| `phase_full` | V2-R12–R14 | `WebGLPaneOrchestrator` wired in core |

---

## 4. Consequences

- Integrators must add `@coderyo/renderer-webgl` to dependencies @ 2.0.0
- Bundle budget shifts from LWC gate to CDN 400 KB gate + WebGL asset policy
- Porting checklist in DESIGN-v2 **Appendix A** (`PaneOrchestrator` → `WebGLPaneOrchestrator`)

---

## 5. Status

**Proposed** — accept @ rc.4 when Playground defaults to webgl and API-FREEZE-2.0 is candidate.

### 5.1 `phase_alpha` (2026-06-04)

- `@coderyo/renderer-webgl`: `WebGL2Context`, `CandlestickRenderer`, `VolumeRenderer`, `ChartViewport`, `WebGLChartPane`, `WebGLPaneOrchestrator`
- Standalone demo: `apps/playground/webgl-demo.html` (V2-R4b) — **no** `createChart` wiring