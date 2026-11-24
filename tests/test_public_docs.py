import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))

from build_public_docs import GUIDES, build
from public_site import ERRORS, LEGACY
from check_docs_impact import has_decision


class PublicDocsTests(unittest.TestCase):
    def scaffold(self, parent):
        root = parent / 'repo'
        shutil.copytree(ROOT / 'site', root / 'site')
        (root / 'docs').mkdir()
        shutil.copyfile(ROOT / 'docs/public-guides.json', root / 'docs/public-guides.json')
        shutil.copytree(ROOT / 'public', root / 'public')
        return root

    def test_build_publishes_only_curated_pages_and_preserves_legacy_links(self):
        with tempfile.TemporaryDirectory() as scratch:
            parent = Path(scratch)
            root = self.scaffold(parent)
            (root / 'site/internal.html').write_text('Private fixture')
            (root / 'docs/private-runbook.md').write_text('Private fixture')
            config = root / 'docs/public-guides.json'
            data = json.loads(config.read_text(encoding='utf-8'))
            data['guides']['settings']['intro'] = '<b>Example</b>'
            config.write_text(json.dumps(data), encoding='utf-8')
            for hosting in (True, False):
                output = parent / ('hosting' if hosting else 'pages')
                revision = 'a' * 40
                with patch.dict(os.environ, {'FINBUDDY_SOURCE_REVISION': revision}):
                    build(root, output, hosting=hosting)
                self.assertFalse((output / 'internal.html').exists())
                self.assertFalse((output / 'docs/private-runbook.md').exists())
                for asset in ('google-sans-latin-wght-normal.woff2', 'google-sans-OFL.txt', 'finbuddy-tour.mp4'):
                    self.assertTrue((output / 'media' / asset).is_file(), asset)
                for name in GUIDES:
                    guide = (output / 'docs' / (name + '.html')).read_text(encoding='utf-8')
                    self.assertIn('name="source-revision" content="' + revision, guide)
                    self.assertIn('aria-label="Main"', guide)
                    self.assertIn('aria-label="Footer"', guide)
                    alias = (output / 'docs/handbook' / (name + '.html')).read_text(encoding='utf-8')
                    self.assertIn('href="../../docs/' + name + '.html"', alias)
                for old, current in LEGACY.items():
                    self.assertIn('id="guide-destination" href="../' + current + '"',
                                  (output / old).read_text(encoding='utf-8'))
                settings = (output / 'docs/settings.html').read_text(encoding='utf-8')
                self.assertIn('&lt;b&gt;Example&lt;/b&gt;', settings)
                home = (output / 'index.html').read_text(encoding='utf-8')
                self.assertIn('href="' + ('' if hosting else 'https://finbuddy-2025.web.app/') + 'signin"', home)
                self.assertEqual('/entry.js' in home, hosting)
                self.assertNotIn('id="root"', home)
                for code in ERRORS:
                    self.assertIn('id="error-' + str(code) + '"',
                                  (output / 'errors' / (str(code) + '.html')).read_text(encoding='utf-8'))
                missing = (output / '404.html').read_text(encoding='utf-8')
                self.assertIn('href="' + ('/' if hosting else '/finbuddy/') + 'landing.css"', missing)

    def test_check_rejects_existing_output_and_keeps_its_contents(self):
        with tempfile.TemporaryDirectory() as scratch:
            parent = Path(scratch)
            root = self.scaffold(parent)
            output = parent / 'out'
            output.mkdir()
            existing = output / 'keep.txt'
            existing.write_text('Original')
            with self.assertRaisesRegex(ValueError, 'empty build output directory'):
                build(root, output)
            self.assertEqual(existing.read_text(), 'Original')

    def test_build_rejects_missing_anchor_without_touching_output(self):
        with tempfile.TemporaryDirectory() as scratch:
            parent = Path(scratch)
            root = self.scaffold(parent)
            landing = root / 'site/index.html'
            landing.write_text(
                landing.read_text(encoding='utf-8').replace('docs/product.html', 'docs/product.html#unknown'),
                encoding='utf-8',
            )
            output = parent / 'out'
            with self.assertRaisesRegex(ValueError, 'missing anchor'):
                build(root, output)
            self.assertFalse(output.exists())

    def test_decision_must_appear_in_visible_impact_section(self):
        heading = '## Documentation impact\n\n'
        for decision in ['Updated: Product handbook', 'No change: Internal refactor']:
            self.assertTrue(has_decision((heading + decision).replace('\n', '\r\n')))
        for body in [
            heading + '<!-- Updated: mention guides here -->',
            heading + 'Updated: ',
            heading + '~~~md\nNo change: example\n~~~',
            heading + '## Testing\nUpdated: Unit tests',
            'Updated: Product handbook',
        ]:
            self.assertFalse(has_decision(body), body)

    def test_ci_reads_pr_event(self):
        with tempfile.TemporaryDirectory() as scratch:
            event = Path(scratch) / 'event.json'
            for body, code in [(None, 1), ('## Documentation impact\nUpdated: Settings guide', 0)]:
                event.write_text(json.dumps({'pull_request': {'body': body}}))
                result = subprocess.run(
                    [sys.executable, ROOT / 'scripts/check_docs_impact.py'],
                    env={**os.environ, 'GITHUB_EVENT_NAME': 'pull_request', 'GITHUB_EVENT_PATH': str(event)},
                    capture_output=True, text=True,
                )
                self.assertEqual(result.returncode, code, result.stderr)
