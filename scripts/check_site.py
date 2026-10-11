# -*- coding: utf-8 -*-
"""Offline checks for preserved routes, local references, and public-page privacy."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
ROUTES = ['index.html', 'about.html', 'experience.html', 'projects.html', 'notes.html', 'contact.html']

class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.duplicates = []
        self.refs = []
        self.h1 = 0
        self.errors = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'h1':
            self.h1 += 1
        identity = attrs.get('id')
        if identity:
            if identity in self.ids:
                self.duplicates.append(identity)
            self.ids.add(identity)
        for key in ('href', 'src'):
            if attrs.get(key):
                self.refs.append(attrs[key])
        if tag == 'img' and 'alt' not in attrs:
            self.errors.append('Image missing alt text')
        if tag == 'a' and attrs.get('target') == '_blank' and 'noopener' not in attrs.get('rel', '').split():
            self.errors.append('External new-tab link missing noopener')

pages = {}
errors = []
for name in ROUTES:
    path = ROOT / name
    if not path.is_file():
        errors.append(f'Missing preserved route: {name}')
        continue
    text = path.read_text(encoding='utf-8')
    parser = Page()
    parser.feed(text)
    pages[name] = parser
    if parser.h1 != 1:
        errors.append(f'{name}: expected one h1, got {parser.h1}')
    if parser.duplicates:
        errors.append(f'{name}: duplicate IDs: {parser.duplicates}')
    errors.extend(f'{name}: {message}' for message in parser.errors)
    for forbidden in ['tel:', '15347144219', '2005/02', '工作经历', '京东', '北京抖知', '闫爽.pdf']:
        if forbidden in text:
            errors.append(f'{name}: excluded personal/history content: {forbidden}')

checked = 0
external = set()
for name, page in pages.items():
    for ref in page.refs:
        url = urlsplit(ref)
        if url.scheme in ('http', 'https'):
            external.add(ref)
            continue
        if url.scheme:
            continue
        target = (ROOT / unquote(url.path)).resolve() if url.path else ROOT / name
        if not target.is_relative_to(ROOT):
            errors.append(f'{name}: path outside site root: {ref}')
        elif not target.is_file():
            errors.append(f'{name}: broken local reference: {ref}')
        elif url.fragment and target.suffix == '.html':
            dest = pages.get(target.name)
            if not dest or unquote(url.fragment) not in dest.ids:
                errors.append(f'{name}: missing fragment: {ref}')
        checked += 1

result = {'pages': len(pages), 'local_references_checked': checked, 'external_links': sorted(external), 'errors': errors}
print(json.dumps(result, ensure_ascii=False, indent=2))
sys.exit(bool(errors))
