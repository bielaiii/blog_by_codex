# Runtime tools only. Source code is mounted at /app by Compose.
ARG NODE_IMAGE=node:22.23.3-bookworm-slim
FROM ${NODE_IMAGE}

ARG BLOG_UID=1000
ARG BLOG_GID=1000
RUN test "$BLOG_UID" -gt 0 && test "$BLOG_GID" -gt 0 \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
       bash ca-certificates clang-format curl git gzip libc-bin libstdc++6 \
       openssh-client openssh-server procps tar \
    && rm -rf /var/lib/apt/lists/* \
    && rm -f /etc/ssh/ssh_host_* \
    && groupmod --non-unique --gid "$BLOG_GID" --new-name blog node \
    && usermod --uid "$BLOG_UID" --gid "$BLOG_GID" --login blog \
       --home /home/blog --move-home --password '*' node \
    && mkdir -p /app /run/sshd \
    && chown blog:blog /app /home/blog

ENV HOME=/home/blog SHELL=/bin/bash LANG=C.UTF-8
WORKDIR /app
USER blog
ENTRYPOINT ["/usr/local/bin/node"]
CMD ["preview-server.js"]
