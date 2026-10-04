"""Read-only asset checks; writes only the validation report and prompt transcript."""
import json, hashlib, sys
from pathlib import Path
import numpy as np
from PIL import Image, __version__ as pillow_version
import process

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
OUT=ROOT/'assets/pixel/units-v2'
meta=json.loads((OUT/'sprites.json').read_text(encoding='utf-8'))
expected={n for u in process.UNITS for n in (u['id'],'dead-'+u['id'])}
assert set(meta['sprites'])==expected and len(expected)==44
process.verify(meta)
report={'units':len(process.UNITS),'sprites':len(expected),'format':'32x32 indexed PNG, bit depth 4, binary alpha, <=16 used colors',
        'rgb5Exception':[12,14,18],'python':sys.version.split()[0],'pillow':pillow_version,'numpy':np.__version__,
        'oldAtlasesUnchanged':[],'sprites':{}}
generation=json.loads((HERE/'generation.json').read_text(encoding='utf-8'))
assert {u['id'] for u in generation['units']}=={u['id'] for u in process.UNITS}
for e in generation['units']:
    assert e['prompt'] and e['generatedOriginal']
for name,entry in meta['sprites'].items():
    p=OUT/entry['file']; im=Image.open(p); palette=im.getpalette(); rgba=im.convert('RGBA')
    assert [palette[i*3:i*3+3] for i in range(entry['colors'])]==entry['palette'],name
    assert len(im.getcolors())==entry['colors'],name
    assert process.sha(ROOT/entry['source'])==entry['source_sha256'],name
    assert (np.asarray(im)==1).any(),name
    report['sprites'][name]={'sha256':entry['sha256'],'colors':entry['colors'],'bounds':list(rgba.getbbox())}
for old in json.loads((HERE/'protected-files.json').read_text(encoding='utf-8-sig')):
    assert process.sha(Path(old['Path'])).upper()==old['Hash'],old['Path']
    report['oldAtlasesUnchanged'].append({'path':str(Path(old['Path']).relative_to(ROOT)).replace('\\','/'),'sha256':old['Hash'].lower()})
(HERE/'validation/format-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
prompt=['# Unit sprites v2 — actual generation prompts','',
        'Generated 2026-10-04 with the builtin image generator. Each call produced one unit, left standing / right corpse.',
        'Style reference for every call: `assets/pixel/preview-4x.png`. Reference is not an edit target.',
        'All 22 source pairs are Codex delivery v1 selections, not individual user approvals. No user pixel edits.',
        'The user explicitly approved retaining the existing (12,14,18) outline as the only RGB5 exception.','']
for u in generation['units']:
    prompt+=['## '+u['id'],'','Source copy: `sources/'+u['id']+'.png`','',u['prompt'],'']
(HERE/'PROMPT.md').write_text('\n'.join(prompt),encoding='utf-8')
print(json.dumps({'units':report['units'],'sprites':len(report['sprites']),'protectedAtlases':len(report['oldAtlasesUnchanged']),'result':'PASS'}))
