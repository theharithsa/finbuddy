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

from public_site import APP_ORIGIN, ERRORS, LEGACY, document, error_page, footer, header, moved_page

ROOT = Path(__file__).resolve().parents[1]
GUIDES = {
    'index': 'Help center',
    'product': 'Product handbook',
    'technical': 'Technical guide',
    'settings': 'Settings reference',
    'sdlc': 'SDLC guide',
    'pipeline': 'CI/CD pipeline',
    'roadmap': 'Roadmap',
    'releases': 'Release history',
    'privacy-policy': 'Privacy policy',
    'terms-and-conditions': 'Terms of use',
    'security': 'Security',
    'troubleshooting': 'Troubleshooting',
    'mobile': 'FinBuddy on your phone',
    'feature-availability': 'Feature availability',
}
MEDIA_SUFFIXES = {'.jpg', '.jpeg', '.png', '.webp', '.avif', '.mp4', '.webm', '.vtt', '.woff2'}
MEDIA_LICENSES = {'google-sans-OFL.txt'}
GUIDE_GROUPS = {
    'Using FinBuddy': ('index', 'product', 'settings', 'mobile', 'troubleshooting'),
    'For developers': ('technical', 'sdlc', 'pipeline'),
    'Project updates': ('feature-availability', 'roadmap', 'releases'),
    'Privacy and support': ('privacy-policy', 'terms-and-conditions', 'security'),
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


def validate_links(output, hosting=False):
    pages = {file: Page(file.read_text(encoding='utf-8')) for file in output.rglob('*.html')}
    for file, page in pages.items():
        for link in page.links:
            url = urlsplit(link)
            if url.scheme or url.netloc:
                continue
            path = unquote(url.path)
            if not hosting and path.startswith('/finbuddy/'):
                target = (output / path.removeprefix('/finbuddy/')).resolve()
            elif path.startswith('/') and hosting:
                target = (output / path.lstrip('/')).resolve()
            elif path.startswith('/'):
                raise ValueError(f'{file.relative_to(output)}: link escapes the project site: {link}')
            else:
                target = (file.parent / path).resolve() if path else file
            if not target.is_relative_to(output):
                raise ValueError(f'{file.relative_to(output)}: link leaves the output: {link}')
            relative = target.relative_to(output).as_posix()
            if hosting and (relative in {'app', 'signin', 'finvision'} or relative.startswith('api/v1/')):
                continue
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
        body += f'<div class="guide-table"><table><thead><tr>{header}</tr></thead><tbody>{cells}</tbody></table></div>'
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
    assets = '../'
    app = '../' if hosting else APP_ORIGIN + '/'
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
    content = f'''<div class="wrap guide-layout">
      <nav class="guide-sidebar" aria-label="Documentation"><div class="guide-nav-desktop">{menu}</div>
        <details class="guide-nav-mobile"><summary>Browse guides</summary>{menu}</details></nav>
      <main id="main" class="guide" tabindex="-1">
        <h1>{escape(title)}</h1><p class="lead">{escape(data['intro'])}</p>{index}{sections}
      </main></div>'''
    content = content.replace('href="' + APP_ORIGIN + '/docs/"', 'href="index.html"')
    content = content.replace('href="' + APP_ORIGIN + '/docs/', 'href="')
    if hosting:
        content = content.replace('href="' + APP_ORIGIN + '/', 'href="../')
    return document(title, data['intro'], assets, app, content)


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
        if target.scheme == 'mailto' and re.fullmatch(r'[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}', target.path) and not target.query and not target.fragment:
            continue
        if (target.scheme or target.netloc) and (target.scheme != 'https' or not target.netloc):
            raise ValueError(f'{slug}: expected a local link or HTTPS URL')


def build(root, output, hosting=False, environment='prod'):
    config = json.loads((root / 'docs/public-guides.json').read_text(encoding='utf-8'))
    guides = config['guides']
    if set(guides) != set(GUIDES):
        raise ValueError('The public guide catalog and navigation must match.')
    revision = os.getenv('FINBUDDY_SOURCE_REVISION') or os.getenv('VITE_RELEASE_REVISION') or os.getenv('GITHUB_SHA')
    if revision and not re.fullmatch('[0-9a-f]{40}', revision):
        raise ValueError('Invalid source revision')
    if output.is_symlink():
        raise ValueError(f'Use a regular build output directory: {output}')
    output = output.resolve()
    app = '' if hosting else APP_ORIGIN + '/'
    marker = f'<meta name="source-revision" content="{revision}">' if revision else ''
    with tempfile.TemporaryDirectory(prefix='finbuddy-site-') as scratch:
        staged = Path(scratch).resolve()

        def write(relative, html):
            path = staged / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(html.replace('</head>', marker + '</head>'), encoding='utf-8')

        if hosting:
            for name in ('icons', 'icon-licenses', 'font-licenses'):
                shutil.copytree(root / 'public' / name, staged / name)
            for name in ('manifest.json', 'sw.js', 'favicon.ico'):
                shutil.copyfile(root / 'public' / name, staged / name)
        for name in ('landing.css', 'guides.css', 'guide-redirect.js', *(('entry.js',) if hosting else ())):
            shutil.copyfile(root / 'site' / name, staged / name)
        (staged / 'media').mkdir()
        for source in (root / 'site/media').iterdir():
            if source.is_file() and not source.is_symlink() and (source.suffix in MEDIA_SUFFIXES or source.name in MEDIA_LICENSES):
                shutil.copyfile(source, staged / 'media' / source.name)
        home = (root / 'site/index.html').read_text(encoding='utf-8')
        home = home.replace('<!-- public-header -->', header('', app)).replace('<!-- public-footer -->', footer(''))
        if hosting:
            platform = (f'<meta name="finbuddy-environment" content="{environment}"><meta name="finbuddy-firebase-project" content="finbuddy-2025">'
                        f'<meta name="finbuddy-revision" content="{revision or "local"}"><meta name="referrer" content="no-referrer">'
                        '<link rel="manifest" href="/manifest.json"><link rel="icon" type="image/png" href="/icons/buddy-favicon-v2.png">'
                        '<link rel="apple-touch-icon" href="/icons/buddy-touch-v2.png"><script src="/entry.js"></script>')
            if environment == 'preprod':
                home = home.replace('<body>', '<body><aside class="public-preprod">Pre-production · Synthetic data only</aside>')
                platform += '<meta name="robots" content="noindex">'
        else:
            platform = '<link rel="icon" href="media/buddy-mark-v2.png" type="image/png">'
            for route in ('app?demo=1', 'signin', 'finvision?demo=1'):
                home = home.replace(f'href="{route}"', f'href="{app}{route}"')
        write('index.html', home.replace('<!-- platform-head -->', platform))
        for slug, data in guides.items():
            validate_guide(slug, data)
            write('docs/' + slug + '.html', render(slug, {**data, 'project': config['project']}, hosting))
        aliases = {**LEGACY, **{f'docs/handbook/{key}.html': f'docs/{key}.html' for key in guides}}
        for name, target in aliases.items():
            prefix = '../' * name.count('/')
            write(name, moved_page(target, prefix, prefix if hosting else app))
        # Old hosted handbooks linked directly to their screenshots and local font.
        legacy_assets = staged / 'docs/handbook/media'
        legacy_assets.mkdir()
        for name in ('home.jpg', 'expenses.jpg', 'bills.jpg', 'savings.jpg', 'finvision.jpg',
                     'buddy-mark-v2.png', 'google-sans-latin-wght-normal.woff2', 'google-sans-OFL.txt'):
            shutil.copyfile(staged / 'media' / name, legacy_assets / name)
        for name in ('landing.css', 'guides.css'):
            (legacy_assets.parent / name).write_text(f'@import url("../../{name}");\n', encoding='utf-8')
        for code in ERRORS:
            write(f'errors/{code}.html', error_page(code, '../', '../' if hosting else app))
        # The host returns this document for a missing URL at any depth.
        mount = '/' if hosting else '/finbuddy/'
        write('404.html', error_page(404, mount, mount if hosting else app))
        validate_links(staged, hosting)
        if output.exists() and (not output.is_dir() or any(output.iterdir())):
            raise ValueError(f'Use an empty build output directory: {output}')
        shutil.copytree(staged, output, dirs_exist_ok=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, help='Write the verified site to an empty directory.')
    parser.add_argument('--hosting', action='store_true', help='Use same-origin workspace and API links.')
    parser.add_argument('--environment', choices=('prod', 'preprod'), default='prod')
    args = parser.parse_args()
    try:
        if args.output:
            build(ROOT, args.output, args.hosting, args.environment)
        else:
            with tempfile.TemporaryDirectory(prefix='finbuddy-docs-check-') as scratch:
                build(ROOT, Path(scratch) / 'pages')
                build(ROOT, Path(scratch) / 'hosting', True)
        print('Public site, documentation and local links passed.')
    except (OSError, ValueError, KeyError, TypeError, AttributeError) as error:
        raise SystemExit(f'Public site build failed: {error}')
