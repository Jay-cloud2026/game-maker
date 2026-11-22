"""통합 9단계: 해외 석사→국내 박사 완주·난이도별 실제 계산·재수 성장 상한."""
# 프로젝트 루트에서 실행: python3 tests/test_integration.py
from playwright.sync_api import sync_playwright
from test_graduate import prepared_page, submit, documents, finish_results
from test_degree import complete_degree
from test_game import click, phase
from test_campus import start_budget


def admit(page, id):
    submit(page, id)
    documents(page)
    page.evaluate("window.randomQueue=[0]")
    click(page, "연구실 경험" if page.evaluate("state.degree") == "masters" else "석사 연구 성과")
    finish_results(page)
    country = page.evaluate("(id)=>programById(id).country", id)
    page.locator(".opportunity").filter(has_text=country).get_by_role("button", name="이 제안 수락").click()


def run():
    with sync_playwright() as p:
        b = p.chromium.launch()
        errors = []
        page = prepared_page(b, errors)
        admit(page, "us-ms")
        complete_degree(page)
        click(page, "취업·박사 지원 살펴보기")
        click(page, "박사 지원")
        admit(page, "kr-phd")
        complete_degree(page)
        click(page, "학위 취득 엔딩")
        assert page.evaluate("state.postgraduate.records.map(d=>d.program)") == ["us-ms", "kr-phd"]
        assert page.evaluate("state.life.highestDegree") == "박사"
        saved = page.evaluate("JSON.stringify(state.reflection.snapshot)")
        page.reload()
        assert page.evaluate("JSON.stringify(state.reflection.snapshot)") == saved
        page.set_viewport_size({"width": 375, "height": 812})
        page.locator("#slots-button").click()
        assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
        page.locator("#slots-close").click()
        page.close()
        page = start_budget(b, errors)
        assert page.evaluate("""() => {
          const original=JSON.stringify(state), values=[];
          for(const difficulty of ['easy','normal','hard']){
            state=JSON.parse(original);state.development.difficulty=difficulty;
            state.campus.ledgers[1].eligibility.research=10;
            applyScholarship('research');
            const snapshot=graduateSnapshot('masters'), rules={
              ...GRAD_ADMISSIONS,difficulty:60+difficultyConfig().competition};
            const job=hiringSnapshot(companyById('daon'));
            values.push({college:admissionProbability(UNIVERSITIES[0],{schoolScore:70,percentile:70,activity:70}),
              graduate:graduateProbability(65,rules),job:snapshotHiringProbability(65,job),
              scholarship:state.campus.ledgers[1].applications.research.probability,
              living:termQuote().living,growth:difficultyConfig().growth,risk:difficultyConfig().eventRisk});
          }
          state=JSON.parse(original);
          return ['college','graduate','job','scholarship','growth','living','risk'].every(k=>values[0][k]===values[1][k]&&values[1][k]===values[2][k]) &&
            values.every(v=>v.college<1&&v.graduate<1&&v.job<1);
        }""")
        assert page.evaluate("""() => {
          const previous={...entranceAttempt().exam,subjects:entranceAttempt().exam.subjects.map(s=>({...s,score:10}))};
          const retry={general:999,subjects:Object.fromEntries(previous.subjects.map(s=>[s.name,999]))};
          const next=generateExam(previous,retry);
          return next.subjects.every(s=>s.score<=20) && next.schoolScore===previous.schoolScore;
        }""")
        # 다른 창/탭의 revision이 변경되면 덮어쓰기하지 않습니다.
        saved = page.evaluate("localStorage.getItem(SLOT_CONFIG.key)")
        page.evaluate("""const external=JSON.parse(localStorage.getItem(SLOT_CONFIG.key));
          external.revision++;localStorage.setItem(SLOT_CONFIG.key,JSON.stringify(external));
          window.externalText=localStorage.getItem(SLOT_CONFIG.key);state.money=99999;save();""")
        assert page.evaluate("localStorage.getItem(SLOT_CONFIG.key)===window.externalText")
        assert page.evaluate("saveAvailable") is False
        assert not errors, errors
        b.close()
        print("PASS 통합 9단계: 해외석사→국내박사 UI 완주·학위 엔딩/모바일·7종 기본 계수 통일·재수 상한·동시 저장 보호")


if __name__ == "__main__":
    run()
