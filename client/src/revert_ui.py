import os
import re
import glob

pages_dir = '/home/wppjkw/SmartPhoto/client/src/pages/create/'
history_file = '/home/wppjkw/SmartPhoto/client/src/pages/History.tsx'

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Dark text to light text
    content = content.replace('text-white', 'text-slate-900')
    content = content.replace('text-slate-200', 'text-slate-700')
    content = content.replace('text-slate-300', 'text-slate-600')
    content = content.replace('text-slate-400', 'text-slate-500')
    
    # Borders
    content = content.replace('border-white/10', 'border-slate-200')
    content = content.replace('border-white/20', 'border-slate-300')
    content = content.replace('border-white/5', 'border-slate-200')
    
    # Backgrounds
    content = content.replace('bg-black/20', 'bg-slate-50')
    content = content.replace('bg-black/40', 'bg-white/80')
    content = content.replace('bg-black/60', 'bg-white')
    content = content.replace('bg-white/5', 'bg-slate-100')
    content = content.replace('bg-white/10', 'bg-slate-200')
    
    # Ensure button text is white when it should be
    # Actually wait. `text-slate-900` within sci-fi-button is wrong.
    # We can fix that with a regex.
    def button_fixer(match):
        inner = match.group(0)
        return inner.replace('text-slate-900', 'text-white')
    content = re.sub(r'className="[^"]*sci-fi-button[^"]*"', button_fixer, content)
    
    # AnalyzeStep needs specific fixes:
    if 'AnalyzeStep.tsx' in filepath:
        # Revert text-slate-900 to text-white for the scanning box text if any.
        # Ensure scanning box is dark.
        # Find the scanning box:
        def scanning_box_fixer(match):
            inner = match.group(0)
            return inner.replace('glass-panel', 'bg-[#050914]')
            
        content = re.sub(r'<div className="relative mb-5 flex h-\[340px\][^>]+>', scanning_box_fixer, content)
        
        # We need the "识别进度" / "识别结果" etc to just rely on the new light text.

    with open(filepath, 'w') as f:
        f.write(content)

for filepath in glob.glob(os.path.join(pages_dir, '*.tsx')):
    process_file(filepath)
    
if os.path.exists(history_file):
    process_file(history_file)

print("UI reversion to bright theme completed locally.")
