#!/usr/bin/env python3
"""Pack the installed Linux runtime and VS Code attach tools into an offline image.

Only selected tools, libraries and public system metadata are included. Project
files, credentials and user configuration are not copied into the image.
"""
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile


def add_binary(root, name, destination):
    binary = shutil.which(name)
    if not binary:
        raise RuntimeError(f"Required local program is missing: {name}")
    target = root / destination.lstrip("/")
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(binary, target, follow_symlinks=True)
    result = subprocess.run(["ldd", binary], capture_output=True, text=True)
    if "not found" in result.stdout:
        raise RuntimeError(f"Missing shared libraries for {binary}: {result.stdout}")
    if result.returncode and "not a dynamic executable" not in result.stderr + result.stdout:
        raise RuntimeError(f"Cannot inspect {binary}: {result.stderr or result.stdout}")
    for library in re.findall(r"(?:=>\s+|^\s*)(/[^\s]+)", result.stdout, re.MULTILINE):
        source = Path(library)
        target = root / str(source).lstrip("/")
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target, follow_symlinks=True)


def add_attach_tools(root):
    # Dev Containers bootstraps through /bin/sh and then installs VS Code Server.
    # Keep a real Bash login shell and the utilities used by setup and terminals.
    for name in (
        "bash", "tar", "gzip", "curl", "getent", "getconf", "ldd", "ps",
        "uname", "cat", "mkdir", "touch", "ln", "rm", "mv", "cp", "dd",
        "date", "sleep", "head", "tail", "cut", "tr", "wc", "sort", "xargs",
        "id", "env", "chmod", "readlink", "dirname", "basename", "tee",
        "stat", "ls", "grep", "sed", "awk", "find", "expr", "timeout",
    ):
        add_binary(root, name, f"/usr/bin/{name}")
    # Remote editing and browser tunnels use SSH directly into this container.
    add_binary(root, "sshd", "/usr/sbin/sshd")
    add_binary(root, "ssh-keygen", "/usr/bin/ssh-keygen")
    add_binary(root, "ssh", "/usr/bin/ssh")
    (root / "bin").mkdir(exist_ok=True)
    (root / "bin/bash").symlink_to("/usr/bin/bash")
    (root / "bin/sh").symlink_to("/usr/bin/bash")

    # VS Code's own prerequisite script checks these conventional library paths
    # when an ldconfig cache is not present in a minimal image.
    libraries = subprocess.check_output(["ldd", shutil.which("node")], text=True)
    for name in ("libc.so.6", "libstdc++.so.6"):
        match = re.search(rf"{re.escape(name)}\s+=>\s+(/[^\s]+)", libraries)
        if not match:
            raise RuntimeError(f"Cannot locate VS Code prerequisite: {name}")
        (root / "usr/lib").mkdir(parents=True, exist_ok=True)
        (root / "usr/lib" / name).symlink_to(match[1])

    # VS Code's prebuilt native modules still link these glibc compatibility
    # libraries even when current Node.js and host utilities no longer do.
    libc_dir = Path(re.search(r"libc\.so\.6\s+=>\s+(/[^\s]+)", libraries)[1]).parent
    for name in ("libutil.so.1", "libpthread.so.0", "libdl.so.2", "librt.so.1", "libnss_files.so.2", "libnss_dns.so.2"):
        source = libc_dir / name
        if source.is_file():
            target = root / str(source).lstrip("/")
            shutil.copy2(source, target, follow_symlinks=True)

    certificates = Path("/etc/ssl/certs/ca-certificates.crt")
    if not certificates.is_file():
        raise RuntimeError("Local system CA certificates are required for VS Code downloads")
    (root / "etc/ssl/certs").mkdir(parents=True, exist_ok=True)
    shutil.copy2(certificates, root / "etc/ssl/certs/ca-certificates.crt")
    shutil.copy2("/etc/os-release", root / "etc/os-release", follow_symlinks=True)
    (root / "etc/nsswitch.conf").write_text("passwd: files\ngroup: files\nhosts: files dns\n")
    (root / "etc/profile").write_text('# Minimal login environment for the local container.\nexport LANG="${LANG:-C.UTF-8}"\n')
    (root / "etc/shells").write_text("/bin/sh\n/bin/bash\n")


def main():
    if sys.platform != "linux":
        raise RuntimeError("Build this image from Linux/WSL, not Windows Python")
    with tempfile.TemporaryDirectory(prefix="blog-local-rootfs-") as directory:
        root = Path(directory)
        add_binary(root, "node", "/usr/local/bin/node")
        add_binary(root, "git", "/usr/bin/git")
        add_attach_tools(root)
        if shutil.which("clang-format"):
            add_binary(root, "clang-format", "/usr/bin/clang-format")
        else:
            print("clang-format is not installed; code formatting will keep code unchanged and report a warning.", file=sys.stderr)
        for name in ("app", "tmp", "etc", "root", "home/blog", "run/sshd"):
            (root / name).mkdir(parents=True, exist_ok=True)
        os.chmod(root / "tmp", 0o1777)
        (root / "etc/passwd").write_text(
            "root:x:0:0:root:/root:/bin/bash\n"
            f"blog:x:{os.getuid()}:{os.getgid()}:Blog:/home/blog:/bin/bash\n"
            "sshd:x:65534:65534:SSH privilege separation:/run/sshd:/bin/sh\n"
        )
        (root / "etc/group").write_text(f"root:x:0:\nblog:x:{os.getgid()}:\nnogroup:x:65534:\n")
        with tarfile.open(fileobj=sys.stdout.buffer, mode="w|") as archive:
            for entry in sorted(root.iterdir()):
                archive.add(entry, arcname=entry.name)


if __name__ == "__main__":
    main()
