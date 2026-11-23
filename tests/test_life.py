"""2단계 UI·마이그레이션 테스트: python3 test_life.py"""
# 프로젝트 루트에서 실행: python3 tests/test_life.py
import copy
import json
from playwright.sync_api import sync_playwright
from test_game import URL, button, click, finish_event, legacy_state, phase, prepare_term

RANDOM_SCRIPT = """
window.randomQueue = [];
window.randomCalls = 0;
let testSeed = 74021;
Math.random = () => {
  window.randomCalls++;
  if (window.randomQueue.length) return window.randomQueue.shift();
  testSeed = (Math.imul(testSeed, 1664525) + 1013904223) >>> 0;
  return testSeed / 4294967296;
};
"""


def new_page(browser, errors):
    page = browser.new_page(viewport={"width": 1180, "height": 900}, reduced_motion="reduce")
    page.add_init_script(RANDOM_SCRIPT)
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(URL)
    return page


def create_character(page, name="새봄", birth="2008", age="18"):
    assert phase(page) == "character"
    assert page.locator("#academic-menu").is_hidden()
    assert page.locator("#career-menu").is_hidden()
    page.locator("#character-name").fill(name)
    page.locator("#character-birth").fill(birth)
    click(page, "캐릭터 생성하고 시작")
    # Long-path fixtures require a STEM major, now generated rather than chosen.
    page.evaluate("state.character.interest='컴퓨터·데이터';commit()")
    # Nonstandard historical starting ages are fixture data, no longer creation controls.
    if age != "18":
        page.evaluate("(age)=>{state.character.startAge=age;state.life.year=state.character.birthYear+age;commit()}", int(age))
    assert phase(page) == "hsReady"
    assert page.evaluate("state.character.name") == name
    assert page.evaluate("characterAge()") == int(age)
    snapshot = page.evaluate("JSON.stringify({character:state.character, exam:entranceAttempt().exam})")
    page.reload()
    assert phase(page) == "hsReady"
    assert page.evaluate("JSON.stringify({character:state.character, exam:entranceAttempt().exam})") == snapshot
    assert page.evaluate("window.randomCalls") == 0
    click(page, "고등학교 성적표 공개")
    assert phase(page) == "hsReport"
    assert page.locator("#scene tbody tr").count() == 5
    assert f"{int(birth) + int(age) + 1}학년도 대학수학능력시험 성적표" in page.locator("#scene").inner_text()
    assert page.evaluate("Math.max(...Object.values(state.development.innate)) >= 82")
    assert page.evaluate("Math.min(...Object.values(state.development.innate)) <= 30")
    assert page.evaluate("Math.max(...Object.values(state.development.skills)) <= 52")


def apply_colleges(page, draws, colleges=("상록과학기술원", "은하종합대학교", "솔빛국립대학교", "들꽃미래대학교")):
    assert phase(page) == "hsReport"
    click(page, "대학과 전공 탐색")
    assert page.locator("#scene .opportunity").count() == 10
    for name in colleges:
        click(page, f"{name} 지원 목록에 담기")
    if len(colleges) == 4:
        assert button(page, "한울대학교 지원 목록에 담기").is_disabled()
    selection = page.evaluate("JSON.stringify(state.entrance.selection)")
    page.reload()
    assert phase(page) == "collegeExplore"
    assert page.evaluate("JSON.stringify(state.entrance.selection)") == selection
    before = page.evaluate("state.money")
    total = page.evaluate("state.entrance.selection.reduce((s,c)=>s+universityById(c.university).fee,0)")
    page.evaluate("(draws) => { window.randomQueue = draws; }", draws)
    # 같은 이전 DOM 노드에 두 번 클릭해도 접수비·추첨은 한 번만 처리합니다.
    target = button(page, "접수비를 내고 원서 접수").element_handle()
    target.evaluate("(button) => { button.click(); button.click(); }")
    assert phase(page) == "collegeMail"
    assert page.evaluate("state.money") == before - total
    snapshot = page.evaluate("JSON.stringify(entranceAttempt().applications)")
    page.reload()
    assert phase(page) == "collegeMail"
    assert page.evaluate("window.randomCalls") == 0
    assert page.evaluate("JSON.stringify(entranceAttempt().applications)") == snapshot
    assert page.evaluate("entranceAttempt().applications.every(a=>a.opened)")
    page.reload()
    assert page.evaluate("state.money") == before - total
    assert page.evaluate("entranceAttempt().applications.every(a=>a.opened)")
    click(page, "진학 선택으로")


def enter_university(page, name="들꽃미래대학교"):
    click(page, f"{name} 등록 결정")
    assert phase(page) == "collegeEnrollment"
    before_year = page.evaluate("state.life.year")
    before_age = page.evaluate("characterAge()")
    target = button(page, "대학 생활 시작").element_handle()
    target.evaluate("(button) => { button.click(); button.click(); }")
    assert phase(page) == "termBudget"
    assert page.evaluate("state.life.year") == before_year + 1
    assert page.evaluate("characterAge()") == before_age + 1
    page.reload()
    assert phase(page) == "termBudget"
    assert page.evaluate("state.life.year") == before_year + 1
    assert page.evaluate("state.life.admissionYear") == before_year + 1
    prepare_term(page)
    assert phase(page) == "semester"


def test_a(browser, errors):
    page = new_page(browser, errors)
    create_character(page)
    apply_colleges(page, [0, 0, 0, 0])
    assert page.evaluate("entranceAttempt().applications.every(a=>a.accepted)")
    enter_university(page)
    assert page.evaluate("characterAge()") == 19
    entry_year = page.evaluate("state.life.admissionYear")
    for semester in range(1, 9):
        prepare_term(page)
        assert phase(page) == "semester"
        assert page.evaluate("state.semester") == semester
        assert page.evaluate("state.life.year") == entry_year + (semester - 1) // 2
        assert page.evaluate("characterAge()") == 19 + (semester - 1) // 2
        actions = ["전공 공부", "연구실 참여", "휴식"] if semester == 1 else ["졸업 프로젝트", "휴식", "휴식"] if semester == 7 else ["휴식"] * 3
        # 정산 직후 잔액이 부족하면 프로젝트 재료비를 카페 근무로 마련합니다.
        if semester == 7 and page.evaluate("state.money") < 10:
            actions = ["카페 알바", "졸업 프로젝트", "휴식"]
        for title in actions:
            click(page, title)
            finish_event(page)
        assert phase(page) == "reportReady"
        click(page, "성적표 열기")
        report_snapshot = page.evaluate("JSON.stringify(currentTerm().report)")
        page.reload()
        assert page.evaluate("JSON.stringify(currentTerm().report)") == report_snapshot
        click(page, "방학 계획 세우기")
        click(page, "방학 동안 쉬기")
        click(page, "졸업 후 진로 보기" if semester == 8 else "다음 학기로")
        page.reload()
    assert phase(page) == "hub"
    assert page.evaluate("characterAge()") == 23
    assert page.evaluate("state.life.graduationYear") == 2031
    assert page.evaluate("state.terms.every(t=>t.actions.length===3 && t.report)")
    # 취업과 석사 턴도 연도에 연결되며 나이는 평가 입력에 들어가지 않습니다.
    click(page, "취업 지원")
    click(page, "연구실 경험 활용해 면접 보고 일하기")
    assert page.evaluate("characterAge()") == 24
    assert page.evaluate("state.life.year") == 2032
    page.reload()
    assert page.evaluate("characterAge()") == 24
    assert phase(page) == "jobNext"
    click(page, "국내외 석사 지원")
    assert phase(page) == "application"
    assert page.evaluate("'age' in evaluationInputs(75)") is False
    page.close()


def test_b(browser, errors):
    page = new_page(browser, errors)
    create_character(page, name="다시봄")
    first_exam = page.evaluate("JSON.stringify(entranceAttempt().exam)")
    apply_colleges(page, [.999] * 4)
    assert page.evaluate("entranceAttempt().applications.every(a=>!a.accepted)")
    assert button(page, "대학 외의 길 살펴보기").is_enabled()
    click(page, "재수 준비")
    assert phase(page) == "retake"
    assert page.evaluate("characterAge()") == 19
    assert page.evaluate("state.life.year") == 2027
    page.reload()
    assert page.evaluate("characterAge()") == 19
    for title in ["아르바이트 병행", "독학 재수", "영어 집중 공부", "휴식 및 멘탈 관리"]:
        click(page, title)
    assert phase(page) == "retakeReady"
    assert page.evaluate("state.entrance.retry.actions.length") == 4
    click(page, "다음 수능 성적 생성")
    assert phase(page) == "hsReady"
    assert page.evaluate("state.entrance.attempts.length") == 2
    assert page.evaluate("JSON.stringify(state.entrance.attempts[0].exam)") == first_exam
    new_exam = page.evaluate("JSON.stringify(entranceAttempt().exam)")
    assert new_exam != first_exam
    assert page.evaluate("entranceAttempt().exam.schoolGrade === state.entrance.attempts[0].exam.schoolGrade")
    page.reload()
    assert page.evaluate("JSON.stringify(entranceAttempt().exam)") == new_exam
    click(page, "고등학교 성적표 공개")
    apply_colleges(page, [0], colleges=("들꽃미래대학교",))
    enter_university(page)
    assert page.evaluate("characterAge()") == 20
    assert page.evaluate("state.life.year") == 2028
    assert page.evaluate("state.entrance.attempts.length") == 2
    assert page.evaluate("state.entrance.attempts[0].applications.every(a=>!a.accepted)")
    page.close()


def test_alternatives_and_boundaries(browser, errors):
    page = new_page(browser, errors)
    create_character(page, name="<새길>", birth="2000", age="18")
    assert "<새길>" in page.locator("#life-summary").inner_text()
    assert page.locator("#life-summary script").count() == 0
    # 지원하지 않은 모집도 기록되며 삼수 이상 계속하거나 다른 길을 선택할 수 있습니다.
    for _ in range(2):
        click(page, "대학과 전공 탐색")
        click(page, "이번 모집에서 지원하지 않기")
        click(page, "재수 준비")
        for _ in range(4):
            click(page, "휴식 및 멘탈 관리")
        click(page, "다음 수능 성적 생성")
        click(page, "고등학교 성적표 공개")
    assert page.evaluate("state.entrance.attempts.length") == 3
    assert page.evaluate("characterAge()") == 20
    click(page, "대학과 전공 탐색")
    click(page, "이번 모집에서 지원하지 않기")
    assert "적극적으로" in button(page, "대학 외의 길 살펴보기").inner_text()
    click(page, "대학 외의 길 살펴보기")
    click(page, "직업 교육 후 취업 준비")
    assert phase(page) == "jobBoard"
    assert page.evaluate("characterAge()") == 21
    click(page, "앞으로의 학습 계획 활용해 면접 보고 일하기")
    assert page.evaluate("characterAge()") == 22
    assert page.locator("#scene button").filter(has_text="국내외 석사 지원").count() == 0
    assert button(page, "대학 입시에 다시 도전").is_enabled()
    # 실제 잔액 부족 시 접수비와 재수 활동의 지출을 막습니다.
    page.evaluate("state.phase='hsReport'; state.flags.alternativeCareer=false; render()")
    click(page, "대학과 전공 탐색")
    click(page, "상록과학기술원 지원 목록에 담기")
    page.evaluate("state.money=0; render()")
    assert button(page, "접수비를 내고 원서 접수").is_disabled()
    click(page, "이번 모집에서 지원하지 않기")
    click(page, "재수 준비")
    assert button(page, "재수 학원 등록").is_disabled()
    assert button(page, "아르바이트 병행").is_enabled()
    # 성적 분포·확률의 일관성·재수 성적 하락 가능성에 대한 모델 검증.
    result = page.evaluate("""() => {
      const profiles = [], percentiles = [];
      const original = state.character;
      for(let i=0;i<100;i++){
        state.character=generateCharacter({...original});
        profiles.push(state.character.abilities.academic);
        percentiles.push(generateExam().percentile);
      }
      state.character=original;
      const university=UNIVERSITIES[4];
      const low={schoolScore:30,percentile:30,activity:30};
      const high={schoolScore:90,percentile:90,activity:90};
      const old=entranceAttempt().exam;
      const retry={general:0,subjects:{}};
      let declines=0;
      for(let i=0;i<50;i++) if(generateExam(old,retry).percentile<old.percentile) declines++;
      return {spread:Math.max(...percentiles)-Math.min(...percentiles),
              monotonic:admissionProbability(university,low)<admissionProbability(university,high), declines};
    }""")
    assert result["spread"] > 35, result
    assert result["monotonic"] and result["declines"] > 0, result
    page.set_viewport_size({"width": 375, "height": 800})
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    page.close()


def test_migration(browser, errors):
    page = new_page(browser, errors)
    old = legacy_state()
    old.update(semester=3, money=37, energy=42, research=2)
    old["experiences"] = {"study": 2, "lab": 2, "rest": 2, "cafe": 1}
    old["firstParticipation"] = {"lab": 1, "study": 1}
    for term in old["terms"][:2]:
        term.update(actions=["study", "lab", "rest"], vacationDone=True,
                    report={"courses": [{"name": "전공", "credits": 3, "point": 3.5, "grade": "B+"}], "gpa": 3.5})
    old["terms"][2]["actions"] = ["cafe"]
    raw = json.dumps(old, ensure_ascii=False)
    page.evaluate("(raw)=>{localStorage.removeItem(SLOT_CONFIG.key);localStorage.setItem(CONFIG.saveKey,raw)}", raw)
    page.reload()
    assert phase(page) == "semester"
    assert page.evaluate("state.semester") == 3
    assert page.evaluate("state.money") == 37
    assert page.evaluate("state.energy") == 42
    assert page.evaluate("state.life.year") == 2028
    assert page.evaluate("state.entrance.attempts.length") == 0
    assert page.evaluate("state.terms") == old["terms"]
    assert page.evaluate("localStorage.getItem(CONFIG.saveKey+':backup-v1')") == raw
    migrated = page.evaluate("JSON.stringify({...state,notice:''})")
    page.reload()
    assert page.evaluate("JSON.stringify({...state,notice:''})") == migrated
    click(page, "휴식")
    finish_event(page)
    assert phase(page) == "semester"
    assert page.evaluate("currentTerm().actions.length") == 2

    # 이전 대학원 면접·확정 결과·연구 성과도 입시로 되돌리지 않습니다.
    graduate = copy.deepcopy(old)
    graduate.update(phase="interview", semester=8, jobTurns=1, round=1)
    graduate["terms"][7]["vacationDone"] = True
    graduate["applications"] = [{"id": "kr-ms", "status": "applied", "interview": 0,
                                  "evidence": "", "score": None, "accepted": None}]
    page.evaluate("(save)=>{localStorage.removeItem(SLOT_CONFIG.key);localStorage.setItem(CONFIG.saveKey,JSON.stringify(save))}", graduate)
    page.reload()
    assert phase(page) == "interview"
    assert page.evaluate("state.applications") == graduate["applications"]
    assert page.evaluate("state.life.year") == 2032
    assert page.evaluate("state.research") == graduate["research"]

    # 8학기 방학 결과에서 이주해도 졸업 전 연도가 두 번 증가하지 않습니다.
    boundary = copy.deepcopy(graduate)
    boundary.update(phase="vacationResult", jobTurns=0)
    boundary["terms"][7]["vacationResult"] = "방학을 마쳤다."
    page.evaluate("(save)=>{localStorage.removeItem(SLOT_CONFIG.key);localStorage.setItem(CONFIG.saveKey,JSON.stringify(save))}", boundary)
    page.reload()
    assert page.evaluate("state.life.year") == 2030
    click(page, "졸업 후 진로 보기")
    assert page.evaluate("state.life.year") == 2031
    page.reload()
    assert page.evaluate("state.life.year") == 2031
    page.close()


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        errors = []
        test_a(browser, errors)
        test_b(browser, errors)
        test_alternatives_and_boundaries(browser, errors)
        test_migration(browser, errors)
        assert not errors, errors
        browser.close()
        print("PASS A: 캐릭터→고교 성적→복수 지원·합격→입학→8학기→졸업→직장→석사 지원")
        print("PASS B: 전부 불합격→재수 4행동→새 성적→합격→1년 늦은 입학")
        print("PASS: 삼수·대체 경로, 비용 부족, 난수 고정 저장, 중복 클릭, 연도·나이, 모바일")
        print("PASS: v1 학부·대학원 저장 호환, 원본 백업, 기존 성적·자금 유지, 졸업 경계 복원")


if __name__ == "__main__":
    run()
