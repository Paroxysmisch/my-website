import { z } from "astro/zod";

const ym = z.string().regex(/^\d{4}(-\d{2})?$/, "expected YYYY or YYYY-MM");
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

export const profileSchema = z.object({
  name: z.string(),
  bibName: z.string().optional(),
  title: z.string(),
  affiliation: z.string(),
  advisor: z.string().optional(),
  tagline: z.string(),
  bioMarkdown: z.string(),
  email: z.email(),
  emailAlt: z.email().optional(),
  links: z.object({
    github: z.string().optional(),
    scholar: z.string().optional(),
    orcid: z.string().optional(),
    linkedin: z.string().optional(),
    cv: z.string().optional(),
  }),
  openalexAuthorId: z.string().optional(),
});

export const researchSchema = z.array(
  z.object({
    id: z.string(),
    title: z.string(),
    summary: z.string(),
    relatedProjectIds: z.array(z.string()),
    relatedPubKeys: z.array(z.string()),
  }),
);

export const experienceSchema = z.array(
  z.object({
    lane: z.enum(["Education", "Research", "Industry", "Teaching"]),
    role: z.string(),
    org: z.string(),
    start: ym,
    end: ym.optional(),
    description: z.string(),
  }),
);

export const newsSchema = z.array(
  z.object({
    date: ymd.optional(),
    /** shown instead of a date for undated items (e.g. "award") */
    label: z.string().optional(),
    text: z.string(),
    link: z.url().optional(),
  }),
);

export const statsSchema = z.object({
  papers: z.number(),
  citations: z.number(),
  hIndex: z.number(),
  citationsByYear: z.array(z.object({ year: z.number(), count: z.number() })),
  updated: ymd,
});

export type Profile = z.infer<typeof profileSchema>;
export type Stats = z.infer<typeof statsSchema>;
export type Role = z.infer<typeof experienceSchema>[number];
