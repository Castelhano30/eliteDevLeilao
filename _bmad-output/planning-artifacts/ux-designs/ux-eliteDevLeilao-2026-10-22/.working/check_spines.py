"""Check local links and token references in the UX contracts (stdlib only).

This checks indentation-based token paths, not full YAML schema validity.
Run from the repository root with uv run <this file>.
"""
import json
import re
from pathlib import Path
from urllib.parse import unquote

root = Path('_bmad-output/planning-artifacts')
design = (root / 'DESIGN.md').read_text(encoding='utf-8-sig')
paths = set()
stack = []
for line in design.split('---', 2)[1].splitlines():
    match = re.match(r'^( *)([\w-]+|\x27[^\x27]+\x27):(?:\s|$)', line)
    if not match:
        continue
    indent, key = len(match[1]), match[2].strip("'")
    while stack and stack[-1][0] >= indent:
        stack.pop()
    stack.append((indent, key))
    paths.add('.'.join(item[1] for item in stack))

errors = []
counts = {}
for name in ['DESIGN.md', 'EXPERIENCE.md']:
    content = (root / name).read_text(encoding='utf-8-sig')
    refs = set(re.findall(r'\{((?:colors|typography|components|spacing|rounded|shadows|borders)\.[\w.-]+)\}', content))
    for ref in sorted(refs):
        if ref.endswith('.x'):  # Syntax examples in the conventions paragraph.
            continue
        if ref in paths:
            continue
        if ref.startswith('colors.') and all('colors.' + theme + '.' + ref[7:] in paths for theme in ['claro', 'noite']):
            continue
        errors.append(f'{name}: missing token {ref}')
    links = [angle or plain for angle, plain in re.findall(r'\]\((?:<([^>]+)>|([^\s)]+))\)', content)]
    for target in links:
        target = unquote(target.strip('<>').split('#')[0])
        if not target or re.match(r'^[a-z]+://', target):
            continue
        if not (root / target).exists():
            errors.append(f'{name}: broken local link {target}')
    counts[name] = {'unique_token_references': len(refs), 'markdown_links': len(links)}

print(json.dumps({'scope': 'token paths and local Markdown links; not full YAML validation', 'counts': counts, 'errors': errors}, ensure_ascii=False, indent=2))
raise SystemExit(bool(errors))
