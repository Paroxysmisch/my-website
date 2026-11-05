# Personal Website — Build Spec

> **Audience for this document:** a coding agent implementing the site.
> **Owner:** a PhD researcher working on GPUs / specialized accelerators, software for them, and ML-driven automation of accelerator design.
> Read the whole spec before starting. Sections marked **MUST** are hard requirements.

---

## 1. Concept in one paragraph

A personal academic website whose entire visual story is **one output tile of a BF16 GEMM executing on an NVIDIA Blackwell B200 using 5th‑gen Tensor Cores**. As the visitor scrolls, a fixed 3D scene follows that tile from the full matrices → tiling → mapping onto an SM pair on the die → the TMA/shared‑memory k‑loop → `tcgen05.mma` accumulating into Tensor Memory → the epilogue writing back to HBM. Each stage of the kernel hosts one content section of the site (About, Research, Projects, Publications, Experience, News, Contact). Around the 3D story, the site's UI uses a **profiler / `btop`-inspired design language**: bordered panels with titles in the border, dot‑matrix graphs, segmented meters, and process‑list‑style tables — but with proper typographic hierarchy and high contrast.

---

## 2. Non‑negotiable principles (MUST)

1. **Scroll is the only interaction for the story.** No drag, orbit controls, click‑to‑zoom, or hover‑required content. Links, buttons and focus states work normally.
2. **Content first.** All content is static, semantic HTML that renders and is readable before any 3D JS loads. The 3D scene is progressive enhancement.
3. **Readability.** Minimum text size 14px anywhere (including chart labels, tags, HUD). Body 17–18px. WCAG AAA (7:1) contrast for body text; ≥ 4.5:1 for all other text; ≥ 3:1 for meaningful graphics and borders. Never place text directly over the canvas or a gradient without a solid panel behind it.
4. **Standard text hierarchy.** Exactly one `h1` (owner's name). Each section/panel title is a real `h2`; items within are `h3`. The profiler styling must never replace semantic structure.
5. **No decorative text.** Every piece of text must convey information. No fake hex addresses, fake register dumps, invented temperatures/wattages, fake die labels (`SM_07`), fake compiler output, or self‑rated skill percentages. Every graph/meter must plot real data.
6. **Excellent mobile performance and fast load.** See §9 budgets.
7. **Technical accuracy.** The GEMM story targets **datacenter Blackwell (SM100, B200)**. All numbers shown must be consistent with the config in §5.1. Consumer Blackwell (RTX 50, SM120) lacks Tensor Memory — do not reference it.
8. **No NVIDIA branding.** No NVIDIA logo, wordmark, or NVIDIA green as a primary colour. Referencing products and tools by name (B200, `nvidia-smi`, Nsight) is fine. The site must not look like an official NVIDIA page.

---

## 3. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Astro 6**, `output: 'static'` | Zero JS by default; no SSR adapter needed. |
| Package manager / scripts | **Bun** | `bun create astro`, `bun add`, `bun run dev/build`. Astro's docs note Bun may have rough edges with some integrations; Astro 6 requires **Node ≥ 22**, so keep Node 22 installed as a fallback for build tooling if something misbehaves. |
| Language | TypeScript (strict) | |
| 3D | **Three.js, vanilla** (no React / R3F) | Scene is one scripted, imperative timeline. Pin the exact version in `package.json`. |
| Renderer | **`WebGLRenderer` + custom GLSL `ShaderMaterial`s** | Smallest bundle, most mature on mobile. No compute needed. (Future option: migrate to `WebGPURenderer` + TSL if a compute effect is added — not in scope.) |
| Scroll animation | **GSAP + ScrollTrigger** | GSAP and all plugins are free (incl. commercial). Use **native scrolling** — no Lenis, no ScrollSmoother, no scroll hijacking. Use numeric `scrub` (≈0.5–1) for damping. |
| Content | Astro content collections (Markdown / YAML) | Typed schemas via `astro:content` + Zod. |
| Publications | `src/data/pubs.bib` parsed at build time | Use a maintained BibTeX parser (e.g. `citation-js` or similar); generate the list + per‑entry BibTeX download. |
| Citation stats (optional) | OpenAlex API at build time, fallback to a hand‑maintained `stats.json` | Google Scholar has no official API — do not scrape it. Build must not fail if the API is unreachable. |
| Fonts | Astro 6 built‑in Fonts API | Self‑hosted, subset, preloaded, with metric‑matched fallbacks. |
| Lint/format | Biome (or ESLint + Prettier) | |
| Hosting | Static CDN (Cloudflare Pages / Netlify / GitHub Pages) | Brotli, immutable caching for hashed assets. |

Bootstrap:

```bash
bun create astro site   # choose: empty template, TypeScript strict
cd site
bun add three gsap
bun add -d @types/three
```

---

## 4. Architecture

### 4.1 Page structure

Single long page (`/`) plus `/404`. Optional future routes: `/publications` (full list), `/cv` (PDF link).

```
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <canvas id="scene" aria-hidden="true">       ← position: fixed, behind content, lazily initialised
  <img class="scene-poster" …>                 ← static AVIF of chapter 0, shown until canvas is ready
  <div id="hud" aria-hidden="true">            ← fixed readout panel (see §6.6)
  <main id="main">
    <section data-chapter="0" id="hero">        h1 + one-line intro
    <section data-chapter="1" id="about">
    <section data-chapter="2" id="research">
    <section data-chapter="3" id="projects">
    <section data-chapter="4" id="publications">
    <section data-chapter="5" id="experience">
    <section data-chapter="6" id="news">        news / teaching / talks / awards
    <section data-chapter="7" id="contact">
  </main>
  <footer>                                      ← minimal: name, year, source link if public
```

- Content sections are in normal document flow. Each has a `min-height` tuned so its chapter gets enough scroll distance (see §5.3).
- The canvas never intercepts pointer events (`pointer-events: none`).
- A simple top nav (anchor links to sections) is allowed and should be sticky/compact; it must meet the same contrast/size rules.

### 4.2 Directory layout

```
site/
├─ astro.config.ts
├─ src/
│  ├─ content/
│  │  ├─ config.ts            # Zod schemas (see §8)
│  │  ├─ projects/*.md
│  │  ├─ experience.yaml
│  │  ├─ news.yaml
│  │  └─ research.yaml
│  ├─ data/
│  │  ├─ pubs.bib             # source of truth for publications
│  │  ├─ profile.yaml         # name, title, bio, links
│  │  └─ stats.json           # fallback citation stats
│  ├─ components/             # Astro components: Panel, Meter, DotGraph, PubTable, Timeline, …
│  ├─ pages/
│  │  ├─ index.astro
│  │  └─ 404.astro
│  ├─ scene/
│  │  ├─ main.ts              # entry; dynamically imported
│  │  ├─ kernel.ts            # GEMM config + derived numbers (single source of truth)
│  │  ├─ timeline.ts          # GSAP master timeline, one sub-timeline per chapter
│  │  ├─ camera.ts            # CatmullRom spline + per-chapter stops
│  │  ├─ quality.ts           # tiering, DPR cap, frame-time watchdog
│  │  ├─ labels.ts            # HTML overlay labels projected from 3D positions
│  │  ├─ hud.ts
│  │  ├─ actors/              # matrices.ts, tiles.ts, die.ts, smPair.ts, smemRing.ts, tmemGrid.ts, pipelineLanes.ts
│  │  └─ shaders/             # *.glsl: heatmap, glow, dataStreak, dotMatrix
│  └─ styles/
│     ├─ tokens.css           # colours, type scale, spacing (§7)
│     └─ global.css
└─ public/
   └─ posters/                # chapter-N.avif static fallbacks
```

---

## 5. The GEMM story (3D scene)

### 5.1 Kernel configuration — single source of truth (`scene/kernel.ts`)

All on‑screen numbers MUST be derived from these constants, not hard‑coded in multiple places.

| Constant | Value | Notes |
|---|---|---|
| GPU | B200 | 2 dies, **74 SMs enabled per die → 148 SMs**, **8 HBM3e stacks** (4 per die), dies joined by a 10 TB/s die‑to‑die link |
| SMEM per SM | 228 KB | |
| TMEM per SM | 256 KB = **128 lanes × 512 columns × 32‑bit** | Accumulator lives here, not in registers |
| Problem | `C[M×N] = A[M×K] · B[K×N]`, **M = N = K = 8192** | |
| Types | A, B: BF16; accumulate FP32; C output BF16 | |
| Total FLOPs | 2·M·N·K = **1.0995 × 10¹²** ("1.10 TFLOP") | |
| MMA mode | **2‑SM UMMA** (`tcgen05.mma.cta_group::2`), MMA_M = 256, MMA_N = 256 | CTA pair across 2 SMs |
| Output tile per CTA pair | **256 × 256** | Each SM owns 128 × 256 of it |
| Tile grid | 32 × 32 = **1024 tiles** | |
| CTA pairs | 148 / 2 = **74** | Persistent kernel: ≈ 13.8 tiles per pair |
| k‑block (BLK_K) | **64** | → K / 64 = **128 k‑iterations** per tile |
| MMA instruction K (BF16) | 16 | → 4 MMA instructions per k‑block |
| SMEM per stage per SM | A: 128×64×2 B = 16 KB; B (half, since pair splits B): 128×64×2 B = 16 KB → **32 KB** | |
| Pipeline stages | **6** → 192 KB of 228 KB SMEM | |
| TMEM use per SM | 128 lanes × 256 cols FP32 = **half of TMEM** | Other half → double‑buffered accumulator for the next tile |

Facts the scene relies on (keep these correct in labels/subtitles):
- **TMA** (Tensor Memory Accelerator) asynchronously copies tiles from global memory (HBM, via L2) into shared memory; completion is tracked with **mbarriers** (full/empty per stage).
- In 2‑SM mode, **each CTA loads only half of the B tile**; the paired MMA reads both halves.
- `tcgen05.mma` is **issued by a single thread** (one thread in one CTA of the pair) — not a whole warp/warpgroup as on Hopper.
- Operand A from SMEM (or TMEM), operand B from SMEM, **accumulator always in TMEM**.
- Epilogue: `tcgen05.ld` moves accumulator TMEM → registers, convert FP32 → BF16, stage in SMEM, TMA store to global.
- Warp specialisation: **producer warp** (TMA loads), **MMA warp** (single elected thread issues MMAs), **epilogue warps** (4 warps, TMEM → global).
- Output tiles are scheduled in a **swizzled raster order** for L2 reuse.

### 5.2 Colour coding (consistent at every zoom level)

| Entity | Colour |
|---|---|
| Matrix A data | Cyan `#4FD1E0` |
| Matrix B data | Magenta `#E46FD0` |
| Accumulator / C | Thermal ramp `#A8502F → #F08A3C → #FFC46B → #FFF1C9` (brightness = accumulated progress) |
| Hardware structures | Graphite surfaces, copper hairlines `#D98A4E` |

### 5.3 Chapters

Each chapter = one GSAP sub‑timeline in a master timeline scrubbed by scroll. Suggested scroll lengths are relative to viewport height and should be tuned. Each chapter has: a camera stop, the visual beats, the content section it hosts, a **HUD readout** (real numbers from `kernel.ts`), and a **one‑line plain‑language subtitle** for non‑experts (this is informational text, allowed).

#### Chapter 0 — `C = A · B` → **Hero** (~150vh)
- **Visual:** the "matmul cube": A on the left face, B on top, C as the front face; the box is the M×N×K iteration space. Slow data streaks (cyan/magenta) flow toward C.
- **Content:** `h1` name + one‑line description.
- **HUD:** `gemm · bf16 · M=N=K=8192 · 1.10 TFLOP`
- **Subtitle:** "Multiplying two 8192×8192 matrices — the core operation of modern AI."

#### Chapter 1 — Tiling the output → **About** (~200vh)
- **Visual:** C partitions into a 32×32 grid of 256×256 tiles. Tiles light briefly in **swizzled raster order**. One tile (e.g. `(12, 7)`) stays lit; everything else dims except the A row‑strip and B column‑strip it depends on.
- **Content:** About panel (bio + stats panel, §7.6).
- **HUD:** `tile (12, 7) of 1024 · 256×256`
- **Subtitle:** "The output is split into tiles; each tile needs one strip of A and one strip of B."

#### Chapter 2 — Mapping onto the die → **Research** (~200vh)
- **Visual:** camera pulls back; matrices shrink into the B200 package: two dies, the die‑to‑die link, 8 HBM stacks around them. 148 SMs appear as a grid (74 per die). A persistent tile scheduler assigns tiles to CTA pairs; our tile flies into one specific SM pair and locks in with a pulse.
- **Content:** Research themes panels.
- **HUD:** `148 SMs · 74 CTA pairs · tile → pair 23`
- **Subtitle:** "Each tile is assigned to a pair of streaming multiprocessors (SMs) that work on it together."

#### Chapter 3 — Inside the SM pair → **Projects** (~250vh)
- **Visual:** fly into the two SMs. Introduce and label, one at a time: TMA unit, shared memory as a **ring of 6 stage slots**, **TMEM as a 128×512 cell grid**, Tensor Cores, and the warp roles (producer warp, single MMA thread, 4 epilogue warps).
- **Content:** Projects panels.
- **HUD:** `SMEM 6 × 32 KB stages · TMEM 128 × 512 × 32b`
- **Subtitle:** "Specialised units: one loads data, one does the maths, others write results back."

#### Chapter 4 — The k‑loop (TMA → SMEM) → **Publications** (~300–400vh, the centrepiece)
- **Visual:** A and B strips slice into 128 k‑blocks of width 64. TMA streams them HBM → L2 → the SMEM ring. Show **each SM loading half of B**, with the halves visibly shared across the pair. Each ring slot shows an empty/full barrier state (filled vs outlined indicator — not colour alone).
- **Content:** Publications table. (Optional enhancement: entries reveal as k‑blocks arrive — the table itself must be fully present in HTML regardless.)
- **HUD:** `k-block 37 / 128 · stage 1 / 6 · 32 KB/stage` (k‑block counter driven by scroll progress)
- **Subtitle:** "Data is streamed in chunks into a ring of on‑chip buffers so loading and computing overlap."

#### Chapter 5 — MMA into Tensor Memory → **Experience** (~250vh)
- **Visual:** the single MMA thread highlights and issues `tcgen05.mma`; cyan/magenta flow into the Tensor Cores; the TMEM grid fills as a heatmap, brightening with each k‑step. Show **pipelining** as three horizontal lanes (producer / MMA / epilogue) with overlapping bars, Nsight‑Systems style.
- **Content:** Experience timeline, rendered in the same lane style (roles as bars on lanes such as Education / Research / Industry / Teaching).
- **HUD:** `tcgen05.mma.cta_group::2 · 256×256×16 · TMEM cols 0–255`
- **Subtitle:** "One thread drives the Tensor Cores; partial results accumulate in dedicated Tensor Memory."

#### Chapter 6 — Epilogue → **News / Teaching / Talks / Awards** (~200vh)
- **Visual:** `tcgen05.ld` pulls the finished accumulator TMEM → registers; FP32 → BF16 (cells visibly shrink); staged in SMEM; TMA stores to HBM; the tile slots into C. Simultaneously the **other half of TMEM** starts filling for the next tile (double buffering).
- **Content:** News/teaching/talks/awards panel(s).
- **HUD:** `epilogue · FP32 → BF16 · TMEM cols 256–511 → next tile`
- **Subtitle:** "Results are converted and written back while the next tile is already being computed."

#### Chapter 7 — Finale → **Contact** (~150vh)
- **Visual:** pull back to the whole die/matrix; remaining tiles complete in waves across all SMs until C is fully lit; settle to a calm, low‑intensity heatmap.
- **Content:** Contact panel.
- **HUD:** `1024 / 1024 tiles · done`
- **Subtitle:** none needed.

### 5.4 Scene implementation notes
- **One master GSAP timeline**, progress 0→1 bound to scroll via ScrollTrigger (`scrub` numeric). Chapter sub‑timelines are positioned to align with their `<section>` elements (use each section as a trigger, or compute positions from section offsets on resize).
- **Camera:** a `CatmullRomCurve3` path with eased stops per chapter; also animate camera target/FOV where needed.
- **State in shaders:** instanced meshes compute per‑instance state (lit/dim, heat, fill) in the vertex/fragment shader from `instanceId` + a few uniforms (`uChapterProgress`, `uSelectedTile`, `uKBlock`, …). The CPU updates only a handful of uniforms per frame — never iterate thousands of instances in JS per frame.
- **Draw calls:** target ≤ 40 per frame. Every repeated element (tiles, SMs, TMEM cells, ring slots, data streaks) is an `InstancedMesh` or a single merged geometry.
- **Procedural geometry only:** no glTF/model downloads. Boxes, planes, lines.
- **Labels:** HTML overlay elements positioned by projecting 3D anchor points (crisp text, respects min font size). Max ~6–8 visible at once. Labels are `aria-hidden` (the HTML content + subtitles carry the information).
- **Glow:** on mobile/medium tiers, fake glow in shaders (emissive falloff, additive sprites). Real bloom post‑processing only on the high tier.

---

## 6. Loading & performance (MUST)

### 6.1 Budgets
| Metric | Target |
|---|---|
| Critical path (HTML + CSS + preloaded fonts for first screen) | ≤ ~50 KB compressed |
| 3D bundle (three + gsap + scene code) | ≤ ~200 KB compressed, loaded after content is interactive — measure and report |
| LCP (Lighthouse mobile) | < 2.0 s (the LCP element must be text, not the canvas) |
| CLS | < 0.05 |
| Lighthouse | Performance ≥ 90 mobile, Accessibility 100, Best Practices ≥ 95, SEO ≥ 95 |
| Frame rate | 60 fps desktop; ≥ 50 fps on a mid‑range phone on the default tier |
| Main thread | No long tasks > 50 ms during scroll |

### 6.2 Loading strategy
1. All content is static HTML/CSS. No client JS is required to read anything.
2. A small inline script decides whether to enable 3D (see §6.4) and, if yes, schedules `import('/src/scene/main.ts')` on `requestIdleCallback` (with a timeout fallback) — never in the critical path.
3. `scene-poster` (AVIF, < 30 KB) is shown immediately behind the hero; the canvas cross‑fades in once the first frame is rendered.
4. Precompile all shaders (`renderer.compile(scene, camera)`) during idle before the first scroll interaction to avoid stutter at chapter transitions.
5. Fonts via Astro Fonts API: one sans + one mono family, variable, Latin subset, `font-display: swap` with metric‑matched fallback.

### 6.3 Render loop
- **Render on demand:** render only when scroll progress changes or an animation is settling; stop when idle.
- Pause entirely when the tab is hidden or the canvas is scrolled out (e.g. footer).
- Respond to resize with debounced handling; don't reallocate geometry on resize.

### 6.4 Quality tiers (`scene/quality.ts`)
- **Tier detection at start:** WebGL2 availability, `MAX_TEXTURE_SIZE`, viewport size, `navigator.hardwareConcurrency`, `navigator.deviceMemory` (if present).
- **Tiers:**
  - `high`: DPR cap 2, real bloom, full instance counts.
  - `medium`: DPR cap 1.5, shader glow, full instance counts.
  - `low`: DPR cap 1.0–1.25, shader glow, reduced instance detail (e.g. coarser TMEM grid visual).
  - `off`: no canvas; static per‑chapter posters (`public/posters/chapter-N.avif`).
- **Runtime watchdog:** rolling frame‑time average; if above budget for ~2 s, step down a tier (DPR first). Never step up automatically mid‑session.
- **Force `off`** when: `prefers-reduced-motion: reduce`, `navigator.connection.saveData`, WebGL2 unavailable, or context creation fails. Handle `webglcontextlost` by falling back to posters.
- No MSAA on mobile tiers.

---

## 7. Design system — "profiler‑grade", inspired by `btop`

### 7.1 What to take from `btop`
- **Panels:** 1px rounded borders with the **section title inset into the top border**. The title is a real `h2` (styled into the notch with a background matching the page).
- **Dot‑matrix graphs:** the braille‑style area graph look (dense dots, vertical colour gradient by value).
- **Segmented meters:** bars made of discrete cells, coloured along the thermal ramp.
- **Tiled panel grid** on desktop; single column on mobile.
- **Process‑list tables:** aligned columns, highlighted row on hover/focus.

### 7.2 What to change from `btop`
- **Do not use Unicode braille or box‑drawing characters** for graphs or borders. Render graphs with SVG (small series) or canvas (larger), borders with CSS. (Braille/box chars are read aloud by screen readers, render inconsistently across fonts, and break at narrow widths.)
- Dot size ≥ 3px on mobile, ≥ 2.5px on desktop; never "hairline" graphics.
- **Reading text uses a proportional sans**, not mono. Mono is for numbers, labels, tags, code, and the HUD only.
- Panel titles are proper headings at heading size, not tiny lowercase labels.

### 7.3 Typography
- Families (suggested, both open‑licensed — final choice is the implementer's, keep to two families): **Inter** or **Geist** (sans), **JetBrains Mono** or **IBM Plex Mono** (mono).
- `font-variant-numeric: tabular-nums` on all numeric data.
- Line height ≈ 1.55 for body; measure ≤ ~70ch.

| Token | Desktop | Mobile | Usage |
|---|---|---|---|
| `--fs-h1` | 44px | 34px | Owner's name (only `h1`) |
| `--fs-h2` | 28px | 24px | Panel / section titles |
| `--fs-h3` | 22px | 20px | Item titles (project, role, paper title in cards) |
| `--fs-body` | 18px | 17px | Body text |
| `--fs-meta` | 15px | 15px | Mono labels, tags, table meta, HUD |
| Floor | 14px | 14px | **Nothing smaller, anywhere** |

### 7.4 Colour tokens (contrast verified)

Background `--bg: #0F1115`, panel surface `--panel: #161A20`.

| Token | Value | vs `--bg` | vs `--panel` | Use |
|---|---|---|---|---|
| `--text` | `#E8EAED` | 15.7:1 | 14.5:1 | Primary text |
| `--text-muted` | `#A8B0BA` | 8.6:1 | 8.0:1 | Secondary text |
| `--accent` (copper) | `#D98A4E` | 6.9:1 | 6.4:1 | Links, focus, highlights |
| `--a` (cyan) | `#4FD1E0` | 10.4:1 | 9.6:1 | Matrix A |
| `--b` (magenta) | `#E46FD0` | 6.7:1 | 6.2:1 | Matrix B |
| `--border` | `#606A76` | 3.4:1 | 3.2:1 | Panel borders, dividers |
| `--heat-0` | `#A8502F` | 3.5:1 | 3.2:1 | Ramp start (graphics only, not text) |
| `--heat-1` | `#F08A3C` | 7.6:1 | 7.0:1 | Ramp |
| `--heat-2` | `#FFC46B` | 12.0:1 | 11.1:1 | Ramp |
| `--heat-3` | `#FFF1C9` | 16.8:1 | 15.5:1 | Ramp end |

Rules:
- The thermal ramp is monotonic in luminance (works in greyscale / for colour‑blind users).
- Colour is never the only carrier of meaning — every meter/graph has a numeric value or label.
- Re‑verify contrast for any new colour pairing with a script in CI (WCAG 2.x formula).
- Dark theme only for v1.

### 7.5 Components
- **`Panel`**: border `--border`, radius ~10px, padding ≥ 24px desktop / 16px mobile, `h2` notched into the top border. Optional right‑aligned meta in the border (e.g. a count) only if it's real data.
- **`Meter`**: segmented bar (e.g. 20 cells), filled cells along the thermal ramp, numeric value always shown next to it, `role="meter"` with `aria-valuenow/min/max` and an accessible label.
- **`DotGraph`**: dot‑matrix area/column graph with vertical ramp; axis labels ≥ 14px; includes an accessible text alternative (visually hidden table or `aria-label` summary). Only plots real data.
- **`PubTable`**: process‑list style table (see §7.6 Publications).
- **`Timeline`**: horizontal lanes with bars (Experience).
- **`Tag`**: mono data‑type‑style badges, e.g. venue `ISCA'26`, topic tags `bf16`‑style only where they're real categories. ≥ 14px, ≥ 4.5:1 contrast.
- **Links/buttons:** copper, underline on hover/focus, visible 2px focus ring (`--accent`) with offset; touch targets ≥ 44×44px.

### 7.6 Section specs (all data real)
- **Hero:** `h1` name, one‑sentence description, compact anchor nav.
- **About:** two‑column panel on desktop. Left: short bio (2–3 short paragraphs), affiliation, advisor. Right: stats panel styled like a compact `nvidia-smi`/`btop` readout with **real** numbers (papers, citations, h‑index) and a `DotGraph` of citations per year. Data from OpenAlex at build time or `stats.json`.
- **Research:** one panel per research theme: `h3` title, 2–4 sentence description, and a `Meter` showing **count of papers/projects in that theme** (not a self‑rating).
- **Projects:** card per project: title, 2–3 sentence summary, links (paper/code/demo), tags, and **one small chart of the headline result** (e.g. speedup vs baseline bars) using real numbers from the project file.
- **Publications:** table columns **Year · Venue · Title · Authors (owner bolded) · Links (PDF / BibTeX / Code)**. Paper titles in sans at body size. Grouped or sorted by year (newest first). Mobile (< 640px): each row becomes a stacked card. BibTeX link downloads/copies the entry generated from `pubs.bib`.
- **Experience:** `Timeline` lanes (Education / Research / Industry / Teaching as applicable), bars labelled with role + org; below or alongside, an accessible list with dates and 1–2 line descriptions.
- **News / Teaching / Talks / Awards:** dated list in a panel (date in mono, text in sans), newest first, capped at ~8 items with a "show all" link if needed.
- **Contact:** email (with copy button), GitHub, Google Scholar, ORCID, LinkedIn (as provided), CV PDF. Large tap targets.
- **404:** may use a CUDA‑style error line (it communicates "page not found") plus a clear "Back to home" link.

### 7.7 Responsive layout
- Breakpoints: `< 640px` (phone), `640–1024px` (tablet), `> 1024px` (desktop).
- Desktop: content panels occupy one side (≈ 45% width) while the 3D scene is framed on the other side; the camera framing per chapter must account for this.
- Phone: canvas is fixed full‑viewport; content panels scroll over it **with solid `--panel` backgrounds**; frame each chapter's key visual in the **upper ~55%** of the viewport so panels don't obscure it.
- HUD: top‑right on desktop; compact single line at the top on phones (still ≥ 14px), hidden when tier is `off`.

### 7.8 Motion
- UI (non‑3D) motion is restrained: short fades/translations on section entry (≤ 300ms), no parallax on text.
- `prefers-reduced-motion`: disable 3D (posters instead) and UI motion.

---

## 8. Content model (`src/content/config.ts`)

Use Zod schemas; build must fail with a clear error on invalid content.

```ts
// profile.yaml
{ name, title, affiliation, advisor?, bioMarkdown, email, links: { github?, scholar?, orcid?, linkedin?, cv? }, openalexAuthorId? }

// research.yaml  -> ResearchTheme[]
{ id, title, summary, relatedProjectIds: string[], relatedPubKeys: string[] }   // meter value = counts derived from these

// projects/*.md  frontmatter
{ title, summary, year, tags: string[], links: { paper?, code?, demo? },
  result?: { metric: string, unit: string, baselineLabel: string,
             series: { label: string, value: number }[] } }   // drives the small result chart

// experience.yaml -> Role[]
{ lane: 'Education'|'Research'|'Industry'|'Teaching', role, org, start: 'YYYY-MM', end?: 'YYYY-MM', description }

// news.yaml -> NewsItem[]
{ date: 'YYYY-MM-DD', text, link? }

// stats.json (fallback)
{ papers, citations, hIndex, citationsByYear: { year: number, count: number }[], updated: 'YYYY-MM-DD' }
```

Publications come from `pubs.bib`. Support custom BibTeX fields: `pdf`, `code`, `venue_short` (e.g. `ISCA'26`), `topics` (comma‑separated research theme ids).

Ship with clearly marked **placeholder content** (e.g. `[Your Name]`, sample entries) so the owner can drop in real data. Do not invent real‑looking publications attributed to real venues as if they were real — placeholders must be obviously placeholders.

---

## 9. Accessibility (MUST)
- Semantic landmarks (`header`, `nav`, `main`, `footer`), one `h1`, logical `h2`/`h3` order.
- Skip link. Full keyboard navigation with visible focus.
- Canvas, HUD and 3D labels are `aria-hidden="true"`; all information they show is available in the HTML (content + chapter subtitles rendered as normal text in each section).
- Every graph/meter has an accessible name and text alternative.
- Respect `prefers-reduced-motion` and Save‑Data.
- Text resizes to 200% without loss of content or horizontal scrolling (except data tables, which may scroll horizontally inside their panel).

---

## 10. Explicitly out of scope / do NOT do
- Orbit/drag controls, hover‑to‑reveal content, scroll hijacking/smooth‑scroll libraries.
- React/R3F, Next.js, or any SPA runtime.
- Decorative text of any kind (see §2.5), including fake hex gutters, fake die labels, fake `nvidia-smi` temperatures/power, fake compiler footers, self‑rated skill percentages.
- Unicode braille / box‑drawing glyphs for graphics.
- NVIDIA logos, wordmarks, or NVIDIA green as a primary colour.
- glTF models or large texture downloads.
- Scraping Google Scholar.
- Light theme (v1).

---

## 11. Milestones

1. **M1 — Skeleton & content (no 3D).** Astro + Bun setup, tokens, all components, all sections with placeholder content, BibTeX pipeline, stats pipeline with fallback, 404, responsive layout, accessibility pass. Lighthouse targets met at this stage.
2. **M2 — Scene foundation + Chapters 0–2.** Lazy loader, tier detection, posters fallback, renderer/camera/timeline infrastructure, `kernel.ts`, HUD, overlay labels, chapters 0–2 visuals.
3. **M3 — Chapters 3–5.** SM pair interior, SMEM ring + barriers, k‑loop streaming, TMEM heatmap, pipeline lanes tied to Experience.
4. **M4 — Chapters 6–7 + polish.** Epilogue + double buffering, finale, transitions, bloom on high tier, poster generation for each chapter (render frames from the scene to AVIF).
5. **M5 — Performance & QA.** Bundle analysis, real‑device testing (Android via Chrome remote debugging, iPhone via Safari Web Inspector), watchdog tuning, Lighthouse CI, contrast check script in CI.

## 12. Acceptance checklist
- [ ] Site fully readable with JS disabled.
- [ ] All §6.1 budgets met; bundle sizes reported in the PR/README.
- [ ] No text < 14px anywhere (verify with a computed‑style audit script).
- [ ] Contrast script passes for all token pairings used.
- [ ] Exactly one `h1`; heading order valid; axe/Lighthouse accessibility 100.
- [ ] Every number in the HUD/labels derives from `kernel.ts` and matches §5.1.
- [ ] Reduced‑motion, Save‑Data, no‑WebGL2 and context‑loss paths all show posters correctly.
- [ ] Scroll is smooth with no long tasks on a mid‑range Android phone.
- [ ] No decorative/fake text present (§2.5, §10).
- [ ] README documents: how to edit content, update `pubs.bib`, refresh stats, run dev/build with Bun, deploy.

---

## 13. Information the owner still needs to provide
- Name, title, affiliation, advisor, bio, contact links, CV PDF.
- `pubs.bib` with `pdf` / `code` / `venue_short` / `topics` fields.
- Research themes and project list, including real headline results for project charts.
- Experience and news entries.
- OpenAlex author ID (optional) for automatic citation stats.
- Domain name and preferred host.

---

## 14. Technical references
- Colfax — CUTLASS tutorial: GEMM with Tensor Memory on Blackwell: https://research.colfax-intl.com/cutlass-tutorial-writing-gemm-kernels-using-tensor-memory-for-nvidia-blackwell-gpus/
- Colfax — GEMM with thread block clusters on Blackwell (TMA multicast, 2‑SM UMMA): https://research.colfax-intl.com/cutlass-tutorial-gemm-with-thread-block-clusters-on-nvidia-blackwell-gpus/
- NVIDIA CUTLASS — tcgen05 MMA programming guide: https://docs.nvidia.com/cutlass/latest/media/docs/pythonDSL/guides/mma/tcgen05_programming.html
- Modular — Matrix multiplication on Blackwell, Part 3: https://modular.com/blog/matrix-multiplication-on-nvidias-blackwell-part-3-the-optimizations-behind-85-of-sota-performance
- Chips and Cheese — Nvidia's B200: https://chipsandcheese.com/p/nvidias-b200-keeping-the-cuda-juggernaut
- Astro — Use Bun with Astro: https://docs.astro.build/en/recipes/bun/
- GSAP: https://github.com/greensock/GSAP
- WCAG 2.2 contrast requirements: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
