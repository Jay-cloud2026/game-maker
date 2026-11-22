"""17번: 다중 SSS·무보상 결산·40세 계속·4슬롯 순수 비교·v12 보존."""
import json
from pathlib import Path
from datetime import datetime
from playwright.sync_api import sync_playwright
from test_career import graduate_page
from test_life import new_page
from test_game import click, phase, hire_and_work, reveal
from test_degree import complete_degree


def healthy_graduate(browser, errors, name):
    page = graduate_page(browser, errors)
    # 졸업 전 형성한 건강/관계의 명시적 시작 픽스처. 경력/성과/논문은 아래 실제 UI로 쌓습니다.
    page.evaluate("""name => {
      state.character.name=name;state.money=1000;state.campus.debt=0;state.campus.borrowed=0;
      Object.assign(state.wellness,{maxEnergy:110,habit:40,recovery:1.2,fatigue:0});
      state.energy=110;state.character.abilities.happiness=95;state.character.abilities.stress=5;
      state.household.relationship=90;
      for(const id of ['peer','professor']){
        Object.assign(state.social.npcs[id],{trust:95,intimacy:95});
      }
      commit();
    }""", name)
    return page


def work_year(page, title):
    click(page, "직장 생활 계속하기")
    page.evaluate("window.ratingTestRandom=Math.random;Math.random=()=>0")
    click(page, title)
    assert phase(page) == "workEvent"
    if page.locator("#scene button").filter(has=page.get_by_text("승진을 수락한다", exact=True)).count():
        click(page, "승진을 수락한다")
    else:
        page.locator("#scene button:enabled").last.click()
    page.evaluate("Math.random=window.ratingTestRandom")
    assert phase(page) == "jobNext"


def finalize(page, path):
    reveal(page.locator("#life-review-button")).click()
    page.locator("#life-path").select_option(path)
    report = page.evaluate("state.lifeAssessment.records.at(-1)")
    assert report["paths"][path]["grade"] == "SSS", report["paths"][path]
    page.once("dialog", lambda d: d.accept())
    page.locator("#life-review-content button").filter(has=page.get_by_text("이 결산으로 인생 마무리", exact=True)).click()
    assert phase(page) == "ending"
    assert page.evaluate("validSave(state)")
    return page.evaluate("JSON.parse(JSON.stringify(state))")


def test_multiple_sss(browser, errors):
    states = []
    for path, company, years, action in [
        ("corporate", "한빛테크놀로지", 12, "핵심 프로젝트 완수"),
        ("specialist", "미래정밀솔루션", 12, "핵심 프로젝트 완수"),
        ("balanced", "다온웨이브", 9, "균형 있게 일하기"),
    ]:
        page = healthy_graduate(browser, errors, f"{path}의 삶")
        click(page, "취업 지원")
        hire_and_work(page, "연구실 경험", company)
        for _ in range(years):
            work_year(page, action)
        assert page.evaluate("state.master===null && !state.reflection.phdCompleted")
        states.append(finalize(page, path))
        if path == "corporate":
            # 저장된 최종 평가는 설정 변경·재열람 후에도 같은 결과와 기준을 유지.
            frozen = page.evaluate("JSON.stringify(state.lifeAssessment.records.find(r=>r.id===state.lifeAssessment.finalId))")
            page.evaluate("LIFE_ASSESSMENT_CONFIG.grades[0].minimum=101")
            click(page, "최종 인생 평가 다시 보기")
            assert "SSS — 전설적인 인생" in page.locator("#life-review-content").inner_text()
            assert page.evaluate("JSON.stringify(state.lifeAssessment.records.find(r=>r.id===state.lifeAssessment.finalId))") == frozen
            page.locator("#life-review-content button").filter(has_text="계속 진행하기").click()
            page.reload()
            assert page.evaluate("JSON.stringify(state.lifeAssessment.records.find(r=>r.id===state.lifeAssessment.finalId))") == frozen
        page.close()

    page = healthy_graduate(browser, errors, "연구자의 삶")
    page.evaluate("startDegree(programById('kr-ms'));commit()")
    complete_degree(page)
    click(page, "취업·박사 지원 살펴보기")
    page.evaluate("startDegree(programById('de-phd'));commit()")
    complete_degree(page)
    # 박사 학위만으로 어느 진로에서도 SSS가 나오지 않습니다.
    assert page.evaluate("Object.values(evaluateLife(state).paths).every(p=>p.grade!=='SSS')")
    click(page, "취업·다음 진로 살펴보기")
    click(page, "취업 지원")
    hire_and_work(page, "석사 연구 성과", "늘봄융합연구원")
    for _ in range(12):
        work_year(page, "업무 연구와 개선")
    assert page.evaluate("state.study.papers.length>=4 && state.career.workHistory.some(r=>r.researchOutcome)")
    states.append(finalize(page, "researcher"))
    page.close()

    page = healthy_graduate(browser, errors, "창업가의 삶")
    click(page, "취업 지원")
    hire_and_work(page, "연구실 경험")
    work_year(page, "새 사업 아이디어 검증")
    click(page, "창업 시작")
    for _ in range(16):
        page.evaluate("window.ratingTestRandom=Math.random;Math.random=()=>0")
        click(page, "제품 개발과 고객 검증")
        page.evaluate("Math.random=window.ratingTestRandom")
        reveal(page.locator("#lifestyle-button")).click()
        click(page, "충분한 수면")
        click(page, "생활 관리 마치기")
    states.append(finalize(page, "founder"))
    page.close()
    return states


def test_no_free_points_and_forty(browser, errors):
    page = healthy_graduate(browser, errors, "마흔의 삶")
    assert page.title() == "이번 학기는 진짜 에이 각이다"
    assert page.locator("h1").inner_text() == "이번 학기는 진짜 에이 각이다"
    click(page, "취업 지원")
    hire_and_work(page, "연구실 경험")
    # 39세 직장인의 실제 다음 1년 업무 전이로 40세 이벤트 발생.
    page.evaluate("state.life.year=state.character.birthYear+39;state.life.half=0;state.lifeAssessment.lastAge=39;commit()")
    work_year(page, "균형 있게 일하기")
    assert page.evaluate("characterAge()") == 40
    assert phase(page) == "jobNext"
    assert page.locator("#forty-review-button").is_visible()
    captured = page.evaluate("state.lifeAssessment.forty.recordId")
    frozen = page.evaluate("JSON.stringify(state.lifeAssessment.records.find(r=>r.id===state.lifeAssessment.forty.recordId))")
    before = page.evaluate("JSON.stringify({money:state.money,year:state.life.year,half:state.life.half,skills:state.development.skills,rng:state.development.rng,research:state.research,savings:state.savings,practice:state.practice,history:state.history})")
    random_calls = page.evaluate("window.randomCalls")
    reveal(page.locator("#forty-review-button")).click()
    assert "40세 인생 이정표" in page.locator("#life-review-content").inner_text()
    page.locator("#life-review-content button").filter(has_text="계속 진행하기").click()
    for _ in range(3):
        reveal(page.locator("#life-review-button")).click()
        page.locator("#life-review-content button").filter(has_text="계속 진행하기").click()
    count = page.evaluate("state.lifeAssessment.records.length")
    reveal(page.locator("#life-review-button")).click()
    page.locator("#life-review-content button").filter(has_text="계속 진행하기").click()
    assert page.evaluate("state.lifeAssessment.records.length") == count
    assert page.evaluate("window.randomCalls") == random_calls
    assert page.evaluate("JSON.stringify({money:state.money,year:state.life.year,half:state.life.half,skills:state.development.skills,rng:state.development.rng,research:state.research,savings:state.savings,practice:state.practice,history:state.history})") == before
    page.reload()
    assert page.evaluate("state.lifeAssessment.forty.recordId") == captured
    assert page.evaluate("JSON.stringify(state.lifeAssessment.records.find(r=>r.id===state.lifeAssessment.forty.recordId))") == frozen
    # 자유 엔딩은 명시적 선택이며 결산 전 선택 화면으로 돌아올 수 있습니다.
    reveal(page.locator("#life-review-button")).click()
    page.once("dialog", lambda d: d.accept())
    page.locator("#life-review-content button").filter(has_text="이 결산으로 인생 마무리").click()
    assert phase(page) == "ending"
    final_id = page.evaluate("state.lifeAssessment.finalId")
    final_record = page.evaluate("JSON.stringify(state.lifeAssessment.records.find(r=>r.id===state.lifeAssessment.finalId))")
    reveal(page.locator("#lifestyle-button")).click()
    click(page, "정기 용돈 받기")
    click(page, "생활 관리 마치기")
    assert page.evaluate("state.lifeAssessment.finalId") == final_id
    assert page.evaluate("JSON.stringify(state.lifeAssessment.records.find(r=>r.id===state.lifeAssessment.finalId))") == final_record
    click(page, "결산 전 진행으로 계속")
    assert phase(page) == "jobNext"
    work_year(page, "균형 있게 일하기")
    assert page.evaluate("characterAge()") == 41
    assert page.evaluate("state.lifeAssessment.forty.recordId") == captured
    assert page.evaluate("JSON.stringify(state.lifeAssessment.records.find(r=>r.id===state.lifeAssessment.forty.recordId))") == frozen
    page.close()
    page = healthy_graduate(browser, errors, "이정표를 건넌 삶")
    page.evaluate("""state.life.year=state.character.birthYear+39;state.lifeAssessment.lastAge=39;
      advanceTime(8,'review-age-jump');commit()""")
    assert page.evaluate("state.lifeAssessment.records.find(r=>r.id===state.lifeAssessment.forty.recordId).snapshot.age") == 43
    reveal(page.locator("#forty-review-button")).click()
    assert "현재 43세 기록" in page.locator("#life-review-content").inner_text()
    page.locator("#life-review-content button").filter(has_text="계속 진행하기").click()
    # 이미 40세를 지난 구버전은 과거 나이/성과를 꾸미지 않고 현재 기록으로 알림을 제공합니다.
    old = page.evaluate("()=>{const old=JSON.parse(JSON.stringify(state));old.version=12;delete old.lifeAssessment;return old}")
    raw = json.dumps(old, ensure_ascii=False)
    page.evaluate("(raw)=>{localStorage.removeItem(SLOT_CONFIG.key);localStorage.setItem(CONFIG.saveKey,raw)}", raw)
    page.reload()
    assert page.evaluate("state.lifeAssessment.records.find(r=>r.id===state.lifeAssessment.forty.recordId).snapshot.age") == 43
    assert page.evaluate("state.life.year") == old["life"]["year"]
    assert page.evaluate("localStorage.getItem(CONFIG.saveKey+':backup-v12')") == raw
    page.close()


def test_limits_comparison_migration(browser, errors, states):
    page = healthy_graduate(browser, errors, "부만 높은 삶")
    assert page.evaluate("""() => {
      const original=JSON.stringify(state);
      const work=Array.from({length:15},(_,i)=>({year:2030+i,company:'hanbit',action:'project',salary:100000}));
      state.money=1e8;state.career.employer='hanbit';state.career.salary=100000;
      state.career.workHistory=work;state.career.years=15;state.career.performance=1000;state.practice=100;
      state.character.abilities.happiness=0;state.character.abilities.stress=100;state.energy=0;state.wellness.fatigue=100;
      for(const npc of Object.values(state.social.npcs)){npc.trust=0;npc.intimacy=0;}
      state.household.relationship=0;
      for(const k of Object.keys(state.development.skills))state.development.skills[k]=100;
      const grades=Object.values(evaluateLife(state).paths).map(p=>p.grade);
      state=JSON.parse(original);return grades.every(g=>g!=='SSS');
    }""")
    # 네 개의 독립된 실제 플레이 결과를 저장한 뒤 활성 state 교체 없이 비교.
    page.evaluate("""items=>{
      slotStore={format:SLOT_CONFIG.format,revision:slotStore.revision,active:0,
        slots:items.map(data=>({data,savedAt:new Date().toISOString(),ovr:careerRatings(data).overall}))};
      state=items[0];saveActiveSlot();render();
    }""", states[:4])
    current = page.evaluate("JSON.stringify(state)")
    slots = page.evaluate("JSON.stringify(slotStore)")
    page.locator("#slots-button").click()
    assert page.locator("#slots-content .comparison-scroll tbody tr").count() == 4
    for i, data in enumerate(states[:4]):
        row = page.locator("#slots-content .comparison-scroll tbody tr").nth(i)
        assert data["character"]["name"] in row.inner_text()
        assert "SSS" in row.inner_text()
    assert page.evaluate("JSON.stringify(state)") == current
    assert page.evaluate("JSON.stringify(slotStore)") == slots
    page.set_viewport_size({"width":375,"height":812})
    assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
    page.locator("#slots-close").click()
    # v12 슬롯에서 원서/학위/복무/기존 엔딩 스냅샷을 그대로 보존하고 새 평가만 추가.
    old = page.evaluate("""() => {
      const old=JSON.parse(JSON.stringify(state));old.version=12;delete old.lifeAssessment;return old;
    }""")
    page.evaluate("""old=>{
      const store=JSON.parse(JSON.stringify(slotStore));store.slots[0].data=old;
      localStorage.setItem(SLOT_CONFIG.key,JSON.stringify(store));
    }""", old)
    page.reload()
    for key, value in old.items():
        if key != "version":
            assert page.evaluate(f"state[{json.dumps(key)}]") == value, key
    assert page.evaluate("state.version===CONFIG.saveVersion && validSave(state)")
    assert page.evaluate("!!state.lifeAssessment.finalId")
    assert page.evaluate("localStorage.getItem(SLOT_CONFIG.key+':before-assessment')!==null")
    page.close()


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        errors = []
        states = test_multiple_sss(browser, errors)
        test_no_free_points_and_forty(browser, errors)
        test_limits_comparison_migration(browser, errors, states)
        assert not errors, errors
        receipt = {"finished":datetime.now().isoformat(), "passed":True, "paths":[]}
        for value in states:
            record = next(r for r in value["lifeAssessment"]["records"] if r["id"] == value["lifeAssessment"]["finalId"])
            selected = record["paths"][record["path"]]
            receipt["paths"].append({"path":record["path"],"grade":selected["grade"],"total":selected["total"],
                "axes":selected["axes"],"age":record["snapshot"]["age"],"education":record["snapshot"]["education"],
                "salary":record["snapshot"]["salary"],"netWorth":record["snapshot"]["netWorth"]})
        artifacts = Path(__file__).resolve().parent.parent / ".artifacts"
        artifacts.mkdir(exist_ok=True)
        (artifacts / "LIFE_ASSESSMENT_TEST_RESULTS.json").write_text(
            json.dumps(receipt,ensure_ascii=False,indent=2),encoding="utf-8")
        browser.close()
        print("PASS 17번: 5개 진로 실제 업무/연구/사업 SSS·학사 SSS·박사/자산/OVR 단독 최고등급 차단")
        print("PASS 17번: 중간 결산 무보상/중복 방지·40세→41세 계속·자유 종료/재개·기준/등급 저장")
        print("PASS 17번: 4슬롯 순수 비교/모바일·v12→v13 원본/엔딩 보존·사이트 제목")


if __name__ == "__main__":
    run()
