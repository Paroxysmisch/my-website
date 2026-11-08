import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

export const resultSchema = z.object({
  metric: z.string(),
  unit: z.string(),
  baselineLabel: z.string(),
  series: z.array(z.object({ label: z.string(), value: z.number() })).min(2),
});

const projects = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/projects" }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    year: z.number().int().optional(),
    /** e.g. "MEng dissertation" — shown instead of the year when the year isn't known */
    context: z.string().optional(),
    tags: z.array(z.string()),
    links: z.object({
      paper: z.string().optional(),
      code: z.string().optional(),
      demo: z.string().optional(),
    }),
    result: resultSchema.optional(),
  }),
});

export const collections = { projects };
