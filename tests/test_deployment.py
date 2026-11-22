"""배포 산출물·HTTP 실행·방문자별 브라우저 저장 분리 확인."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import subprocess
import sys
from threading import Thread
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


class PreviewServer(ThreadingHTTPServer):
    request_queue_size = 64
    daemon_threads = True


def run():
    subprocess.run([sys.executable, str(ROOT / "scripts" / "build_site.py")], check=True)
    site = ROOT / "_site"
    assert all(p.name in ("index.html", ".nojekyll") or p.suffix == ".js" for p in site.iterdir())
    server = PreviewServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(site)))
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            errors = []
            first = browser.new_page()
            first.on("pageerror", lambda e: errors.append(str(e)))
            url = f"http://127.0.0.1:{server.server_port}/"
            response = first.goto(url)
            assert response.status == 200
            first.wait_for_function("typeof state !== 'undefined'")
            assert first.title() == "이번 학기는 진짜 에이 각이다"
            assert first.evaluate("state.phase") == "character"
            first.locator("#character-name").fill("공유 플레이어")
            first.locator("#scene button[type=submit]").click()
            assert first.evaluate("state.phase") == "hsReady"
            first.reload()
            assert first.evaluate("state.character.name") == "공유 플레이어"
            second = browser.new_page()
            second.on("pageerror", lambda e: errors.append(str(e)))
            response = second.goto(url)
            assert response.status == 200
            second.wait_for_function("typeof state !== 'undefined'")
            assert second.evaluate("state.phase") == "character"
            assert second.evaluate("state.character") is None
            assert not errors, errors
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join()
    print("PASS 배포: 실행 파일만 포함·HTTP 실행/새로고침 저장·다른 방문자의 캐릭터 독립")


if __name__ == "__main__":
    run()
