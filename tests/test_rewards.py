"""Degree pay, actual income, proactive NPC opportunities, and v13 preservation."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
from test_career import graduate_page
from test_campus import start_budget, finish_term
from test_game import click, button, phase, prepare_term, finish_event


def accept_contact(page, kind):
    assert page.evaluate("state.social.outreach.offers.find(o=>o.status==='pending').kind") == kind
    assert page.locator("#npc-contact button:visible").count() == 2
    page.locator("#npc-contact button").first.click()


def test_pay(browser, errors):
    page = graduate_page(browser, errors)
    result = page.evaluate("""() => {
      const original=JSON.stringify(state);
      state.experiences={};state.study.papers=[];state.career.years=0;
      state.career.salary=0;state.career.employmentHistory=[];
      const degree=(level, program) => {
        state.master=level>=2?{program:'kr-tech-ms',completed:true,turn:4,actions:[],research:8}:null;
        state.reflection.phdCompleted=level===3;state.life.highestDegree=['','학사','석사','박사'][level];
        state.postgraduate.active=null;state.postgraduate.records=[];
        if(level>=2){const d=newDegree(programById(program));d.completed=true;state.postgraduate.records=[d];}
      };
      degree(1);const bachelor=careerRecognition(companyById('hanbit'));
      degree(2,'kr-tech-ms');const masters=careerRecognition(companyById('hanbit'));
      const labMasters=careerRecognition(companyById('neulbom'));
      degree(3,'kr-tech-phd');state.research=8;state.study.papers=[{kind:'degree-paper'}];
      const phd=careerRecognition(companyById('neulbom'));
      degree(3,'us-phd');const mismatch=careerRecognition(companyById('hanbit'));
      degree(1);state.study.papers=[];state.career.years=4;
      const experienced=careerRecognition(companyById('hanbit'));
      state.career.salary=6000;state.career.employmentHistory=[{company:'hanbit'}];
      const negotiated=careerRecognition(companyById('mirae'));
      degree(2,'kr-tech-ms');state.career.years=0;state.career.employmentHistory=[];
      const general=careerRecognition(companyById('daon'));
      state=JSON.parse(original);
      return {bachelor,masters,labMasters,phd,mismatch,experienced,negotiated,general};
    }""")
    assert result["bachelor"]["salary"] == 4200
    assert result["masters"]["salary"] == 4600
    assert result["labMasters"]["degreeBonus"] == 600
    assert result["phd"]["degreeBonus"] == 1400
    assert result["phd"]["role"] == "선임 전문연구원"
    assert result["phd"]["scoreBonus"] > result["labMasters"]["scoreBonus"]
    assert result["mismatch"]["degreeBonus"] == result["mismatch"]["scoreBonus"] == 0
    assert result["experienced"]["salary"] > result["masters"]["salary"]
    assert result["general"]["degreeBonus"] == 0
    assert 0 < result["negotiated"]["negotiation"] <= 500
    page.close()
    return result


def test_payroll_and_frozen_offer(browser, errors):
    page = graduate_page(browser, errors)
    page.evaluate("""state.master={program:'kr-tech-ms',completed:true,turn:4,actions:['연구 프로젝트'],research:8};
      state.life.highestDegree='석사';state.experiences={};state.campus.debt=0;commit()""")
    click(page, "취업 지원")
    click(page, "한빛테크놀로지 지원 선택")
    page.evaluate("window.randomQueue=[0]")
    click(page, "지원서 제출")
    snapshot = page.evaluate("JSON.stringify(state.career.applications[0].hiringSnapshot)")
    assert page.evaluate("state.career.applications[0].hiringSnapshot.salary") == 4600
    page.evaluate("state.career.years=9;state.study.papers.push({kind:'later'});render()")
    assert page.evaluate("JSON.stringify(state.career.applications[0].hiringSnapshot)") == snapshot
    page.evaluate("state.career.years=0")
    click(page, "한빛테크놀로지 서류 결과 확인")
    click(page, "기업 면접으로")
    page.evaluate("window.randomQueue=[0]")
    click(page, "석사 연구 성과")
    click(page, "한빛테크놀로지 최종 메일 열기")
    click(page, "입사 제안 비교")
    assert "석사 학위 우대: 초봉 +400만원" in page.locator("#scene").inner_text()
    click(page, "한빛테크놀로지 입사")
    assert page.evaluate("state.career.salary") == 4600
    click(page, "직장 생활 계속 진행")
    before = page.evaluate("state.money")
    target = button(page, "핵심 프로젝트 완수").element_handle()
    target.evaluate("(b)=>{b.click();b.click()}")
    record = page.evaluate("state.career.workHistory.at(-1)")
    assert record["salary"] == 4600
    assert record["incentive"] == 92
    assert page.evaluate("state.money") == before + 1692
    assert page.evaluate("state.savings") == 1692
    assert page.evaluate("state.career.salary") == record["salaryReview"]["nextSalary"] > 4600
    assert page.evaluate("assessmentFacts(state).promotions") == 0
    assert page.evaluate("assessmentFacts(state).salary") == record["salaryReview"]["nextSalary"]
    assert page.evaluate("assessmentFacts(state).assets") >= page.evaluate("state.money")
    saved = page.evaluate("JSON.stringify({career:state.career,money:state.money,savings:state.savings})")
    page.reload()
    assert page.evaluate("JSON.stringify({career:state.career,money:state.money,savings:state.savings})") == saved
    # v13 contracts without new metadata are accepted and never retrospectively repriced.
    assert page.evaluate("""() => {
      const old=JSON.parse(JSON.stringify(state));delete old.social.outreach;
      delete old.career.employmentHistory[0].contract.recognition;
      old.career.employmentHistory[0].contract.salary=4200;
      const loaded=migrateSave(old);
      return validSave(loaded)&&JSON.stringify(loaded)===JSON.stringify(old);
    }""")
    page.close()


def test_professor_and_collaboration(browser, errors):
    page = graduate_page(browser, errors)
    page.evaluate("""state.recommendations=0;Object.assign(state.social.npcs.professor,{intimacy:20,trust:40});commit()""")
    accept_contact(page, "project")
    before = page.evaluate("graduateInputs(graduateSnapshot('masters')).recommendation")
    page.evaluate("startDegree(programById('kr-ms'));commit()")
    click(page, "등록하고 연구 시작")
    click(page, "연구 프로젝트")
    assert page.evaluate("state.social.outreach.letters.length") == 1
    assert page.evaluate("state.recommendations") == 1
    assert page.evaluate("graduateInputs(graduateSnapshot('masters')).recommendation") > before
    click(page, "연구 프로젝트")
    assert page.evaluate("state.social.outreach.letters.length") == 1
    assert page.evaluate("state.recommendations") == 1
    page.evaluate("state.postgraduate.active=null;state.master=null;state.life.highestDegree='학사';state.phase='hub';commit()")
    click(page, "석사 지원")
    click(page, "대한민국 융합생명 데이터 석사 지원")
    app = page.evaluate("state.applications[0]")
    assert app["snapshot"]["npcRecommendations"][0]["source"] == "김은솔 교수"
    assert app["snapshot"]["recommendationQuality"] >= 60
    click(page, "지원 마감하고 면접 준비")
    assert "교수님의 공동 과제 추천서" in page.locator("#scene").inner_text()
    page.close()
    page = graduate_page(browser, errors)
    page.evaluate("Object.assign(state.social.npcs.labmate,{intimacy:35,trust:40});commit()")
    accept_contact(page, "collaboration")
    page.evaluate("startDegree(programById('kr-ms'));commit()")
    click(page, "등록하고 연구 시작")
    page.evaluate("window.randomQueue=[0]")
    target = button(page, "연구 프로젝트").element_handle()
    target.evaluate("(b)=>{b.click();b.click()}")
    assert page.evaluate("degreeTerm().actions.length") == 1
    assert page.evaluate("state.study.papers.length") == 1
    assert page.evaluate("state.postgraduate.active.paper") == 1
    snapshot = page.evaluate("JSON.stringify(state.social.outreach)")
    page.evaluate("render();render()")
    assert page.evaluate("JSON.stringify(state.social.outreach)") == snapshot
    page.reload()
    assert page.evaluate("JSON.stringify(state.social.outreach)") == snapshot
    click(page, "연구 프로젝트")
    assert page.evaluate("state.study.papers.length") == 1
    page.close()


def test_study(browser, errors):
    page = start_budget(browser, errors)
    prepare_term(page)
    page.evaluate("Object.assign(state.social.npcs.peer,{intimacy:35,trust:30});commit()")
    page.set_viewport_size({"width": 375, "height": 812})
    assert page.locator("#scene .core-actions button:visible").count() == 5
    assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
    accept_contact(page, "study")
    for title in ["공부", "연구·프로젝트", "쉬어 가기"]:
        click(page, title)
        finish_event(page)
    assert phase(page) == "report"
    improvement = page.evaluate("""() => {
      const original=JSON.stringify(state), boosted=currentTerm().report.gpa;
      delete currentTerm().npcStudy;currentTerm().report=null;makeReport();
      const difference=round(boosted-currentTerm().report.gpa);state=JSON.parse(original);
      return difference;
    }""")
    assert improvement == .15
    assert page.locator("#scene .core-actions button:visible").count() == 0
    page.close()


def test_long_internship_and_career_news(browser, errors):
    page = start_budget(browser, errors)
    for term in range(1, 5):
        prepare_term(page)
        if term == 1:
            click(page, "사람들과 시간 보내기")
            click(page, "윤도현과 대화")
            click(page, "학기로 돌아가기")
        for title in ["카페 알바", "전공 공부", "휴식"]:
            click(page, title)
            finish_event(page)
        finish_term(page)
    prepare_term(page)
    assert page.evaluate("state.semester") == 5
    assert page.evaluate("state.social.outreach.careers.senior.stage") == "한빛테크놀로지 취업"
    assert "2년 전부터" in page.locator("#npc-contact").inner_text()
    accept_contact(page, "internship")
    for title in ["전공 공부", "연구실 참여", "휴식"]:
        click(page, title)
        finish_event(page)
    click(page, "성적표 열기")
    assert "선배 추천 전형" in button(page, "유급 인턴 지원").inner_text()
    before = page.evaluate("state.money")
    checkpoint = page.evaluate("JSON.stringify(state)")
    page.evaluate("window.randomQueue=[0]")
    click(page, "유급 인턴 지원")
    assert phase(page) == "vacationResult"
    assert page.evaluate("state.money") == before + 120
    assert page.evaluate("state.experiences.internship") == 1
    assert page.evaluate("currentTerm().internshipReferral.selected")
    assert page.evaluate("state.social.outreach.internship.used")
    assert page.evaluate("state.social.outreach.offers.filter(o=>o.kind==='internship').length") == 1
    page.evaluate("(s)=>{state=JSON.parse(s);commit()}", checkpoint)
    page.evaluate("window.randomQueue=[.999]")
    click(page, "유급 인턴 지원")
    assert not page.evaluate("currentTerm().internshipReferral.selected")
    assert page.evaluate("state.money") == before
    assert page.evaluate("state.experiences.internship||0") == 0
    assert page.evaluate("state.social.outreach.internship.used")
    page.close()
    page = graduate_page(browser, errors)
    page.evaluate("""advanceTime(4,'test:senior-transfer');
      Object.assign(state.social.npcs.senior,{intimacy:40,trust:45});
      state.social.npcs.senior.history.push({year:2027,semester:1,text:'1학년 때 함께한 활동',intimacy:12,trust:6});commit()""")
    assert page.evaluate("state.social.outreach.careers.senior.stage") == "미래정밀솔루션으로 이직"
    accept_contact(page, "job")
    click(page, "취업 지원")
    assert "선배 추천 공고" in button(page, "미래정밀솔루션 지원 선택").inner_text()
    click(page, "미래정밀솔루션 지원 선택")
    page.evaluate("window.randomQueue=[0]")
    click(page, "지원서 제출")
    support = page.evaluate("state.career.applications[0].hiringSnapshot.npcSupport")
    assert support["bonus"] == 3
    assert page.evaluate("state.social.outreach.job.used")
    page.close()


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        errors = []
        salaries = test_pay(browser, errors)
        test_payroll_and_frozen_offer(browser, errors)
        test_professor_and_collaboration(browser, errors)
        test_study(browser, errors)
        test_long_internship_and_career_news(browser, errors)
        assert not errors, errors
        browser.close()
    folder = Path(__file__).resolve().parent.parent / ".artifacts"
    folder.mkdir(exist_ok=True)
    (folder / "REWARDS_TEST_RESULTS.json").write_text(json.dumps(salaries, ensure_ascii=False, indent=2), encoding="utf-8")
    print("PASS 보상: 학위/전공/경력별 연봉·실제 급여/자산·원서 고정·NPC 선제 연락·스터디 GPA·인턴·추천서·공동 논문·진로 소식·v13")


if __name__ == "__main__":
    run()
