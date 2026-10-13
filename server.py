#!/usr/bin/env python3
"""Lightweight static file server + API proxy for ENERGISA invoice extraction.
Uses Python (survives container) for serving; spawns Node.js for PDF processing.
Saves uploaded PDF to temp file to avoid memory pressure on stdin pipe."""
import http.server, json, os, subprocess, sys, signal, socket, time, tempfile, re, threading
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

def parse_multipart_body(body, content_type):
    """Extract file data from multipart form-data body."""
    bm = re.search(r'boundary=([\w\-\.]+)', content_type)
    if not bm:
        return None, None
    boundary = bm.group(1).encode()
    delim = b'--' + boundary
    s = body.find(delim)
    if s < 0:
        return None, None
    s += len(delim)
    while s < len(body):
        # Skip CRLF after boundary
        if body[s:s+2] == b'\r\n':
            s += 2
        # Find end of headers
        he = body.find(b'\r\n\r\n', s)
        if he < 0:
            break
        hs = body[s:he].decode('utf-8', errors='replace')
        bs = he + 4  # body start
        nb = body.find(delim, bs)  # next boundary
        if nb < 0:
            break
        file_body = body[bs:nb-2]  # subtract trailing CRLF
        # Check if this is the file part
        name_match = re.search(r'name="([^"]+)"', hs)
        fname_match = re.search(r'filename="([^"]+)"', hs)
        if name_match and name_match.group(1) == 'file':
            filename = fname_match.group(1) if fname_match else 'upload.pdf'
            return file_body, filename
        s = nb + len(delim)
        if body[s:s+2] == b'--':
            break
    return None, None

def extract_json_from_stdout(stdout_bytes):
    """Extract JSON from Node.js stdout which may have warnings before the JSON."""
    text = stdout_bytes.decode('utf-8', errors='replace')
    # Find the first { or [ that starts a JSON object/array
    for i, ch in enumerate(text):
        if ch in ('{', '['):
            try:
                return json.loads(text[i:])
            except json.JSONDecodeError:
                continue
    return None

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
        if p == '/api/health':
            self.send_json(200, {'status': 'ok', 'pid': os.getpid()})
            return
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
                self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            else:
                self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
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
                    # Parse multipart to extract the PDF file
                    file_data, filename = parse_multipart_body(body, ct)
                    if not file_data:
                        self.send_json(400, {'error': 'no file found in upload'})
                        return

                    # Save to temp file to avoid stdin memory pressure
                    tmp_fd, tmp_path = tempfile.mkstemp(suffix='.pdf', dir='/tmp')
                    try:
                        os.write(tmp_fd, file_data)
                        os.close(tmp_fd)

                        # Call the direct extraction script with file path
                        r = subprocess.run(
                            ['node', os.path.join(SCRIPTS, 'extract-from-file.cjs'), tmp_path],
                            capture_output=True, timeout=30,
                            env={**os.environ, 'NODE_OPTIONS': '--max-old-space-size=512'}
                        )
                    finally:
                        try: os.unlink(tmp_path)
                        except: pass

                    elapsed = round((time.time() - t0) * 1000)
                    if r.returncode == 0 and r.stdout:
                        result = extract_json_from_stdout(r.stdout)
                        if result and result.get('success'):
                            if 'stats' in result:
                                result['stats']['totalTimeMs'] = elapsed
                            self.send_json(200, result)
                        else:
                            self.send_json(200, result or {'error': 'invalid response'})
                    else:
                        err_msg = (r.stderr or b'unknown').decode('utf-8', errors='replace')[:500]
                        self.send_json(500, {'error': err_msg})
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
                    timeout = max(60, len(body) // 50000 * 30)
                    r = subprocess.run(
                        ['node', os.path.join(SCRIPTS, 'api-extract-batch.cjs')],
                        input=body, capture_output=True, timeout=timeout, env=env
                    )
                    elapsed = round((time.time() - t0) * 1000)
                    if r.returncode == 0 and r.stdout:
                        result = extract_json_from_stdout(r.stdout)
                        if result is not None:
                            if isinstance(result, list):
                                for item in result:
                                    if 'stats' in item:
                                        item['stats']['totalTimeMs'] = elapsed
                            self.send_json(200, result)
                        else:
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
            pass

    def send_json(self, code, data):
        try:
            self.send_response(code)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass

for sig in (signal.SIGTERM, signal.SIGHUP, signal.SIGINT):
    signal.signal(sig, signal.SIG_IGN)

if __name__ == '__main__':
    class ReusableThreadingServer(ThreadingHTTPServer):
        allow_reuse_address = True
        allow_reuse_port = True
        daemon_threads = True
    srv = http.server.HTTPServer(('0.0.0.0', 3000), Handler)
    srv.allow_reuse_address = True
    srv.allow_reuse_port = True
    print('> Ready on :3000', flush=True)
    srv.serve_forever()
