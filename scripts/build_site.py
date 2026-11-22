"""GitHub Pages용 정적 배포본: index.html이 실제로 참조하는 스크립트만 복사."""
from html.parser import HTMLParser
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "_site"


class Scripts(HTMLParser):
    def __init__(self):
        super().__init__()
        self.sources = []

    def handle_starttag(self, tag, attrs):
        if tag == "script":
            source = dict(attrs).get("src")
            if source:
                self.sources.append(source)


def build():
    parser = Scripts()
    parser.feed((ROOT / "index.html").read_text(encoding="utf-8"))
    files = ["index.html", *parser.sources]
    if not parser.sources:
        raise ValueError("게임 스크립트를 찾지 못했습니다.")
    for name in files:
        path = Path(name)
        if path.name != name or (ROOT / name).resolve().parent != ROOT:
            raise ValueError(f"배포 목록에 허용되지 않는 경로: {name}")
        if not (ROOT / name).is_file():
            raise FileNotFoundError(name)
    SITE.mkdir(exist_ok=True)
    unexpected = [p.name for p in SITE.iterdir() if p.name not in {*files, ".nojekyll"}]
    if unexpected:
        raise ValueError(f"출력 폴더의 예상 밖 파일을 확인해 주세요: {unexpected}")
    for name in files:
        shutil.copy2(ROOT / name, SITE / name)
    (SITE / ".nojekyll").write_text("", encoding="utf-8")
    print(f"배포본: {SITE.name}/ · 게임 파일 {len(files)}개 (테스트·문서·저장 파일 제외)")


if __name__ == "__main__":
    build()
