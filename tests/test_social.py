"""4단계: python3 test_social.py"""
# 프로젝트 루트에서 실행: python3 tests/test_social.py
import json
from playwright.sync_api import sync_playwright
from test_game import button, click, phase, prepare_term, admissions
from test_life import new_page
from test_campus import start_budget, finish_term


def resolve_events(page):
    for _ in range(5):
        current = phase(page)
        if current == "campus":
            page.locator("#scene button:enabled").first.click()
        elif current == "wellbeing":
            click(page, "상담과 충분한 수면으로 회복")
        elif current == "relationshipEvent":
            click(page, "서로의 일정과 연락 방식을 조율한다")
        else:
            return
    raise AssertionError("이벤트가 반복됩니다")


def prepare_social_term(page):
    prepare_term(page)
    if phase(page) == "competitionCrisis":
        click(page, "지원금 신청과 역할 재배분")


def test_npc_butterfly(browser, errors):
    page = start_budget(browser, errors)
    # 해외 진학/협업 면접 경로의 어학 사전 준비 픽스처.
    page.evaluate("state.development.skills.language=60;syncLearnedAbility('language');commit()")
    prepare_term(page)
    click(page, "사람들과 시간 보내기")
    click(page, "박서우의 과제 돕기")
    assert page.evaluate("currentTerm().actions.length") == 1
    assert page.evaluate("state.social.npcs.peer.trust") == 30
    click(page, "사람들과 시간 보내기")
    click(page, "박서우와 대화")
    assert page.evaluate("state.flags.tutorApproved")
    assert page.evaluate("state.social.npcs.peer.intimacy") == 42
    assert button(page, "박서우와 대화").is_disabled()
    snapshot = page.evaluate("JSON.stringify(state.social)")
    page.reload()
    assert phase(page) == "relationships"
    assert page.evaluate("JSON.stringify(state.social)") == snapshot
    click(page, "학기로 돌아가기")
    assert button(page, "과외").is_enabled()
    for title in ["연구실 참여", "휴식"]:
        click(page, title)
        resolve_events(page)
    finish_term(page)
    for semester in range(2, 9):
        prepare_social_term(page)
        if semester == 5:
            assert page.evaluate("state.social.unlocked.competitionTeam")
            click(page, "국제 팀 대회에 지원")
            click(page, "데이터 분석")
            assert page.evaluate("state.competition.teammate") == "peer"
            assert page.evaluate("state.competition.support") == 1
            titles = ["국제 대회 준비", "휴식"]
        elif semester == 6:
            titles = ["국제 대회 준비", "연구실 참여", "휴식"]
        elif semester == 7:
            titles = ["졸업 프로젝트", "연구실 참여", "휴식"]
        else:
            titles = ["연구실 참여", "전공 공부", "휴식"]
        for title in titles:
            click(page, title)
            resolve_events(page)
        if semester == 6:
            click(page, "최종 발표와 결과 공개")
            assert page.evaluate("state.competition.result.team") == "우수 협업상 입상"
            assert "박서우" in page.locator("#scene").inner_text()
            click(page, "학기 마무리로")
        finish_term(page)
    assert phase(page) == "hub"
    assert page.evaluate("state.social.unlocked.professorRecommendation")
    letters = page.evaluate("state.recommendations")
    page.evaluate("checkSocialOpportunities();checkSocialOpportunities()")
    assert page.evaluate("state.recommendations") == letters
    click(page, "석사 지원")
    admissions(page, "masters", "대회 데이터 분석 기여")
    assert page.evaluate("state.applications.every(a=>a.evidence.includes('박서우'))")
    assert page.evaluate("state.applications.every(a=>a.accepted)")
    assert page.evaluate("state.social.npcs.peer.history.some(h=>h.semester===1)")
    page.close()


def test_romance_and_distance(browser, errors):
    page = start_budget(browser, errors)
    page.evaluate("state.development.skills.language=60;syncLearnedAbility('language');commit()")
    rejected_checkpoint = None
    for semester in range(1, 9):
        prepare_social_term(page)
        click(page, "사람들과 시간 보내기")
        if semester in (1, 2, 4):
            click(page, "이하람과 대화")
        elif semester == 3:
            click(page, "이하람을 조금 더 알아가기")
            assert page.evaluate("state.social.npcs.clubmate.romanceStage") == "flirting"
        elif semester == 5:
            rejected_checkpoint = page.evaluate("JSON.stringify(state)")
            page.evaluate("window.randomQueue=[0]")
            click(page, "이하람에게 고백")
            assert page.evaluate("state.social.romance.npc") == "clubmate"
            saved = page.evaluate("JSON.stringify(state.social.npcs.clubmate.lastConfession)")
            page.reload()
            assert page.evaluate("JSON.stringify(state.social.npcs.clubmate.lastConfession)") == saved
        elif semester == 6:
            money = page.evaluate("state.money")
            happiness = page.evaluate("state.character.abilities.happiness")
            click(page, "이하람과 데이트")
            assert page.evaluate("state.money") == money - 12
            assert page.evaluate("state.character.abilities.happiness") >= happiness
        elif semester == 7:
            click(page, "관계에 대해 솔직히 이야기하기")
            click(page, "서로의 일정과 연락 방식을 조율한다")
            assert phase(page) == "relationships"
            assert button(page, "관계에 대해 솔직히 이야기하기").is_disabled()
        click(page, "학기로 돌아가기")
        titles = ["졸업 프로젝트", "연구실 참여", "휴식"] if semester == 7 else ["연구실 참여", "전공 공부", "휴식"]
        for title in titles:
            click(page, title)
            resolve_events(page)
        if semester == 5:
            page.evaluate("window.randomQueue=[0]")
        finish_term(page)
        if semester == 5:
            assert page.evaluate("state.social.pendingEvent.kind") == "conflict"
            pending = page.evaluate("JSON.stringify(state.social.pendingEvent)")
            page.reload()
            assert page.evaluate("JSON.stringify(state.social.pendingEvent)") == pending
    assert phase(page) == "hub"
    assert page.evaluate("state.social.romance.npc") == "clubmate"
    assert page.evaluate("state.social.romanceHistory.some(h=>h.text.includes('갈등을 대화'))")
    click(page, "취업 지원")
    click(page, "연구실 경험 활용해 면접 보고 일하기")
    click(page, "국내외 석사 지원")
    admissions(page, "masters", "연구실 경험")
    checkpoint = page.evaluate("JSON.stringify(state)")
    page.locator(".opportunity").filter(has_text="미국").get_by_role("button", name="이 제안 수락").click()
    assert phase(page) == "relationshipEvent"
    assert page.evaluate("state.social.pendingEvent.kind") == "distance"
    money = page.evaluate("state.money")
    page.reload()
    assert page.evaluate("state.money") == money
    click(page, "장거리 연락과 만남 계획 세우기")
    assert phase(page) == "graduateTerm"
    assert page.evaluate("state.social.romance.longDistance")
    click(page, "잠시 쉬고 생활비 상담")
    assert button(page, "잠시 쉬고 생활비 상담").is_disabled()
    aid = page.evaluate("state.money")
    page.reload()
    assert page.evaluate("state.money") == aid
    assert button(page, "잠시 쉬고 생활비 상담").is_disabled()
    from test_degree import complete_degree
    complete_degree(page)
    assert page.evaluate("state.social.romance.longDistance")
    assert page.evaluate("state.master.completed")
    page.close()

    # 같은 진학 제안에서도 이별을 선택해 학업은 동일하게 이어갈 수 있습니다.
    page = new_page(browser, errors)
    page.evaluate("(raw)=>{localStorage.removeItem(SLOT_CONFIG.key);localStorage.setItem(CONFIG.saveKey,raw)}", checkpoint)
    page.reload()
    page.locator(".opportunity").filter(has_text="미국").get_by_role("button", name="이 제안 수락").click()
    click(page, "서로의 선택을 존중하며 이별한다")
    assert phase(page) == "graduateTerm"
    assert page.evaluate("state.social.romance") is None
    assert page.evaluate("state.social.romanceHistory.some(h=>h.text.includes('관계를 정리'))")
    complete_degree(page)
    assert phase(page) == "graduateDone"
    page.close()

    # 고백 거절 결과도 다시 열어 재추첨할 수 없습니다.
    page = new_page(browser, errors)
    page.evaluate("(raw)=>{localStorage.removeItem(SLOT_CONFIG.key);localStorage.setItem(CONFIG.saveKey,raw)}", rejected_checkpoint)
    page.reload()
    page.evaluate("window.randomQueue=[.999]")
    click(page, "이하람에게 고백")
    assert page.evaluate("state.social.romance") is None
    assert page.evaluate("state.social.npcs.clubmate.lastConfession.accepted") is False
    page.reload()
    assert page.evaluate("state.social.npcs.clubmate.lastConfession.accepted") is False
    assert button(page, "이하람에게 고백").is_disabled()
    click(page, "학기로 돌아가기")
    assert phase(page) == "semester"
    page.close()


def test_wellbeing_and_v3(browser, errors):
    page = start_budget(browser, errors)
    prepare_term(page)
    # 실제 활동과 이후 회복 화면을 통한 경계 검증.
    page.evaluate("state.character.abilities.stress=82")
    research = page.evaluate("state.research")
    click(page, "연구실 참여")
    assert phase(page) == "wellbeing"
    assert page.evaluate("state.research") == research + .5
    assert page.evaluate("state.social.strainTerms[1]")
    snapshot = page.evaluate("JSON.stringify({social:state.social,abilities:state.character.abilities})")
    page.reload()
    assert page.evaluate("JSON.stringify({social:state.social,abilities:state.character.abilities})") == snapshot
    click(page, "상담과 충분한 수면으로 회복")
    assert phase(page) == "semester"
    assert page.evaluate("state.character.abilities.stress") == 57
    click(page, "휴식")
    resolve_events(page)
    assert page.evaluate("state.character.abilities.stress") == 32
    assert page.evaluate("state.social.npcs.peer.trust") >= 13
    # v3 원장·성적·돈을 유지하면서 신규 NPC 기본값만 보충합니다.
    saved = page.evaluate("""() => {
      const old=JSON.parse(JSON.stringify(state));delete old.social;old.version=3;
      return old;
    }""")
    raw = json.dumps(saved, ensure_ascii=False)
    page.evaluate("(raw)=>{localStorage.removeItem(SLOT_CONFIG.key);localStorage.setItem(CONFIG.saveKey,raw)}", raw)
    page.reload()
    assert phase(page) == saved["phase"]
    assert page.evaluate("state.campus") == saved["campus"]
    assert page.evaluate("state.terms") == saved["terms"]
    assert page.evaluate("state.money") == saved["money"]
    assert page.evaluate("state.version===CONFIG.saveVersion")
    assert page.evaluate("localStorage.getItem(CONFIG.saveKey+':backup-v3')") == raw
    assert page.evaluate("Object.keys(state.social.npcs).length") == 7
    page.set_viewport_size({"width": 375, "height": 800})
    click(page, "사람들과 시간 보내기")
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    page.close()


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        errors = []
        test_npc_butterfly(browser, errors)
        test_romance_and_distance(browser, errors)
        test_wellbeing_and_v3(browser, errors)
        assert not errors, errors
        browser.close()
        print("PASS 4단계: NPC 신뢰·친밀도·과외 소개·교수 추천서·1학년 도움→대회 동료→석사 면접")
        print("PASS 4단계: 알아가기→썸→고백/거절→데이트→갈등 조율→해외 석사 장거리/이별→석사 졸업")
        print("PASS 4단계: 보상 반복 방지·추첨 저장·스트레스 성과 영향/회복·v3 원장 보존·모바일")


if __name__ == "__main__":
    run()
