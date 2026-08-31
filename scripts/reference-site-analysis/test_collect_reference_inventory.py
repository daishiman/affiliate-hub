import hashlib
import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.parse import urlparse


MODULE_PATH = Path(__file__).with_name("collect_reference_inventory.py")
SPEC = importlib.util.spec_from_file_location("collect_reference_inventory", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
collector = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = collector
SPEC.loader.exec_module(collector)


# Fixtures use a reserved test domain and invented slugs on purpose.
# The real source host and its paths live in the site profile under
# `docs/spec/feat-reference-blog-admin-ux/evidence/`, never in this file.
ROOT = b'''<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<sitemap><loc>https://example.test/sitemap-posttype-post.2026.xml</loc></sitemap>
<sitemap><loc>https://example.test/sitemap-news.xml</loc></sitemap>
</sitemapindex>'''
POST = b'''<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>https://example.test/post-a/</loc><lastmod>2026-08-01</lastmod></url>
<url><loc>https://example.test</loc></url>
</urlset>'''
NEWS = b'''<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>https://example.test/</loc></url>
</urlset>'''

#: Stands in for the real site profile. Same shape, invented values.
FIXTURE_PROFILE = {
    "root_sitemap": "https://example.test/sitemap.xml",
    "article_index_paths": {"/all-posts": "all-posts", "/index-page": "html-sitemap"},
    "navigator_paths": ["/compare-a"],
    "policy_or_contact_paths": ["/policy-a"],
    "publisher_profile_paths": ["/about-a"],
}


def fake_fetch(url: str, _timeout: float):
    bodies = {
        "https://example.test/sitemap.xml": ROOT,
        "https://example.test/sitemap-posttype-post.2026.xml": POST,
        "https://example.test/sitemap-news.xml": NEWS,
    }
    return collector.Response(url=url, status=200, content_type="application/xml", body=bodies[url])


class CollectorTest(unittest.TestCase):
    def test_classification_covers_every_declared_archetype(self):
        cases = {
            "https://example.test/": ("home", "editorial-home"),
            "https://example.test/all-posts/": ("article-index", "all-posts"),
            "https://example.test/index-page/": ("article-index", "html-sitemap"),
            "https://example.test/category/topic-a/": ("taxonomy", "category"),
            "https://example.test/tag/label-a/": ("taxonomy", "tag"),
            "https://example.test/author/person-a/": ("author", "profile-and-post-list"),
            "https://example.test/compare-a/": ("navigator", "comparison-or-guided-choice"),
            "https://example.test/policy-a/": ("fixed-page", "policy-or-contact"),
            "https://example.test/about-a/": ("fixed-page", "publisher-profile"),
            "https://example.test/anything-else/": ("fixed-page", "utility"),
        }
        for url, expected in cases.items():
            sitemap = "https://example.test/sitemap-posttype-page.xml"
            if "/category/" in url:
                sitemap = "https://example.test/sitemap-taxonomy-category.xml"
            elif "/tag/" in url:
                sitemap = "https://example.test/sitemap-taxonomy-post_tag.xml"
            elif "/author/" in url:
                sitemap = "https://example.test/sitemap-author.xml"
            self.assertEqual(collector.classify(url, sitemap, FIXTURE_PROFILE)[:2], expected)

    def test_site_specific_paths_come_from_the_profile_not_the_source(self):
        """Without a profile the collector must not recognise any site's own paths.

        This is the regression guard for the isolation: if someone re-hardcodes a
        real slug list into the module, these fall out of `fixed-page/utility`."""
        sitemap = "https://example.test/sitemap-posttype-page.xml"
        for path in ("/all-posts/", "/compare-a/", "/policy-a/", "/about-a/"):
            self.assertEqual(
                collector.classify(f"https://example.test{path}", sitemap)[:2],
                ("fixed-page", "utility"),
            )
        self.assertIsNone(collector.EMPTY_PROFILE["root_sitemap"])

    def test_canonical_removes_query_and_normalizes_trailing_slash(self):
        self.assertEqual(
            collector.canonical("HTTPS://Example.TEST/path?utm_source=test#top"),
            "https://example.test/path/",
        )

    def test_fixture_reproduction_deduplicates_memberships(self):
        with patch.object(collector, "fetch", side_effect=fake_fetch):
            snapshot, inventory = collector.collect(
                "https://example.test/sitemap.xml", 1, "2026-08-29T21:19:00+00:00", FIXTURE_PROFILE
            )
        self.assertEqual(snapshot["sitemap_part_count"], 2)
        self.assertEqual(snapshot["membership_count"], 3)
        self.assertEqual(snapshot["canonical_url_count"], 2)
        self.assertEqual(len(snapshot["duplicate_memberships"]), 1)
        self.assertEqual(snapshot["unclassified_count"], 0)
        self.assertEqual(len(inventory["items"]), 2)

    def test_abstract_tier_drops_the_host_but_keeps_the_proof(self):
        with patch.object(collector, "fetch", side_effect=fake_fetch):
            snapshot, inventory = collector.collect(
                "https://example.test/sitemap.xml", 1, "2026-08-29T21:19:00+00:00", FIXTURE_PROFILE
            )
        abstract_inventory = collector.abstract_inventory(inventory)
        abstract_snapshot = collector.abstract_snapshot(snapshot)

        # No host, no scheme, anywhere in the abstract tier.
        for document in (abstract_inventory, abstract_snapshot):
            serialized = json.dumps(document, ensure_ascii=False)
            self.assertNotIn("example.test", serialized)
            self.assertNotIn("https://", serialized)

        # The counts that carry the evidence survive unchanged.
        self.assertEqual(
            abstract_inventory["canonical_url_count"], inventory["canonical_url_count"]
        )
        self.assertEqual(abstract_inventory["unclassified_count"], 0)
        self.assertEqual(len(abstract_inventory["items"]), len(inventory["items"]))
        self.assertEqual(abstract_snapshot["inventory_digest"], snapshot["inventory_digest"])
        self.assertEqual(abstract_snapshot["membership_count"], snapshot["membership_count"])
        self.assertEqual(
            abstract_snapshot["screen_type_counts"], snapshot["screen_type_counts"]
        )

        # Each abstract record still joins back to exactly one raw record.
        raw_by_digest = {
            hashlib.sha256(item["canonical_url"].encode()).hexdigest(): item
            for item in inventory["items"]
        }
        self.assertEqual(len(raw_by_digest), len(inventory["items"]))
        for item in abstract_inventory["items"]:
            source = raw_by_digest[item["url_digest"]]
            self.assertEqual(item["record_digest"], source["record_digest"])
            self.assertEqual(item["screen_type"], source["screen_type"])

    def test_shipped_abstract_tier_carries_no_source_identity(self):
        repo = Path(__file__).resolve().parents[2]
        docs = repo / "docs/spec/feat-reference-blog-admin-ux"
        evidence = docs / "evidence"
        raw = json.loads(
            (evidence / "reference-url-inventory.raw.json").read_text(encoding="utf-8")
        )
        host = urlparse(raw["items"][0]["canonical_url"]).netloc
        self.assertTrue(host)

        published = sorted(path for path in docs.rglob("*") if path.is_file())
        self.assertTrue(published)
        for path in published:
            text = path.read_text(encoding="utf-8", errors="replace")
            # The host may appear in evidence/ and nowhere else. That is gate 2.
            if evidence not in path.parents:
                self.assertNotIn(
                    host,
                    text,
                    f"source host leaked outside evidence/: {path.relative_to(repo)}",
                )

        shipped = json.loads((docs / "reference-url-inventory.json").read_text(encoding="utf-8"))
        self.assertEqual(shipped["canonical_url_count"], 1072)
        self.assertEqual(shipped["unclassified_count"], 0)
        self.assertEqual(len(shipped["items"]), 1072)
        self.assertTrue(all(item["screen_type"] for item in shipped["items"]))
        # The abstract tier reproduces the digest recorded in the snapshot, so the
        # 1,072-record classification stays checkable without the raw URLs.
        snapshot = json.loads((docs / "sitemap-snapshot.json").read_text(encoding="utf-8"))
        self.assertEqual(
            hashlib.sha256(
                "\n".join(item["record_digest"] for item in shipped["items"]).encode()
            ).hexdigest(),
            snapshot["inventory_digest"],
        )

    def test_A3_trace_lists_every_screen_inventory_id(self):
        repo = Path(__file__).resolve().parents[2]
        docs = repo / "docs/spec/feat-reference-blog-admin-ux"
        screen_text = (docs / "screen-inventory.md").read_text(encoding="utf-8")
        ids = {
            line.split("|", 2)[1].strip().split()[0]
            for line in screen_text.splitlines()
            if line.startswith("| PUB-") or line.startswith("| ADM-")
        }
        trace = json.loads((docs / "acceptance-traceability.json").read_text(encoding="utf-8"))
        a3 = next(row for row in trace["requirements"] if row["id"] == "A3")
        self.assertEqual(set(a3["screens"]), ids)

    def test_A1_through_A12_have_complete_and_canonical_trace(self):
        repo = Path(__file__).resolve().parents[2]
        docs = repo / "docs/spec/feat-reference-blog-admin-ux"
        screen_text = (docs / "screen-inventory.md").read_text(encoding="utf-8")
        screen_ids = {
            line.split("|", 2)[1].strip().split()[0]
            for line in screen_text.splitlines()
            if line.startswith("| PUB-") or line.startswith("| ADM-")
        }
        trace = json.loads((docs / "acceptance-traceability.json").read_text(encoding="utf-8"))
        rows = {row["id"]: row for row in trace["requirements"]}
        self.assertEqual(set(rows), {f"A{index}" for index in range(1, 13)})
        for row in rows.values():
            self.assertTrue(row["screens"])
            self.assertTrue(row["data"])
            self.assertTrue(row["evidence"])
            self.assertLessEqual(set(row["screens"]), screen_ids)
        self.assertIn("usability-observations", rows["A10"]["data"])
        self.assertIn("usability-test-protocol.md", rows["A10"]["evidence"])
        self.assertIn("a11y-results", rows["A11"]["data"])
        self.assertIn("test-design.md", rows["A11"]["evidence"])

    def test_preview_contract_is_default_deny_and_rights_gates_images(self):
        repo = Path(__file__).resolve().parents[2]
        docs = repo / "docs/spec/feat-reference-blog-admin-ux"
        contract = (docs / "affiliate-preview-contract.md").read_text(encoding="utf-8")
        self.assertIn("default-deny", contract)
        self.assertIn("DNS", contract)
        self.assertIn("imageDisplayAllowed", contract)
        self.assertIn("redirect", contract)


if __name__ == "__main__":
    unittest.main()
