#!/usr/bin/env bash
set -euo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/docker-local-env.sh"

if ! "${docker_cmd[@]}" image inspect "$BLOG_IMAGE" >/dev/null 2>&1; then
  echo "Local image $BLOG_IMAGE is missing. Run docker compose build blog (downloads public dependencies), or use docker load / bash scripts/build-local-image.sh for offline deployment." >&2
  exit 1
fi

"${compose_cmd[@]}" up -d --no-build --pull never --wait --wait-timeout 60
echo "Blog ready: http://127.0.0.1:$blog_port"
