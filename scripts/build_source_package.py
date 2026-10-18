"""Build a source-only allowlisted ZIP; exclude runtime data and symlinks."""

from pathlib import Path
import os
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
DIRECTORIES = ("apps", "vendor", "scripts", "docs", ".github")
ROOT_FILES = (
    "README.md",
    "LICENSE",
    "THIRD_PARTY_NOTICES.md",
    "CODEX_HANDOFF.md",
    ".env.example",
    ".gitignore",
    ".gitattributes",
    ".dockerignore",
    "docker-compose.yml",
    "requirements.lock",
)
SKIP = {
    "build",
    "node_modules",
    ".venv",
    "venv",
    "__pycache__",
    ".git",
    ".pytest_cache",
    "dist",
    "test-results",
    "playwright-report",
    ".cache",
    ".ruff_cache",
}
SUFFIXES = {".pyc", ".db", ".sqlite", ".mp4", ".jpg", ".png", ".log", ".tsbuildinfo"}


def allowed(p):
    rel = p.relative_to(ROOT)
    return (
        not p.is_symlink()
        and not any(x in SKIP or x.endswith(".egg-info") for x in rel.parts)
        and p.suffix not in SUFFIXES
        and (not p.name.startswith(".env") or p.name == ".env.example")
        and not any(x in p.name.lower() for x in ("credentials", "secret.key", ".pem"))
    )


def build():
    out = ROOT / "dist/agentvora-source.zip"
    out.parent.mkdir(exist_ok=True)
    with ZipFile(out, "w", ZIP_DEFLATED) as archive:
        for folder in DIRECTORIES:
            for current, dirs, names in os.walk(ROOT / folder, followlinks=False):
                dirs[:] = sorted(
                    d
                    for d in dirs
                    if d not in SKIP
                    and not d.endswith(".egg-info")
                    and not (Path(current) / d).is_symlink()
                )
                for name in sorted(names):
                    p = Path(current) / name
                    if allowed(p):
                        archive.write(p, p.relative_to(ROOT).as_posix())
        for name in ROOT_FILES:
            p = ROOT / name
            if p.is_file():
                archive.write(p, name)
        archive.writestr("data/.gitkeep", "")
    with ZipFile(out) as archive:
        for name in archive.namelist():
            assert not any(x in SKIP for x in Path(name).parts)
            assert Path(name).name == ".env.example" or not Path(name).name.startswith(
                ".env"
            )
    print(f"Built {out.name}: {out.stat().st_size:,} bytes")
    return out


if __name__ == "__main__":
    build()
