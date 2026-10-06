#!/usr/bin/env bash
# Portable build: Docker provides Node.js and all required Linux utilities.
set -euo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/docker-local-env.sh"
"${compose_cmd[@]}" build blog
echo "Runtime image built locally: $BLOG_IMAGE"
