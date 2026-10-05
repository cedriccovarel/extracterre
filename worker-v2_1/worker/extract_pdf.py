#!/usr/bin/env python3
import argparse
import json
import os
import re
import subprocess
import tempfile
import csv
import io
import xml.etree.ElementTree as ET
from pathlib import Path


def run(cmd, *, text=True, check=True):
    return subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=text, check=check).stdout


def page_count(pdf: Path) -> int:
    info = run(["pdfinfo", str(pdf)])
    m = re.search(r"^Pages:\s*(\d+)\s*$", info, re.M)
    if not m:
        raise RuntimeError("Nombre de pages introuvable via pdfinfo")
    return int(m.group(1))


def native_page_struct(pdf: Path, page: int):
    """Return (text, lines) with word x positions from Poppler bbox output."""
    xml = run(["pdftotext", "-bbox-layout", "-f", str(page), "-l", str(page), str(pdf), "-"])
    lines = []
    try:
        root = ET.fromstring(xml)
        for line_el in root.findall('.//{*}line'):
            items = []
            words = []
            for word in line_el.findall('.//{*}word'):
                text = ''.join(word.itertext()).strip()
                if not text:
                    continue
                try:
                    x = float(word.attrib.get('xMin', '0') or 0)
                except Exception:
                    x = 0.0
                items.append({"text": text, "x": x})
                words.append(text)
            if words:
                lines.append({"index": len(lines), "text": " ".join(words), "items": items})
    except Exception:
        lines = []
    if not lines:
        fallback = run(["pdftotext", "-layout", "-f", str(page), "-l", str(page), str(pdf), "-"])
        lines = make_lines(fallback)
    text = "\n".join(x["text"] for x in lines)
    return text, lines


def text_quality(text: str) -> float:
    clean = re.sub(r"\s+", " ", text or "").strip()
    if not clean:
        return 0.0
    alnum = sum(ch.isalnum() for ch in clean)
    weird = sum((not ch.isalnum()) and (not ch.isspace()) and ch not in ".,;:()[]{}%/+°'’\"-_" for ch in clean)
    ratio = alnum / max(1, len(clean))
    penalty = weird / max(1, len(clean))
    length_score = min(1.0, len(clean) / 450.0)
    return max(0.0, min(1.0, 0.55 * ratio + 0.55 * length_score - 1.4 * penalty))


def should_ocr(text: str, mode: str) -> bool:
    if mode == "off":
        return False
    if mode in {"always", "max"}:
        return True
    clean = re.sub(r"\s+", " ", text or "").strip()
    if len(clean) < 55:
        return True
    q = text_quality(clean)
    if len(clean) < 150 and q >= 0.55:
        return False
    return q < 0.42


def ocr_page_struct(pdf: Path, page: int, dpi: int = 220):
    with tempfile.TemporaryDirectory(prefix="extracterre-ocr-") as td:
        prefix = Path(td) / "page"
        subprocess.run([
            "pdftoppm", "-f", str(page), "-l", str(page), "-singlefile",
            "-r", str(dpi), "-png", str(pdf), str(prefix)
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        png = prefix.with_suffix(".png")
        if not png.exists():
            raise RuntimeError(f"Rendu OCR impossible page {page}")
        tsv = run([
            "tesseract", str(png), "stdout", "-l", "fra+eng", "--psm", "6",
            "-c", "preserve_interword_spaces=1", "tsv"
        ])
        reader = csv.DictReader(io.StringIO(tsv), delimiter='\t')
        grouped = {}
        order = []
        for row in reader:
            if str(row.get('level', '')) != '5':
                continue
            text = str(row.get('text') or '').strip()
            if not text:
                continue
            key = (row.get('block_num'), row.get('par_num'), row.get('line_num'))
            if key not in grouped:
                grouped[key] = []
                order.append(key)
            try:
                x = float(row.get('left') or 0)
            except Exception:
                x = 0.0
            grouped[key].append({"text": text, "x": x})
        lines = []
        for key in order:
            items = sorted(grouped[key], key=lambda it: it['x'])
            if items:
                lines.append({"index": len(lines), "text": " ".join(i['text'] for i in items), "items": items, "ocr": True})
        text = "\n".join(x["text"] for x in lines)
        return text, lines


def make_lines(text: str):
    out = []
    for raw in (text or "").replace("\r", "").split("\n"):
        line = raw.rstrip()
        if not line.strip():
            continue
        out.append({"index": len(out), "text": line, "items": []})
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("read_json")
    ap.add_argument("result_json")
    ap.add_argument("--options", default="{}")
    args = ap.parse_args()

    pdf = Path(args.pdf)
    options = json.loads(args.options or "{}")
    ocr_mode = str(options.get("ocrMode") or "auto").lower()
    pages_n = page_count(pdf)
    pages = []
    ocr_pages = []
    warnings = []

    for page in range(1, pages_n + 1):
        native, native_lines = native_page_struct(pdf, page)
        chosen = native
        chosen_lines = native_lines
        source = "pdf"
        native_quality = text_quality(native)
        if should_ocr(native, ocr_mode):
            try:
                ocr, ocr_lines = ocr_page_struct(pdf, page, 260 if ocr_mode == "max" else 220)
                # L'OCR remplace la couche native seulement si celle-ci est faible ou si le mode le force.
                if ocr_mode in {"always", "max"} or text_quality(ocr) >= native_quality:
                    chosen = ocr
                    chosen_lines = ocr_lines
                    source = "ocr"
                else:
                    source = "pdf"
                ocr_pages.append(page)
            except Exception as exc:
                warnings.append(f"Page {page} : OCR impossible ({exc})")

        lines = chosen_lines if chosen_lines else make_lines(chosen)
        pages.append({
            "page": page,
            "text": "\n".join(x["text"] for x in lines),
            "lines": lines,
            "textSource": source,
            "pdfTextQuality": round(native_quality, 4),
        })

    text = "\n\f\n".join(p["text"] for p in pages)
    read = {
        "kind": "pdf",
        "pages": pages,
        "text": text,
        "pageCount": pages_n,
        "ocr": {
            "mode": ocr_mode,
            "used": bool(ocr_pages),
            "pages": ocr_pages,
            "warnings": warnings,
            "engine": "Tesseract CLI / GitHub Actions",
            "languages": "fra+eng",
            "parallelism": "server-sequential-pages",
            "quality": "maximum" if ocr_mode == "max" else "standard",
        },
        "retainedCompact": True,
        "remoteRead": True,
    }
    Path(args.read_json).write_text(json.dumps(read, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    import hashlib
    sha = hashlib.sha256(pdf.read_bytes()).hexdigest()
    result = {
        "status": "success",
        "worker": "github-actions",
        "workerVersion": "2.1.0",
        "pages": pages_n,
        "sizeBytes": pdf.stat().st_size,
        "sha256": sha,
        "charactersExtracted": len(text),
        "textNative": any(p["textSource"] == "pdf" and p["text"].strip() for p in pages),
        "ocrNeeded": bool(ocr_pages),
        "ocrUsed": bool(ocr_pages),
        "ocrPages": ocr_pages,
        "ocrWarnings": warnings[:20],
    }
    Path(args.result_json).write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
