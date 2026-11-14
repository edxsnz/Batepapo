"""Servidor de teste: igual ao normal, mas demora a responder a CONFERÊNCIA de atualização (fetch) dos scripts.
Uso: python3 servidor_lento.py <pasta> <porta> <segundos>"""
import sys, time, functools, http.server, socketserver
pasta, porta, atraso = sys.argv[1], int(sys.argv[2]), float(sys.argv[3])
class H(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.headers.get("Sec-Fetch-Dest") == "empty" and self.path.split("?")[0].endswith(".js"): time.sleep(atraso)
        return super().do_GET()
    def log_message(self, *a): pass
class S(socketserver.ThreadingMixIn, http.server.HTTPServer): daemon_threads = True
S(("127.0.0.1", porta), functools.partial(H, directory=pasta)).serve_forever()
