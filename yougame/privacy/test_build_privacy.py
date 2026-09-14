import gzip
import io
import unittest
import zipfile
import zlib
from build_privacy import scan_bytes


class PrivacyTests(unittest.TestCase):
    def test_nested_archive_and_utf16(self):
        out = io.BytesIO()
        with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
            z.writestr('asset.bin', 'private-person'.encode('utf-16-le'))
        self.assertTrue(scan_bytes('assets.o2r', out.getvalue(), ['private-person']))
        self.assertTrue(scan_bytes('asset.gz', gzip.compress(b'/Users/example/source'), ['private-person']))
        self.assertTrue(scan_bytes('asset.bin', zlib.compress(b'/Users/example/source'), ['private-person']))

    def test_generic_runtime_home_is_allowed(self):
        self.assertFalse(scan_bytes('engine.js', b'/home/web_user/file', ['private-person']))
        self.assertFalse(scan_bytes('engine.js', b'HOME:"/home/web_user"', ['private-person']))

    def test_worktrees_and_partial_words(self):
        self.assertTrue(scan_bytes('engine', b'/src/.codex/worktrees/example/file.cpp', ['person']))
        self.assertFalse(scan_bytes('engine', b'personality', ['person']))

    def test_paths_and_names_in_file_names(self):
        self.assertTrue(scan_bytes('private-person.png', b'png', ['private-person']))
        self.assertTrue(scan_bytes('file', b'C:\\Users\\example\\src', ['private-person']))

    def test_archive_metadata_and_top_level_private_files(self):
        for filename, comment in [('.env', b''), ('file', b'private-person')]:
            out = io.BytesIO()
            with zipfile.ZipFile(out, 'w') as archive:
                entry = zipfile.ZipInfo(filename)
                entry.comment = comment
                archive.writestr(entry, b'innocent')
            self.assertTrue(scan_bytes('bundle.zip', out.getvalue(), ['private-person']))

    def test_wide_paths_at_both_alignments(self):
        for encoding in ('utf-16-le', 'utf-16-be'):
            for prefix in (b'', b'x'):
                self.assertTrue(scan_bytes('file', prefix + 'C:/Users/example/src'.encode(encoding), ['person']))
                self.assertTrue(scan_bytes('file', prefix + '.codex/worktrees/build'.encode(encoding), ['person']))

    def test_compressed_bytes_are_not_identifiers(self):
        self.assertFalse(scan_bytes('asset.gz', gzip.compress(b'abc', mtime=0), ['klj']))

    def test_compression_limits(self):
        from unittest.mock import patch
        with patch('build_privacy.LIMIT', 32):
            for compressed in (gzip.compress(b'x' * 100), zlib.compress(b'x' * 100)):
                with self.assertRaises(ValueError):
                    scan_bytes('asset.bin', compressed, ['person'])


if __name__ == '__main__':
    unittest.main()
