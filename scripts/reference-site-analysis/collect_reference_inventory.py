#!/usr/bin/env python3
"""Build a metadata-only inventory for the public reference blog.

The collector deliberately does not persist page bodies, images, stylesheets, or
other theme assets.  It stores sitemap facts and stable digests only, so the
analysis is reproducible without becoming a copy of the referenced work.

Two output tiers exist, because "no page body" is not the same as "no identity".

* **raw tier** (``--evidence-dir``) keeps the source host and the concrete URLs.
  It is the only tier allowed to do so, per gate 2 of
  ``docs/spec/feat-reference-blog-admin-ux/non-copying-design-system.md``.
* **abstract tier** (``--output-dir``) keeps counts, classifications, digests and
  *path shapes* such as ``/<article-slug>/``.  No host, no slug, no proper noun.
  Every abstract record carries ``record_digest`` and ``url_digest``, so the
  abstract tier can be re-verified against the raw tier without re-fetching.

The source host and the site-specific path list are **not** written in this file.
They live in a profile JSON under the evidence directory and reach the collector
through ``--site-profile``.  A checker that hardcoded the names it forbids would
be its own violation.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote, urlparse

USER_AGENT = "affiliate-hub-reference-analysis/1.0"
NS = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}

DEFAULT_SITE_PROFILE = Path(
    "docs/spec/feat-reference-blog-admin-ux/evidence/reference-site-profile.json"
)
DEFAULT_EVIDENCE_DIR = Path("docs/spec/feat-reference-blog-admin-ux/evidence")
DEFAULT_OUTPUT_DIR = Path("docs/spec/feat-reference-blog-admin-ux")

#: A profile with no site-specific knowledge.  Classification still works: it
#: falls back to the structural rules (sitemap part name, ``/`` root) that hold
#: for any sitemap, and puts unmatched pages in ``fixed-page/utility``.
EMPTY_PROFILE: dict[str, object] = {
    "root_sitemap": None,
    "article_index_paths": {},
    "navigator_paths": [],
    "policy_or_contact_paths": [],
    "publisher_profile_paths": [],
}

#: Abstract stand-in for a concrete path, chosen by classification alone.
#: The shape says what the URL *is*; it never says what it is *about*.
PATH_SHAPES = {
    ("home", "editorial-home"): "/",
    ("home", "news-duplicate"): "/",
    ("article", "yearly-post"): "/<article-slug>/",
    ("article-index", "all-posts"): "/<article-index-slug>/",
    ("article-index", "html-sitemap"): "/<article-index-slug>/",
    ("taxonomy", "category"): "/category/<category-slug>/",
    ("taxonomy", "tag"): "/tag/<tag-slug>/",
    ("author", "profile-and-post-list"): "/author/<author-slug>/",
    ("navigator", "comparison-or-guided-choice"): "/<navigator-slug>/",
    ("fixed-page", "policy-or-contact"): "/<fixed-page-slug>/",
    ("fixed-page", "publisher-profile"): "/<fixed-page-slug>/",
    ("fixed-page", "utility"): "/<fixed-page-slug>/",
}


def load_profile(path: Path) -> dict:
    """Read the site profile, or fail loudly.

    There is no built-in fallback to a real site.  If the profile is missing the
    operator must say which site is being analysed; the repository must not."""
    profile = json.loads(path.read_text(encoding="utf-8"))
    merged = dict(EMPTY_PROFILE)
    merged.update(profile)
    return merged


def path_shape(screen_type: str, screen_variant: str) -> str:
    return PATH_SHAPES.get((screen_type, screen_variant), "/<page-slug>/")


def sitemap_part_role(sitemap_url: str) -> str:
    """The sitemap file name. Generator-structural, carries no site identity."""
    return Path(urlparse(sitemap_url).path).name


@dataclass(frozen=True)
class Response:
    url: str
    status: int
    content_type: str | None
    body: bytes


def sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def fetch(url: str, timeout: float) -> Response:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": "application/xml,text/xml;q=0.9"},
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return Response(
            url=response.geturl(),
            status=response.status,
            content_type=response.headers.get("content-type"),
            body=response.read(),
        )


def text(element: ET.Element | None) -> str | None:
    if element is None or element.text is None:
        return None
    value = element.text.strip()
    return value or None


def classify(
    url: str, sitemap_url: str, profile: dict | None = None
) -> tuple[str, str, int | None]:
    profile = profile if profile is not None else EMPTY_PROFILE
    path = unquote(urlparse(url).path).rstrip("/") or "/"
    sitemap_name = sitemap_part_role(sitemap_url)
    year_match = re.search(r"post\.(\d{4})\.xml$", sitemap_name)
    if year_match:
        return "article", "yearly-post", int(year_match.group(1))
    if "taxonomy-category" in sitemap_name:
        return "taxonomy", "category", None
    if "taxonomy-post_tag" in sitemap_name:
        return "taxonomy", "tag", None
    if "author" in sitemap_name:
        return "author", "profile-and-post-list", None
    if "news" in sitemap_name:
        return "home", "news-duplicate", None

    if path == "/":
        return "home", "editorial-home", None
    article_index = profile.get("article_index_paths") or {}
    if path in article_index:
        return "article-index", str(article_index[path]), None
    if path in set(profile.get("navigator_paths") or ()):
        return "navigator", "comparison-or-guided-choice", None
    if path in set(profile.get("policy_or_contact_paths") or ()):
        return "fixed-page", "policy-or-contact", None
    if path in set(profile.get("publisher_profile_paths") or ()):
        return "fixed-page", "publisher-profile", None
    return "fixed-page", "utility", None


def canonical(url: str) -> str:
    parsed = urlparse(url)
    path = parsed.path or "/"
    if path != "/" and not path.endswith("/"):
        path += "/"
    return f"{parsed.scheme.lower()}://{parsed.netloc.lower()}{path}"


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def collect(
    root_url: str, timeout: float, captured_at: str, profile: dict | None = None
) -> tuple[dict, dict]:
    profile = profile if profile is not None else EMPTY_PROFILE
    root = fetch(root_url, timeout)
    root_xml = ET.fromstring(root.body)
    sitemap_entries = []
    inventory_by_canonical: dict[str, dict] = {}
    duplicate_memberships: list[dict] = []

    for sitemap in root_xml.findall("sm:sitemap", NS):
        sitemap_url = text(sitemap.find("sm:loc", NS))
        if sitemap_url is None:
            continue
        source = fetch(sitemap_url, timeout)
        document = ET.fromstring(source.body)
        source_rows = []
        for entry in document.findall("sm:url", NS):
            raw_url = text(entry.find("sm:loc", NS))
            if raw_url is None:
                continue
            last_modified = text(entry.find("sm:lastmod", NS))
            canonical_url = canonical(raw_url)
            screen_type, screen_variant, year = classify(raw_url, sitemap_url, profile)
            row = {
                "canonical_url": canonical_url,
                "source_sitemap": sitemap_url,
                "last_modified": last_modified,
                "screen_type": screen_type,
                "screen_variant": screen_variant,
                "year": year,
                "record_digest": sha256(
                    f"{canonical_url}\n{last_modified or ''}\n{screen_type}\n{screen_variant}".encode()
                ),
            }
            source_rows.append(row)
            previous = inventory_by_canonical.get(canonical_url)
            if previous is None:
                inventory_by_canonical[canonical_url] = row
            else:
                duplicate_memberships.append(
                    {
                        "canonical_url": canonical_url,
                        "kept_sitemap": previous["source_sitemap"],
                        "duplicate_sitemap": sitemap_url,
                    }
                )
        sitemap_entries.append(
            {
                "url": sitemap_url,
                "index_last_modified": text(sitemap.find("sm:lastmod", NS)),
                "status": source.status,
                "content_type": source.content_type,
                "content_sha256": sha256(source.body),
                "url_memberships": len(source_rows),
            }
        )

    inventory = sorted(inventory_by_canonical.values(), key=lambda item: item["canonical_url"])
    type_counts = Counter(item["screen_type"] for item in inventory)
    variant_counts = Counter(item["screen_variant"] for item in inventory)
    year_counts = Counter(item["year"] for item in inventory if item["year"] is not None)
    uncategorized = [item["canonical_url"] for item in inventory if item["screen_type"] == "unknown"]

    snapshot = {
        "schema_version": 1,
        "captured_at": captured_at,
        "collector": "scripts/reference-site-analysis/collect_reference_inventory.py",
        "root_sitemap": root_url,
        "root_status": root.status,
        "root_content_type": root.content_type,
        "root_content_sha256": sha256(root.body),
        "sitemap_part_count": len(sitemap_entries),
        "sitemap_parts": sitemap_entries,
        "membership_count": sum(item["url_memberships"] for item in sitemap_entries),
        "canonical_url_count": len(inventory),
        "duplicate_memberships": duplicate_memberships,
        "screen_type_counts": dict(sorted(type_counts.items())),
        "screen_variant_counts": dict(sorted(variant_counts.items())),
        "post_year_counts": {str(key): year_counts[key] for key in sorted(year_counts)},
        "unclassified_count": len(uncategorized),
        "inventory_digest": sha256(
            "\n".join(item["record_digest"] for item in inventory).encode()
        ),
        "retention_policy": "metadata-and-digests-only; no page body, image, logo, CSS, or theme asset",
    }
    inventory_document = {
        "schema_version": 1,
        "captured_at": captured_at,
        "source_snapshot": "sitemap-snapshot.json",
        "canonical_url_count": len(inventory),
        "unclassified_count": len(uncategorized),
        "items": inventory,
    }
    return snapshot, inventory_document


# --- abstraction tier -------------------------------------------------------
#
# The two functions below are pure: raw document in, host-free document out.
# They add no facts.  Everything they emit is either a count that already
# existed, a classification that already existed, or a digest of a value they
# are dropping.  That last part is what keeps the abstract tier checkable: a
# reader holding the raw tier can recompute every digest and confirm the
# abstract tier describes it, and nothing else.


def abstract_inventory(inventory_document: dict) -> dict:
    items = []
    for item in inventory_document["items"]:
        canonical_url = item["canonical_url"]
        screen_type = item["screen_type"]
        screen_variant = item["screen_variant"]
        items.append(
            {
                "record_digest": item["record_digest"],
                "url_digest": sha256(canonical_url.encode()),
                "path_shape": path_shape(screen_type, screen_variant),
                "path_segment_count": len(
                    [part for part in urlparse(canonical_url).path.split("/") if part]
                ),
                "source_sitemap_part": sitemap_part_role(item["source_sitemap"]),
                "last_modified": item["last_modified"],
                "screen_type": screen_type,
                "screen_variant": screen_variant,
                "year": item["year"],
            }
        )
    return {
        "schema_version": 1,
        "captured_at": inventory_document["captured_at"],
        "source_snapshot": "sitemap-snapshot.json",
        "raw_evidence": "evidence/reference-url-inventory.raw.json",
        "abstraction": (
            "host-and-slug-free; each record keeps record_digest and url_digest so it "
            "can be matched back to the raw evidence tier without re-fetching"
        ),
        "canonical_url_count": inventory_document["canonical_url_count"],
        "unclassified_count": inventory_document["unclassified_count"],
        "items": items,
    }


def abstract_snapshot(snapshot: dict) -> dict:
    document = {
        key: value
        for key, value in snapshot.items()
        if key
        not in {"root_sitemap", "sitemap_parts", "duplicate_memberships", "retention_policy"}
    }
    document["root_sitemap_part"] = sitemap_part_role(snapshot["root_sitemap"])
    document["root_sitemap_digest"] = sha256(snapshot["root_sitemap"].encode())
    document["raw_evidence"] = "evidence/sitemap-snapshot.raw.json"
    document["sitemap_parts"] = [
        {
            "part": sitemap_part_role(part["url"]),
            "url_digest": sha256(part["url"].encode()),
            "index_last_modified": part["index_last_modified"],
            "status": part["status"],
            "content_type": part["content_type"],
            "content_sha256": part["content_sha256"],
            "url_memberships": part["url_memberships"],
        }
        for part in snapshot["sitemap_parts"]
    ]
    document["duplicate_memberships"] = [
        {
            "url_digest": sha256(row["canonical_url"].encode()),
            "kept_sitemap_part": sitemap_part_role(row["kept_sitemap"]),
            "duplicate_sitemap_part": sitemap_part_role(row["duplicate_sitemap"]),
        }
        for row in snapshot["duplicate_memberships"]
    ]
    document["retention_policy"] = snapshot["retention_policy"]
    document["abstraction"] = (
        "host-and-slug-free; the source host lives only in evidence/ per "
        "non-copying-design-system.md gate 2"
    )
    return document


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--site-profile",
        type=Path,
        default=DEFAULT_SITE_PROFILE,
        help="JSON holding the source host and its site-specific paths; never hardcoded here",
    )
    parser.add_argument(
        "--root-sitemap",
        default=None,
        help="overrides root_sitemap from the site profile",
    )
    parser.add_argument("--timeout", type=float, default=20.0)
    parser.add_argument(
        "--captured-at",
        default=datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        help="ISO timestamp recorded in outputs; pass a fixed value for byte-for-byte reproduction",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help="abstract, host-free tier read by the specification documents",
    )
    parser.add_argument(
        "--evidence-dir",
        type=Path,
        default=DEFAULT_EVIDENCE_DIR,
        help="raw tier; the only place allowed to carry the source host",
    )
    args = parser.parse_args()

    try:
        profile = load_profile(args.site_profile)
    except (OSError, json.JSONDecodeError) as error:
        print(f"site profile unreadable ({args.site_profile}): {error}", file=sys.stderr)
        return 1
    root_sitemap = args.root_sitemap or profile.get("root_sitemap")
    if not root_sitemap:
        print(
            "no root sitemap: set root_sitemap in the site profile or pass --root-sitemap",
            file=sys.stderr,
        )
        return 1

    try:
        snapshot, inventory = collect(root_sitemap, args.timeout, args.captured_at, profile)
    except (urllib.error.URLError, TimeoutError, ET.ParseError) as error:
        print(f"reference inventory collection failed: {error}", file=sys.stderr)
        return 1

    write_json(args.evidence_dir / "sitemap-snapshot.raw.json", snapshot)
    write_json(args.evidence_dir / "reference-url-inventory.raw.json", inventory)
    write_json(args.output_dir / "sitemap-snapshot.json", abstract_snapshot(snapshot))
    write_json(args.output_dir / "reference-url-inventory.json", abstract_inventory(inventory))
    print(
        json.dumps(
            {
                "sitemap_parts": snapshot["sitemap_part_count"],
                "canonical_urls": snapshot["canonical_url_count"],
                "unclassified": snapshot["unclassified_count"],
                "inventory_digest": snapshot["inventory_digest"],
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
