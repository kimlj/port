"""Pack the numbered Avatar-pipeline images into one sprite for the hero film.

    python scripts/build-avatar-sprite.py

The film's avatar chapter shows every image at once for about seven seconds.
The originals are 1024px and 13 MB with the rest of the folder, so it reads this one sheet
instead: 11 columns, tiles in filename order, lossy WebP with alpha.

The output name carries the count because `assets/*.webp` is served immutable
for a year: a sheet with a different set of faces must arrive under a new
name, and hero-film.js must be pointed at it (AVATAR_SPRITE, AV_COLS, AV_COUNT).
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "ai-showcase"
TILE, COLS = 112, 11

# numbered files only: the folder also holds comfyui-workflow.webp, a screenshot
files = sorted(SRC.glob("[0-9]*.webp"))
rows = -(-len(files) // COLS)
sheet = Image.new("RGBA", (COLS * TILE, rows * TILE), (0, 0, 0, 0))
for i, f in enumerate(files):
    im = Image.open(f).convert("RGBA")
    s = min(im.size)
    im = im.crop(((im.width - s) // 2, 0, (im.width - s) // 2 + s, s)).resize((TILE, TILE), Image.LANCZOS)
    sheet.paste(im, ((i % COLS) * TILE, (i // COLS) * TILE))

out = ROOT / "assets" / f"avatar-sprite-{len(files)}.webp"
sheet.save(out, "WEBP", quality=80, method=6)
print(f"{out.name}: {len(files)} tiles, {COLS}x{rows}, {out.stat().st_size // 1024} KB")
