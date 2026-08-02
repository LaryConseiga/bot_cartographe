import os
import shutil
import subprocess
import tempfile
from pathlib import Path

from jinja2 import Environment, FileSystemLoader

import datetime

from .labels import LABELS, LETTER_LABELS

TEMPLATES_DIR = Path(__file__).parent / "templates"
VENDOR_DIR = Path(__file__).parent / "vendor"

_LATEX_ESCAPE_MAP = {
    "\\": r"\textbackslash{}",
    "&": r"\&",
    "%": r"\%",
    "$": r"\$",
    "#": r"\#",
    "_": r"\_",
    "{": r"\{",
    "}": r"\}",
    "~": r"\textasciitilde{}",
    "^": r"\textasciicircum{}",
}


def latex_escape(value) -> str:
    if value is None:
        return ""
    if not isinstance(value, str):
        value = str(value)
    return "".join(_LATEX_ESCAPE_MAP.get(ch, ch) for ch in value)


class CvPdfCompileError(Exception):
    def __init__(self, message: str, stderr_tail: str = ""):
        super().__init__(message)
        self.stderr_tail = stderr_tail


_LATEX_JINJA_ENV = Environment(
    block_start_string=r"\BLOCK{",
    block_end_string="}",
    variable_start_string=r"\VAR{",
    variable_end_string="}",
    comment_start_string=r"\#{",
    comment_end_string="}",
    line_statement_prefix="%%",
    trim_blocks=True,
    lstrip_blocks=True,
    autoescape=False,
    finalize=latex_escape,
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
)


def _split_full_name(full_name: str) -> tuple[str, str]:
    parts = (full_name or "").strip().split(" ")
    parts = [p for p in parts if p]
    if len(parts) <= 1:
        return "", full_name or ""
    return " ".join(parts[:-1]), parts[-1]


def render_tex(cv: dict, lang: str) -> str:
    if lang not in LABELS:
        raise ValueError(f"Langue non supportée: {lang}")
    personal_info = dict(cv.get("personal_info") or {})
    first_name, last_name = _split_full_name(personal_info.get("full_name", ""))
    personal_info["first_name"] = first_name
    personal_info["last_name"] = last_name
    cv_for_template = dict(cv)
    cv_for_template["personal_info"] = personal_info
    template = _LATEX_JINJA_ENV.get_template("altacv.tex.jinja")
    return template.render(cv=cv_for_template, labels=LABELS[lang])


def render_letter_tex(
    personal_info: dict, company: str, location: str, paragraphs: list, lang: str
) -> str:
    if lang not in LETTER_LABELS:
        raise ValueError(f"Langue non supportée: {lang}")
    info = dict(personal_info or {})
    first_name, last_name = _split_full_name(info.get("full_name", ""))
    info["first_name"] = first_name
    info["last_name"] = last_name

    now = datetime.date.today()
    months = LETTER_LABELS[lang]["months"]
    date_label = f"{now.day} {months[now.month - 1]} {now.year}" if lang == "fr" else f"{months[now.month - 1]} {now.day}, {now.year}"

    template = _LATEX_JINJA_ENV.get_template("letter.tex.jinja")
    return template.render(
        personal_info=info,
        company=company or "",
        location=location or "",
        date_label=date_label,
        paragraphs=paragraphs or [],
        labels=LETTER_LABELS[lang],
    )


def _resolve_tectonic_bin() -> str:
    env_bin = os.environ.get("TECTONIC_BIN")
    if env_bin and Path(env_bin).exists():
        return env_bin
    found = shutil.which("tectonic")
    if found:
        return found
    fallback = Path.home() / ".local" / "bin" / "tectonic"
    if fallback.exists():
        return str(fallback)
    # Répertoire du projet llm/ (là où la commande de build de Render dépose le binaire)
    project_fallback = Path(__file__).resolve().parent.parent / "tectonic"
    if project_fallback.exists():
        return str(project_fallback)
    raise CvPdfCompileError(
        "Moteur LaTeX 'tectonic' introuvable. Installe-le et ajoute-le au PATH "
        "(ou définis TECTONIC_BIN)."
    )


def compile_pdf(tex_source: str, timeout_s: int = 120) -> bytes:
    tectonic_bin = _resolve_tectonic_bin()
    with tempfile.TemporaryDirectory(prefix="apex_cv_pdf_") as tmpdir:
        tex_path = Path(tmpdir) / "main.tex"
        tex_path.write_text(tex_source, encoding="utf-8")

        if VENDOR_DIR.is_dir():
            for vendor_file in VENDOR_DIR.iterdir():
                if vendor_file.is_file():
                    shutil.copy(vendor_file, Path(tmpdir) / vendor_file.name)

        try:
            result = subprocess.run(
                [tectonic_bin, "main.tex", "--outdir", tmpdir],
                cwd=tmpdir,
                capture_output=True,
                timeout=timeout_s,
                text=True,
            )
        except subprocess.TimeoutExpired as e:
            raise CvPdfCompileError(
                "La compilation du CV a dépassé le délai autorisé.",
                stderr_tail=(e.stderr or "")[-2000:],
            )

        if result.returncode != 0:
            raise CvPdfCompileError(
                "Échec de la compilation LaTeX du CV.",
                stderr_tail=(result.stderr or "")[-2000:],
            )

        pdf_path = Path(tmpdir) / "main.pdf"
        if not pdf_path.exists():
            raise CvPdfCompileError(
                "La compilation n'a produit aucun PDF.",
                stderr_tail=(result.stderr or "")[-2000:],
            )
        return pdf_path.read_bytes()
