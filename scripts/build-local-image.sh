#!/usr/bin/env bash
set -euo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/docker-local-env.sh"

case $(uname -m) in
  x86_64) platform=linux/amd64 ;;
  aarch64) platform=linux/arm64 ;;
  *) echo 'Unsupported local CPU architecture' >&2; exit 1 ;;
esac

python3 "$project_dir/scripts/build-local-image.py" |
  "${docker_cmd[@]}" image import --platform "$platform" \
    --change 'ENV PATH=/usr/local/bin:/usr/bin:/bin' \
    --change 'ENV HOME=/home/blog SHELL=/bin/bash LANG=C.UTF-8' \
    --change 'WORKDIR /app' \
    --change 'CMD ["/usr/local/bin/node", "preview-server.js"]' \
    --change 'LABEL org.opencontainers.image.title=blog-by-codex-local' \
    - "$BLOG_IMAGE"

"${docker_cmd[@]}" run --rm --pull=never --entrypoint /usr/local/bin/node "$BLOG_IMAGE" --version
"${docker_cmd[@]}" run --rm --pull=never --entrypoint /usr/bin/git "$BLOG_IMAGE" --version
"${docker_cmd[@]}" run --rm --pull=never --user "$BLOG_UID:$BLOG_GID" --entrypoint /bin/sh "$BLOG_IMAGE" -c \
  'set -e; uname -m; getent passwd "$(id -u)"; test -w "$HOME"; tar --version >/dev/null; gzip --version >/dev/null; curl --version >/dev/null; /bin/bash -lc "node --version && git --version"'
echo "Local image ready: $BLOG_IMAGE (no registry download or upload)"
