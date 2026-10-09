// Tokenizer + BM25 ranking shared by the knowledge builder and the Worker,
// so documents and queries are normalised exactly the same way.

const STOPWORDS = new Set([
  // English
  "a", "an", "the", "and", "or", "of", "to", "in", "on", "for", "with", "is", "are",
  "be", "it", "this", "that", "as", "at", "by", "from", "can", "you", "your", "i",
  "my", "me", "we", "do", "does", "how", "what", "where", "when", "which", "who",
  "will", "if", "not", "so", "into", "about", "there", "then", "than", "also",
  // Arabic (normalised forms)
  "في", "من", "علي", "الي", "عن", "مع", "هذا", "هذه", "ذلك", "تلك", "التي", "الذي",
  "او", "ثم", "كيف", "ما", "ماذا", "هل", "هو", "هي", "انا", "انت", "كل", "قد", "لا",
  "ان", "او", "يمكن", "يمكنني", "يمكنك", "عند", "بعد", "قبل", "اي", "به", "بها", "لي",
]);

const ARABIC_PREFIXES = ["وال", "بال", "كال", "فال", "لل", "ال"];

export function normalize(text) {
  return String(text)
    .toLowerCase()
    .replace(/[ً-ْٰـ]/g, "") // tashkeel + tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي");
}

function stem(token) {
  if (/^[؀-ۿ]+$/.test(token)) {
    for (const prefix of ARABIC_PREFIXES) {
      if (token.startsWith(prefix) && token.length - prefix.length >= 3) {
        return token.slice(prefix.length);
      }
    }
    return token;
  }
  if (token.length > 4 && token.endsWith("ies")) return token.slice(0, -3) + "y";
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

export function tokenize(text) {
  const tokens = normalize(text).match(/[\p{L}\p{N}]+/gu) || [];
  const out = [];
  for (const raw of tokens) {
    if (raw.length < 2 || STOPWORDS.has(raw)) continue;
    out.push(stem(raw));
  }
  return out;
}

const K1 = 1.2;
const B = 0.75;

/**
 * Rank the chunks of one language index against a query.
 * @param {{N:number, avgdl:number, df:Record<string,number>, chunks:Array}} index
 */
export function search(index, query, limit = 5) {
  const terms = [...new Set(tokenize(query))];
  if (!terms.length) return [];
  const scored = [];
  for (const chunk of index.chunks) {
    let score = 0;
    for (const term of terms) {
      const tf = chunk.tf[term];
      if (!tf) continue;
      const df = index.df[term] || 0;
      const idf = Math.log(1 + (index.N - df + 0.5) / (df + 0.5));
      score += idf * ((tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * chunk.len) / index.avgdl)));
    }
    if (score > 0) scored.push({ chunk, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}
