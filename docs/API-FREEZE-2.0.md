# TradView API Freeze — `2.0.0` (draft skeleton)

| Field | Value |
|-------|-------|
| Status | **Draft skeleton** (V2-00b — not final freeze) |
| Target GA | `@coderyo/*@2.0.0`, `@coderyo/bridge@3.0.0` |
| Embed API | `apiVersion: 2` (`TRADVIEW_API_VERSION`) |
| Bridge schema | `bridgeSchemaVersion: 3` |
| Final freeze candidate | **2.0.0-rc.4** (W16) |
| Baseline | [API-FREEZE.md](./API-FREEZE.md) (1.0.0 / apiVersion 1) |

> Planned breaking deltas vs 1.x are listed below. **Do not** treat this file as binding until rc.4 sign-off.

---

## 1. npm / CDN deliverables (planned)

| Product | Version | License | Notes |
|---------|---------|---------|-------|
| `@coderyo/core` | `2.0.0` | MIT | `createChart`, `ChartWorkspace` |
| `@coderyo/ui-shell` | `2.0.0` | UNLICENSED | Compositor-only public layout |
| `@coderyo/bridge` | **`3.0.0`** | MIT | Schema 3 wire |
| `@coderyo/data` | `2.0.0` | MIT | JSON + optional Protobuf |
| `@coderyo/renderer-webgl` | `2.0.0` | MIT | **Required** peer/runtime @ GA |
| `@coderyo/renderer-lite` | `2.0.0` | MIT | Opt-in `features.renderer: 'lite'` |
| `tradview.min.js` | `2.0.0` | UMD | gzip ≤ **400 KB**; no separate bridge CDN |

---

## 2. Breaking changes vs API-FREEZE 1.x

| Area | 1.x | 2.0 (planned) |
|------|-----|---------------|
| `TRADVIEW_API_VERSION` | `1` | **`2`** |
| Bridge schema | `2` | **`3`** (package `@coderyo/bridge@3`) |
| Default renderer | LWC / lite | **WebGL** |
| Layout public API | `createLayoutGrid`, `LayoutSchema` | **Removed** — compositor + `/migrate` |
| `host.*` wire | `chartId` on `host.layer.*` only | **`chartId` on all `host.*`** |
| Workspace | Single chart assumption | `ChartWorkspace`, `host.workspace.*` |
| `core` → `ui-shell` dep | Forbidden (de facto) | **CI enforced** (`arch:boundary`) |
| `check:lwc-size` | Required | **Skipped** @ 2.0.0-rc+ |
| Protobuf | Flag present, unwired | Opt-in v1.1 Envelope |

---

## 3. `createChart` / `IChart` (planned additions)

| Symbol | Package | Notes |
|--------|---------|-------|
| `ChartWorkspace` | `core` | Multi-chart factory |
| `createChart` in workspace | `core` | Per-slot charts |
| `features.renderer` | `core` | `'webgl' \| 'lite'` |
| `features.debugWebGL` | `core` | Shader debug |
| `features.protobuf` | `core` | Opt-in binary WS |
| `getVisibleRange` / `setVisibleRange` | `core` | Retained from 1.x |
| Link sync | `core` | Via workspace + bridge events |

### Removed @ 2.0.0-rc.2 (PR-L7b landed)

| Symbol | When / where |
|--------|----------------|
| `createLayoutGrid`, `LayoutSchema` helpers (main entry) | **Removed** @ 2.0.0-rc.2 — use compositor |
| `layoutSchemaToPreset`, v1 schema persistence | **`@coderyo/ui-shell/migrate`** @ 2.0.0-rc.2 |
| `DEFAULT_LAYOUT_SCHEMA` | **Removed** from main entry @ 2.0.0-rc.2 |
| Bridge schema 2 inbound | **Rejected** @ GA |

---

## 4. Bridge schema 3 (planned freeze)

See [bridge-schema-3.md](./bridge-schema-3.md).

| Category | Count |
|----------|-------|
| Chart-scoped `host.*` | 25 |
| `host.workspace.*` | 4 |
| New outbound | 3 workspace events |

Error surface: `UNSUPPORTED_BRIDGE_SCHEMA`, `MISSING_CHART_ID`, `CHART_NOT_FOUND`, + layer codes.

---

## 5. ChartFeatures (2.0 defaults — target)

| Field | GA default |
|-------|------------|
| `renderer` | `'webgl'` |
| `protobuf` | `false` |
| `debugWebGL` | `false` |
| `pineWorker` | `true` (retain 1.x) |
| `telemetry` | `false` |

---

## 6. Non-breaking carry-over from 1.1.x

- Layer compositor preset v2 + `host.layer.*` semantics (revision merge, `allPages`, lazy time-scale)
- `host.setChartPaneResizeFocus` independent of link groups
- Indicator persist (`indicatorPersist`) when adapter provided
- CDN size gate 400 KB

---

## 7. Verification gates (rc.4 target)

| Gate | Command |
|------|---------|
| Unit + contract | `pnpm test` |
| Types | `pnpm typecheck` |
| Lint | `pnpm lint` |
| RC bundle | `pnpm check:rc` |
| Arch boundary | `pnpm arch:boundary` |
| Schema 3 contract | `@coderyo/bridge` `schema3-contract.test.ts` |

---

## 8. References

- [DESIGN-v2.md](./DESIGN-v2.md)
- [MIGRATION-2.0.md](./MIGRATION-2.0.md)
- [MIGRATION-bridge-3.md](./MIGRATION-bridge-3.md)
- [API-FREEZE.md](./API-FREEZE.md) (1.x baseline)