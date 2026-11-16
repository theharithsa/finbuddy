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

from build_public_docs import build
from check_docs_impact import has_decision


class PublicDocsTests(unittest.TestCase):
    def scaffold(self, parent):
        root = parent / 'repo'
        shutil.copytree(ROOT / 'site', root / 'site')
        (root / 'docs').mkdir()
        shutil.copyfile(ROOT / 'docs/public-guides.json', root / 'docs/public-guides.json')
        shutil.copyfile(ROOT / 'index.html', root / 'index.html')
        shutil.copytree(ROOT / 'public/docs', root / 'public/docs', ignore=shutil.ignore_patterns('handbook'))
        return root

    def test_build_publishes_only_curated_content_with_revision(self):
        with tempfile.TemporaryDirectory() as scratch:
            parent = Path(scratch)
            root = self.scaffold(parent)
            (root / 'site/internal.html').write_text('Private fixture')
            (root / 'docs/private-runbook.md').write_text('Private fixture')
            config = root / 'docs/public-guides.json'
            data = json.loads(config.read_text(encoding='utf-8'))
            data['guides']['settings']['intro'] = '<b>Example</b>'
            config.write_text(json.dumps(data), encoding='utf-8')
            output = parent / 'out'
            with patch.dict(os.environ, {'GITHUB_SHA': 'a' * 40}):
                build(root, output)
            self.assertEqual(
                {path.name for path in (output / 'docs').iterdir()},
                {'product.html', 'technical.html', 'settings.html', 'sdlc.html', 'pipeline.html',
                 'roadmap.html', 'releases.html'},
            )
            self.assertFalse((output / 'internal.html').exists())
            self.assertFalse((output / 'docs/private-runbook.md').exists())
            for asset in ('google-sans-latin-wght-normal.woff2', 'google-sans-OFL.txt', 'finbuddy-tour.mp4'):
                self.assertTrue((output / 'media' / asset).is_file(), asset)
            guide = (output / 'docs/settings.html').read_text(encoding='utf-8')
            self.assertIn('&lt;b&gt;Example&lt;/b&gt;', guide)
            self.assertIn('name="source-revision" content="' + 'a' * 40, guide)

    def test_hosting_build_checks_help_hub_and_release_anchors(self):
        with tempfile.TemporaryDirectory() as scratch:
            parent = Path(scratch)
            root = self.scaffold(parent)
            output = root / 'public/docs/handbook'
            with patch.dict(os.environ, {'GITHUB_SHA': 'b' * 40}):
                build(root, output, hosting=True)
            releases = (output / 'releases.html').read_text(encoding='utf-8')
            self.assertIn('id="v3-1-1"', releases)
            self.assertIn('href="#v3-1-1"', releases)
            self.assertIn('name="source-revision" content="' + 'b' * 40, releases)
            self.assertFalse((output / 'media/finbuddy-tour.mp4').exists())
            self.assertTrue((output / 'media/google-sans-latin-wght-normal.woff2').is_file())
            product = (output / 'product.html').read_text(encoding='utf-8')
            self.assertIn('id="record-income"', product)
            self.assertIn('class="task-steps"', product)
            self.assertTrue((output / 'media/home.jpg').is_file())
            technical = (output / 'technical.html').read_text(encoding='utf-8')
            self.assertIn('<pre><code>git clone ', technical)
            hub = root / 'public/docs/index.html'
            hub.write_text(hub.read_text(encoding='utf-8').replace('#troubleshooting', '#missing'), encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'missing anchor'):
                build(root, output, hosting=True)
            self.assertEqual(releases, (output / 'releases.html').read_text(encoding='utf-8'))

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
