#!/usr/bin/env python3
"""Generates every app icon (web/PWA, iOS, Android) from one square source image.

    python3 scripts/generate-icons.py [resources/icon.png]

The source should be at least 1024x1024, square, with its background painted in (no
transparency) — iOS rejects icons with an alpha channel. Needs Pillow (`pip install pillow`).
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
source = Image.open(sys.argv[1] if len(sys.argv) > 1 else ROOT / 'resources' / 'icon.png').convert('RGBA')
if source.width != source.height or source.width < 1024:
    sys.exit(f'Source must be square and at least 1024x1024, got {source.width}x{source.height}')

# Background colour, sampled from the corner, for padding and Android's adaptive background.
background = source.getpixel((0, 0))[:3]
background_hex = '#{:02X}{:02X}{:02X}'.format(*background)


def resized(size: int) -> Image.Image:
    return source.resize((size, size), Image.LANCZOS)


def padded(size: int, scale: float, fill=background) -> Image.Image:
    """The artwork shrunk to `scale` of the canvas, centred on `fill`."""
    canvas = Image.new('RGBA', (size, size), (*fill, 255) if fill else (0, 0, 0, 0))
    inner = round(size * scale)
    offset = (size - inner) // 2
    canvas.alpha_composite(resized(inner), (offset, offset))
    return canvas


def circle(size: int) -> Image.Image:
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(resized(size), (0, 0), mask)
    return out


def save(image: Image.Image, path: Path, opaque=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    (image.convert('RGB') if opaque else image).save(path, optimize=True)
    print(path.relative_to(ROOT))


# Web / PWA. Maskable icons keep the art inside the central 80% safe zone Android may crop to.
web = ROOT / 'public' / 'icons'
for size in (72, 96, 128, 144, 152, 192, 384, 512):
    save(resized(size), web / f'icon-{size}.png', opaque=True)
for size in (192, 512):
    save(padded(size, 0.8), web / f'icon-maskable-{size}.png', opaque=True)
save(resized(180), web / 'apple-touch-icon.png', opaque=True)
for size in (16, 32):
    save(resized(size), web / f'favicon-{size}.png', opaque=True)

# iOS: a single 1024 icon, no alpha channel.
save(resized(1024), ROOT / 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', opaque=True)

# Android: legacy square and round icons, plus the adaptive-icon foreground. The adaptive
# canvas is 108dp but launchers may show only a 66dp circle of it, so the art is scaled down.
res = ROOT / 'android/app/src/main/res'
for density, size in {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}.items():
    save(resized(size), res / f'mipmap-{density}' / 'ic_launcher.png')
    save(circle(size), res / f'mipmap-{density}' / 'ic_launcher_round.png')
    foreground = round(size * 108 / 48)
    save(padded(foreground, 0.72), res / f'mipmap-{density}' / 'ic_launcher_foreground.png')

colour_file = res / 'values' / 'ic_launcher_background.xml'
colour_file.write_text(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
    f'    <color name="ic_launcher_background">{background_hex}</color>\n</resources>\n'
)
print(colour_file.relative_to(ROOT), background_hex)
