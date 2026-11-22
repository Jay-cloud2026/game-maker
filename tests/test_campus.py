"""3단계 UI 검증: python3 test_campus.py (Playwright/Chromium)."""
# 프로젝트 루트에서 실행: python3 tests/test_campus.py
import json
from playwright.sync_api import sync_playwright
from test_game import button, click, phase, prepare_term, finish_event, legacy_state
from test_life import new_page, create_character, apply_colleges


def start_budget(browser, errors, school="들꽃미래대학교"):
    page = new_page(browser, errors)
    create_character(page)
    apply_colleges(page, [0], colleges=(school,))
    click(page, f"{school} 등록 결정")
    click(page, "대학 생활 시작")
    assert phase(page) == "termBudget"
    return page


def finish_term(page, intern=False):
    assert phase(page) == "reportReady"
    click(page, "성적표 열기")
    click(page, "방학 계획 세우기")
    click(page, "유급 인턴 지원" if intern else "방학 동안 쉬기")
    click(page, "졸업 후 진로 보기" if page.evaluate("state.semester") >= 8 else "다음 학기로")


def test_finances(browser, errors):
    page = start_budget(browser, errors)
    click(page, "원룸 자취 선택")
    assert page.evaluate("termQuote().deposit") == 180
    page.evaluate("state.campus.ledgers[1].eligibility.money=100;window.randomQueue=[0]")
    click(page, "생활비 장학금 신청")
    assert page.evaluate("state.campus.ledgers[1].applications.need.accepted")
    award_snapshot = page.evaluate("JSON.stringify(state.campus.ledgers[1].applications)")
    page.reload()
    assert page.evaluate("JSON.stringify(state.campus.ledgers[1].applications)") == award_snapshot
    assert page.evaluate("window.randomCalls") == 0
    assert button(page, "생활비 장학금 신청 완료").is_disabled()
    before = page.evaluate("state.money")
    quote = page.evaluate("termQuote()")
    expected_loan = max(0, quote["cashFlow"] - before) + 30
    click(page, "부족액 학자금 대출")
    assert page.evaluate("state.campus.debt") == expected_loan
    assert page.evaluate("state.money") == before + expected_loan
    money = page.evaluate("state.money")
    energy = page.evaluate("state.energy")
    happiness = page.evaluate("state.character.abilities.happiness")
    target = button(page, "정산 확정하고 학기 시작").element_handle()
    target.evaluate("(button)=>{button.click();button.click()}")
    assert phase(page) == "semester"
    assert page.evaluate("state.money") == money - quote["cashFlow"]
    assert page.evaluate("state.energy") == energy - 3
    assert page.evaluate("state.character.abilities.happiness") == happiness + 6
    assert page.evaluate("state.campus.housing.deposit") == 180
    assert page.evaluate("state.campus.transactions.filter(t=>t.kind==='settlement').length") == 1
    snapshot = page.evaluate("JSON.stringify({campus:state.campus,money:state.money,energy:state.energy,abilities:state.character.abilities})")
    page.reload()
    click(page, "학기 재정·주거 확인")
    assert "이미 정산" in page.locator("#scene").inner_text()
    page.evaluate("settleTerm();settleTerm()")
    click(page, "학기로 돌아가기")
    assert page.evaluate("JSON.stringify({campus:state.campus,money:state.money,energy:state.energy,abilities:state.character.abilities})") == snapshot
    for title in ["연구실 참여", "연구실 참여", "휴식"]:
        click(page, title)
        finish_event(page)
    finish_term(page)
    assert phase(page) == "termBudget"
    assert page.evaluate("state.research") == 2
    # 조건 미달과 추첨 탈락도 저장되며 같은 학기 재신청하지 못합니다.
    click(page, "성적 장학금 신청")
    assert "미달" in button(page, "성적 장학금 신청 완료").inner_text()
    page.evaluate("window.randomQueue=[.99]")
    click(page, "연구 장학금 신청")
    assert page.evaluate("state.campus.ledgers[2].applications.research.accepted") is False
    page.reload()
    assert page.evaluate("window.randomCalls") == 0
    assert button(page, "연구 장학금 신청 완료").is_disabled()
    click(page, "부모님 집에서 통학 선택")
    quote = page.evaluate("termQuote()")
    assert quote["refund"] == 180 and quote["deposit"] == 0
    assert quote["cashFlow"] < 0
    money = page.evaluate("state.money")
    click(page, "정산 확정하고 학기 시작")
    assert page.evaluate("state.money") == money - quote["cashFlow"]
    assert page.evaluate("state.campus.housing.deposit") == 0
    for _ in range(3):
        click(page, "휴식")
        finish_event(page)
    finish_term(page)
    page.evaluate("window.randomQueue=[0]")
    click(page, "연구 장학금 신청")
    assert page.evaluate("state.campus.ledgers[3].applications.research.accepted")
    assert page.evaluate("termQuote().awarded") == 55
    assert page.evaluate("""() => { const q=state.campus.ledgers[1].quote;
      return q.discount===Math.min(q.tuition+q.rent+q.living+q.travel,q.entry+q.awarded+q.exchangeGrant); }""")
    # 보증금 부족은 대출이나 등록 유예 근로로 해결. 근로도 시간과 원장에 반영.
    money = page.evaluate("state.money")
    half_year = page.evaluate("state.life.year*2+state.life.half")
    click(page, "등록 전 단기 근로")
    assert page.evaluate("state.money") == money + 80
    assert page.evaluate("state.life.year*2+state.life.half") == half_year + 1
    assert page.evaluate("state.semester") == 3
    assert page.evaluate("currentTerm().actions.length") == 0
    page.reload()
    assert page.evaluate("state.life.year*2+state.life.half") == half_year + 1
    page.close()

    # 기숙사가 없는 대학의 선택 제한.
    page = start_budget(browser, errors, "서림시립대학교")
    assert button(page, "학교 기숙사 선택").is_disabled()
    assert "미제공" in button(page, "학교 기숙사 선택").inner_text()
    click(page, "룸메이트와 공동 거주 선택")
    assert page.evaluate("termQuote().deposit") == 60
    prepare_term(page)
    assert page.evaluate("state.campus.housing.type") == "roommate"
    # 도심 대학의 실제 알바 보너스.
    before = page.evaluate("state.money")
    click(page, "카페 알바")
    assert page.evaluate("state.money") == before + 55
    page.close()


def test_retake_and_extra(browser, errors):
    page = start_budget(browser, errors)
    prepare_term(page)
    for _ in range(3):
        click(page, "카페 알바")
        finish_event(page)
    assert phase(page) == "reportReady"
    click(page, "성적표 열기")
    assert page.evaluate("currentTerm().report.gpa") == 0
    assert page.evaluate("state.academic.warnings") == [1]
    original = page.evaluate("JSON.stringify(state.terms[0].report)")
    click(page, "방학 계획 세우기")
    click(page, "방학 동안 쉬기")
    click(page, "다음 학기로")
    prepare_term(page)
    for title in ["전공 이론 재수강 [s1-c0]", "휴식", "실험과 탐구 재수강 [s1-c1]"]:
        click(page, title)
        if phase(page) == "campus":
            page.locator("#scene button:enabled").last.click()  # 남은 재수강 비용을 남기는 무료 선택
    click(page, "성적표 열기")
    assert page.evaluate("JSON.stringify(state.terms[0].report)") == original
    assert page.evaluate("effectiveTranscript().filter(c=>c.id==='s1-c0').length") == 1
    assert page.evaluate("effectiveTranscript().find(c=>c.id==='s1-c0').point") == 1
    assert page.evaluate("academicProgress().total") == 18
    # 2개의 재수강은 6학점만 복구하고 기존 수강을 중복 합산하지 않습니다.
    assert page.evaluate("currentTerm().report.courses.filter(c=>c.repeated).length") == 2
    snapshot = page.evaluate("JSON.stringify({gpa:cumulativeGpa(),progress:academicProgress(),reports:state.terms.map(t=>t.report)})")
    page.reload()
    assert page.evaluate("JSON.stringify({gpa:cumulativeGpa(),progress:academicProgress(),reports:state.terms.map(t=>t.report)})") == snapshot
    click(page, "방학 계획 세우기")
    click(page, "방학 동안 쉬기")
    click(page, "다음 학기로")
    for semester in range(3, 9):
        prepare_term(page)
        for _ in range(3):
            click(page, "휴식")
            finish_event(page)
        finish_term(page)
    assert phase(page) == "graduationReview"
    assert page.evaluate("state.life.graduationYear") is None
    assert "프로젝트 미완료" in page.locator("#scene").inner_text()
    assert page.evaluate("state.life.year") == 2031
    click(page, "초과 학기 등록 준비")
    assert page.evaluate("state.semester") == 9
    assert page.evaluate("termQuote().tuition") == 66
    assert "초과 1학기" in page.locator("#scene").inner_text()
    prepare_term(page)
    assert "초과 1학기" in page.locator("#stage").inner_text()
    for title in ["졸업 프로젝트", "휴식", "휴식"]:
        click(page, title)
        finish_event(page)
    finish_term(page)
    assert phase(page) == "hub"
    assert page.evaluate("state.life.highestDegree") == "학사"
    assert page.evaluate("state.life.year") == 2031
    assert page.evaluate("state.life.half") == 1
    assert page.evaluate("academicProgress().issues") == []
    assert page.evaluate("state.terms.length") == 9
    assert page.evaluate("state.academic.project")
    assert page.evaluate("state.campus.housing.active") is False
    page.reload()
    assert page.evaluate("state.semester") == 9
    assert phase(page) == "hub"
    # 졸업 후 급여 상환 및 저장 복원.
    debt = page.evaluate("state.campus.debt")
    money = page.evaluate("state.money")
    click(page, "취업 지원")
    click(page, "졸업 프로젝트 활용해 면접 보고 일하기")
    assert page.evaluate("state.campus.debt") == debt - min(debt, 50)
    assert page.evaluate("state.money") == money + 200 - min(debt, 50)
    assert page.evaluate("state.savings") == 150
    payments = page.evaluate("JSON.stringify(state.campus.transactions.filter(t=>t.kind==='repayment'))")
    page.reload()
    assert page.evaluate("JSON.stringify(state.campus.transactions.filter(t=>t.kind==='repayment'))") == payments
    page.locator("#records-drawer > summary").click()
    page.locator("#assets-menu > summary").click()
    money = page.evaluate("state.money")
    page.locator("#assets button").filter(has=page.get_by_text("대출 직접 상환", exact=True)).click()
    assert page.evaluate("state.money") == money - 50
    click(page, "국내외 석사 지원")
    assert phase(page) == "application"
    page.close()


def test_policies_and_migration(browser, errors):
    page = start_budget(browser, errors)
    # 성적 장학금 상위 경계: 초보자 3회 공부로 고득점을 보장하지 않습니다.
    page.evaluate("state.development.skills.academic=85;syncLearnedAbility('academic')")
    prepare_term(page)
    for _ in range(3):
        click(page, "전공 공부")
        finish_event(page)
    finish_term(page)
    assert page.evaluate("state.campus.ledgers[2].eligibility.gpa") >= 3.3
    page.evaluate("window.randomQueue=[0]")
    click(page, "성적 장학금 신청")
    assert page.evaluate("state.campus.ledgers[2].applications.merit.accepted")
    assert page.evaluate("termQuote().awarded") == 65
    page.close()
    page = start_budget(browser, errors, "상록과학기술원")
    prepare_term(page)
    click(page, "연구실 참여")
    assert page.evaluate("state.research") == 2
    assert page.evaluate("schoolPolicy().requiredResearch") == 2
    page.close()
    page = start_budget(browser, errors, "해온공학대학교")
    prepare_term(page)
    click(page, "산학 프로젝트")
    assert page.evaluate("state.academic.industryProject && state.practice===1")
    assert page.evaluate("careerEvidence().some(e=>e.id==='industry')")
    page.close()
    page = start_budget(browser, errors, "가온국제대학교")
    prepare_term(page)
    language = page.evaluate("state.character.abilities.language")
    click(page, "국제 소통 세미나")
    assert language < page.evaluate("state.character.abilities.language") <= language + 2
    assert page.evaluate("state.academic.internationalSeminar")
    page.close()

    page = new_page(browser, errors)
    old = legacy_state()
    page.evaluate("(old)=>{state=migrateSave(old)}", old)
    v2 = page.evaluate("""() => {
      const old=JSON.parse(JSON.stringify(state)); delete old.campus; delete old.academic;
      old.version=2;old.semester=3;old.money=23;old.energy=31;old.life.university='hanul';
      old.life.year=2028;old.life.timeKeys=['undergraduate:1','undergraduate:2'];
      old.terms[2].actions=['study'];return old;
    }""")
    raw = json.dumps(v2, ensure_ascii=False)
    page.evaluate("(raw)=>{localStorage.removeItem(SLOT_CONFIG.key);localStorage.setItem(CONFIG.saveKey,raw)}", raw)
    page.reload()
    assert phase(page) == "semester"
    assert page.evaluate("state.money") == 23
    assert page.evaluate("state.energy") == 31
    assert page.evaluate("state.terms") == v2["terms"]
    assert page.evaluate("state.version===CONFIG.saveVersion")
    assert page.evaluate("Object.values(state.campus.ledgers).every(l=>l.status==='waived')")
    assert page.evaluate("state.campus.debt") == 0
    assert page.evaluate("localStorage.getItem(CONFIG.saveKey+':backup-v2')") == raw
    page.reload()
    assert page.evaluate("state.money") == 23
    click(page, "학기 재정·주거 확인")
    assert "소급 청구하지 않" in page.locator("#scene").inner_text()
    click(page, "학기로 돌아가기")
    for _ in range(2):
        click(page, "휴식")
        finish_event(page)
    finish_term(page)
    assert phase(page) == "termBudget"
    assert page.evaluate("state.campus.ledgers[4].status") == "pending"
    assert page.evaluate("termQuote().tuition") == 180
    page.set_viewport_size({"width": 375, "height": 800})
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    page.close()


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        errors = []
        test_finances(browser, errors)
        test_retake_and_extra(browser, errors)
        test_policies_and_migration(browser, errors)
        assert not errors, errors
        browser.close()
        print("PASS 3단계: 등록금·4종 주거·보증금 반환·장학금 당락 고정·중복 정산 방지")
        print("PASS 3단계: 대출·졸업 후 자동/수동 상환·등록 유예·학사경고·재수강·초과 학기→졸업")
        print("PASS 3단계: 대학별 행동·추가 졸업 요건·v2 원본 백업/소급 면제·모바일")


if __name__ == "__main__":
    run()
