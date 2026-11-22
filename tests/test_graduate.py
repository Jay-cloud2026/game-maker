"""통합 3단계: 지원 자격·서류/면접/최종 확률·원서 스냅샷·v8 호환."""
# 프로젝트 루트에서 실행: python3 tests/test_graduate.py
import json
from playwright.sync_api import sync_playwright
from test_career import graduate_page
from test_game import click, phase


def prepared_page(browser, errors, degree="masters"):
    page = graduate_page(browser, errors)
    page.evaluate("""degree => {
      state.research=35;state.recommendations=5;state.development.skills.language=85;
      syncLearnedAbility('language');state.character.abilities.stress=10;state.energy=95;
      for(const term of state.terms){term.report.gpa=4.2;for(const course of term.report.courses)course.point=4.2;}
      if(degree==='phd'){
        state.master={program:'kr-ms',turn:2,actions:['연구 프로젝트','수업 조교(TA)'],research:12,completed:true};
        state.life.highestDegree='석사';
      }
      state.phase='hub';commit();
    }""", degree)
    click(page, "석사 지원" if degree == "masters" else "박사 지원")
    return page


def submit(page, id, draw=0):
    title = page.evaluate("(id)=>{const p=programById(id);return `${p.country} ${p.title} 지원`}", id)
    page.evaluate("(draw)=>window.randomQueue=[draw]", draw)
    click(page, title)


def documents(page):
    click(page, "지원 마감하고 면접 준비")
    assert phase(page) == "graduateDocuments"
    while page.locator("#scene button").filter(has_text="서류 결과 확인").count():
        page.locator("#scene button").filter(has_text="서류 결과 확인").first.click()
    page.locator("#scene button:enabled").last.click()


def finish_results(page):
    assert phase(page) == "mail"
    while page.locator("#scene button").filter(has_text="결과 메일 열기").count():
        page.locator("#scene button").filter(has_text="결과 메일 열기").first.click()
    click(page, "진학 제안 비교하기")
    assert phase(page) == "offers"


def test_catalog_and_minimums(browser, errors):
    page = prepared_page(browser, errors)
    assert page.evaluate("""() => ['masters','phd'].every(degree=>{
      const p=PROGRAMS.filter(p=>p.degree===degree);
      return p.length===6 && p.filter(p=>p.country==='대한민국').length===3 &&
        ['미국','독일','일본'].every(country=>p.filter(p=>p.country===country).length===1);
    })""")
    assert page.evaluate("PROGRAMS.every(p=>Object.values(p.weights).reduce((a,b)=>a+b,0)>.999 && p.admissions)")
    page.evaluate("""state.research=0;state.recommendations=0;state.development.skills.language=10;
      for(const term of state.terms){term.report.gpa=1;for(const c of term.report.courses)c.point=1;}render()""")
    submit(page, "us-ms")
    assert page.evaluate("state.applications[0].document.missing.length") == 4
    assert page.evaluate("state.applications[0].document.draw") is None
    documents(page)
    assert phase(page) == "mail"  # 미달자는 면접 없이 최종 불합격.
    finish_results(page)
    assert page.evaluate("state.applications[0].accepted") is False
    click(page, "진로 화면으로 돌아가기")
    page.evaluate("startApplications('phd');commit()")
    assert phase(page) == "hub"
    assert "석사 학위" in page.locator("#notice").inner_text()
    # 이전 지원의 결과는 재지원 시 별도 보존.
    click(page, "석사 지원")
    assert page.evaluate("state.graduateAdmissions.history.length") == 1
    assert page.evaluate("state.graduateAdmissions.history[0].applications[0].accepted") is False
    page.close()


def test_fixed_probabilities(browser, errors):
    page = prepared_page(browser, errors)
    submit(page, "kr-ms", .999)  # 고역량이어도 서류 불합격 가능.
    submit(page, "us-ms", 0)
    app_snapshot = page.evaluate("JSON.stringify(state.applications)")
    page.reload()
    assert page.evaluate("JSON.stringify(state.applications)") == app_snapshot
    assert page.evaluate("window.randomCalls") == 0
    documents(page)
    assert phase(page) == "interview"
    assert page.evaluate("state.applications[0].document.passed") is False
    original_inputs = page.evaluate("graduateInputs(state.applications[1].snapshot,0)")
    # 지원 후 학점/연구를 조작해도 원서의 당시 역량과 면접 증빙은 불변.
    page.evaluate("""state.research=0;state.recommendations=0;state.energy=0;
      state.development.skills.social=0;state.experiences={};
      for(const t of state.terms)for(const c of t.report.courses)c.point=0;render();
      window.randomQueue=[.999]""")
    click(page, "연구실 경험")
    assert phase(page) == "mail"
    assert page.evaluate("state.applications[1].accepted") is False
    final_inputs = page.evaluate("state.applications[1].inputs")
    assert all(final_inputs[k] == original_inputs[k] for k in ("gpa", "research", "language", "recommendation"))
    stored = page.evaluate("JSON.stringify(state.applications)")
    page.reload()
    assert page.evaluate("JSON.stringify(state.applications)") == stored
    assert page.evaluate("window.randomCalls") == 0
    finish_results(page)
    assert page.evaluate("state.applications.every(a=>!a.accepted)")
    assert page.evaluate("state.applications[1].finalProbability<=.84")
    assert page.evaluate("validSave(state)")
    page.close()


def test_degree_paths_and_migration(browser, errors):
    for degree, id in [("masters", "jp-ms"), ("phd", "kr-phd")]:
        page = prepared_page(browser, errors, degree)
        submit(page, id)
        documents(page)
        page.evaluate("window.randomQueue=[0]")
        click(page, "연구실 경험")
        finish_results(page)
        assert page.evaluate("state.applications[0].accepted")
        stored = page.evaluate("JSON.stringify(state.applications)")
        page.reload()
        assert page.evaluate("JSON.stringify(state.applications)") == stored
        assert page.evaluate("validSave(state)")
        page.close()

    page = prepared_page(browser, errors)
    # v8의 진행 중 면접 원서는 새 서류 심사를 강제하지 않습니다.
    old = page.evaluate("""() => {
      const v=JSON.parse(JSON.stringify(state));v.version=8;delete v.graduateAdmissions;
      v.phase='interview';v.applications=[{id:'kr-ms',status:'applied',interview:0,evidence:'',score:null,accepted:null}];
      return v;
    }""")
    raw = json.dumps(old, ensure_ascii=False)
    page.evaluate("(raw)=>{localStorage.removeItem(SLOT_CONFIG.key);localStorage.setItem(CONFIG.saveKey,raw)}", raw)
    page.reload()
    assert phase(page) == "interview"
    assert page.evaluate("state.development") == old["development"]
    assert page.evaluate("state.applications") == old["applications"]
    assert page.evaluate("localStorage.getItem(CONFIG.saveKey+':backup-v8')") == raw
    click(page, "연구실 경험")
    assert page.evaluate("state.applications[0].ruleset===undefined")
    assert page.evaluate("state.applications[0].finalDraw===undefined")
    assert page.evaluate("state.applications[0].accepted")
    finish_results(page)
    page.close()


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        errors = []
        test_catalog_and_minimums(browser, errors)
        test_fixed_probabilities(browser, errors)
        test_degree_paths_and_migration(browser, errors)
        assert not errors, errors
        browser.close()
        print("PASS 통합 3단계: 학위별 6개국별 구성·최소 조건·서류/면접/최종·상위권 불합격")
        print("PASS 통합 3단계: 지원 당시 스냅샷·고정 추첨·재지원 이력·국내외 선택·v8 진행 원서 보존")


if __name__ == "__main__":
    run()
