"""5단계 UI 및 저장 회귀: python3 test_study.py"""
# 프로젝트 루트에서 실행: python3 tests/test_study.py
import json
from playwright.sync_api import sync_playwright
from test_game import click, button, phase, prepare_term, admissions
from test_campus import start_budget, finish_term
from test_social import resolve_events
from test_life import new_page


def confirm_activity(page):
    assert phase(page) == "studyResult"
    click(page, "활동 결과 확인")
    resolve_events(page)


def test_labs(browser, errors):
    page = start_budget(browser, errors)
    prepare_term(page)
    click(page, "연구실·어학 활동")
    click(page, "재현과학 연구실 선택")
    click(page, "진행으로 돌아가기")
    before = page.evaluate("state.research")
    click(page, "연구실 참여")
    assert page.evaluate("state.research") == before + 1.5
    click(page, "휴식")
    resolve_events(page)
    click(page, "연구실·어학 활동")
    page.evaluate("window.randomQueue=[.999]")
    click(page, "연구 프로젝트 진행")
    assert page.evaluate("state.study.events[0].success") is False
    research = page.evaluate("state.research")
    page.reload()
    assert page.evaluate("state.research") == research
    assert page.evaluate("state.study.events[0].success") is False
    confirm_activity(page)
    finish_term(page)
    prepare_term(page)
    click(page, "카페 알바")
    click(page, "연구실·어학 활동")
    page.evaluate("window.randomQueue=[0]")
    click(page, "연구 프로젝트 진행")
    confirm_activity(page)
    click(page, "연구실·어학 활동")
    count = page.evaluate("state.recommendations")
    click(page, "지도교수 추천서 요청")
    assert page.evaluate("state.recommendations") == count + 1
    assert button(page, "지도교수 추천서 요청").is_disabled()
    page.evaluate("window.randomQueue=[0]")
    click(page, "논문 공동 저자 도전")
    assert page.evaluate("state.study.papers.length") == 1
    confirm_activity(page)
    finish_term(page)
    prepare_term(page)
    click(page, "연구실·어학 활동")
    count = page.evaluate("state.recommendations")
    click(page, "지도교수 추천서 요청")
    assert page.evaluate("state.recommendations") == count  # 품질 갱신, 새 추천서 중복 지급 아님
    assert page.evaluate("recommendationQuality()") > 70
    click(page, "학회 발표 참여")
    confirm_activity(page)
    assert page.evaluate("state.study.conferences.length") == 1
    assert page.evaluate("careerEvidence().some(e=>e.id==='paper') && careerEvidence().some(e=>e.id==='conference')")
    # v4 원본 데이터의 비파괴 이전.
    old = page.evaluate("() => {const old=JSON.parse(JSON.stringify(state));delete old.study;old.version=4;return old}")
    raw = json.dumps(old, ensure_ascii=False)
    page.evaluate("(raw)=>{localStorage.removeItem(SLOT_CONFIG.key);localStorage.setItem(CONFIG.saveKey,raw)}", raw)
    page.reload()
    assert phase(page) == old["phase"]
    assert page.evaluate("state.campus") == old["campus"]
    assert page.evaluate("state.social") == old["social"]
    assert page.evaluate("state.money") == old["money"]
    assert page.evaluate("localStorage.getItem(CONFIG.saveKey+':backup-v4')") == raw
    page.close()


def test_exchange_leave_life(browser, errors):
    page = start_budget(browser, errors)
    # 교환·관계 경로 검증용 사전 어학 훈련 이력. 이제 공부 3회로 어학 60을 얻지 않습니다.
    page.evaluate("state.development.skills.language=65;syncLearnedAbility('language');commit()")
    initial_year = page.evaluate("state.life.year")
    for semester in range(1, 9):
        if semester == 4:
            before = page.evaluate("state.money")
            year = page.evaluate("state.life.year")
            click(page, "1년 휴학 신청")
            assert page.evaluate("state.life.year") == year + 1
            for title in ["휴학 중 아르바이트", "휴학 중 어학 공부", "복학 준비"]:
                click(page, title)
            assert phase(page) == "leaveReady"
            assert page.evaluate("state.money") == before + 95
            assert page.evaluate("currentTerm().actions.length") == 0
            page.reload()
            assert page.evaluate("state.life.year") == year + 1
            click(page, "복학하기")
            assert phase(page) == "termBudget"
        prepare_term(page)
        if semester == 7:
            assert phase(page) == "relationshipEvent"
            assert page.evaluate("state.study.exchangeActive.program") == "us"
            assert page.evaluate("state.campus.ledgers[7].quote.rent") == 65
            assert page.evaluate("state.campus.ledgers[7].quote.travel") == 45
            money = page.evaluate("state.money")
            page.reload()
            assert page.evaluate("state.money") == money
            click(page, "짧고 자주 연락하며 장거리 시도")
            assert page.evaluate("state.social.romance.longDistance")
        click(page, "사람들과 시간 보내기")
        if semester in (1, 2, 4):
            click(page, "이하람과 대화")
        elif semester == 3:
            click(page, "이하람을 조금 더 알아가기")
        elif semester == 5:
            page.evaluate("window.randomQueue=[0]")
            click(page, "이하람에게 고백")
        click(page, "학기로 돌아가기")
        if semester in (1, 2):
            click(page, "연구실·어학 활동")
            click(page, "어학 공부")
            confirm_activity(page)
            titles = ["연구실 참여", "휴식"]
        elif semester == 3:
            click(page, "카페 알바")
            click(page, "연구실·어학 활동")
            for test in ["TOEIC", "TOEFL", "IELTS"]:
                page.evaluate("window.randomQueue=[.5]")
                click(page, f"{test} 응시")
                score = page.evaluate("state.study.exams.at(-1).score")
                page.reload()
                assert page.evaluate("state.study.exams.at(-1).score") == score
                confirm_activity(page)
                assert button(page, f"{test} 응시").is_disabled()
            click(page, "어학 공부")
            confirm_activity(page)
            titles = ["연구실 참여"]
        elif semester == 6:
            click(page, "교환학생 살펴보기")
            assert page.locator("#scene button").filter(has_text="교환학생 지원").count() == 5
            page.evaluate("window.randomQueue=[0,0]")
            click(page, "미국 교환학생 지원")
            app = page.evaluate("JSON.stringify(state.study.exchangeApplications.at(-1))")
            page.reload()
            assert page.evaluate("JSON.stringify(state.study.exchangeApplications.at(-1))") == app
            click(page, "교환학생 결과 메일 열기")
            click(page, "교환 제안 수락")
            resolve_events(page)
            titles = ["연구실 참여", "휴식"]
        else:
            titles = ["졸업 프로젝트", "연구실 참여", "휴식"] if semester == 7 else ["연구실 참여", "전공 공부", "휴식"]
        for title in titles:
            click(page, title)
            resolve_events(page)
        if semester == 7:
            click(page, "성적표 열기")
            assert page.evaluate("currentTerm().report.courses.every(c=>c.name.startsWith('교환 인정'))")
            click(page, "방학 계획 세우기")
            click(page, "방학 동안 쉬기")
            click(page, "다음 학기로")
            assert page.evaluate("state.study.exchanges.length") == 1
            assert page.evaluate("state.social.romance.longDistance") is False
        else:
            finish_term(page)
    assert phase(page) == "hub"
    assert page.evaluate("state.life.graduationYear") == initial_year + 5
    assert page.evaluate("characterAge()") == 24
    assert page.evaluate("state.study.leaves.length") == 1
    assert page.evaluate("state.study.contacts.length") == 1
    assert page.evaluate("state.study.exams.length") == 3
    assert page.evaluate("state.campus.transactions.filter(t=>t.kind==='settlement').length") == 8
    click(page, "취업 지원")
    click(page, "연구실 경험 활용해 면접 보고 일하기")
    click(page, "국내외 석사 지원")
    admissions(page, "masters", "교환학생 국제 협업")
    assert page.evaluate("state.applications.every(a=>a.evidence.includes('교환학생'))")
    page.locator(".opportunity").filter(has_text="대한민국").get_by_role("button", name="이 제안 수락").click()
    from test_degree import complete_degree
    complete_degree(page)
    assert page.evaluate("state.master.turn") == 4
    click(page, "취업·박사 지원 살펴보기")
    click(page, "박사 지원")
    admissions(page, "phd", "교환학생 국제 협업")
    page.locator(".opportunity").filter(has_text="독일").get_by_role("button", name="이 제안 수락").click()
    assert phase(page) == "relationshipEvent"
    click(page, "장거리 연락과 만남 계획 세우기")
    assert phase(page) == "graduateTerm"
    complete_degree(page)
    click(page, "학위 취득 엔딩")
    assert page.evaluate("state.life.highestDegree") == "박사"
    assert page.evaluate("state.reflection.snapshot.age") == page.evaluate("characterAge()")
    page.set_viewport_size({"width": 375, "height": 800})
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    page.close()


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        errors = []
        test_labs(browser, errors)
        test_exchange_leave_life(browser, errors)
        assert not errors, errors
        browser.close()
        print("PASS 5단계: 교수 스타일·연구비·재현 실패·논문·학회·기여 기반 추천서 품질")
        print("PASS 5단계: 어학 3종 고정 결과·휴학→복학·연애→교환→장거리→귀국→졸업→석사 면접")
        print("PASS 연구 회귀: 해외 주거 단일 정산·석사4/박사8학기·v4 보존·나이·모바일")


if __name__ == "__main__":
    run()
