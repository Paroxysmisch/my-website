import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { initSync, type Name, parse } from "@retorquere/bibtex-parser";

let ready = false;
function init() {
  if (ready) return;
  const wasm = readFileSync(
    resolve(process.cwd(), "node_modules/@retorquere/bibtex-parser/dist/wasm/bibtex_parser_bg.wasm"),
  );
  initSync({ module: wasm });
  ready = true;
}

export interface Pub {
  key: string;
  year: number;
  venue: string;
  title: string;
  authors: string[];
  pdf?: string;
  code?: string;
  topics: string[];
  bibtex: string;
}

const nameToString = (n: Name) =>
  n.name ?? [n.firstName, n.prefix, n.lastName, n.suffix].filter(Boolean).join(" ");

const str = (v: unknown) => (typeof v === "string" ? v.trim() : undefined);

export function loadPubs(): Pub[] {
  init();
  const file = resolve(process.cwd(), "src/data/pubs.bib");
  const lib = parse(readFileSync(file, "utf8"));
  if (lib.errors.length) {
    throw new Error(`Invalid src/data/pubs.bib:\n${lib.errors.map((e) => e.error).join("\n")}`);
  }
  return lib.entries
    .map((e): Pub => {
      const f = e.fields as Record<string, unknown>;
      const year = Number(str(f.year));
      const title = str(f.title);
      if (!title || !Number.isFinite(year)) {
        throw new Error(`pubs.bib entry "${e.key}" needs a title and a numeric year`);
      }
      const authors = Array.isArray(f.author) ? (f.author as Name[]).map(nameToString) : [];
      return {
        key: e.key,
        year,
        title,
        authors,
        venue: str(f.venue_short) ?? str(f.booktitle) ?? str(f.journal) ?? "",
        pdf: str(f.pdf),
        code: str(f.code),
        topics: (str(f.topics) ?? "")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        bibtex: e.input.trim(),
      };
    })
    .sort((a, b) => b.year - a.year);
}
