"""Fail-closed privacy scan of release packages (never modifies input).

Private terms live in BUILD_PRIVATE_TERMS (comma separated), never in packages.
Uses only the Python standard library. Reports file names, never matched secrets.
"""
import argparse
import gzip
import io
import json
import os
from pathlib import Path
import re
import zipfile
import zlib
import stat

LIMIT = 512 * 1024 * 1024

def bounded_read(stream):
    data = stream.read(LIMIT + 1)
    if len(data) > LIMIT:
        raise ValueError('Archive member exceeds scan limit')
    return data

def scan_archive(name, archive, terms, depth):
    issues = scan_bytes(name + '!comment', archive.comment, terms, depth)
    for entry in archive.infolist():
        if stat.S_ISLNK(entry.external_attr >> 16):
            raise ValueError('Archive symlinks are not permitted')
        label = name + '!' + entry.filename
        issues += scan_bytes(label + '!metadata', entry.comment + entry.extra, terms, depth)
        if entry.is_dir():
            issues += scan_bytes(label, b'', terms, depth)
        else:
            if entry.file_size > LIMIT:
                raise ValueError('Archive member exceeds scan limit')
            with archive.open(entry) as stream:
                issues += scan_bytes(label, bounded_read(stream), terms, depth)
    return issues


LOCAL_PATH = re.compile(rb'(?:/Users/[^/\x00\s]+/|/home/(?!web_user(?:[^A-Za-z0-9_]|$))[^/\x00\s]+/|[A-Za-z]:[\\/]Users[\\/]|\.(?:claude|codex)[\\/]worktrees[\\/])', re.I)
PRIVATE_FILE = re.compile(r'(?:^|[!/])(?:\.git|\.env(?:\..*)?|CMakeCache\.txt|build\.ninja|.*\.(?:pdb|map|dSYM))(?:/|$)', re.I)


def scan_bytes(name, data, terms, depth=0):
    if depth > 8 or len(data) > LIMIT:
        raise ValueError('Archive scan limit exceeded')
    # Melee asset blocks use zlib even though their filename ends in .bin.
    # A zlib stream has no text metadata; inspect the decoded contents, not coincidental compressed bytes.
    if len(data) >= 2 and data[0] == 0x78 and (data[0] * 256 + data[1]) % 31 == 0:
        try:
            decoder = zlib.decompressobj()
            decoded = decoder.decompress(data, LIMIT + 1)
            if len(decoded) > LIMIT or decoder.unconsumed_tail:
                raise ValueError('Decompressed data exceeds scan limit')
            if not decoder.eof or decoder.unused_data:
                raise ValueError('Truncated or trailing compressed data')
        except zlib.error:
            pass
        else:
            return scan_plain(name, b'', terms) + scan_bytes(name + '!zlib', decoded, terms, depth + 1)
    issues = scan_plain(name, b'', terms)
    if data.startswith(b'\x1f\x8b'):
        # Gzip optional header fields can identify the build machine; compressed bytes cannot.
        if len(data) < 10 or data[2] != 8 or data[3] & 0xe0:
            raise ValueError('Invalid gzip header')
        cursor = 10
        if data[3] & 4:
            if cursor + 2 > len(data):
                raise ValueError('Truncated gzip header')
            length = int.from_bytes(data[cursor:cursor+2], 'little')
            issues += scan_plain(name + '!extra', data[cursor+2:cursor+2+length], terms)
            cursor += 2 + length
        for flag in (8, 16):
            if data[3] & flag:
                end = data.find(b'\x00', cursor)
                if end < 0:
                    raise ValueError('Truncated gzip header')
                issues += scan_plain(name + '!header', data[cursor:end], terms)
                cursor = end + 1
        decoder = zlib.decompressobj(31)
        decoded = decoder.decompress(data, LIMIT + 1)
        if len(decoded) > LIMIT or decoder.unconsumed_tail:
            raise ValueError('Decompressed data exceeds scan limit')
        if not decoder.eof or decoder.unused_data:
            raise ValueError('Truncated or concatenated gzip data')
        return issues + scan_bytes(name + '!gzip', decoded, terms, depth + 1)
    if zipfile.is_zipfile(io.BytesIO(data)):
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            return issues + scan_archive(name, archive, terms, depth + 1)
    if name.lower().endswith(('.zip', '.o2r', '.gz', '.br', '.7z', '.rar')):
        raise ValueError('Unrecognized or unsupported compressed file: ' + name)
    return scan_plain(name, data, terms)


def scan_plain(name, data, terms):
    issues = []
    if PRIVATE_FILE.search(name.replace('\\', '/')):
        issues.append({'file': name, 'reason': 'development file'})
    # Search UTF-16 identifiers directly; only decode UTF-16 when a path prefix exists.
    lower = data.lower()
    texts = [data]
    for encoding in ('utf-16-le', 'utf-16-be'):
        if any(p.encode(encoding) in lower for p in ('/users/', '/home/', ':\\users\\', ':/users/', '.claude', '.codex')):
            texts.extend(data[offset:].decode(encoding, errors='ignore').encode('utf-8') for offset in (0, 1))
    if LOCAL_PATH.search(name.encode()) or any(LOCAL_PATH.search(t) for t in texts):
        issues.append({'file': name, 'reason': 'local source path'})
    ascii_name = any(re.search(rb'(?<![a-z0-9_])' + re.escape(term.lower().encode()) + rb'(?![a-z0-9_])', lower) for term in terms)
    wide_name = any(term.lower().encode(enc) in lower for term in terms for enc in ('utf-16-le', 'utf-16-be'))
    if any(term.casefold() in name.casefold() for term in terms) or ascii_name or wide_name:
        issues.append({'file': name, 'reason': 'private identifier'})
    return issues

def scan(root, terms):
    root = Path(root)
    files = sorted(root.rglob('*')) if root.is_dir() else [root]
    issues = []
    count = 0
    for file in files:
        if file.is_symlink():
            raise ValueError('Symlinks are not permitted in release packages')
        if file.is_file():
            count += 1
            name = file.relative_to(root).as_posix() if root.is_dir() else file.name
            if zipfile.is_zipfile(file):
                with zipfile.ZipFile(file) as archive:
                    issues += scan_archive(name, archive, terms, 0)
            else:
                if file.stat().st_size > LIMIT:
                    raise ValueError('File exceeds scan limit')
                issues += scan_bytes(name, file.read_bytes(), terms)
    if not count:
        raise ValueError('No release files found')
    return {'files': count, 'issues': issues}



def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['scan'])
    parser.add_argument('path')
    args = parser.parse_args()
    terms = [t.strip() for t in os.environ.get('BUILD_PRIVATE_TERMS', '').split(',') if t.strip()]
    if not terms:
        parser.error('Set BUILD_PRIVATE_TERMS to the private names/account identifiers to reject')
    result = scan(args.path, terms)
    print(json.dumps(result, indent=2))
    raise SystemExit(1 if result['issues'] else 0)


if __name__ == '__main__':
    main()
