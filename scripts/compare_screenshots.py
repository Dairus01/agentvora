"""Compare source content crops with the corresponding implementation checkpoints."""

from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "artifacts/comparisons"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    refs = ROOT / "artifacts/reconstruction/reference"
    impl = ROOT / "artifacts/reconstruction/implemented"
    for stamp in (0, 5, 10, 15, 20, 25, 36, 60, 75, 100, 130, 140):
        src = Image.open(refs / f"{stamp:03d}s.jpg").convert("RGB")
        # Reference samples are 1280×720, including browser and OS chrome.
        src = src.crop((0, 82, 1280, 674))
        candidate = impl / f"checkpoint-{stamp:03d}.png"
        if not candidate.exists():
            continue
        dest = Image.open(candidate).convert("RGB")
        sheet = Image.new("RGB", (1600, 520), "#111820")
        draw = ImageDraw.Draw(sheet)
        draw.text((15, 12), f"REFERENCE {stamp}s - app content crop", fill="white")
        draw.text((815, 12), "AGENTVORA - corresponding state", fill="white")
        for i, image in enumerate((src, dest)):
            image.thumbnail((800, 470))
            sheet.paste(image, (i * 800, 40))
        sheet.save(OUT / f"comparison-{stamp:03d}.jpg", quality=90)
    print(f"Comparison sheets: {OUT}")


if __name__ == "__main__":
    main()
