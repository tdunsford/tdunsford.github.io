#!/usr/bin/env python3
"""Generate printable choir book QR labels."""

from __future__ import annotations

import argparse
import io
import sys
from pathlib import Path

try:
    import qrcode
    from qrcode.constants import ERROR_CORRECT_M
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.units import inch
    from reportlab.lib.utils import ImageReader
    from reportlab.pdfgen import canvas
except ImportError as exc:  # pragma: no cover - depends on local environment
    missing = exc.name or "required package"
    print(
        f"Missing dependency: {missing}\n"
        "Install dependencies with: python -m pip install -r requirements.txt",
        file=sys.stderr,
    )
    raise SystemExit(1) from exc


BASE_URL = "https://www.rainbowharmonyproject.ca/"
COLS = 5
ROWS = 7
LABELS_PER_PAGE = COLS * ROWS
PAGE_SIZE = letter
PAGE_MARGIN = 0.25 * inch
TEXT_BASELINE_GAP = 0.02 * inch
QR_TEXT_GAP = 0.005 * inch
TEXT_SIZE = 8


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate a US Letter PDF of 5x7 QR labels for choir books."
    )
    parser.add_argument(
        "--year", required=True, help="Four-digit book year, e.g. 2026."
    )
    parser.add_argument(
        "--start",
        type=int,
        default=1,
        help="Starting four-digit book number. Default: 1.",
    )
    parser.add_argument(
        "--count",
        type=int,
        default=LABELS_PER_PAGE,
        help="Number of labels to generate. Default: 40.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Output PDF path. Default: book-labels-YYYY-start-NNNN.pdf.",
    )
    return parser.parse_args()


def validate_args(args: argparse.Namespace) -> None:
    if not (args.year.isdigit() and len(args.year) == 4):
        raise ValueError("--year must be exactly four digits, e.g. 2026.")
    if args.start < 0 or args.start > 9999:
        raise ValueError("--start must be between 0 and 9999.")
    if args.count < 1:
        raise ValueError("--count must be at least 1.")
    if args.start + args.count - 1 > 9999:
        raise ValueError("--start plus --count must not exceed book number 9999.")


def make_code(year: str, number: int) -> str:
    return f"book{year}{number:04d}"


def make_label_text(year: str, number: int) -> str:
    return f"{year}/{number:04d}"


def make_qr_image(value: str):
    qr = qrcode.QRCode(
        version=None,
        error_correction=ERROR_CORRECT_M,
        box_size=10,
        border=2,
    )
    qr.add_data(value)
    qr.make(fit=True)
    return qr.make_image(fill_color="black", back_color="white").convert("RGB")


def draw_label(
    pdf: canvas.Canvas,
    *,
    code: str,
    label_text: str,
    url: str,
    col: int,
    row: int,
    cell_width: float,
    cell_height: float,
    page_height: float,
) -> None:
    x = PAGE_MARGIN + col * cell_width
    y = page_height - PAGE_MARGIN - (row + 1) * cell_height
    text_y = y + TEXT_BASELINE_GAP
    text_top = text_y + TEXT_SIZE
    qr_size = min(
        cell_width * 0.78,
        cell_height - (text_top - y) - QR_TEXT_GAP - (0.12 * inch),
    )
    qr_x = x + (cell_width - qr_size) / 2
    qr_y = text_top + QR_TEXT_GAP

    image = make_qr_image(url)
    image_buffer = io.BytesIO()
    image.save(image_buffer, format="PNG")
    image_buffer.seek(0)

    pdf.drawImage(ImageReader(image_buffer), qr_x, qr_y, width=qr_size, height=qr_size)
    pdf.setFont("Helvetica", TEXT_SIZE)
    pdf.drawCentredString(x + cell_width / 2, text_y, label_text)


def generate_pdf(year: str, start: int, count: int, output: Path) -> None:
    page_width, page_height = PAGE_SIZE
    cell_width = (page_width - (2 * PAGE_MARGIN)) / COLS
    cell_height = (page_height - (2 * PAGE_MARGIN)) / ROWS

    output.parent.mkdir(parents=True, exist_ok=True)
    pdf = canvas.Canvas(str(output), pagesize=PAGE_SIZE)

    for index in range(count):
        if index and index % LABELS_PER_PAGE == 0:
            pdf.showPage()

        number = start + index
        code = make_code(year, number)
        label_text = make_label_text(year, number)
        url = f"{BASE_URL}?{code}"
        position = index % LABELS_PER_PAGE
        row = position // COLS
        col = position % COLS
        draw_label(
            pdf,
            code=code,
            label_text=label_text,
            url=url,
            col=col,
            row=row,
            cell_width=cell_width,
            cell_height=cell_height,
            page_height=page_height,
        )

    pdf.save()


def main() -> int:
    args = parse_args()
    try:
        validate_args(args)
    except ValueError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 2

    output = args.output or Path(f"book-labels-{args.year}-start-{args.start:04d}.pdf")
    generate_pdf(args.year, args.start, args.count, output)
    print(f"Wrote {output} with {args.count} labels.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
