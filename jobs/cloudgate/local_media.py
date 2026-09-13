"""PNG storage for the loopback preview. Hosted apps use Cloudgate's IdP file service."""
import base64
import binascii
import hashlib
import json
import re
import struct
from pathlib import Path
from datetime import datetime, timezone
from urllib.parse import urlparse

MAX_BYTES = 4 * 1024 * 1024

def validate_png(data):
    if len(data) > MAX_BYTES or not data.startswith(b'\x89PNG\r\n\x1a\n'):
        raise ValueError('Upload a PNG image under 4 MB.')
    offset, first, ended, pixels = 8, True, False, False
    while offset + 12 <= len(data):
        size = struct.unpack('>I', data[offset:offset+4])[0]
        kind = data[offset+4:offset+8]
        end = offset + 12 + size
        if end > len(data): raise ValueError('Incomplete PNG image.')
        payload = data[offset+8:offset+8+size]
        crc = struct.unpack('>I', data[offset+8+size:end])[0]
        if binascii.crc32(kind+payload) & 0xffffffff != crc: raise ValueError('Invalid PNG image.')
        if first:
            if kind != b'IHDR' or size != 13: raise ValueError('Invalid PNG header.')
            width, height = struct.unpack('>II', payload[:8])
            if not 1 <= width <= 2048 or not 1 <= height <= 2048: raise ValueError('Images must be at most 2048 pixels per side.')
            first = False
        if kind == b'IDAT': pixels = True
        if kind == b'IEND':
            ended = size == 0 and end == len(data)
            break
        offset = end
    if not ended or not pixels: raise ValueError('Incomplete PNG image.')

def upload(directory, content, name, path='jobs/branding'):
    if not re.fullmatch(r'jobs/(?:[A-Za-z0-9_-]+/)*[A-Za-z0-9_-]+', str(path)):
        raise ValueError('Choose a Jobs media folder.')
    try: data = base64.b64decode(content, validate=True)
    except (ValueError, TypeError, binascii.Error): raise ValueError('Invalid image encoding.')
    validate_png(data)
    directory = Path(directory); directory.mkdir(parents=True, exist_ok=True)
    key = hashlib.sha256(path.encode()+b'\x00'+data).hexdigest()
    item = {'id': key, 'name': str(name or 'Image')[:120], 'path': path, 'createdAt': datetime.now(timezone.utc).isoformat(), 'url': '/api/branding-media/'+key+'.png', 'size': len(data)}
    (directory/(key+'.png')).write_bytes(data)
    (directory/(key+'.json')).write_text(json.dumps(item), encoding='utf-8')
    return item

def listing(directory, skip=0, take=36, path='*'):
    files = sorted(Path(directory).glob('*.json'), key=lambda p: p.stat().st_mtime, reverse=True)
    skip, take = max(0, int(skip)), max(1, min(100, int(take)))
    items = []
    for file in files:
        item = json.loads(file.read_text(encoding='utf-8'))
        item.setdefault('path', 'jobs/branding')
        if path in ('', '*') or item['path'] == path: items.append(item)
    return {'total': len(items), 'items': items[skip:skip+take]}


def delete(directory, key, references=()):
    if not re.fullmatch(r'[a-f0-9]{64}', str(key)): raise ValueError('Invalid image identifier.')
    directory = Path(directory)
    metadata = directory/(key+'.json')
    if not metadata.is_file(): raise ValueError('Image not found.')
    item = json.loads(metadata.read_text(encoding='utf-8'))
    if not str(item.get('path', 'jobs/branding')).startswith('jobs/'):
        raise ValueError('Only Jobs images can be deleted here.')
    if any(urlparse(str(value or '')).path == item['url'] for value in references):
        raise ValueError('This image is in use. Remove it from its service or branding setting first.')
    (directory/(key+'.png')).unlink(missing_ok=True)
    metadata.unlink()
    return {'id': key, 'deleted': True}

def read_image(directory, route):
    match = re.fullmatch(r'/api/branding-media/([a-f0-9]{64}\.png)', route)
    if not match: return None
    path = Path(directory)/match[1]
    return path.read_bytes() if path.is_file() else None
