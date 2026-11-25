"""Serve the extracted game over loopback and open it in the browser."""

import webbrowser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class GameFiles(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".mjs": "text/javascript"}


def main():
    folder = Path(__file__).resolve().parent
    handler = partial(GameFiles, directory=str(folder))
    try:
        server = ThreadingHTTPServer(("127.0.0.1", 8000), handler)
    except OSError as error:
        raise SystemExit(f"Could not start the local server on port 8000: {error}")

    with server:
        url = "http://127.0.0.1:8000/"
        print(f"Faraday Island: {url}", flush=True)
        print("Keep this window open while playing. Press Ctrl+C to stop.", flush=True)
        try:
            webbrowser.open(url)
        except webbrowser.Error:
            pass  # The printed URL can also be opened manually.
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
