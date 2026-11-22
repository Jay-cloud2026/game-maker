"""통합 4단계: 기업 자격·고정 선발·입사 직후 엔딩/계속·계약 기록."""
# 프로젝트 루트에서 실행: python3 tests/test_employment.py
from playwright.sync_api import sync_playwright
from test_career import graduate_page
from test_game import click, phase


def apply_one(page, company="한빛테크놀로지", final_draw=0):
    click(page, "취업 지원")
    click(page, f"{company} 지원 선택")
    page.evaluate("window.randomQueue=[0]")
    click(page, "지원서 제출")
    click(page, f"{company} 서류 결과 확인")
    click(page, "기업 면접으로")
    page.evaluate("(draw)=>window.randomQueue=[draw]", final_draw)
    click(page, "연구실 경험")
    click(page, f"{company} 최종 메일 열기")
    click(page, "입사 제안 비교")


def test_ending_and_continue(browser, errors):
    page = graduate_page(browser, errors)
    apply_one(page)
    before_money = page.evaluate("state.money")
    before_age = page.evaluate("characterAge()")
    click(page, "한빛테크놀로지 입사")
    assert phase(page) == "employmentDecision"
    assert page.evaluate("state.money") == before_money
    assert page.evaluate("state.jobTurns") == 0
    page.reload()
    assert phase(page) == "employmentDecision"
    assert page.evaluate("validSave(state)")
    click(page, "취업 엔딩으로 마무리")
    assert phase(page) == "ending"
    assert page.locator("#stage").inner_text().endswith("취업 엔딩")
    contract = page.evaluate("state.reflection.snapshot.employment")
    assert contract["company"] == "한빛테크놀로지"
    assert contract["salary"] == 4200
    assert contract["role"] == "시스템 엔지니어"
    assert contract["age"] == before_age
    assert contract["gpa"] == 3.5
    assert contract["education"] == "학사"
    assert contract["internships"] == 0
    assert any(project["id"] == "club" for project in contract["projects"])
    assert "연구실 참여" in contract["story"]
    assert "연도별 인생 타임라인" in page.locator("#scene").inner_text()
    assert page.evaluate("state.money") == before_money
    stored = page.evaluate("JSON.stringify(state.reflection.snapshot)")
    page.reload()
    assert page.evaluate("JSON.stringify(state.reflection.snapshot)") == stored
    page.locator("#records-drawer > summary").click()
    page.locator("#journal-button").click()
    assert "계약 연봉 4200만원" in page.locator("#journal-content").inner_text()
    page.locator("#journal-close").click()
    click(page, "아직 커리어를 더 이어가기")
    assert phase(page) == "jobNext"
    click(page, "직장 생활 계속하기")
    assert phase(page) == "workTurn"
    click(page, "균형 있게 일하기")
    assert page.evaluate("state.jobTurns") == 1
    assert page.evaluate("characterAge()") == before_age + 1
    page.locator("#scene button:enabled").last.click()
    click(page, "국내외 석사 지원")
    assert phase(page) == "application"
    page.close()


def test_conditions_and_results(browser, errors):
    page = graduate_page(browser, errors)
    click(page, "취업 지원")
    assert page.evaluate("hiringEligibility(companyById('neulbom')).includes('석사 학위 필요')")
    assert page.locator("#scene button").filter(has_text="늘봄융합연구원 지원 선택").is_disabled()
    page.evaluate("state.practice=0;render()")
    assert page.locator("#scene button").filter(has_text="한빛테크놀로지 지원 선택").is_disabled()
    # 경력 없이도 가능한 초급 공고와 준비 프로젝트가 있어 진행이 막히지 않습니다.
    assert page.locator("#scene button").filter(has_text="다온웨이브 지원 선택").is_enabled()
    click(page, "직무 준비 프로젝트")
    click(page, "직무 준비 프로젝트")
    click(page, "한빛테크놀로지 지원 선택")
    page.evaluate("window.randomQueue=[0]")
    click(page, "지원서 제출")
    snapshot = page.evaluate("JSON.stringify(state.career.applications)")
    page.reload()
    assert page.evaluate("JSON.stringify(state.career.applications)") == snapshot
    assert page.evaluate("window.randomCalls") == 0
    click(page, "한빛테크놀로지 서류 결과 확인")
    click(page, "기업 면접으로")
    inputs = page.evaluate("state.career.applications[0].hiringSnapshot.inputs")
    page.evaluate("state.practice=0;state.research=0;state.experiences={};window.randomQueue=[.999];render()")
    click(page, "연구실 경험")  # 원서 제출 시 증빙을 유지.
    app = page.evaluate("state.career.applications[0]")
    assert app["hiringSnapshot"]["inputs"] == inputs
    assert app["accepted"] is False
    assert app["probability"] <= .88
    saved = page.evaluate("JSON.stringify(state.career.applications)")
    page.reload()
    assert page.evaluate("JSON.stringify(state.career.applications)") == saved
    click(page, "한빛테크놀로지 최종 메일 열기")
    click(page, "입사 제안 비교")
    click(page, "진로 화면으로 돌아가기")
    assert phase(page) == "hub"
    assert page.evaluate("validSave(state)")
    page.close()


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        errors = []
        test_ending_and_continue(browser, errors)
        test_conditions_and_results(browser, errors)
        assert not errors, errors
        browser.close()
        print("PASS 통합 4단계: 기업별 학위/GPA/경험·불합격/대체 경로·지원 당시 역량/증빙 고정")
        print("PASS 통합 4단계: 취업 정상 엔딩·계약 연봉/입사 나이/학력/GPA/프로젝트·복원·근무/대학원 재개")


if __name__ == "__main__":
    run()
