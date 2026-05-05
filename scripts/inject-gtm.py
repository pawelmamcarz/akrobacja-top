#!/usr/bin/env python3
"""Inject Google Tag Manager snippets into all HTML files under public/."""
import os
import re
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..", "public")

GTM_HEAD = """<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-N92DVP6H');</script>
<!-- End Google Tag Manager -->
"""

GTM_BODY = """<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-N92DVP6H"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->
"""

HEAD_RE = re.compile(r"(<head\s*>)", re.IGNORECASE)
BODY_RE = re.compile(r"(<body\b[^>]*>)", re.IGNORECASE)

processed = 0
skipped = 0
missing_head = []
missing_body = []
already = []

for dirpath, _, files in os.walk(ROOT):
    for name in files:
        if not name.endswith(".html"):
            continue
        path = os.path.join(dirpath, name)
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()

        if "GTM-N92DVP6H" in content:
            already.append(path)
            skipped += 1
            continue

        head_match = HEAD_RE.search(content)
        body_match = BODY_RE.search(content)
        if not head_match:
            missing_head.append(path)
            continue
        if not body_match:
            missing_body.append(path)
            continue

        new_content = HEAD_RE.sub(
            lambda m: m.group(1) + "\n" + GTM_HEAD.rstrip() + "\n", content, count=1
        )
        new_content = BODY_RE.sub(
            lambda m: m.group(1) + "\n" + GTM_BODY.rstrip() + "\n", new_content, count=1
        )

        with open(path, "w", encoding="utf-8") as f:
            f.write(new_content)
        processed += 1

print(f"Processed: {processed}")
print(f"Already present (skipped): {skipped}")
if already:
    for p in already[:5]:
        print(f"  - {p}")
if missing_head:
    print(f"Missing <head>: {len(missing_head)}")
    for p in missing_head[:5]:
        print(f"  - {p}")
if missing_body:
    print(f"Missing <body>: {len(missing_body)}")
    for p in missing_body[:5]:
        print(f"  - {p}")

sys.exit(0)
