#!/usr/bin/env python3
"""Build the public site from curated inputs and validate local HTML links."""
import argparse
from html import escape
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import shutil
import tempfile
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
GUIDES = {
    'product': 'Product handbook',
    'technical': 'Technical guide',
    'settings': 'Settings reference',
    'sdlc': 'SDLC guide',
    'pipeline': 'CI/CD pipeline',
    'roadmap': 'Roadmap',
    'releases': 'Release history',
}
MEDIA_SUFFIXES = {'.jpg', '.jpeg', '.png', '.webp', '.avif', '.mp4', '.webm', '.vtt', '.woff2'}
MEDIA_LICENSES = {'google-sans-OFL.txt'}
HANDBOOK_MEDIA = {'buddy-mark-v2.png', 'google-sans-latin-wght-normal.woff2', *MEDIA_LICENSES}
GUIDE_GROUPS = {
    'Using FinBuddy': ('product', 'settings'),
    'For developers': ('technical', 'sdlc', 'pipeline'),
    'Project updates': ('roadmap', 'releases'),
}


class Page(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.ids = set()
        self.links = []
        self.template_depth = 0
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        if tag == 'template':
            self.template_depth += 1
        if self.template_depth:
            return
        attrs = dict(attrs)
        if attrs.get('id'):
            self.ids.add(attrs['id'])
        self.links.extend(attrs[key] for key in ('href', 'src', 'poster') if attrs.get(key))

    def handle_endtag(self, tag):
        if tag == 'template':
            self.template_depth -= 1


def validate_links(output, selected=None):
    pages = {file: Page(file.read_text(encoding='utf-8')) for file in output.rglob('*.html')}
    for file, page in pages.items():
        if selected is not None and file not in selected:
            continue
        for link in page.links:
            url = urlsplit(link)
            if url.scheme or url.netloc:
                continue
            path = unquote(url.path)
            target = (file.parent / path).resolve() if path else file
            if path.startswith('/') or not target.is_relative_to(output):
                raise ValueError(f'{file.relative_to(output)}: use a relative site link for {link}')
            if target.is_dir():
                target /= 'index.html'
            if not target.is_file():
                raise ValueError(f'{file.relative_to(output)}: missing target {link}')
            if url.fragment and target in pages and unquote(url.fragment) not in pages[target].ids:
                raise ValueError(f'{file.relative_to(output)}: missing anchor {link}')


def render_links(links):
    return ''.join(f'<li><a href="{escape(url)}">{escape(text)}</a></li>' for text, url in links)


def render_releases(releases):
    index = [(f'v{release["version"]}', f'#v{release["version"].replace(".", "-")}') for release in releases]
    notes = []
    for release, (_, anchor) in zip(releases, index):
        version = escape(release['version'])
        notes.append(f'''<article class="release" id="{anchor[1:]}">
  <h2>{escape(release.get('title', f'FinBuddy v{version}'))}</h2>
  <p class="release-version">v{version}</p>
  <p class="release-status">{escape(release['status'])}</p>
  <p>{escape(release['summary'])}</p>
  <details class="release-sources"><summary>Sources for v{version}</summary><ul class="related">{render_links(release['links'])}</ul></details>
</article>''')
    return f'<nav aria-label="Versions"><ul class="version-index">{render_links(index)}</ul></nav>' + ''.join(notes)


def render_section(section, assets):
    aliases = ''.join(f'<span class="anchor-alias" id="{name}"></span>' for name in section.get('aliases', []))
    body = ''.join(f'<p>{escape(paragraph)}</p>' for paragraph in section.get('paragraphs', []))
    if section.get('steps'):
        body += '<ol class="task-steps">' + ''.join(f'<li>{escape(step)}</li>' for step in section['steps']) + '</ol>'
    if section.get('table'):
        headings, *rows = section['table']
        header = ''.join(f'<th scope="col">{escape(item)}</th>' for item in headings)
        cells = ''.join('<tr>' + ''.join(f'<td>{escape(item)}</td>' for item in row) + '</tr>' for row in rows)
        body += f'<table><thead><tr>{header}</tr></thead><tbody>{cells}</tbody></table>'
    if section.get('code'):
        body += f'<pre><code>{escape(section["code"])}</code></pre>'
    if section.get('links'):
        body += f'<ul class="related">{render_links(section["links"])}</ul>'
    if section.get('figure'):
        name, alt, caption = section['figure']
        body += (f'<figure><a href="{assets}media/{escape(name)}" aria-label="Open the full-size screenshot">'
                 f'<img src="{assets}media/{escape(name)}" alt="{escape(alt)}" width="1280" height="800" loading="lazy"></a>'
                 f'<figcaption>{escape(caption)}</figcaption></figure>')
    if section.get('note'):
        body += f'<p class="guide-note">{escape(section["note"])}</p>'
    return f'<section id="{section["id"]}">{aliases}<h2>{escape(section["title"])}</h2>{body}</section>'


def render_flow(title, stages):
    nodes = ''.join(f'<li><h3>{escape(stage)}</h3><p>{escape(result)}</p></li>' for stage, result in stages)
    return f'<section id="sequence"><h2>{title}</h2><ol class="guide-flow">{nodes}</ol></section>'


def render(slug, data, hosting=False):
    title = GUIDES[slug]
    assets = './' if hosting else '../'
    menu = []
    for group, guides in GUIDE_GROUPS.items():
        links = ''.join(f'<li><a href="{key}.html"' + (' aria-current="page"' if key == slug else '')
                        + f'>{GUIDES[key]}</a></li>' for key in guides)
        menu.append(f'<div class="guide-nav-group"><p>{group}</p><ul>{links}</ul></div>')
    menu = ''.join(menu)
    flow_title = {'pipeline': 'From pull request to production', 'roadmap': 'FinVision rollout gates'}.get(slug)
    contents = [(section['title'], '#' + section['id']) for section in data['sections']]
    if flow_title:
        contents.insert(0, (flow_title, '#sequence'))
    index = '' if slug == 'releases' else f'<nav class="guide-index" aria-label="On this page"><ul>{render_links(contents)}</ul></nav>'
    sections = ''.join(render_section(section, assets) for section in data['sections'])
    if flow_title:
        sections = render_flow(flow_title, data['stages']) + sections
    if slug == 'releases':
        sections += render_releases(data['releases'])
    if data.get('links'):
        sections += f'<section><h2>Related links</h2><ul class="related">{render_links(data["links"])}</ul></section>'
    return f'''<!doctype html>
<html lang="en-IN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title} | {escape(data['project'])}</title>
  <link rel="icon" href="{assets}media/buddy-mark-v2.png" type="image/png">
  <link rel="stylesheet" href="{assets}landing.css">
  <link rel="stylesheet" href="{assets}guides.css">
</head>
<body>
  <a class="skip" href="#main">Skip to content</a>
  <header class="wrap header guide-header">
    <a class="wordmark" href="../"><span class="mark" aria-hidden="true"></span>{escape(data['project'])}</a>
    <a class="button small outline" href="https://finbuddy-2025.web.app/">Open FinBuddy</a>
  </header>
  <div class="wrap guide-layout">
    <nav class="guide-sidebar" aria-label="Documentation"><div class="guide-nav-desktop">{menu}</div>
      <details class="guide-nav-mobile"><summary>Browse guides</summary>{menu}</details>
    </nav>
    <main id="main" class="guide" tabindex="-1">
      <h1>{title}</h1>
      <p class="lead">{escape(data['intro'])}</p>
      {index}
      {sections}
    </main>
  </div>
  <footer class="footer wrap"><a href="../">{escape(data['project'])}</a><nav aria-label="Footer">
    <a href="https://finbuddy-2025.web.app/docs/">Help Center</a><a href="https://github.com/theharithsa/finbuddy">Source code</a>
  </nav></footer>
</body>
</html>
'''


def validate_guide(slug, data):
    if not data['intro'].strip():
        raise ValueError(f'{slug}: introduction is required')
    fields = [field for field in ('stages', 'links') if field in data]
    for field in fields:
        entries = data[field]
        if not isinstance(entries, list) or not entries or any(
            not isinstance(entry, list) or len(entry) != 2
            or any(not isinstance(value, str) or not value.strip() for value in entry)
            for entry in entries
        ):
            raise ValueError(f'{slug}: {field} must contain title and text pairs')
    links = list(data.get('links', []))
    sections = data['sections']
    anchors = [anchor for section in sections for anchor in (section['id'], *section.get('aliases', []))]
    if not sections or len(set(anchors)) != len(anchors):
        raise ValueError(f'{slug}: section IDs are required and must be unique')
    if any(not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', anchor) or anchor == 'sequence' for anchor in anchors):
        raise ValueError(f'{slug}: invalid section ID')
    for section in sections:
        if not section['title'].strip() or not any(section.get(field) for field in ('paragraphs', 'steps', 'table', 'code', 'links')):
            raise ValueError(f'{slug}: each section needs a title and content')
        if 'table' in section:
            header, *rows = section['table']
            if not rows or not header or any(not isinstance(row, list) or len(row) != len(header) for row in rows):
                raise ValueError(f'{slug}: tables need headings and matching rows')
        links.extend(section.get('links', []))
        if section.get('figure') and not re.fullmatch(r'[a-z0-9-]+\.jpg', section['figure'][0]):
            raise ValueError(f'{slug}: expected a guide screenshot filename')
    if slug == 'releases':
        versions = [release['version'] for release in data['releases']]
        if not versions or len(set(versions)) != len(versions) or any(
            not re.fullmatch(r'[0-9]+\.[0-9]+\.[0-9]+', version) for version in versions
        ):
            raise ValueError('Release history must contain unique version numbers.')
        for release in data['releases']:
            if not release['status'].strip() or not release['summary'].strip() or not release['links']:
                raise ValueError(f'Incomplete release {release["version"]}')
            links.extend(release['links'])
    for _, url in links:
        target = urlsplit(url)
        if (target.scheme or target.netloc) and (target.scheme != 'https' or not target.netloc):
            raise ValueError(f'{slug}: expected a local link or HTTPS URL')


def build(root, output, hosting=False):
    config = json.loads((root / 'docs/public-guides.json').read_text(encoding='utf-8'))
    if not config['project'].strip() or set(config['guides']) != set(GUIDES):
        raise ValueError('Public guide slugs must match the handbook, roadmap and release history.')
    guide_media = {section['figure'][0] for data in config['guides'].values()
                   for section in data['sections'] if section.get('figure')}
    revision = os.getenv('GITHUB_SHA') or (os.getenv('VITE_RELEASE_REVISION') if hosting else None)
    if revision and not re.fullmatch('[0-9a-f]{40}', revision):
        raise ValueError('Invalid GitHub source revision')
    if output.is_symlink():
        raise ValueError(f'Use a regular build output directory: {output}')
    output = output.resolve()
    with tempfile.TemporaryDirectory(prefix='app-launchpad-docs-') as scratch:
        staged = Path(scratch).resolve()
        guides = staged / 'docs'
        assets = staged
        static_files = ('index.html', 'landing.css', 'guides.css')
        if hosting:
            shutil.copytree(root / 'public/docs', guides, ignore=shutil.ignore_patterns('handbook'))
            shutil.copyfile(root / 'index.html', staged / 'index.html')
            guides /= 'handbook'
            assets = guides
            static_files = ('landing.css', 'guides.css')
        guides.mkdir()
        for asset in static_files:
            source = root / 'site' / asset
            if not source.is_file() or source.is_symlink():
                raise ValueError(f'Expected a regular site file at {asset}')
            shutil.copyfile(source, assets / asset)
        media = root / 'site/media'
        if media.is_dir() and not media.is_symlink():
            for source in sorted(media.iterdir()):
                allowed = source.suffix.lower() in MEDIA_SUFFIXES or source.name in MEDIA_LICENSES
                if hosting:
                    allowed = source.name in HANDBOOK_MEDIA or source.name in guide_media
                if allowed and source.is_file() and not source.is_symlink():
                    destination = assets / 'media' / source.name
                    destination.parent.mkdir(exist_ok=True)
                    shutil.copyfile(source, destination)
        for slug, data in config['guides'].items():
            validate_guide(slug, data)
            page = render(slug, {**data, 'project': config['project']}, hosting)
            if revision:
                page = page.replace('</head>', f'  <meta name="source-revision" content="{revision}">\n</head>')
            (guides / (slug + '.html')).write_text(page, encoding='utf-8')
        validate_links(staged, {*guides.glob('*.html'), staged / 'docs/index.html'} if hosting else None)
        if not hosting and output.exists() and (not output.is_dir() or any(output.iterdir())):
            raise ValueError(f'Use an empty build output directory: {output}')
        shutil.copytree(guides if hosting else staged, output, dirs_exist_ok=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--output', type=Path, help='Build GitHub Pages in an empty directory.')
    mode.add_argument('--hosting', action='store_true', help='Generate the Firebase handbook in public/docs/handbook.')
    args = parser.parse_args()
    try:
        if args.output:
            build(ROOT, args.output)
        elif args.hosting:
            build(ROOT, ROOT / 'public/docs/handbook', hosting=True)
        else:
            with tempfile.TemporaryDirectory(prefix='app-launchpad-docs-check-') as scratch:
                build(ROOT, Path(scratch) / 'pages')
                build(ROOT, Path(scratch) / 'hosting', hosting=True)
        print('Public documentation build and local links passed.')
    except (OSError, ValueError, KeyError, TypeError, AttributeError) as error:
        raise SystemExit(f'Public documentation build failed: {error}')
