# Globitel Connect AI assistant

A Cloudflare Worker that answers questions about the documentation in English and Arabic,
using Workers AI on the **free plan** (10,000 neurons/day, roughly 400 questions/day with
the default model). The chat widget is part of the static site
(`overrides/assets/javascripts/chatbot.js`) and talks to this Worker.

## How it works

1. `./build.sh` builds the sites and runs `scripts/build-knowledge.mjs`, which turns
   `en/search/search_index.json` and `ar/search/search_index.json` into `src/knowledge.json`.
2. The Worker ranks those sections against each question (BM25, Arabic-aware normalisation),
   sends the best ones to the model with strict "answer only from the docs" instructions,
   and streams the answer back with links to the source pages.

## Deploy (first time)

```sh
cd chatbot-worker
npm install
npx wrangler login          # if not logged in
npm run deploy              # prints https://globitel-connect-chatbot.<your-subdomain>.workers.dev
```

Put that URL in `mkdocs.yml`:

```yaml
extra:
  chatbot:
    endpoint: https://globitel-connect-chatbot.<your-subdomain>.workers.dev
```

(or build with `GC_CHATBOT_ENDPOINT=<url> ./build.sh`), then rebuild the site. When the
endpoint is empty, the widget is not rendered.

## Updating

After changing the docs: `./build.sh`, then `cd chatbot-worker && npm run deploy`.

## Settings (`wrangler.jsonc`)

| Setting | Purpose |
| --- | --- |
| `MODEL` | Workers AI model. Default `@cf/qwen/qwen3-30b-a3b-fp8` (cheap, good Arabic). |
| `ALLOWED_ORIGINS` | Sites allowed to call the API. Add any new domain or preview host. |
| `ratelimits` | 15 questions/minute per IP. Remove the block if your plan rejects it. |

## Local development

```sh
npm run dev   # http://localhost:8787 (Workers AI runs remotely and uses your free neurons)
GC_CHATBOT_ENDPOINT=http://localhost:8787 mkdocs serve -f mkdocs.yml
```
