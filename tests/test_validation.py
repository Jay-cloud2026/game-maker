"""8단계 저장·엔딩 경계 검증. A~F 경로는 전체 스위트의 UI 테스트에서 실행합니다."""
# 프로젝트 루트에서 실행: python3 tests/test_validation.py
import copy
import json
from playwright.sync_api import sync_playwright
from test_game import legacy_state, click, phase
from test_life import new_page
from test_career import graduate_page


def test_versions(browser, errors):
    page = new_page(browser, errors)
    legacy = legacy_state()
    legacy.update(money=44, energy=53, semester=2)
    legacy["terms"][1]["actions"] = ["study"]
    page.evaluate("(legacy)=>{state=migrateSave(legacy)}", legacy)
    full = page.evaluate("JSON.parse(JSON.stringify(state))")
    for version in range(1, 13):
        if version == 1:
            old = copy.deepcopy(legacy)
        else:
            old = copy.deepcopy(full)
            remove = {
                2: ["campus", "academic", "social", "study", "career", "reflection"],
                3: ["social", "study", "career", "reflection"],
                4: ["study", "career", "reflection"],
                5: ["career", "reflection"],
                6: ["reflection"],
                7: ["development"],
                8: ["graduateAdmissions"],
                9: ["postgraduate", "wellness", "household", "inventory", "lifestyle", "military"],
                10: ["wellness", "household", "inventory", "lifestyle", "military"],
                11: ["military"],
                12: ["lifeAssessment"],
            }[version]
            for key in remove:
                del old[key]
            old["version"] = version
        raw = json.dumps(old, ensure_ascii=False)
        page.evaluate("(raw)=>{localStorage.removeItem(SLOT_CONFIG.key);localStorage.setItem(CONFIG.saveKey,raw)}", raw)
        page.reload()
        assert phase(page) == old["phase"]
        assert page.evaluate("state.version===CONFIG.saveVersion")
        assert page.evaluate("state.money") == 44
        assert page.evaluate("state.energy") == 53
        assert page.evaluate("state.semester") == 2
        assert page.evaluate("state.terms") == old["terms"]
        for key in ["character", "life", "entrance", "campus", "academic", "social", "study", "career"]:
            if key in old:
                assert page.evaluate(f"state.{key}") == old[key], (version, key)
        assert page.evaluate(f"localStorage.getItem(CONFIG.saveKey+':backup-v{version}')") == raw
        snapshot = page.evaluate("JSON.stringify({...state,notice:''})")
        page.reload()
        assert page.evaluate("JSON.stringify({...state,notice:''})") == snapshot
    # 새 필드가 생겨도 기존 시간 이동 키의 의미는 유지됩니다.
    before = page.evaluate("state.life.year")
    page.evaluate("advanceTime(2,'validation-once');advanceTime(2,'validation-once');commit()")
    assert page.evaluate("state.life.year") == before + 1
    page.reload()
    page.evaluate("advanceTime(2,'validation-once');commit()")
    assert page.evaluate("state.life.year") == before + 1
    # 미래 버전·불완전한 단계 참조는 자동 초기화/덮어쓰기하지 않습니다.
    future = page.evaluate("()=>{const old=JSON.parse(JSON.stringify(state));old.version=999;return old}")
    raw = json.dumps(future, ensure_ascii=False)
    page.evaluate("(raw)=>{localStorage.removeItem(SLOT_CONFIG.key);localStorage.setItem(CONFIG.saveKey,raw)}", raw)
    page.reload()
    assert page.evaluate("preserveUnreadableSave")
    click(page, "캐릭터 생성하고 시작")
    assert page.evaluate("localStorage.getItem(CONFIG.saveKey)") == raw
    page.close()


def test_ending_rules(browser, errors):
    page = graduate_page(browser, errors)
    # 학교 이름·학점만으로 높은 연구·교육 엔딩을 얻지 않습니다.
    assert page.evaluate("endingRequirements(ENDINGS.find(e=>e.id==='professor'))") is False
    assert page.evaluate("endingRequirements(ENDINGS.find(e=>e.id==='enterpriseResearch'))") is False
    assert page.evaluate("endingRequirements(ENDINGS.find(e=>e.id==='transition'))")
    fixtures = [
        ("enterpriseResearch", {"research": 10, "careerYears": 4, "performance": 60, "employer": "hanbit"}),
        ("seniorResearcher", {"research": 12, "careerYears": 3, "performance": 50, "employer": "neulbom", "masters": True}),
        ("globalEngineer", {"research": 5, "careerYears": 3, "performance": 40, "employer": "mirae", "international": True}),
        ("transition", {"research": 0, "careerYears": 0, "performance": 0, "employer": None}),
    ]
    for ending, data in fixtures:
        page.evaluate("""(data)=>{
          state.reflection=initialReflectionFields().reflection;
          state.research=data.research;state.practice=15;state.career.years=data.careerYears;
          state.jobTurns=data.careerYears;state.career.performance=data.performance;
          state.career.employer=data.employer;state.career.salary=data.employer?companyById(data.employer).salary:0;
          state.master=data.masters?{program:'kr-ms',turn:2,actions:['연구 프로젝트','발표 준비'],research:6,completed:true}:null;
          state.study.exchanges=data.international?[{program:'jp',targetSemester:4,completedYear:2029}]:[];
          state.phase='endingChoice';commit();
        }""", data)
        rule = page.evaluate("(id)=>ENDINGS.find(e=>e.id===id)", ending)
        assert page.evaluate("(id)=>endingRequirements(ENDINGS.find(e=>e.id===id))", ending)
        click(page, rule["title"])
        assert page.evaluate("state.reflection.selected") == ending
        snapshot = page.evaluate("JSON.stringify(state.reflection.snapshot)")
        page.reload()
        assert page.evaluate("JSON.stringify(state.reflection.snapshot)") == snapshot
    page.close()


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        errors = []
        test_versions(browser, errors)
        test_ending_rules(browser, errors)
        assert not errors, errors
        browser.close()
        print("PASS 저장 검증: v1~v12→현재 버전·원본 백업·기존 필드 보존·4슬롯 복원")
        print("PASS 8단계: 시간 키 중복 방지·미래 버전 보호·8종 엔딩 규칙/스냅샷")


if __name__ == "__main__":
    run()
