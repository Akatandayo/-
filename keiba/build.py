#!/usr/bin/env python3
"""index.html と css/js を1つのHTMLファイルにまとめる（dist/keiba-card-game.html）。"""
import os
import re

ROOT = os.path.dirname(os.path.abspath(__file__))


def read(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return f.read()


html = read('index.html')
html = re.sub(r'<link rel="stylesheet" href="([^"]+)">',
              lambda m: '<style>\n' + read(m.group(1)) + '</style>', html)
html = re.sub(r'<script src="([^"]+)"></script>',
              lambda m: '<script>\n' + read(m.group(1)).replace('</script', '<\\/script') + '</script>', html)

os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
out = os.path.join(ROOT, 'dist', 'keiba-card-game.html')
with open(out, 'w', encoding='utf-8') as f:
    f.write(html)
print(out, len(html.encode('utf-8')), 'bytes')
