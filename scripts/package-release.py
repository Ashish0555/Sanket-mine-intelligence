"""Package a local release while keeping real credentials and runtime files out."""
from pathlib import Path
import argparse
import hashlib
import json
import re
import zipfile

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('output', nargs='?', default=str(root.parent / 'SANKET_Mining_Assistant_Updated.zip'))
target = Path(parser.parse_args().output).resolve()
target.parent.mkdir(parents=True, exist_ok=True)
excluded = {'node_modules', 'dist', 'work', 'outputs', '.sites-runtime', '.wrangler', '.git', '.next', '.vinext', '.agents', '.codex', '.venv', '__pycache__', 'examples'}
template = (root / '.env.example').read_text()
assert re.search(r'^GEMINI_API_KEY=\s*$', template, re.M), 'The public template must have an empty key'
prefix = 'SANKET_Mining_Assistant/'
files = []
for file in sorted(root.rglob('*')):
    rel = file.relative_to(root)
    if not file.is_file() or file.is_symlink() or excluded.intersection(rel.parts):
        continue
    if (file.name.startswith('.env') and file.name != '.env.example') or file.name.startswith('.dev.vars'):
        continue
    if file.name in {'.DS_Store', '.npmrc', '.yarnrc', '.yarnrc.yml'} or file.suffix in {'.zip', '.log', '.tsbuildinfo', '.pyc', '.pem', '.key'}:
        continue
    if file.suffix != '.pdf':
        content = file.read_text(errors='ignore')
        assert not re.search(r'AIza[0-9A-Za-z_-]{35}', content), 'A potential credential was found; release stopped'
    files.append((file, prefix + rel.as_posix()))
with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for file, name in files:
        archive.write(file, name)
    env_info = zipfile.ZipInfo(prefix + '.env')
    env_info.external_attr = 0o100600 << 16
    archive.writestr(env_info, template, compress_type=zipfile.ZIP_DEFLATED)
with zipfile.ZipFile(target) as archive:
    assert archive.testzip() is None
    required = ['.env', '.env.example', 'START_HERE.txt', 'README.md', 'package.json', 'package-lock.json', 'data/documents.json', 'data/retrieval-model.json', 'public/sources/SANKET_Coal.pdf', 'public/sources/SANKET_NonCoal.pdf', 'Launch on Mac.command', 'Launch on Windows.bat']
    for name in required:
        assert prefix + name in archive.namelist(), name
    assert archive.read(prefix + '.env').decode() == template
    assert not any('api/connect/' in name for name in archive.namelist())
    manifest = json.loads(archive.read(prefix + 'data/manifest.json'))
    for book in manifest['books']:
        content = archive.read(prefix + 'public/sources/' + book['filename'])
        assert hashlib.sha256(content).hexdigest() == book['sha256']
print(json.dumps({'file': str(target), 'files': len(files) + 1, 'sizeMB': round(target.stat().st_size / 1_000_000, 2), 'verified': True}))
