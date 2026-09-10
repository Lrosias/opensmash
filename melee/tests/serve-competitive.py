#!/usr/bin/env python3
"""Preview authored menus using an existing, unchanged native build for local play."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit
import argparse

ROOT = Path(__file__).resolve().parents[2]

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, native, **kwargs):
        self.native = native
        super().__init__(*args, directory=str(ROOT / 'melee/src'), **kwargs)

    def translate_path(self, request):
        relative = unquote(urlsplit(request).path).lstrip('/') or 'index.html'
        root = Path(self.directory)
        if relative.startswith(('engine/', 'assets/')) or relative in {'assets-manifest.json', 'asset-groups.json'}:
            root = self.native
        elif relative.startswith('controllers/'):
            root = ROOT
        candidate = (root / relative).resolve()
        return str(candidate if root.resolve() in candidate.parents else root / '__missing__')

    def end_headers(self):
        if self.path.split('?', 1)[0].endswith('.gz'):
            self.send_header('Content-Encoding', 'gzip')
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'credentialless')
        self.send_header('Document-Isolation-Policy', 'isolate-and-credentialless')
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def guess_type(self, path):
        return super().guess_type(path[:-3] if path.endswith('.gz') else path)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8275)
    parser.add_argument('--native-dist', type=Path, default=ROOT / 'build/melee-web/dist')
    args = parser.parse_args()
    server = ThreadingHTTPServer(('127.0.0.1', args.port), partial(Handler, native=args.native_dist.resolve()))
    print(f'Melee competitive preview: http://127.0.0.1:{args.port}', flush=True)
    server.serve_forever()
