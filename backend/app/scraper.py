"""Fetch public recipe pages safely and reduce them to text for the AI import.

Security: the backend fetches user-supplied URLs, so every hop (including redirects)
is checked against SSRF — only http(s) on standard ports, only public IP addresses,
no credentials in URLs, bounded size and time. Proxy environment variables are ignored.
"""

import asyncio
import ipaddress
import json
import re
import socket
from html.parser import HTMLParser
from typing import Any, NamedTuple
from urllib.parse import urljoin, urlsplit

import httpx

MAX_BYTES = 3_000_000
MAX_REDIRECTS = 4
MAX_SOURCE_CHARS = 28_000
MAX_STRUCTURED_CHARS = 14_000
TIMEOUT = httpx.Timeout(12.0, connect=5.0)
HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; CraveRecipeImport/1.0; +https://crave-frontend-production.up.railway.app)",
    "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
    "Accept-Language": "de-DE,de;q=0.9,en;q=0.6",
}


class ScrapeError(Exception):
    """Raised with a German, user-facing message."""


def _is_public_ip(raw: str) -> bool:
    try:
        address = ipaddress.ip_address(raw.split("%", 1)[0])
    except ValueError:
        return False
    if isinstance(address, ipaddress.IPv6Address) and address.ipv4_mapped is not None:
        address = address.ipv4_mapped
    return address.is_global and not address.is_multicast


async def _validate_url(url: str) -> None:
    parts = urlsplit(url)
    if parts.scheme not in {"http", "https"} or not parts.hostname:
        raise ScrapeError("Bitte gib einen vollständigen Link ein, der mit https:// beginnt.")
    if parts.username or parts.password:
        raise ScrapeError("Links mit Zugangsdaten werden nicht unterstützt.")
    try:
        port = parts.port
    except ValueError:
        raise ScrapeError("Der Link ist ungültig.") from None
    if port not in {None, 80, 443}:
        raise ScrapeError("Dieser Link wird aus Sicherheitsgründen nicht abgerufen.")
    try:
        infos = await asyncio.get_running_loop().getaddrinfo(parts.hostname, port or (443 if parts.scheme == "https" else 80), type=socket.SOCK_STREAM)
    except socket.gaierror:
        raise ScrapeError("Die Seite wurde nicht gefunden. Prüfe den Link.") from None
    # Every resolved address must be public, otherwise internal services could be reached.
    if not infos or not all(_is_public_ip(info[4][0]) for info in infos):
        raise ScrapeError("Dieser Link wird aus Sicherheitsgründen nicht abgerufen.")


def _check_peer(response: httpx.Response) -> None:
    """Second line of defence against DNS rebinding: verify the address we actually connected to."""
    stream = response.extensions.get("network_stream")
    server_addr = stream.get_extra_info("server_addr") if stream is not None else None
    if server_addr and not _is_public_ip(str(server_addr[0])):
        raise ScrapeError("Dieser Link wird aus Sicherheitsgründen nicht abgerufen.")


async def fetch_page(url: str) -> tuple[str, str]:
    """Return (final_url, html) for a public web page, following a few validated redirects."""
    current = url.strip()
    async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=False, headers=HEADERS, trust_env=False) as client:
        for _ in range(MAX_REDIRECTS + 1):
            await _validate_url(current)
            try:
                async with client.stream("GET", current) as response:
                    _check_peer(response)
                    if response.is_redirect:
                        location = response.headers.get("location")
                        if not location:
                            raise ScrapeError("Die Seite leitet ins Leere weiter.")
                        current = urljoin(current, location)
                        continue
                    if response.status_code in {401, 403}:
                        raise ScrapeError("Die Seite ist nur mit Anmeldung sichtbar. Kopiere den Rezepttext stattdessen hinein.")
                    if response.status_code == 404:
                        raise ScrapeError("Unter diesem Link gibt es kein Rezept (Seite nicht gefunden).")
                    if response.status_code >= 400:
                        raise ScrapeError(f"Die Seite konnte nicht abgerufen werden (Fehler {response.status_code}).")
                    content_type = response.headers.get("content-type", "").lower()
                    if content_type and not any(kind in content_type for kind in ("html", "xml", "text/plain")):
                        raise ScrapeError("Unter dem Link liegt keine Webseite, sondern eine Datei.")
                    body = bytearray()
                    async for chunk in response.aiter_bytes():
                        body.extend(chunk)
                        if len(body) > MAX_BYTES:
                            raise ScrapeError("Die Seite ist zu groß für den Import.")
                    return current, body.decode(response.encoding or "utf-8", errors="replace")
            except httpx.TimeoutException:
                raise ScrapeError("Die Seite hat zu lange nicht geantwortet.") from None
            except httpx.HTTPError:
                raise ScrapeError("Die Seite konnte nicht abgerufen werden.") from None
    raise ScrapeError("Der Link leitet zu oft weiter.")


class _PageParser(HTMLParser):
    SKIP = {"script", "style", "noscript", "svg", "template", "iframe", "nav", "footer", "form", "button", "select"}
    BLOCK = {"p", "div", "li", "br", "h1", "h2", "h3", "h4", "h5", "h6", "tr", "section", "article", "ol", "ul", "td", "dd", "dt", "header", "main"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.json_ld: list[str] = []
        self.meta: dict[str, str] = {}
        self.title = ""
        self._skip_depth = 0
        self._ld_buffer: list[str] | None = None
        self._in_title = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = {key: value or "" for key, value in attrs}
        if tag == "script" and attributes.get("type", "").lower() == "application/ld+json":
            self._ld_buffer = []
            return
        if tag == "meta":
            key = (attributes.get("property") or attributes.get("name") or "").lower()
            if key in {"og:title", "og:description", "description", "og:site_name"} and attributes.get("content"):
                self.meta[key] = attributes["content"]
        if tag == "title":
            self._in_title = True
        if tag in self.SKIP:
            self._skip_depth += 1
        if tag in self.BLOCK:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag == "script" and self._ld_buffer is not None:
            self.json_ld.append("".join(self._ld_buffer))
            self._ld_buffer = None
            return
        if tag in self.SKIP and self._skip_depth:
            self._skip_depth -= 1
        if tag == "title":
            self._in_title = False
        if tag in self.BLOCK:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if self._ld_buffer is not None:
            self._ld_buffer.append(data)
        elif self._in_title:
            self.title += data
        elif not self._skip_depth:
            self.parts.append(data)


def _find_recipe(node: Any) -> dict[str, Any] | None:
    """Locate a schema.org Recipe object inside arbitrary JSON-LD (lists, @graph, nesting)."""
    if isinstance(node, list):
        for entry in node:
            if found := _find_recipe(entry):
                return found
    elif isinstance(node, dict):
        kind = node.get("@type")
        kinds = kind if isinstance(kind, list) else [kind]
        if any(isinstance(entry, str) and entry.lower() == "recipe" for entry in kinds):
            return node
        for key in ("@graph", "mainEntity", "mainEntityOfPage"):
            if found := _find_recipe(node.get(key)):
                return found
    return None


# Bulky or irrelevant schema.org fields that would only waste the model's context.
_DROPPED_FIELDS = {"image", "video", "review", "aggregateRating", "author", "publisher", "@context", "thumbnailUrl", "comment", "interactionStatistic"}


class ScrapedPage(NamedTuple):
    source: str
    # True when the page has structured recipe data but no steps (e.g. Cookidoo shows them only after login).
    missing_steps: bool


def page_to_source_text(url: str, html: str) -> ScrapedPage:
    """Condense a recipe page into structured data plus readable text for the AI."""
    parser = _PageParser()
    try:
        parser.feed(html)
        parser.close()
    except Exception:  # Malformed markup: keep whatever was parsed so far.
        pass

    recipe: dict[str, Any] | None = None
    for block in parser.json_ld:
        try:
            if recipe := _find_recipe(json.loads(block)):
                break
        except json.JSONDecodeError:
            continue

    lines: list[str] = []
    for line in "".join(parser.parts).splitlines():
        cleaned = re.sub(r"\s+", " ", line).strip()
        if cleaned and (not lines or lines[-1] != cleaned):
            lines.append(cleaned)
    page_text = "\n".join(lines)

    if recipe is None and len(page_text) < 200:
        title = (parser.meta.get("og:title") or parser.title or "").strip()
        title_hint = f" ({title})" if title else ""
        raise ScrapeError(
            f"Die Seite{title_hint} lädt Rezeptdaten erst nach dem Öffnen im Browser – "
            "der Link kann daher nicht direkt übernommen werden. "
            "Öffne das Rezept in der App, kopiere den gesamten Text (Zutaten, Mengen und Schritte) "
            "und füge ihn in das Textfeld ein."
        )

    sections = [f"Quelle: {url}"]
    title = parser.meta.get("og:title") or parser.title.strip()
    if title:
        sections.append(f"Seitentitel: {title}")
    if description := parser.meta.get("og:description") or parser.meta.get("description"):
        sections.append(f"Seitenbeschreibung: {description}")
    if recipe is not None:
        structured = {key: value for key, value in recipe.items() if key not in _DROPPED_FIELDS}
        sections.append("Strukturierte Rezeptdaten (schema.org):\n" + json.dumps(structured, ensure_ascii=False)[:MAX_STRUCTURED_CHARS])
    source = "\n".join(sections)
    remaining = MAX_SOURCE_CHARS - len(source) - 20
    if remaining > 500:
        source += "\nSeitentext:\n" + page_text[:remaining]
    missing_steps = recipe is not None and not recipe.get("recipeInstructions")
    return ScrapedPage(source[:MAX_SOURCE_CHARS], missing_steps)


def appliance_from_url(url: str) -> str | None:
    """Domains that only host recipes for one kitchen machine."""
    host = (urlsplit(url).hostname or "").lower()
    if "cookidoo" in host or "thermomix" in host or host.endswith("rezeptwelt.de"):
        return "thermomix"
    if "monsieur-cuisine" in host or "monsieurcuisine" in host:
        return "monsieur_cuisine"
    return None
