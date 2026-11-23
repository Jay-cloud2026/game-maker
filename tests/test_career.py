"""6단계: python3 test_career.py"""
# 프로젝트 루트에서 실행: python3 tests/test_career.py
import json
from playwright.sync_api import sync_playwright
from test_game import click, button, phase, prepare_term, legacy_state
from test_life import new_page
from test_campus import start_budget, finish_term


def graduate_page(browser, errors):
    page = new_page(browser, errors)
    old = legacy_state()
    page.evaluate("""(old)=>{
      state=migrateSave(old);state.life.year=2031;state.life.graduationYear=2031;
      state.life.highestDegree='학사';state.semester=8;state.phase='hub';
      state.research=4;state.practice=3;state.recommendations=2;
      state.experiences={lab:2,club:2};state.social.npcs.peer.trust=60;
      state.campus.debt=200;state.campus.borrowed=200;state.money=200;
      for(let i=0;i<8;i++)state.terms[i].report={gpa:3.5,courses:[{name:'전공',credits:3,point:3.5,grade:'B+'}]};
      commit();
    }""", old)
    return page


def reveal_documents(page, names):
    for name in names:
        click(page, f"{name} 서류 결과 확인")
    click(page, "기업 면접으로")


def resolve_work(page):
    assert phase(page) == "workEvent"
    page.locator("#scene button:enabled").last.click()
    assert phase(page) == "jobNext"


def test_hiring_work_and_venture(browser, errors):
    page = graduate_page(browser, errors)
    # 연구직은 이제 석사 학위를 요구합니다. 채용 절차 테스트의 명시적 학위 픽스처.
    page.evaluate("state.master={program:'kr-ms',turn:2,actions:['연구 프로젝트','발표 준비'],research:6,completed:true};state.life.highestDegree='석사';commit()")
    assert page.evaluate("referralBonus()") == 8
    click(page, "취업 지원")
    assert phase(page) == "jobBoard"
    assert page.locator("#scene button").filter(has_text="지원 선택").count() == 6
    names = ["한빛테크놀로지", "미래정밀솔루션", "늘봄융합연구원"]
    for name in names:
        click(page, f"{name} 지원 선택")
    assert button(page, "다온웨이브 지원 선택").is_disabled()
    page.evaluate("window.randomQueue=[0,.999,0]")
    click(page, "지원서 제출")
    snapshot = page.evaluate("JSON.stringify(state.career.applications)")
    page.reload()
    assert page.evaluate("JSON.stringify(state.career.applications)") == snapshot
    assert page.evaluate("window.randomCalls") == 0
    reveal_documents(page, names)
    page.evaluate("window.randomQueue=[0,.999]")
    click(page, "동아리 협업")
    click(page, "연구실 경험")
    assert phase(page) == "jobResults"
    page.reload()
    assert page.evaluate("state.career.applications.filter(a=>a.accepted).length") == 1
    for name in [names[0], names[2]]:
        click(page, f"{name} 최종 메일 열기")
    click(page, "입사 제안 비교")
    click(page, "한빛테크놀로지 입사")
    assert phase(page) == "employmentDecision"
    click(page, "직장 생활 계속 진행")
    assert page.evaluate("state.career.salary") == 4650  # Related master's +400, lab record +50.
    money = page.evaluate("state.money")
    age = page.evaluate("characterAge()")
    target = button(page, "핵심 프로젝트 완수").element_handle()
    target.evaluate("(button)=>{button.click();button.click()}")
    assert page.evaluate("state.money") == money + 1743 - 200
    assert page.evaluate("state.campus.debt") == 0
    assert page.evaluate("characterAge()") == age + 1
    assert page.evaluate("state.career.workHistory.length") == 1
    page.reload()
    resolve_work(page)
    assert page.evaluate("state.career.events.at(-1).resolved")
    click(page, "직장 생활 계속하기")
    click(page, "핵심 프로젝트 완수")
    assert page.evaluate("state.career.pendingEvent.kind") == "promotion"
    promotion_salary = int(page.evaluate("state.career.salary") * 1.08 + .5)
    click(page, "승진을 수락한다")
    assert page.evaluate("state.career.salary") == promotion_salary
    page.reload()
    assert page.evaluate("state.career.salary") == promotion_salary
    click(page, "직장 생활 계속하기")
    click(page, "새 사업 아이디어 검증")
    assert page.evaluate("state.career.pendingEvent.kind") == "transfer"
    click(page, "이직 공고를 살펴본다")
    assert page.evaluate("state.career.employer") == "hanbit"
    click(page, "미래정밀솔루션 지원 선택")
    page.evaluate("window.randomQueue=[0]")
    click(page, "지원서 제출")
    reveal_documents(page, ["미래정밀솔루션"])
    page.evaluate("window.randomQueue=[0]")
    click(page, "직장 실무 경험")
    click(page, "미래정밀솔루션 최종 메일 열기")
    click(page, "입사 제안 비교")
    click(page, "미래정밀솔루션 입사")
    click(page, "직장 생활 계속 진행")
    assert page.evaluate("state.career.employmentHistory[0].endYear") is not None
    assert page.evaluate("state.career.employer") == "mirae"
    click(page, "균형 있게 일하기")
    resolve_work(page)
    money = page.evaluate("state.money")
    click(page, "창업 시작")
    assert page.evaluate("state.money") == money - 100
    assert phase(page) == "venture"
    assert page.evaluate("state.career.employer") is None
    for _ in range(2):
        page.evaluate("window.randomQueue=[0]")
        click(page, "제품 개발과 고객 검증")
    assert page.evaluate("state.career.venture.traction") == 2
    snapshot = page.evaluate("JSON.stringify(state.career.venture)")
    money = page.evaluate("state.money")
    page.reload()
    assert page.evaluate("JSON.stringify(state.career.venture)") == snapshot
    assert page.evaluate("state.money") == money
    click(page, "사업 정리 후 재취업 준비")
    assert phase(page) == "jobBoard"
    assert page.evaluate("state.career.ventures.length") == 1
    click(page, "채용 준비에서 돌아가기")
    assert phase(page) == "hub"
    click(page, "박사 지원")
    assert phase(page) == "application"
    page.close()


def test_failure_events_and_v5(browser, errors):
    page = graduate_page(browser, errors)
    click(page, "취업 지원")
    click(page, "공감도시공사 지원 선택")
    page.evaluate("window.randomQueue=[.999]")
    click(page, "지원서 제출")
    click(page, "공감도시공사 서류 결과 확인")
    click(page, "지원 결과 정리")
    assert phase(page) == "jobDecision"
    click(page, "다음 채용에 다시 지원")
    old_practice = page.evaluate("state.practice")
    clock = page.evaluate("state.life.year*2+state.life.half")
    click(page, "직무 준비 프로젝트")
    assert page.evaluate("state.practice") == old_practice + 2
    assert page.evaluate("state.life.year*2+state.life.half") == clock + 1
    # 이전 버전의 진행 중인 첫 직장 턴을 강제로 새 채용으로 되돌리지 않습니다.
    old = page.evaluate("()=>{const old=JSON.parse(JSON.stringify(state));delete old.career;old.version=5;old.phase='job';return old}")
    raw = json.dumps(old, ensure_ascii=False)
    page.evaluate("(raw)=>{localStorage.removeItem(SLOT_CONFIG.key);localStorage.setItem(CONFIG.saveKey,raw)}", raw)
    page.reload()
    assert phase(page) == "job"
    assert page.evaluate("state.study") == old["study"]
    assert page.evaluate("state.campus") == old["campus"]
    assert page.evaluate("state.money") == old["money"]
    assert page.evaluate("localStorage.getItem(CONFIG.saveKey+':backup-v5')") == raw
    click(page, "연구실 경험 활용해 면접 보고 일하기")
    assert phase(page) == "jobNext"
    page.close()

    page = start_budget(browser, errors)
    prepare_term(page)
    click(page, "동아리 프로젝트")
    page.evaluate("window.randomQueue=[.3]")
    click(page, "동아리 프로젝트")
    assert page.evaluate("currentTerm().event") == "seniorProject"
    snapshot = page.evaluate("JSON.stringify(state.career.campusRolls)")
    page.reload()
    assert page.evaluate("JSON.stringify(state.career.campusRolls)") == snapshot
    click(page, "후속 프로젝트 소식을 받는다")
    assert page.evaluate("state.flags.industryInvite")
    before = page.evaluate("state.practice")
    click(page, "선배의 산학 협업 참여")
    assert page.evaluate("state.practice") == before + 2
    assert page.evaluate("state.flags.industryInvite") is False
    assert page.evaluate("careerEvidence().some(e=>e.id==='referral')")
    finish_term(page)
    prepare_term(page)
    click(page, "휴식")
    page.evaluate("window.randomQueue=[.3]")
    click(page, "휴식")
    assert page.evaluate("currentTerm().event") != "seniorProject"
    page.set_viewport_size({"width": 375, "height": 800})
    assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
    page.close()


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        errors = []
        test_hiring_work_and_venture(browser, errors)
        test_failure_events_and_v5(browser, errors)
        assert not errors, errors
        browser.close()
        print("PASS 6단계: 6종 기업·복수 서류/면접/최종 메일/입사·고정 추첨·급여/상환/승진")
        print("PASS 6단계: 현 직장 유지 이직·퇴사·창업/재취업·대학원 지원·NPC 소개와 후속 협업")
        print("PASS 6단계: 전부 불합격 후 준비·중복 급여/시간 방지·조건부 사건 중복 방지·v5 보존")


if __name__ == "__main__":
    run()
