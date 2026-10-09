#!/usr/bin/env sh
# Builds both languages: English -> ./en, Arabic -> ./ar
# Then refreshes the AI assistant's knowledge base from the built search indexes.
# Set GC_CHATBOT_ENDPOINT (or extra.chatbot.endpoint in mkdocs.yml) to show the assistant.
set -e
cd "$(dirname "$0")"
mkdocs build --clean -f mkdocs.yml "$@"
mkdocs build --clean -f mkdocs.ar.yml "$@"

if command -v node >/dev/null 2>&1; then
  node chatbot-worker/scripts/build-knowledge.mjs
  echo "Knowledge updated. Run 'cd chatbot-worker && npm run deploy' to publish it."
else
  echo "Node.js not found: skipped chatbot knowledge update."
fi
