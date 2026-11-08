import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import {
  educationSchema,
  experienceSchema,
  newsSchema,
  type Profile,
  profileSchema,
  researchSchema,
  type Stats,
  statsSchema,
} from "./schemas";

const read = (p: string) => readFileSync(resolve(process.cwd(), "src", p), "utf8");

function load<T>(file: string, schema: { parse: (v: unknown) => T }, json = false): T {
  try {
    const raw = read(file);
    return schema.parse(json ? JSON.parse(raw) : parse(raw));
  } catch (e) {
    throw new Error(`Invalid content in src/${file}:\n${e instanceof Error ? e.message : e}`);
  }
}

export const profile: Profile = load("data/profile.yaml", profileSchema);
export const research = load("content/research.yaml", researchSchema);
export const education = load("content/education.yaml", educationSchema);
export const experience = load("content/experience.yaml", experienceSchema);
export const news = load("content/news.yaml", newsSchema).sort((a, b) => {
  // dated items newest first, undated ones (awards) after them in file order
  if (a.date && b.date) return b.date.localeCompare(a.date);
  return a.date ? -1 : b.date ? 1 : 0;
});

/** Citation stats: OpenAlex at build time when configured, else stats.json. Never fails the build. */
export async function getStats(): Promise<{ stats: Stats; source: string }> {
  const fallback = load("data/stats.json", statsSchema, true);
  const id = profile.openalexAuthorId;
  if (!id) return { stats: fallback, source: `placeholder stats.json, ${fallback.updated}` };
  try {
    const res = await fetch(`https://api.openalex.org/authors/${encodeURIComponent(id)}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = (await res.json()) as {
      works_count: number;
      cited_by_count: number;
      summary_stats?: { h_index: number };
      counts_by_year: { year: number; cited_by_count: number }[];
    };
    const stats: Stats = {
      papers: j.works_count,
      citations: j.cited_by_count,
      hIndex: j.summary_stats?.h_index ?? fallback.hIndex,
      citationsByYear: j.counts_by_year
        .map((c) => ({ year: c.year, count: c.cited_by_count }))
        .sort((a, b) => a.year - b.year),
      updated: new Date().toISOString().slice(0, 10),
    };
    return { stats, source: `OpenAlex, ${stats.updated}` };
  } catch (e) {
    console.warn(`[stats] OpenAlex unavailable (${e}); using stats.json`);
    return { stats: fallback, source: `stats.json, ${fallback.updated}` };
  }
}
