import os
import re
import glob

pages_dir = '/home/wppjkw/SmartPhoto/client/src/pages/create/'

def update_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # 1. Update root container backgrounds
    def root_replacer(match):
        inner = match.group(1)
        # remove background colors and gradients completely
        inner = re.sub(r'\bbg-(white|slate-50|gray-50|\[#f5f6f8\]|gradient-\S+)\b', '', inner)
        inner = re.sub(r'\bfrom-\S+\b', '', inner)
        inner = re.sub(r'\bto-\S+\b', '', inner)
        inner = re.sub(r'\bvia-\S+\b', '', inner)
        inner = re.sub(r'\s+', ' ', inner).strip()
        inner_str = f' className="min-h-screen tech-bg {inner}" '
        return inner_str.replace('  ', ' ')
        
    content = re.sub(r'\sclassName="min-h-screen([^"]*)"\s', root_replacer, content)

    # 2. Update white cards to glass-panel
    def card_replacer(match):
        inner = match.group(1)
        # replace bg-white with glass-panel and remove shadow-lg
        inner = re.sub(r'\bbg-(?:white|\[#ffffff\])\b', 'glass-panel text-slate-800', inner)
        inner = re.sub(r'\bshadow-lg\b', '', inner)
        inner = re.sub(r'\bshadow-slate-100\b', '', inner)
        inner = re.sub(r'\s+', ' ', inner).strip()
        return f' className="{inner}" '
        
    content = re.sub(r'\sclassName="([^"]*rounded-\[?(?:32|24)px\]?[^"]*)"\s', card_replacer, content)

    # 3. Update main action buttons
    def btn_replacer(match):
        inner = match.group(1)
        # replace bg-blue-500 with sci-fi-button
        if 'text-white' in inner and 'bg-blue-500' in inner:
            inner = re.sub(r'\bbg-blue-\d+\b', '', inner)
            inner = re.sub(r'\bhover:bg-blue-\d+\b', '', inner)
            inner = re.sub(r'\bshadow-lg\b', '', inner)
            inner = re.sub(r'\bshadow-blue-\d+\b', '', inner)
            inner += ' sci-fi-button'
            inner = re.sub(r'\s+', ' ', inner).strip()
        return f' className="{inner}" '

    content = re.sub(r'\sclassName="([^"]*text-white[^"]*bg-blue-500[^"]*)"\s', btn_replacer, content)

    with open(filepath, 'w') as f:
        f.write(content)

for filepath in glob.glob(os.path.join(pages_dir, '*.tsx')):
    update_file(filepath)

print("UI update script finished.")
