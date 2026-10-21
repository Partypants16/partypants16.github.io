"""Builds the images and fonts the Wallpaper page uses.

    python tools/build_wallpaper_images.py

Writes, all inside wallpaper-files/:
  - <video>.jpg           a still frame of each video: shown instead of the
                          video on phones, with data saver, or when the page
                          is set to still wallpapers
  - thumbs/<video>.jpg    small versions for the wallpaper picker
  - loveless/<act>.webp   the six act plates from Parth's LOVELESS book, as
                          ink-only images (white lines, transparent paper) so
                          the page can gild them
  - fonts/*.woff          EB Garamond (the book's typeface), cut down to the
                          Latin letters, for the LOVELESS wallpaper

The plates are drawn by the book's own code in
physical_projects/completed-or-paused-indefinitely/loveless_book/build, so
that folder has to sit next to apps/ (it does in parth_project). Needs
opencv-python, pillow, numpy, pymupdf and fonttools.
"""
import pathlib
import sys

sys.dont_write_bytecode = True  # don't leave __pycache__ in the book's build folder

import cv2
import numpy as np
import pymupdf
from fontTools import subset
from PIL import Image

SITE = pathlib.Path(__file__).resolve().parent.parent
FILES = SITE / "wallpaper-files"
BOOK = SITE.parent.parent / "physical_projects" / "completed-or-paused-indefinitely" / "loveless_book" / "build"

VIDEOS = {"winter-forest-snow.mp4": 3.0, "FF7-remake.mp4": 4.0}  # seconds in: a good-looking frame
PLATES = [  # (module, function, file name), in the poem's order
    ("plates2", "plate_prologue", "prologue"),
    ("plates", "plate_act1", "act1"),
    ("plates3", "plate_act2", "act2"),
    ("plates3", "plate_act3", "act3"),
    ("plates2", "plate_act4", "act4"),
    ("plates3", "plate_act5", "act5"),
]
PLATE_HEIGHT = 1300  # px; the plates are 100 x 132 mm


def video_stills():
    (FILES / "thumbs").mkdir(exist_ok=True)
    for name, seconds in VIDEOS.items():
        video = cv2.VideoCapture(str(FILES / name))
        video.set(cv2.CAP_PROP_POS_MSEC, seconds * 1000)
        ok, frame = video.read()
        video.release()
        if not ok:
            raise SystemExit(f"couldn't read a frame from {name}")
        image = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        stem = pathlib.Path(name).stem
        still = image.copy()
        still.thumbnail((1920, 1920))
        still.save(FILES / f"{stem}.jpg", quality=82, optimize=True, progressive=True)
        thumb = image.copy()
        thumb.thumbnail((480, 480))
        thumb.save(FILES / "thumbs" / f"{stem}.jpg", quality=80, optimize=True)
        print(f"{stem}.jpg {still.size[0]}x{still.size[1]}, thumb {thumb.size[0]}x{thumb.size[1]}")


def loveless_plates():
    if not BOOK.is_dir():
        raise SystemExit(f"LOVELESS build folder not found: {BOOK}")
    sys.path.insert(0, str(BOOK))
    import importlib

    out = FILES / "loveless"
    out.mkdir(exist_ok=True)
    for module, function, stem in PLATES:
        svg = getattr(importlib.import_module(module), function)()
        page = pymupdf.open(stream=svg.encode("utf-8"), filetype="svg")[0]
        zoom = PLATE_HEIGHT / page.rect.height
        pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), colorspace=pymupdf.csGRAY, alpha=False)
        gray = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width)
        # Ink becomes opaque white, paper becomes transparent. The page tints it gold.
        rgba = np.zeros((pix.height, pix.width, 4), dtype=np.uint8)
        rgba[..., :3] = 255
        rgba[..., 3] = 255 - gray
        path = out / f"{stem}.webp"
        Image.fromarray(rgba).save(path, quality=88, method=6)
        print(f"loveless/{stem}.webp {pix.width}x{pix.height} {path.stat().st_size // 1024} KB")


def garamond():
    out = FILES / "fonts"
    out.mkdir(exist_ok=True)
    for name in ("EBGaramond-400", "EBGaramond-Italic-400"):
        options = subset.Options()
        options.flavor = "woff"
        options.layout_features = ["kern", "liga", "onum"]
        font = subset.load_font(str(BOOK / "fonts" / f"{name}.ttf"), options)
        subsetter = subset.Subsetter(options)
        # Basic Latin, Latin-1, curly quotes, dashes, ellipsis, middle dot
        subsetter.populate(unicodes=list(range(0x20, 0x7F)) + list(range(0xA0, 0x100)) +
                           [0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2026, 0x00B7])
        subsetter.subset(font)
        path = out / f"{name}.woff"
        subset.save_font(font, str(path), options)
        print(f"fonts/{name}.woff {path.stat().st_size // 1024} KB")
    (out / "OFL.txt").write_bytes((BOOK / "fonts" / "OFL.txt").read_bytes())


if __name__ == "__main__":
    video_stills()
    loveless_plates()
    garamond()
