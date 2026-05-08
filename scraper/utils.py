"""
Utilitaires partagés pour les scrapers : requêtes HTTP, nettoyage de texte,
résolution d’URL et détection pays/région à partir de mots-clés géographiques.
"""

from __future__ import annotations

import re
import time
from typing import Optional
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
}


def get_page(
    url: str,
    retries: int = 3,
    delay: float = 2.0,
    session: Optional[requests.Session] = None,
) -> Optional[BeautifulSoup]:
    """
    Télécharge une page HTML et retourne un BeautifulSoup, ou None en cas d’échec.
    Gère 429 (pause 30s), 403/404 (abandon), encodage apparent et backoff exponentiel.
    """
    sess = session or requests.Session()
    sess.headers.update(DEFAULT_HEADERS)
    last_error: Optional[Exception] = None

    for attempt in range(retries):
        try:
            resp = sess.get(url, timeout=45)
            if resp.status_code == 429:
                time.sleep(30.0)
                continue
            if resp.status_code in (403, 404):
                return None
            resp.raise_for_status()
            enc = resp.apparent_encoding or resp.encoding or "utf-8"
            resp.encoding = enc
            return BeautifulSoup(resp.text, "lxml")
        except requests.HTTPError as e:
            code = e.response.status_code if e.response is not None else None
            if code == 429:
                time.sleep(30.0)
                continue
            if code in (403, 404):
                return None
            last_error = e
        except requests.RequestException as e:
            last_error = e

        sleep_for = delay * (2**attempt)
        time.sleep(sleep_for)

    if last_error:
        return None
    return None


def clean_text(text: str | None, max_len: int = 3000) -> str:
    """Normalise les espaces, retire les caractères non imprimables, tronque."""
    if not text:
        return ""
    # Retirer caractères de contrôle sauf \n \t qu’on va ensuite normaliser en espace
    text = "".join(ch for ch in text if ch.isprintable() or ch in "\n\t\r")
    text = re.sub(r"[\r\n\t]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) > max_len:
        text = text[:max_len]
    return text


def make_absolute(url: str, base: str) -> str:
    """Construit une URL absolue (chemins relatifs avec ou sans slash initial)."""
    if not url:
        return ""
    url = url.strip()
    parsed = urlparse(url)
    if parsed.scheme in ("http", "https"):
        return url
    return urljoin(base.rstrip("/") + "/", url.lstrip("/"))


def guess_country(text: str | None) -> tuple[str | None, str | None]:
    """
    Déduit (code_pays, région) à partir de mots-clés (villes, pays, variantes).
    Codes : BF, SN, CI, ML, TG, BJ, MA, NE, GN.
    """
    if not text:
        return None, None
    t = text.lower()
    # Ordre : plus spécifique d’abord
    rules: list[tuple[str, str, frozenset[str]]] = [
        ("BF", "Afrique de l'Ouest", frozenset({"burkina", "ouagadougou", "bobo-dioulasso", "bf "})),
        ("SN", "Afrique de l'Ouest", frozenset({"sénégal", "senegal", "dakar", "thiès", "thies", " saint-louis"})),
        (
            "CI",
            "Afrique de l'Ouest",
            frozenset({"côte d'ivoire", "cote d'ivoire", "ivoire", "abidjan", "yamoussoukro", "bouaké", "bouake"}),
        ),
        ("ML", "Afrique de l'Ouest", frozenset({"mali", "bamako", "sikasso", "kayes"})),
        ("TG", "Afrique de l'Ouest", frozenset({"togo", "lomé", "lome", "kara"})),
        ("BJ", "Afrique de l'Ouest", frozenset({"bénin", "benin", "cotonou", "porto-novo", "porto novo", "parakou"})),
        ("NE", "Afrique de l'Ouest", frozenset({"niger", "niamey", "zinder"})),
        ("GN", "Afrique de l'Ouest", frozenset({"guinée", "guinee", "conakry", "kindia"})),
        ("MA", "Afrique du Nord", frozenset({"maroc", "morocco", "rabat", "casablanca", "marrakech", "fès", "fes"})),
    ]
    for code, region, kws in rules:
        for kw in kws:
            if kw in t:
                return code, region
    return None, None
