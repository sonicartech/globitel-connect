// Builds src/knowledge.json from the MkDocs search indexes of the built sites
// (../en and ../ar). Run after ./build.sh: `npm run build:knowledge`.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tokenize } from "../src/search.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const out = resolve(here, "../src/knowledge.json");
const LANGS = ["en", "ar"];
const MAX_CHUNK_CHARS = 1800;

function htmlToText(html) {
  return html
    .replace(/<li>/g, "\n- ")
    .replace(/<\/(p|ol|ul|tr|h\d|table)>/g, "\n")
    .replace(/<\/t[dh]>/g, " | ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&rsquo;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

function buildIndex(lang) {
  const file = resolve(root, lang, "search/search_index.json");
  if (!existsSync(file)) throw new Error(`Missing ${file}. Run ./build.sh first.`);
  const { docs } = JSON.parse(readFileSync(file, "utf8"));

  const pageTitles = {};
  for (const doc of docs) if (!doc.location.includes("#")) pageTitles[doc.location] = doc.title;

  const chunks = [];
  for (const doc of docs) {
    // Skip the home page and tag listings: they hold no instructions.
    if (doc.location === "" || doc.location.startsWith("tags/")) continue;
    const text = htmlToText(doc.text).slice(0, MAX_CHUNK_CHARS);
    if (text.length < 20) continue;
    let page = pageTitles[doc.location.split("#")[0]] || doc.title;
    // Admin pages reuse agent page names (Login, My Dashboard): make them distinct.
    if (doc.location.startsWith("Administration/")) page = `Administration › ${page}`;
    const heading = page === doc.title ? page : `${page} › ${doc.title}`;
    // Titles count twice so headings weigh more than body text.
    const tokens = [...tokenize(heading), ...tokenize(heading), ...tokenize(text)];
    const tf = {};
    for (const t of tokens) tf[t] = (tf[t] || 0) + 1;
    chunks.push({ title: heading, page, url: doc.location, text, tf, len: tokens.length });
  }

  const df = {};
  for (const chunk of chunks) for (const term of Object.keys(chunk.tf)) df[term] = (df[term] || 0) + 1;
  const avgdl = chunks.reduce((sum, c) => sum + c.len, 0) / Math.max(chunks.length, 1);
  return { N: chunks.length, avgdl, df, chunks };
}

const knowledge = {};
for (const lang of LANGS) {
  knowledge[lang] = buildIndex(lang);
  console.log(`${lang}: ${knowledge[lang].N} chunks`);
}
writeFileSync(out, JSON.stringify(knowledge));
console.log(`Wrote ${out}`);
