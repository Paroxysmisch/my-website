# Personal website

A static [Astro 6](https://astro.build) site whose single visual story is **one output tile of a BF16 GEMM running on a B200 (SM100)**. A fixed Three.js scene follows that tile as you scroll: full matrices → tiling → mapping onto an SM pair → TMA/SMEM k-loop → `tcgen05.mma` into Tensor Memory → epilogue → finale. Each stage hosts one content section. See `personal-website-spec.md` for the full design.

All content is static HTML and readable with JavaScript disabled. The 3D scene is progressive enhancement (poster images when reduced-motion, Save-Data, no WebGL2, or context loss).

> **Everything in `src/data` and `src/content` is placeholder content** (`[Your Name]`, `Placeholder Paper A`, …). Replace it with real information.

## Commands (Bun)

```bash
bun install
bun run dev        # http://localhost:4321
bun run build      # static output in dist/
bun run preview
bun run check      # astro check (types, content schemas)
bun run lint       # biome
bun run contrast   # WCAG contrast check for all colour tokens/pairings
bun run audit      # computed-style audit of the built site (needs `preview` running; min 14px text, headings, overflow, touch targets)
bun run posters    # re-render chapter posters (needs `preview` running; see below)
```

Astro 6 needs Node ≥ 22 (installed alongside Bun) for some tooling.

## Editing content

| What | Where |
|---|---|
| Name, title, affiliation, advisor, bio, links, email | `src/data/profile.yaml` |
| Publications | `src/data/pubs.bib` |
| Research themes | `src/content/research.yaml` |
| Projects (one file each) | `src/content/projects/*.md` |
| Experience (timeline) | `src/content/experience.yaml` |
| News / talks / awards | `src/content/news.yaml` |
| Fallback citation stats | `src/data/stats.json` |
| CV | put `cv.pdf` in `public/` and keep `links.cv: "/cv.pdf"` |

Schemas live in `src/lib/schemas.ts` (Zod) and `src/content.config.ts`; the build fails with a clear message on invalid content or broken references (e.g. a research theme pointing at a missing paper key).

### `pubs.bib`

Standard BibTeX plus custom fields: `pdf`, `code`, `venue_short` (e.g. `ISCA'26`), `topics` (comma-separated research theme ids). The *BibTeX* link on each row downloads the original entry text. Your name is bolded wherever an author matches `bibName` in `profile.yaml`.

Research-theme meters are **counts**: `relatedPubKeys` + `relatedProjectIds` in `research.yaml`, out of all papers + projects.

### Citation stats

Set `openalexAuthorId` in `profile.yaml` to fetch papers/citations/h-index/citations-per-year from OpenAlex at build time. If the id is missing or the API is unreachable the build falls back to `src/data/stats.json` (it never fails). Google Scholar is not scraped.

## The 3D scene

```
src/scene/
  kernel.ts      single source of truth for the GEMM config; every on-screen number derives from it
  chapters.ts    subtitles/stage names (also rendered as real text in each section)
  layout.ts      world-space layout of the cube, package, and "inside the SM pair" group
  state.ts       shared uniforms + animated state
  timeline.ts    one GSAP master timeline (chapter i = tau in [i, i+1])
  camera.ts      CatmullRom rig (target / direction / log-distance), framed per viewport region
  labels.ts      HTML labels projected from 3D anchors
  hud.ts         readout line
  quality.ts     tier detection (high/medium/low/off), DPR caps, frame-time watchdog
  loader.ts      idle-time dynamic import + poster fallback
  actors/        matrices, die, smPair, smemRing, tmemGrid, pipelineLanes, flows, tiles
  shaders/       GLSL (box, face, tmem, strip, lanes, flow, ...)
```

How it works: scroll is mapped (through each section's offset) to timeline time `tau`; GSAP tweens a handful of uniforms and the shaders do the rest, so there is no per-instance work on the CPU. Rendering is on demand (only while scroll/animation changes; idle animation only in the hero). TMEM is a single procedural 128 × 512 plane, not 65k instances. Opaque rendering with screen-door dithered fades keeps depth correct without sorting. No models or textures are downloaded.

Dev helper: `/?tau=3.5` freezes the scene at chapter position 3.5 (chapter *i* spans `i … i+1`).

### Posters

`public/posters/chapter-N.avif` (desktop) and `chapter-N-m.avif` (phone) are generated from the live scene: `bun run build && bun run preview &` then `bun run posters` (uses Chrome via `puppeteer-core` and `sharp`). Re-run after changing the scene.

## Budgets (measured on this build)

| | Result |
|---|---|
| Critical path (HTML + CSS + preloaded sans font, brotli) | ≈ 38 KB |
| 3D bundle (three + gsap + scene), loaded on idle | ≈ 159 KB brotli (≈ 187 KB gzip) |
| Lighthouse (mobile, local) | Perf 99 · A11y 100 · Best Practices 100 · SEO 100; LCP 0.9 s; CLS 0 |

## Deploy

`bun run build`, then publish `dist/` to any static host (Cloudflare Pages, Netlify, GitHub Pages). Enable Brotli and long-lived immutable caching for `/_astro/*` (hashed). Set `site` in `astro.config.ts` to your domain.

## Notes / not done yet

- Real bloom post-processing on the `high` tier is not implemented (it would add ≈ 30 KB to the bundle); glow is done in shaders on every tier.
- Real-device testing (Android / iPhone) and watchdog tuning (spec M5) still need to be done on hardware.
