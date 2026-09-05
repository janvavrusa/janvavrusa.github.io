import http.server, socketserver
import os
PORT = 8000
os.chdir(r"C:\Users\honza\Desktop\Portfolio\Verze webu\v.2 WEB")
Handler = http.server.SimpleHTTPRequestHandler
with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Serving at http://localhost:{PORT}")
    httpd.serve_forever()
