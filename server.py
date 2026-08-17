#!/usr/bin/env python3
"""Lightweight static file server + API proxy for ENERGISA invoice extraction.
Uses Python (survives container) for serving; spawns Node.js for PDF processing."""
import http.server, json, os, subprocess, sys, signal, socket

ROOT = '/home/z/my-project'
BUILD = os.path.join(ROOT, '.next')
SCRIPTS = os.path.join(ROOT, 'scripts')
MIME = {
    '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
    '.json': 'application/json; charset=utf-8',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        p = self.path.split('?')[0]
        if p.startswith('/_next/'):
            rel = p[7:]  # strip '/_next/' → 'static/chunks/...' etc.
            fp = os.path.join(BUILD, rel)
        elif p in ('/', '/index.html'):
            fp = os.path.join(BUILD, 'server', 'app', 'index.html')
        else:
            self.send_error(404)
            return
        try:
            with open(fp, 'rb') as f:
                data = f.read()
            self.send_response(200)
            self.send_header('Content-Type', MIME.get(os.path.splitext(fp)[1], 'application/octet-stream'))
            if p.startswith('/_next/'):
                self.send_header('Cache-Control', 'public, max-age=31536000, immutable')
            self.end_headers()
            self.wfile.write(data)
        except Exception:
            self.send_error(404)

    def do_POST(self):
        ct = self.headers.get('Content-Type', '')
        cl = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(cl) if cl > 0 else b''

        if self.path == '/api/extract-pdf' and 'multipart' in ct:
            try:
                env = os.environ.copy()
                env['CONTENT_TYPE'] = ct
                r = subprocess.run(
                    ['node', os.path.join(SCRIPTS, 'api-extract.cjs')],
                    input=body, capture_output=True, timeout=120, env=env
                )
                if r.returncode == 0 and r.stdout:
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(r.stdout)
                else:
                    self.send_json(500, {'error': (r.stderr or b'unknown').decode()[:500]})
            except subprocess.TimeoutExpired:
                self.send_json(504, {'error': 'PDF processing timeout'})
            except Exception as e:
                self.send_json(500, {'error': str(e)[:500]})
            return

        if self.path == '/api/export-excel':
            try:
                r = subprocess.run(
                    ['node', os.path.join(SCRIPTS, 'api-export.cjs')],
                    input=body, capture_output=True, timeout=120
                )
                if r.returncode == 0 and r.stdout:
                    self.send_response(200)
                    self.send_header('Content-Type', MIME['.xlsx'])
                    self.send_header('Content-Disposition', 'attachment; filename="faturas_energisa.xlsx"')
                    self.end_headers()
                    self.wfile.write(r.stdout)
                else:
                    self.send_json(500, {'error': (r.stderr or b'unknown').decode()[:500]})
            except Exception as e:
                self.send_json(500, {'error': str(e)[:500]})
            return

        self.send_error(404)

    def send_json(self, code, data):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

for sig in (signal.SIGTERM, signal.SIGHUP, signal.SIGINT):
    signal.signal(sig, signal.SIG_IGN)

if __name__ == '__main__':
    class ReusableHTTPServer(http.server.HTTPServer):
        allow_reuse_address = True
        allow_reuse_port = True
    srv = ReusableHTTPServer(('0.0.0.0', 3000), Handler)
    print('> Ready on :3000')
    srv.serve_forever()
