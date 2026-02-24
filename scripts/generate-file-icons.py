"""
Generate document-style .ico files for Open 2D Studio file types.

Creates multi-resolution ICO files with a page/document shape,
the app logo overlaid, and file extension text at the bottom.

Requirements: pip install Pillow
"""

import os
from PIL import Image, ImageDraw, ImageFont

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
ICONS_DIR = os.path.join(PROJECT_ROOT, "src-tauri", "icons")
APP_ICON_PATH = os.path.join(ICONS_DIR, "icon.png")

ICO_SIZES = [16, 32, 48, 64, 256]

# Color schemes
COLORS = {
    "o2d": {
        "accent": (59, 130, 246),       # Blue-500
        "accent_dark": (37, 99, 235),   # Blue-600
        "label_bg": (59, 130, 246),
        "label_text": (255, 255, 255),
    },
    "dxf": {
        "accent": (34, 197, 94),        # Green-500
        "accent_dark": (22, 163, 74),   # Green-600
        "label_bg": (34, 197, 94),
        "label_text": (255, 255, 255),
    },
}

# App logo colors (from the actual icon)
LOGO_BG = (25, 28, 50)          # Dark navy
LOGO_SQUARE = (230, 57, 80)     # Pink-red
LOGO_CIRCLE = (0, 230, 118)     # Green
LOGO_LINE = (255, 255, 255)     # White
LOGO_DOT = (230, 57, 100)       # Pink


def draw_document_page(draw, size, fold_ratio=0.22):
    """Draw a white document page with a folded corner and shadow."""
    s = size
    margin = max(1, int(s * 0.08))
    fold = max(2, int(s * fold_ratio))

    page_left = margin
    page_top = margin
    page_right = s - margin - 1
    page_bottom = s - margin - 1

    # Shadow (subtle offset)
    if s >= 32:
        shadow_offset = max(1, int(s * 0.02))
        shadow_color = (180, 180, 180)
        shadow_points = [
            (page_left + shadow_offset, page_top + fold + shadow_offset),
            (page_right - fold + shadow_offset, page_top + shadow_offset),
            (page_right + shadow_offset, page_top + fold + shadow_offset),
            (page_right + shadow_offset, page_bottom + shadow_offset),
            (page_left + shadow_offset, page_bottom + shadow_offset),
        ]
        draw.polygon(shadow_points, fill=shadow_color)

    # Main page body (white with slight gray border)
    page_points = [
        (page_left, page_top),
        (page_right - fold, page_top),
        (page_right, page_top + fold),
        (page_right, page_bottom),
        (page_left, page_bottom),
    ]
    draw.polygon(page_points, fill=(255, 255, 255), outline=(200, 200, 200))

    # Folded corner triangle
    fold_points = [
        (page_right - fold, page_top),
        (page_right, page_top + fold),
        (page_right - fold, page_top + fold),
    ]
    draw.polygon(fold_points, fill=(230, 230, 235), outline=(200, 200, 200))

    return page_left, page_top, page_right, page_bottom, fold


def draw_app_logo(draw, cx, cy, logo_size):
    """Draw a simplified version of the app logo (square + circle + line + dots)."""
    r = logo_size / 2

    # Background circle/area for the logo
    bg_margin = r * 0.1
    draw.rounded_rectangle(
        [cx - r - bg_margin, cy - r - bg_margin,
         cx + r + bg_margin, cy + r + bg_margin],
        radius=max(1, int(r * 0.25)),
        fill=LOGO_BG,
    )

    # Square (upper-left area)
    sq_size = r * 0.55
    sq_x = cx - r * 0.45
    sq_y = cy - r * 0.45
    line_w = max(1, int(r * 0.12))
    draw.rectangle(
        [sq_x - sq_size / 2, sq_y - sq_size / 2,
         sq_x + sq_size / 2, sq_y + sq_size / 2],
        outline=LOGO_SQUARE,
        width=line_w,
    )

    # Circle (lower-right area)
    circ_r = r * 0.35
    circ_x = cx + r * 0.35
    circ_y = cy + r * 0.35
    draw.ellipse(
        [circ_x - circ_r, circ_y - circ_r,
         circ_x + circ_r, circ_y + circ_r],
        outline=LOGO_CIRCLE,
        width=line_w,
    )

    # Diagonal line
    line_x1 = cx - r * 0.65
    line_y1 = cy + r * 0.55
    line_x2 = cx + r * 0.6
    line_y2 = cy - r * 0.6
    draw.line(
        [(line_x1, line_y1), (line_x2, line_y2)],
        fill=LOGO_LINE,
        width=max(1, int(r * 0.1)),
    )

    # Dots at line endpoints
    dot_r = max(1, int(r * 0.1))
    draw.ellipse(
        [line_x1 - dot_r, line_y1 - dot_r,
         line_x1 + dot_r, line_y1 + dot_r],
        fill=LOGO_DOT,
    )
    draw.ellipse(
        [line_x2 - dot_r, line_y2 - dot_r,
         line_x2 + dot_r, line_y2 + dot_r],
        fill=LOGO_DOT,
    )


def draw_extension_label(draw, text, page_left, page_right, page_bottom, size, colors):
    """Draw the file extension label at the bottom of the document."""
    label_height = max(4, int(size * 0.18))
    label_top = page_bottom - label_height
    label_margin = max(0, int(size * 0.02))

    # Label background bar
    draw.rectangle(
        [page_left + label_margin, label_top,
         page_right - label_margin, page_bottom - label_margin],
        fill=colors["label_bg"],
    )

    # Extension text
    font_size = max(6, int(label_height * 0.8))
    try:
        font = ImageFont.truetype("arialbd.ttf", font_size)
    except (OSError, IOError):
        try:
            font = ImageFont.truetype("arial.ttf", font_size)
        except (OSError, IOError):
            font = ImageFont.load_default()

    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]

    tx = (page_left + page_right) / 2 - tw / 2
    ty = label_top + (label_height - label_margin - th) / 2 - bbox[1]

    draw.text((tx, ty), text, fill=colors["label_text"], font=font)


def draw_accent_bar(draw, page_left, page_top, fold, size, colors):
    """Draw a thin colored accent bar at the top of the document."""
    bar_height = max(1, int(size * 0.04))
    bar_margin = max(0, int(size * 0.02))
    draw.rectangle(
        [page_left + bar_margin, page_top + bar_margin,
         page_left + (size * 0.55), page_top + bar_margin + bar_height],
        fill=colors["accent"],
    )


def generate_icon(ext, colors):
    """Generate a multi-resolution .ico file for the given extension."""
    images = []

    for size in ICO_SIZES:
        img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)

        # Draw document page
        pl, pt, pr, pb, fold = draw_document_page(draw, size)

        # Draw accent bar at top
        if size >= 32:
            draw_accent_bar(draw, pl, pt, fold, size, colors)

        # Draw app logo in center area
        logo_area_top = pt + fold + max(1, int(size * 0.04))
        logo_area_bottom = pb - max(4, int(size * 0.20))
        logo_center_y = (logo_area_top + logo_area_bottom) / 2
        logo_center_x = (pl + pr) / 2
        logo_size = min(
            (pr - pl) * 0.55,
            (logo_area_bottom - logo_area_top) * 0.85,
        )

        if size >= 32:
            draw_app_logo(draw, logo_center_x, logo_center_y, logo_size)

        # Draw extension label at bottom
        label_text = f".{ext.upper()}"
        if size <= 16:
            label_text = ext.upper()
        draw_extension_label(draw, label_text, pl, pr, pb, size, colors)

        images.append(img)

    # Save as .ico — use the largest image as base and let Pillow
    # resample from our hand-drawn per-size images via append_images.
    # Pillow ICO writer: base image + append_images are all included as frames.
    output_path = os.path.join(ICONS_DIR, f"{ext}-document.ico")
    # Sort largest first — Pillow ICO writer uses all provided images as-is
    images_sorted = sorted(images, key=lambda im: im.size[0], reverse=True)
    images_sorted[0].save(
        output_path,
        format="ICO",
        append_images=images_sorted[1:],
    )
    print(f"Created: {output_path}")
    return output_path


def main():
    os.makedirs(ICONS_DIR, exist_ok=True)

    for ext, colors in COLORS.items():
        generate_icon(ext, colors)

    print("\nDone! Icon files generated in:", ICONS_DIR)


if __name__ == "__main__":
    main()
