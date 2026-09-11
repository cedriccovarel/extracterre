from pathlib import Path
import re
root=Path(__file__).parent
order=['config.js','utils.js','insulation-library.js','buildings.js','classifier.js','readers.js','routing.js','parsers.js','tags.js','engine.js','economics.js','exporter.js','persistence.js','app.js']
parts=["/* ExtracTerre bundled runtime v1.1.5 - compatible file:// and GitHub Pages */\n(function(){\n'use strict';\n"]
for name in order:
    text=(root/'js'/name).read_text()
    text=re.sub(r'^import\s+.*?;\s*$', '', text, flags=re.M)
    text=re.sub(r'^export\s+', '', text, flags=re.M)
    parts.append(f"\n/* ---- {name} ---- */\n{text.strip()}\n")
parts.append("\n})();\n")
(root/'js'/'app.bundle.js').write_text(''.join(parts))
