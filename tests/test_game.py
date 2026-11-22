"""로컬 검증: python3 test_game.py (Python Playwright + Chromium 필요)."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

URL = (Path(__file__).resolve().parent.parent / "index.html").as_uri()

def legacy_state():
    """확장 전 실제 v1 스키마. 신규 게임 팩토리와 분리해 호환성을 검증합니다."""
    return {
        "version": 1, "phase": "semester", "semester": 1, "money": 100, "energy": 80,
        "terms": [{"actions": [], "meal": None, "event": None, "eventDone": False,
                   "report": None, "vacationDone": False} for _ in range(8)],
        "experiences": {}, "firstParticipation": {}, "flags": {}, "history": [],
        "research": 0, "recommendations": 0, "practice": 0, "savings": 0,
        "competition": None, "degree": "masters", "applications": [], "round": 0,
        "master": None, "jobTurns": 0, "ending": "", "notice": "기존 진행",
    }


def button(page, title):
    target = page.locator("#scene button").filter(has=page.get_by_text(title, exact=True))
    if target.count() == 1:
        reveal(target)
    return target


def reveal(target):
    """Open advanced drawers through their real summary controls before using them."""
    for details in target.locator("xpath=ancestor::details").all():
        if target.evaluate("(el, d)=>el.tagName==='SUMMARY' && el.parentElement===d", details.element_handle()):
            continue
        if not details.get_attribute("open") == "":
            details.locator(":scope > summary").click()
    return target


def click(page, title):
    if title.endswith(" 활용해 면접 보고 일하기") and phase(page) == "jobBoard":
        hire_and_work(page, title.removesuffix(" 활용해 면접 보고 일하기"))
        return
    button(page, title).click()

def hire_and_work(page, evidence, company="다온웨이브"):
    """구 경로의 기대 결과까지 신 채용 UI 전체를 실제 클릭합니다."""
    page.evaluate("window.savedTestRandom=Math.random;Math.random=()=>0")
    click(page, f"{company} 지원 선택")
    click(page, "지원서 제출")
    click(page, f"{company} 서류 결과 확인")
    click(page, "기업 면접으로")
    click(page, evidence)
    click(page, f"{company} 최종 메일 열기")
    click(page, "입사 제안 비교")
    click(page, f"{company} 입사")
    click(page, "직장 생활 계속 진행")
    click(page, "균형 있게 일하기")
    if phase(page) == "workEvent":
        page.locator("#scene button:enabled").last.click()
    page.evaluate("Math.random=window.savedTestRandom")


def phase(page):
    return page.evaluate("state.phase")

def prepare_term(page):
    """기존 경로 테스트도 실제 학기 정산 UI를 통과합니다."""
    if phase(page) != "termBudget":
        return
    if page.evaluate("state.campus.ledgers[state.semester].status") != "pending":
        click(page, "학기로 돌아가기")
        return
    if button(page, "부족액 학자금 대출").is_enabled():
        click(page, "부족액 학자금 대출")
    click(page, "정산 확정하고 학기 시작")


def finish_event(page):
    if phase(page) == "campus":
        page.locator("#scene button:enabled").first.click()


def admissions(page, degree, evidence):
    assert phase(page) == "application"
    # 이 도우미는 기존 장기 경로의 합격/불합격 분기를 재현합니다.
    # 자격 미달 및 확률 경계는 test_graduate.py에서 별도로 검증합니다.
    page.evaluate("window.beforeGradRandom=Math.random;Math.random=()=>0")
    countries = ["대한민국", "미국"] if degree == "masters" else ["미국", "독일"]
    for country in countries:
        page.locator("#scene button").filter(has_text=country).first.click()
    assert page.evaluate("state.applications.length") == 2
    click(page, "지원 마감하고 면접 준비")
    if phase(page) == "graduateDocuments":
        while page.locator("#scene button").filter(has_text="서류 결과 확인").count():
            page.locator("#scene button").filter(has_text="서류 결과 확인").first.click()
        page.locator("#scene button:enabled").last.click()
    while phase(page) == "interview":
        click(page, evidence)
    assert phase(page) == "mail"
    assert page.locator("#scene").get_by_text("합격", exact=True).count() == 0
    page.reload()
    assert phase(page) == "mail"
    assert page.evaluate("state.applications.every(a => a.status === 'interviewed')")
    page.locator("#scene button").filter(has_text="결과 메일 열기").first.click()
    assert page.evaluate("state.applications.filter(a => a.status === 'opened').length") == 1
    page.locator("#scene button").filter(has_text="결과 메일 열기").first.click()
    click(page, "진학 제안 비교하기")
    assert phase(page) == "offers"
    page.evaluate("Math.random=window.beforeGradRandom")


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1200, "height": 950})
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.add_init_script("window.LEGACY_FIXTURE = " + json.dumps(legacy_state()) + ";")
        page.goto(URL)
        page.evaluate("localStorage.removeItem(SLOT_CONFIG.key);localStorage.setItem(CONFIG.saveKey, JSON.stringify(window.LEGACY_FIXTURE))")
        page.reload()
        assert page.evaluate("state.version === CONFIG.saveVersion && state.life.origin === 'legacy'")
        assert "이번 학기 성적은 아직 공개되지" in page.locator("#scene").inner_text()
        assert page.locator("#scene table").count() == 0

        # 소개 면담은 행동을 쓰지 않으며, 과외는 독립된 수입·체력 설정을 갖습니다.
        assert button(page, "과외").is_disabled()
        click(page, "과외 소개 면담")
        click(page, "전공 기초 과목과 가능한 시간을 설명한다")
        assert page.evaluate("currentTerm().actions.length") == 0
        assert button(page, "과외").is_enabled()

        plans = [
            ["전공 공부", "연구실 참여", "휴식"],
            ["식사에서 들은 연구실 모집에 참여", "동아리 프로젝트", "휴식"],
            ["연구실 참여", "전공 공부", "휴식"],
            ["과외", "식사에서 들은 연구실 모집에 참여", "휴식"],
            ["국제 팀 대회에 지원", "국제 대회 준비", "휴식"],
            ["국제 대회 준비", "연구실 참여", "휴식"],
            ["전공 공부", "식사에서 들은 연구실 모집에 참여", "휴식"],
            ["연구실 참여", "카페 알바", "휴식"],
        ]
        for semester, actions in enumerate(plans, 1):
            prepare_term(page)
            if semester == 6:
                assert phase(page) == "competitionCrisis"
                money_before = page.evaluate("state.money")
                click(page, "발표 범위 축소와 핵심 업무 집중")
                assert page.evaluate("state.money") == money_before
            assert phase(page) == "semester"
            for index, title in enumerate(actions):
                click(page, title)
                if phase(page) == "competitionRole":
                    click(page, "데이터 분석")
                finish_event(page)
                if semester == 1 and index == 1:
                    click(page, "동기와 외식")
                    assert page.evaluate("state.flags.labNews")
                    assert button(page, "식사에서 들은 연구실 모집에 참여").is_enabled()
                if semester == 2 and index == 0:
                    count = page.evaluate("currentTerm().actions.length")
                    click(page, "학식")
                    assert page.evaluate("currentTerm().actions.length") == count
            if semester == 6:
                assert phase(page) == "competitionFinal"
                click(page, "최종 발표와 결과 공개")
                assert page.evaluate("state.competition.result.team.includes('미입상')")
                assert "실험 데이터를 정리" in page.locator("#scene").inner_text()
                click(page, "학기 마무리로")
            assert phase(page) == "reportReady"
            assert page.evaluate("currentTerm().report === null")
            click(page, "성적표 열기")
            assert page.locator("#scene tbody tr").count() == 4
            snapshot = page.evaluate("JSON.stringify({reports:state.terms.map(t=>t.report),gpa:cumulativeGpa()})")
            # 기록을 두 번 열고 새로고침해도 성적과 누적 평점이 바뀌지 않습니다.
            reveal(page.locator("#academic-menu > summary")).click()
            archive = page.locator("#reports > details").first
            archive.locator("summary").click()
            archive.locator("summary").click()
            page.reload()
            assert page.evaluate("JSON.stringify({reports:state.terms.map(t=>t.report),gpa:cumulativeGpa()})") == snapshot
            assert phase(page) == "report"
            click(page, "방학 계획 세우기")
            click(page, "유급 인턴 지원" if semester in (1, 4) else "방학 동안 쉬기")
            assert phase(page) == "vacationResult"
            click(page, "졸업 후 진로 보기" if semester == 8 else "다음 학기로")
        assert phase(page) == "hub"
        assert page.evaluate("state.terms.every(t=>t.actions.length === 3 && t.report)")
        assert page.evaluate("state.experiences.internship") == 2
        click(page, "취업 지원")
        click(page, "대회 데이터 분석 기여 활용해 면접 보고 일하기")
        assert phase(page) == "jobNext"
        assert page.evaluate("state.savings") == 150
        assert page.evaluate("state.practice") >= 7
        click(page, "국내외 석사 지원")
        admissions(page, "masters", "대회 데이터 분석 기여")
        assert page.evaluate("state.applications.every(a=>a.accepted)")
        assert page.evaluate("state.applications.every(a=>a.evidence.includes('미입상'))")
        assert "등록금" in page.locator("#scene").inner_text()
        # 거절 이후에도 준비·다음 모집 가능.
        click(page, "모든 제안 거절하고 다시 준비")
        assert phase(page) == "hub"
        click(page, "단기 연구 활동 후 다음 모집 준비")
        click(page, "석사 지원")
        admissions(page, "masters", "직장 실무 경험")
        page.locator(".opportunity").filter(has_text="대한민국").get_by_role("button", name="이 제안 수락").click()
        assert phase(page) == "graduateTerm"
        assert page.evaluate("state.master.turn") == 0
        from test_degree import complete_degree
        complete_degree(page)
        assert page.evaluate("state.master.actions.length") == 12
        click(page, "취업·박사 지원 살펴보기")
        click(page, "박사 지원")
        admissions(page, "phd", "석사 연구 성과")
        assert page.evaluate("state.applications.every(a=>a.accepted)")
        page.locator(".opportunity").filter(has_text="독일").get_by_role("button", name="이 제안 수락").click()
        complete_degree(page)
        click(page, "학위 취득 엔딩")
        assert phase(page) == "ending"
        assert "독일" in page.locator("#scene h2").inner_text()
        assert "오픈사이언스 연구실" in page.locator("#scene").inner_text()
        page.reload()
        assert phase(page) == "ending"

        # 별도 경계 검증: 잔액 부족, 전부 불합격, 조교 두 종류, 대회 지원금.
        page.evaluate("state = migrateSave(window.LEGACY_FIXTURE); state.money=0; render()")
        for title in ["편의점", "학식", "동기와 외식"]:
            meal_button = button(page, title)
            assert meal_button.is_disabled()
            assert "잔액 부족" in meal_button.inner_text()
        click(page, "식사 건너뛰기")
        for _ in range(3):
            click(page, "휴식")
            finish_event(page)
        click(page, "성적표 열기")
        assert phase(page) == "report"

        page.evaluate("state=migrateSave(window.LEGACY_FIXTURE); state.life.graduationYear=2031; state.phase='hub'; render()")
        click(page, "석사 지원")
        admissions(page, "masters", "앞으로의 학습 계획")
        assert page.evaluate("state.applications.every(a=>!a.accepted)")
        click(page, "진로 화면으로 돌아가기")
        assert phase(page) == "hub"
        click(page, "취업 지원")
        assert phase(page) == "jobBoard"

        page.evaluate("""state=migrateSave(window.LEGACY_FIXTURE); state.master={program:'kr-ms',turn:0,actions:[],research:0,completed:false};
                     state.phase='master';render()""")
        click(page, "수업 조교(TA)")
        assert page.evaluate("state.money") == 170
        assert page.evaluate("state.master.research") == 1
        page.evaluate("""state=migrateSave(window.LEGACY_FIXTURE);state.semester=6;
                     state.competition={role:'management',budget:20,preparation:1,crisis:null,result:null};
                     state.phase='competitionCrisis';render()""")
        click(page, "지원금 신청과 역할 재배분")
        assert page.evaluate("state.competition.budget") == 100
        assert page.evaluate("state.money") == 100
        page.set_viewport_size({"width": 375, "height": 800})
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
        # 외식 소식의 다른 분기, 잘못된 저장본 보호와 저장 차단 환경도 확인합니다.
        page.evaluate("state=migrateSave(window.LEGACY_FIXTURE); render()")
        click(page, "동기와 외식")
        assert page.evaluate("state.flags.clubNews")
        click(page, "식사에서 들은 동아리 프로젝트 합류")
        assert page.evaluate("state.experiences.club") == 1
        page.evaluate("localStorage.removeItem(SLOT_CONFIG.key);localStorage.setItem(CONFIG.saveKey, '{bad-json')")
        page.reload()
        assert page.evaluate("preserveUnreadableSave")
        click(page, "캐릭터 생성하고 시작")
        assert page.evaluate("localStorage.getItem(CONFIG.saveKey)") == "{bad-json"
        page.on("dialog", lambda dialog: dialog.accept())
        page.locator("#restart").click()
        assert page.evaluate("validSave(JSON.parse(localStorage.getItem(SLOT_CONFIG.key)).slots[0].data)")
        page.evaluate("() => { Storage.prototype.setItem = () => { throw new Error('blocked'); }; }")
        click(page, "캐릭터 생성하고 시작")
        assert "자동 저장 실패" in page.locator("#save-status").inner_text()
        assert not errors, errors
        browser.close()
        print("PASS: 8학기/24행동, 성적표 재열람·저장, 식사 제한·소식, 과외, 유급 인턴,")
        print("      미입상 대회→취업·석사 면접, 직장→복수 석사 지원, 거절·재지원,")
        print("      국내 석사 4학기→독일 박사 학위, RA/TA, 전부 불합격→취업, 대회 예산 분리, 모바일")


if __name__ == "__main__":
    run()
