#!/usr/bin/env python3
"""Lightweight static file server + API proxy for ENERGISA invoice extraction.
Uses Python (survives container) for serving; spawns Node.js for PDF processing."""
import http.server, json, os, subprocess, sys, signal, socket, time
from http.server import ThreadingHTTPServer

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

    def handle(self):
        try:
            super().handle()
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass

    def do_GET(self):
        p = self.path.split('?')[0]
        if p.startswith('/_next/'):
            rel = p[7:]
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
        try:
            ct = self.headers.get('Content-Type', '')
            cl = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(cl) if cl > 0 else b''

            if self.path == '/api/extract-pdf' and 'multipart' in ct:
                t0 = time.time()
                try:
                    env = os.environ.copy()
                    env['CONTENT_TYPE'] = ct
                    r = subprocess.run(
                        ['node', os.path.join(SCRIPTS, 'api-extract.cjs')],
                        input=body, capture_output=True, timeout=120, env=env
                    )
                    elapsed = round((time.time() - t0) * 1000)
                    if r.returncode == 0 and r.stdout:
                        try:
                            result = json.loads(r.stdout)
                            if 'stats' in result:
                                result['stats']['totalTimeMs'] = elapsed
                            self.send_response(200)
                            self.send_header('Content-Type', 'application/json')
                            self.end_headers()
                            self.wfile.write(json.dumps(result).encode())
                        except json.JSONDecodeError:
                            self.send_response(200)
                            self.send_header('Content-Type', 'application/json')
                            self.end_headers()
                            self.wfile.write(r.stdout)
                    else:
                        self.send_json(500, {'error': (r.stderr or b'unknown').decode()[:500]})
                except subprocess.TimeoutExpired as te:
                    try: te.kill()
                    except: pass
                    self.send_json(504, {'error': 'PDF processing timeout'})
                except Exception as e:
                    self.send_json(500, {'error': str(e)[:500]})
                return

            if self.path == '/api/extract-batch' and 'multipart' in ct:
                t0 = time.time()
                try:
                    env = os.environ.copy()
                    env['CONTENT_TYPE'] = ct
                    timeout = max(60, len(body) // 50000 * 30)  # scale timeout with upload size
                    r = subprocess.run(
                        ['node', os.path.join(SCRIPTS, 'api-extract-batch.cjs')],
                        input=body, capture_output=True, timeout=timeout, env=env
                    )
                    elapsed = round((time.time() - t0) * 1000)
                    if r.returncode == 0 and r.stdout:
                        try:
                            results = json.loads(r.stdout)
                            if isinstance(results, list):
                                for item in results:
                                    if 'stats' in item:
                                        item['stats']['totalTimeMs'] = elapsed
                            self.send_response(200)
                            self.send_header('Content-Type', 'application/json')
                            self.end_headers()
                            self.wfile.write(json.dumps(results).encode())
                        except json.JSONDecodeError:
                            self.send_json(500, {'error': 'invalid batch response'})
                    else:
                        self.send_json(500, {'error': (r.stderr or b'unknown').decode()[:500]})
                except subprocess.TimeoutExpired as te2:
                    try: te2.kill()
                    except: pass
                    self.send_json(504, {'error': 'Batch processing timeout'})
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
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass  # client disconnected, nothing to do

    def send_json(self, code, data):
        try:
            self.send_response(code)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(data).encode())
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass

for sig in (signal.SIGTERM, signal.SIGHUP, signal.SIGINT):
    signal.signal(sig, signal.SIG_IGN)

if __name__ == '__main__':
    class ReusableThreadingServer(ThreadingHTTPServer):
        allow_reuse_address = True
        allow_reuse_port = True
        daemon_threads = True
    srv = ReusableThreadingServer(('0.0.0.0', 3000), Handler)
    print('> Ready on :3000')
    srv.serve_forever()
