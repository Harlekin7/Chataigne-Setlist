#!/usr/bin/env python3
"""
Build the downloadable release archives for the Setlist Dashboard.

Two archives, one per platform, differing only in which launcher scripts
they carry:

    dist/Setlist-Dashboard-<version>-windows.zip   INSTALL.bat / START-DASHBOARD.bat
    dist/Setlist-Dashboard-<version>-macos.zip     INSTALL.command / START-DASHBOARD.command

Why a script instead of `Compress-Archive` or `zip -r`:

  * The macOS launchers have to arrive executable. A zip records the unix
    mode in the entry's external attributes, and Windows zip tools simply do
    not write one - the .command files would land at mode 000/644 and refuse
    to run on a double-click. Here the mode is set explicitly.
  * Line endings are normalised into the archive (LF for the shell scripts,
    CRLF for the batch files) so a checkout on the wrong side of
    core.autocrlf cannot poison a release.

Usage:  python tools/build-release.py [version]      (default: 1.0.0)
"""

import os
import stat
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist")

# Everything both platforms get. Directories are walked recursively.
COMMON = [
    "README.md",
    "LICENSE",
    "lib",
    "test",
    "chataigne-module",
    "companion",
    "docs",
]

PLATFORM_FILES = {
    "windows": ["INSTALL.bat", "START-DASHBOARD.bat"],
    "macos": ["INSTALL.command", "START-DASHBOARD.command"],
}

# Show data and build noise never belong in a release.
EXCLUDED_NAMES = {
    "node_modules",
    "setlist.json",
    ".DS_Store",
    "Thumbs.db",
    "Desktop.ini",
    "npm-debug.log",
}

EXECUTABLE_SUFFIXES = (".command", ".sh")
LF_SUFFIXES = (".command", ".sh", ".js", ".json", ".md", ".html", ".css")
CRLF_SUFFIXES = (".bat",)
BINARY_SUFFIXES = (".png", ".jpg", ".jpeg", ".gif", ".ico", ".zip", ".pdf")


def collect(entry):
    """Yield (absolute path, path relative to the repo root) for one entry."""
    absolute = os.path.join(ROOT, entry)
    if os.path.isfile(absolute):
        yield absolute, entry.replace(os.sep, "/")
        return
    for dirpath, dirnames, filenames in os.walk(absolute):
        dirnames[:] = sorted(d for d in dirnames if d not in EXCLUDED_NAMES)
        for filename in sorted(filenames):
            if filename in EXCLUDED_NAMES:
                continue
            full = os.path.join(dirpath, filename)
            rel = os.path.relpath(full, ROOT).replace(os.sep, "/")
            yield full, rel


def read_normalised(path):
    """Read a file, forcing the line endings the target platform expects."""
    suffix = os.path.splitext(path)[1].lower()
    data = open(path, "rb").read()
    if suffix in BINARY_SUFFIXES:
        return data
    if suffix in LF_SUFFIXES:
        return data.replace(b"\r\n", b"\n")
    if suffix in CRLF_SUFFIXES:
        return data.replace(b"\r\n", b"\n").replace(b"\n", b"\r\n")
    # Extensionless files such as LICENSE. A NUL byte means it is not text.
    if b"\x00" not in data:
        return data.replace(b"\r\n", b"\n")
    return data


def build(platform, version):
    top = "Setlist-Dashboard-%s" % version
    out = os.path.join(DIST, "Setlist-Dashboard-%s-%s.zip" % (version, platform))

    entries = []
    for entry in PLATFORM_FILES[platform] + COMMON:
        entries.extend(collect(entry))

    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
        for absolute, rel in entries:
            info = zipfile.ZipInfo(
                "%s/%s" % (top, rel),
                date_time=(2026, 1, 1, 0, 0, 0),  # fixed, so builds are reproducible
            )
            executable = rel.endswith(EXECUTABLE_SUFFIXES)
            mode = 0o755 if executable else 0o644
            # High 16 bits of external_attr carry the unix mode; without this a
            # macOS user cannot run the launcher without a manual chmod.
            info.external_attr = (stat.S_IFREG | mode) << 16
            info.create_system = 3  # 3 = unix, so the mode above is honoured
            info.compress_type = zipfile.ZIP_DEFLATED
            zf.writestr(info, read_normalised(absolute))

    size = os.path.getsize(out)
    print("  %-46s %7.1f KB  (%d files)" % (os.path.basename(out), size / 1024.0, len(entries)))
    return out


def main():
    version = sys.argv[1] if len(sys.argv) > 1 else "1.0.0"
    version = version.lstrip("v")

    if not os.path.isdir(DIST):
        os.makedirs(DIST)

    print("Building release %s" % version)
    for platform in ("windows", "macos"):
        build(platform, version)
    print("Done -> %s" % DIST)


if __name__ == "__main__":
    main()
