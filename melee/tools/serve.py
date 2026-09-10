#!/usr/bin/env python3
"""Local player with the shared-memory headers required by the real engine."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from functools import partial
import argparse

ROOT = Path(__file__).resolve().parents[2] / 'build/melee-web/dist'
class Handler(SimpleHTTPRequestHandler):
    def guess_type(self, path):
        return super().guess_type(path[:-3] if path.endswith('.gz') else path)

    def end_headers(self):
        if self.path.split('?', 1)[0].endswith('.gz'):
            self.send_header('Content-Encoding', 'gzip')
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'credentialless')
        self.send_header('Document-Isolation-Policy', 'isolate-and-credentialless')
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8073)
    parser.add_argument('--directory', type=Path, default=ROOT)
    args = parser.parse_args()
    server = ThreadingHTTPServer(('127.0.0.1', args.port), partial(Handler, directory=str(args.directory.resolve())))
    print(f'OpenSmash Melee: http://127.0.0.1:{args.port}', flush=True)
    server.serve_forever()
