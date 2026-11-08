# Personal website

A static [Astro 6](https://astro.build) site with one big idea: **a fixed Three.js scene follows one output tile of a BF16 GEMM on a B200 (SM100)** while you scroll. Each stage of the kernel hosts one content section.

> Everything in `src/data` and `src/content` is **placeholder content**. Replace it with real information.

The page is plain, readable HTML first (no JavaScript needed to read anything). The 3D scene is progressive enhancement and falls back to static chapter posters (reduced motion, Save-Data, no WebGL2, lost context).

## Design

- **Light / dark:** two themes, no "auto" state. On load the page picks the system's light/dark preference (time of day as a fallback: light 07–19h) and keeps following it live: if the system switches (or the clock crosses sunrise/sunset while the tab is open) the theme flips automatically. The pixel sun/moon button in the header flips it manually until the next automatic change; nothing is stored between visits. Tokens live in `src/styles/tokens.css`; the 3D shaders work in dark space and map their final colour with `uLight` (`themed()` in `shaders/common.glsl`). Posters exist per theme (`chapter-N[-m][-light].avif`). `?theme=light|dark` forces a theme for one page load (used by the poster script). `bun run contrast` checks both themes.

- Minimal modern layout on a soft neutral dark theme with a pixelated accent: **Pixelify Sans** for h1/h2, nav, kickers, buttons and link chips; **Space Grotesk** for body copy; **DM Mono** for data (dates, tags, labels, readout). Boxes use stepped pixel borders, buttons are dashed with corner handles, separators are dashed.
- A very faint ASCII-orb background shader (`src/scene/bg.ts`) drifts behind everything and glows around the pointer; it clears out under the 3D scene (screen-space footprint polygons), is skipped for Save-Data and static for reduced motion.
- Palette follows the GEMM walkthrough: **A** blue, **B** magenta, accumulator **amber**, finished/written back **green**, peer SM **purple** (`src/styles/tokens.css`).
- Scene playback: scrolling only selects the active chapter. The camera pans there (time-based, never scrubbed) and the chapter's data-movement animation then loops in real time, like the hero (`DWELL` in `src/scene/timeline.ts`: ping-pong for state changes, seamless wrap for the SMEM ring, once for the finale). Jumps of more than ~1.5 chapters fade the stage out, cut the story to the destination chapter and play its own pan on fade-in. A fast flick snaps to the nearest section; slow scrolling stays free.
- Text pops + fades in **and out every time** it enters/leaves the screen (`src/scripts/reveal.ts`, IntersectionObserver; exits remember the side they left through).
- Navigation is a pixel **section rail** on the left (desktop): one node per section in its stage colour, the track fills with overall progress, hover/focus shows the section name, click glides there. On phones a segmented progress strip sits under the header and the menu lists the sections.
- Desktop: scene fixed on the right, text on the left. Phone/tablet: the scene fills the viewport with the animation in the upper part; text scrolls up over it but fades out as it crosses mid-screen, so it never covers the animation.
- The plain-language narration lives in an info button (i) at the corner of the scene (hover or tap) (`src/scene/beats.ts`) says in plain language what is happening at each beat, next to a mono readout whose numbers all come from `src/scene/kernel.ts`.

## The story (8 chapters)

| # | Section | Scene |
|---|---|---|
| 1 | Hero | `C = A · B`: dot-products scan A's rows and B's columns |
| 2 | About | C is cut into 1,024 tiles (swizzled order); one tile + its A row strip and B column strip, split between the 2 CTAs of a pair; K sliced into 128 blocks |
| 3 | Research | The B200 die (two dies, NV-HBI, GPCs, L2, GigaThread engine, HBM; laid out like the Blackwell Ultra die shot). CTA pairs are assigned; our tile lands on pair 20 |
| 4 | Projects | Inside the SM pair, laid out like the Blackwell SM diagram: 4 sub-partitions (warp scheduler, registers, TMEM slice, CUDA cores, Tensor Core), TMA, shared memory, textures |
| 5 | Education | k-loop: TMA streams k-blocks from the A/B strips in HBM into the 6-slot SMEM ring; full-barrier per slot; each SM loads half of B |
| 6 | Experience | One thread issues `tcgen05.mma.cta_group::2`; accumulators build up in TMEM (4 × 32 lanes × 512 columns per SM) |
| 7 | News | Epilogue: 4 warps `tcgen05.ld` their 32 TMEM lanes → registers → FP32→BF16 → SMEM → TMA store to HBM; the second TMEM buffer starts the next tile |
| 8 | Contact | Every pair works through the remaining tiles; C fills in waves and settles |

Technical facts (warp roles, CTA pair, B halves, ring protocol, TMEM double buffering) follow the walkthrough in `PLENA/docs/gemm-walkthrough`.

## Commands (Bun)

```bash
bun install
bun run dev        # http://localhost:4321
bun run build      # static output in dist/
bun run preview
bun run check      # astro check (types + content schemas)
bun run lint       # biome
bun run contrast   # WCAG contrast check of the colour tokens
bun run audit      # computed-style audit of a running preview (min 14px text, headings, overflow, touch targets)
bun run posters    # re-render the chapter posters from the live scene (needs a running preview)
```

`scripts/serve.sh` rebuilds and serves a preview on port 4322; `scripts/dev/` has screenshot, scroll-mapping and fallback test helpers (`bun scripts/dev/shot.ts out.png 1440 900 3.5` renders the scene at chapter position 3.5; `scroll:N` scrolls instead).

## Editing content

| What | Where |
|---|---|
| Name, title, affiliation, advisor, bio, links, email | `src/data/profile.yaml` |
| Education | `src/content/education.yaml` (+ `interests` in `profile.yaml`) |
| Publications (feed Research counts; no own section) | `src/data/pubs.bib` |
| Research themes | `src/content/research.yaml` (meter = related papers + projects) |
| Projects | `src/content/projects/*.md` |
| Experience | `src/content/experience.yaml` (education lives in `education.yaml`) |
| News / talks / awards | `src/content/news.yaml` |
| Fallback citation stats | `src/data/stats.json` (set `openalexAuthorId` in `profile.yaml` for live OpenAlex stats at build time) |
| CV | put `cv.pdf` in `public/` |

The build fails with a clear message on invalid content or broken references.

## Scene internals (`src/scene/`)

`kernel.ts` (single source of numbers) · `layout.ts` (matrices, die from the reference die shot, SM from the reference SM diagram) · `timeline.ts` (one GSAP master timeline, chapter *i* = τ ∈ [i, i+1]) · `camera.ts` (CatmullRom rig, framed to the visible region of the stage) · `labels.ts` / `beats.ts` / `hud.ts` · `quality.ts` (tiers, DPR caps, frame-time watchdog) · `actors/` · `shaders/`.

Everything animated is a uniform; instances are never touched per frame. TMEM is a procedural plane (not 65k cells). A bitmask "spotlight" dims everything except the units a beat is about. `?tau=3.5` freezes the scene at a chapter position.

## Budgets (measured)

Lighthouse (mobile, local): Performance 96 · Accessibility 100 · Best Practices 100 · SEO 100; LCP 0.8 s; CLS 0. 3D bundle (three + gsap + scene, loaded on idle): ≈ 161 KB brotli.

## Deploy

`bun run build`, publish `dist/` to any static host. Set `site` in `astro.config.ts`. Brotli + immutable caching for `/_astro/*`.

## Not done yet

- Real bloom post-processing on the `high` tier (glow is in shaders).
- Real-device testing (Android / iPhone) and watchdog tuning.
