import importlib.util
from zipfile import ZipFile
from pathlib import Path


def test_source_package_excludes_runtime_secrets(tmp_path, monkeypatch):
    root = Path(__file__).resolve().parents[3]
    spec = importlib.util.spec_from_file_location(
        "packager", root / "scripts/build_source_package.py"
    )
    packager = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(packager)
    monkeypatch.setattr(packager, "ROOT", tmp_path)
    files = {
        "apps/api/main.py": "print('source')",
        "apps/web/.env.local": "PRIVATE_VALUE",
        "apps/api/node_modules/package/index.js": "SECRET_RUNTIME",
        "apps/api/cache.db": "PRIVATE_DATABASE",
        ".env": "PRIVATE_KEY",
        ".env.example": "GROQ_API_KEY=",
        "data/state.db": "PRIVATE_DATA",
        "vendor/TradingAgents/LICENSE": "retained license",
        "apps/web/reference.mp4": "private video",
    }
    for name, content in files.items():
        p = tmp_path / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content)
    package = packager.build()
    with ZipFile(package) as archive:
        names = archive.namelist()
        assert "apps/api/main.py" in names
        assert "vendor/TradingAgents/LICENSE" in names
        assert ".env.example" in names
        assert ".env" not in names
        assert not any(
            n.endswith((".db", ".mp4", ".env.local")) or "node_modules" in n
            for n in names
        )
        assert b"PRIVATE_KEY" not in b"".join(archive.read(n) for n in names)
