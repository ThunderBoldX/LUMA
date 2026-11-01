"""Create a portable release using an explicit allowlist, excluding all user data."""
from pathlib import Path
import hashlib
import json
import shutil
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parent.parent
version = json.loads((root / 'package.json').read_text(encoding='utf-8'))['version']
folder = root / 'release' / 'LUMA'
files = ['LUMA.exe', 'LUMA.ico', 'luma.cjs', 'discord-presence.cjs',
         'LUMA-Discord.png', 'START-LUMA.cmd', 'ПОЧАТИ-ТУТ.txt',
         'LICENSE', 'THIRD-PARTY-NOTICES.md']
for name in ['LICENSE', 'THIRD-PARTY-NOTICES.md']:
    shutil.copyfile(root / name, folder / name)
archive_path = root / 'release' / f'LUMA-v{version}-windows-x64.zip'
with ZipFile(archive_path, 'w', ZIP_DEFLATED, compresslevel=9) as archive:
    for name in files:
        assert (folder / name).is_file(), name
        archive.write(folder / name, 'LUMA/' + name)
with ZipFile(archive_path) as archive:
    assert archive.testzip() is None
    assert len(archive.namelist()) == len(files)
digest = hashlib.sha256(archive_path.read_bytes()).hexdigest()
(root / 'release' / 'SHA256SUMS.txt').write_text(f'{digest}  {archive_path.name}\n', encoding='ascii')
print(f'Built {archive_path.name}: {archive_path.stat().st_size} bytes\nSHA256 {digest}')
