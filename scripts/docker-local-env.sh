#!/usr/bin/env bash
# Shared by the local image and deployment scripts; source this file.
set -euo pipefail

project_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
compose_file="$project_dir/compose.yaml"
blog_host_uid=$(id -u)
blog_host_gid=$(id -g)
if [[ $blog_host_uid == 0 ]]; then blog_host_uid=1000; fi
if [[ $blog_host_gid == 0 ]]; then blog_host_gid=1000; fi
export BLOG_UID=${BLOG_UID:-$blog_host_uid}
export BLOG_GID=${BLOG_GID:-$blog_host_gid}

if command -v docker >/dev/null && docker info >/dev/null 2>&1; then
  docker_cmd=(docker)
  export BLOG_PROJECT_DIR="$project_dir"
elif command -v docker.exe >/dev/null && docker.exe --context desktop-linux info >/dev/null 2>&1; then
  docker_cmd=(docker.exe --context desktop-linux)
  compose_file=$(wslpath -w "$compose_file")
  export BLOG_PROJECT_DIR
  BLOG_PROJECT_DIR=$(wslpath -w "$project_dir")
else
  echo 'Docker is unavailable. Start Docker Desktop and enable this distro in Settings > Resources > WSL Integration.' >&2
  exit 1
fi

compose_cmd=("${docker_cmd[@]}" compose --project-directory "$BLOG_PROJECT_DIR" -f "$compose_file")
export BLOG_HTTP_BIND=127.0.0.1 BLOG_LAN_EDITOR=false
if [[ -f "$project_dir/.local/lan.json" ]]; then
  lan_config=$(python3 -c 'import json,ipaddress,sys; c=json.load(open(sys.argv[1],encoding="utf-8-sig")); print(int(bool(c.get("enabled")))); print(ipaddress.IPv4Address(c.get("bindAddress","127.0.0.1")))' "$project_dir/.local/lan.json")
  mapfile -t lan_values <<< "$lan_config"
  if [[ ${lan_values[0]} == 1 ]]; then
    export BLOG_HTTP_BIND=${lan_values[1]} BLOG_LAN_EDITOR=true
  fi
fi
if [[ -f "$project_dir/.local/remote.json" ]]; then
  remote_config=$(python3 -c 'import json,ipaddress,sys; c=json.load(open(sys.argv[1],encoding="utf-8-sig")); print(int(bool(c.get("enabled")))); print(ipaddress.IPv4Address(c.get("bindAddress","127.0.0.1"))); p=int(c.get("port",2222)); assert 1<=p<=65535; print(p)' "$project_dir/.local/remote.json")
  mapfile -t remote_values <<< "$remote_config"
  if [[ ${remote_values[0]} == 1 ]]; then
    export BLOG_SSH_BIND=${remote_values[1]} BLOG_SSH_PORT=${remote_values[2]}
    remote_compose="$project_dir/compose.remote.yaml"
    if [[ ${docker_cmd[0]} == docker.exe ]]; then remote_compose=$(wslpath -w "$remote_compose"); fi
    compose_cmd+=(-f "$remote_compose")
  fi
fi
if [[ ${docker_cmd[0]} == docker.exe ]]; then
  # Windows executables only receive WSL environment variables listed in WSLENV.
  # BLOG_PROJECT_DIR already uses Windows path syntax, so do not add /p conversion.
  for blog_variable in BLOG_PROJECT_DIR BLOG_UID BLOG_GID BLOG_HTTP_BIND BLOG_LAN_EDITOR BLOG_SSH_BIND BLOG_SSH_PORT BLOG_PORT BLOG_IMAGE; do
    if [[ :${WSLENV:-}: != *":$blog_variable:"* && :${WSLENV:-}: != *":$blog_variable/"* ]]; then
      export WSLENV="${WSLENV:+$WSLENV:}$blog_variable/w"
    fi
  done
fi
resolved_config=$("${compose_cmd[@]}" config --format json | python3 -c 'import json,sys; blog=json.load(sys.stdin)["services"]["blog"]; print(blog["image"]); print(blog["ports"][0]["published"])')
BLOG_IMAGE=${resolved_config%%$'\n'*}
blog_port=${resolved_config##*$'\n'}
