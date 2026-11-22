"""7단계 UI·회고록·백업: python3 test_memoir.py"""
# 프로젝트 루트에서 실행: python3 tests/test_memoir.py
import json
from playwright.sync_api import sync_playwright
from test_game import click, phase, hire_and_work, admissions
from test_life import new_page
from test_career import graduate_page, resolve_work


def test_balance_and_backup(browser, errors):
    page = graduate_page(browser, errors)
    click(page, "취업 지원")
    hire_and_work(page, "연구실 경험")
    click(page, "현재 커리어로 마무리")
    assert phase(page) == "ending"
    assert page.evaluate("state.reflection.snapshot.name") == "이어온 학생"
    click(page, "인생 엔딩 고르기")
    assert page.locator("#scene button").filter(has_text="대학교수").count() == 0
    before_year = page.evaluate("state.life.year")
    target = page.locator("#scene button").filter(has=page.get_by_text("워라밸을 중시하는 직장인", exact=True)).element_handle()
    target.evaluate("(button)=>{button.click();button.click()}")
    assert page.evaluate("state.reflection.selected") == "balance"
    assert page.evaluate("state.life.year") == before_year + 1
    assert "나의 인생 기록" in page.locator("#scene").inner_text()
    snapshot = page.evaluate("JSON.stringify(state.reflection.snapshot)")
    money = page.evaluate("state.money")
    page.reload()
    assert page.evaluate("JSON.stringify(state.reflection.snapshot)") == snapshot
    assert page.evaluate("state.money") == money
    page.locator("#journal-button").click()
    assert page.locator("#journal-dialog").is_visible()
    assert "누적 저축" in page.locator("#journal-content").inner_text()
    with page.expect_download() as download_info:
        page.locator("#journal-download").click()
    assert download_info.value.suggested_filename.endswith(".txt")
    page.locator("#journal-close").click()
    with page.expect_download() as download_info:
        page.locator("#save-export").click()
    assert download_info.value.suggested_filename.endswith(".json")
    before = page.evaluate("JSON.stringify(state)")
    page.locator("#save-file").set_input_files({"name": "bad.json", "mimeType": "application/json", "buffer": b"{}"})
    page.wait_for_function("document.getElementById('save-status').textContent.includes('불러오지 못')")
    assert page.evaluate("JSON.stringify(state)") == before
    # v6 가져오기: 기존 기록은 보존하고 v7 필드만 채우며 현재 저장본은 별도 백업.
    previous = page.evaluate("()=>{let old=JSON.parse(JSON.stringify(state));delete old.reflection;old.version=6;return old}")
    page.on("dialog", lambda dialog: dialog.accept())
    page.locator("#save-file").set_input_files({"name": "old-v6.json", "mimeType": "application/json",
        "buffer": json.dumps(previous, ensure_ascii=False).encode()})
    page.wait_for_function("state.version===CONFIG.saveVersion && state.reflection.selected===null")
    assert page.evaluate("state.career") == previous["career"]
    assert page.evaluate("state.terms") == previous["terms"]
    assert page.evaluate("state.money") == previous["money"]
    assert page.evaluate("localStorage.getItem(CONFIG.saveKey+':before-import')") is not None
    page.close()


def test_founder(browser, errors):
    page = graduate_page(browser, errors)
    click(page, "취업 지원")
    hire_and_work(page, "연구실 경험")
    click(page, "직장 생활 계속하기")
    click(page, "새 사업 아이디어 검증")
    resolve_work(page)
    click(page, "창업 시작")
    for _ in range(2):
        page.evaluate("window.randomQueue=[0]")
        click(page, "제품 개발과 고객 검증")
    click(page, "창업 경험으로 인생 기록 마무리")
    click(page, "인생 엔딩 고르기")
    click(page, "스타트업 창업가")
    assert page.evaluate("state.reflection.selected") == "founder"
    assert page.evaluate("state.reflection.snapshot.profession") == "스타트업 대표"
    assert page.evaluate("state.reflection.snapshot.metrics.traction") == 2
    assert page.evaluate("state.reflection.snapshot.ventureAssets") > 0
    page.close()


def test_phd_life(browser, errors):
    page = graduate_page(browser, errors)
    click(page, "석사 지원")
    admissions(page, "masters", "연구실 경험")
    page.locator(".opportunity").filter(has_text="대한민국").get_by_role("button", name="이 제안 수락").click()
    from test_degree import complete_degree
    complete_degree(page)
    click(page, "취업·박사 지원 살펴보기")
    click(page, "박사 지원")
    admissions(page, "phd", "석사 연구 성과")
    page.locator(".opportunity").filter(has_text="독일").get_by_role("button", name="이 제안 수락").click()
    assert phase(page) == "graduateTerm"
    assert page.evaluate("state.life.highestDegree") == "박사 재학"
    before_year = page.evaluate("state.life.year")
    complete_degree(page)
    click(page, "학위 취득 엔딩")
    click(page, "인생 엔딩 고르기")
    assert page.evaluate("state.life.highestDegree") == "박사"
    assert page.evaluate("state.life.year") == before_year + 4
    checkpoint = page.evaluate("JSON.stringify(state)")
    click(page, "대학교수")
    assert page.evaluate("state.reflection.selected") == "professor"
    assert page.evaluate("state.life.year") == before_year + 6
    assert page.evaluate("state.reflection.snapshot.degree") == "박사"
    assert page.evaluate("state.reflection.snapshot.profession") == "대학교수"
    assert page.locator("#stage").inner_text() == "인생 엔딩"
    assert "대학교수" in page.locator("#life-summary").inner_text()
    assert "박서우" in page.locator("#scene").inner_text()
    assert "연도별 인생 타임라인" in page.locator("#scene").inner_text()
    page.reload()
    assert page.evaluate("state.life.year") == before_year + 6
    page.close()

    # 같은 학위 완료 기록에서도 다른 실제 진로 선택을 비교.
    page = new_page(browser, errors)
    page.evaluate("(raw)=>{localStorage.removeItem(SLOT_CONFIG.key);localStorage.setItem(CONFIG.saveKey,raw)}", checkpoint)
    page.reload()
    click(page, "해외 박사 연구자")
    assert page.evaluate("state.reflection.selected") == "overseasPhd"
    assert page.evaluate("state.life.year") == before_year + 5
    page.set_viewport_size({"width": 375, "height": 800})
    page.locator("#journal-button").click()
    assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
    assert page.locator("#journal-dialog").bounding_box()["width"] <= 375
    page.close()


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        errors = []
        test_balance_and_backup(browser, errors)
        test_founder(browser, errors)
        test_phd_life(browser, errors)
        assert not errors, errors
        browser.close()
        print("PASS 7단계: 워라밸·창업가·대학교수·해외 박사 연구자 실제 UI 엔딩")
        print("PASS 회고록 회귀: 박사8학기/후일담 시간·학위·자산·관계·타임라인·중복 방지")
        print("PASS 7단계: 회고록/저장 내려받기·v6 가져오기·잘못된 파일 비파괴·모바일")


if __name__ == "__main__":
    run()
