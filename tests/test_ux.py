"""Compact UX: real clicks, saved outcomes, gender rules, v13 preservation, mobile."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
from test_game import URL, legacy_state

OUT = Path(__file__).resolve().parent.parent / ".artifacts" / "ux"


def press(page, title):
    page.locator("#scene button").filter(has=page.get_by_text(title, exact=True)).click()


def create(browser, errors, gender="여성", width=1280):
    page = browser.new_page(viewport={"width": width, "height": 900})
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(URL)
    assert page.locator("#scene input:visible, #scene select:visible").count() == 4
    assert page.locator("#character-difficulty, #character-age, #character-military").count() == 0
    page.locator("#character-gender").select_option(gender)
    assert ("남성: 병역 의무" if gender == "남성" else "여성: 병역 의무") in page.locator("#scene").inner_text()
    assert page.locator("#save-export").is_hidden()
    assert page.locator("#slots-export").is_hidden()
    press(page, "캐릭터 생성하고 시작")
    assert page.evaluate("state.military.subject") == (gender == "남성")
    assert page.evaluate("state.character.startAge") == 18
    return page


def admit(page):
    press(page, "고등학교 성적표 공개")
    press(page, "대학과 전공 탐색")
    for name in ["상록과학기술원", "은하종합대학교", "솔빛국립대학교", "들꽃미래대학교"]:
        press(page, f"{name} 지원 목록에 담기")
    # Selected majors remain editable in place.
    first = page.locator("#major-sangrok")
    first.select_option(index=1)
    assert page.evaluate("state.entrance.selection[0].major") == first.input_value()
    before = page.evaluate("state.money")
    fee = page.evaluate("state.entrance.selection.reduce((s,c)=>s+universityById(c.university).fee,0)")
    page.evaluate("window.beforeUXRandom=Math.random;Math.random=()=>0")
    target = page.locator("#scene button").filter(has=page.get_by_text("접수비를 내고 원서 접수", exact=True))
    target.evaluate("(b)=>{b.click();b.click()}")
    page.evaluate("Math.random=window.beforeUXRandom")
    assert page.evaluate("state.phase") == "collegeMail"
    assert page.evaluate("state.money") == before - fee
    assert page.locator(".result-card").count() == 4
    snapshot = page.evaluate("JSON.stringify(entranceAttempt().applications)")
    page.reload()
    assert page.evaluate("JSON.stringify(entranceAttempt().applications)") == snapshot
    press(page, "진학 선택으로")
    press(page, "들꽃미래대학교 등록 결정")
    press(page, "대학 생활 시작")
    assert page.evaluate("state.phase") == "termBudget"


def finish_term(page):
    press(page, "장학금 자동 신청하고 학기 시작")
    assert page.evaluate("state.phase") == "semester"
    assert page.locator("#scene .core-actions button:visible").count() == 5
    assert page.locator("#scene button:visible").count() == 5
    for i in range(3):
        title = "공부" if i != 1 else "연구·프로젝트"
        target = page.locator("#scene .core-actions button").filter(has=page.get_by_text(title, exact=True))
        press(page, title if target.is_enabled() else "쉬어 가기")
        if page.evaluate("state.phase") == "campus":
            page.locator("#scene button:visible:enabled").first.click()
        if page.evaluate("state.phase") == "wellbeing":
            press(page, "상담과 충분한 수면으로 회복")
    assert page.evaluate("state.phase") == "report"
    assert page.locator("#scene .result-card").count() == 1
    press(page, "방학 동안 쉬기")
    assert page.evaluate("state.phase") == "vacationResult"
    press(page, "다음 학기로")


def run():
    OUT.mkdir(parents=True, exist_ok=True)
    measures = {}
    with sync_playwright() as p:
        browser = p.chromium.launch()
        errors = []
        for width in (1280, 375):
            page = create(browser, errors, width=width)
            page.screenshot(path=str(OUT / f"after-{width}-created.png"), full_page=True)
            admit(page)
            press(page, "장학금 자동 신청하고 학기 시작")
            measures[str(width)] = {
                "creation_controls": 4,
                "semester_buttons": page.locator("#scene button:visible").count(),
                "sidebar_summaries": page.locator("aside summary:visible").count(),
                "horizontal_overflow": page.evaluate("document.documentElement.scrollWidth>innerWidth"),
            }
            assert not measures[str(width)]["horizontal_overflow"]
            page.screenshot(path=str(OUT / f"after-{width}-semester.png"), full_page=True)
            before = page.evaluate("JSON.stringify(state)")
            page.evaluate("render();render()")
            assert page.evaluate("JSON.stringify(state)") == before
            # Balance is identical for all old difficulty-bearing v13 saves.
            assert page.evaluate("""() => {
              const original = state.development.difficulty;
              const values = ['easy','normal','hard'].map(difficulty => {
                state.development.difficulty=difficulty;return JSON.stringify(difficultyConfig());
              });
              state.development.difficulty=original;
              return new Set(values).size===1;
            }""")
            page.close()
        # New male playthrough: two real semesters trigger a timing decision.
        page = create(browser, errors, "남성")
        admit(page)
        finish_term(page)
        finish_term(page)
        assert page.evaluate("state.phase") == "militaryBoard"
        assert "급" not in page.locator("#scene h2").inner_text()
        assert page.locator("#scene button:visible").count() == 2
        press(page, "나중에 다녀오기")
        assert page.evaluate("state.phase") == "termBudget"
        assert page.evaluate("state.military.nextPromptSemester") == 5
        # Reopen through contextual character menu; no medical form is required.
        page.locator("#nav-character").click()
        page.locator("#military-button").click()
        page.evaluate("window.beforeUXRandom=Math.random;Math.random=()=>0")
        press(page, "지금 복무 시작")
        page.evaluate("Math.random=window.beforeUXRandom")
        assert page.evaluate("state.phase") == "service"
        clock = page.evaluate("state.life.year*12+state.life.half*6+(state.life.monthRemainder||0)")
        terms = page.evaluate("JSON.stringify(state.terms)")
        press(page, "남은 복무를 마치고 돌아오기")
        assert page.evaluate("state.phase") == "militaryComplete"
        assert page.evaluate("state.military.service.months") == 18
        assert page.evaluate("state.life.year*12+state.life.half*6+(state.life.monthRemainder||0)") == clock + 18
        assert page.evaluate("JSON.stringify(state.terms)") == terms
        before = page.evaluate("JSON.stringify(state.military)")
        page.reload()
        assert page.evaluate("JSON.stringify(state.military)") == before
        press(page, "전역 후 원래 진행으로")
        assert page.evaluate("state.phase") == "termBudget"
        page.close()
        page = create(browser, errors)
        admit(page)
        finish_term(page)
        finish_term(page)
        assert page.evaluate("state.phase") == "termBudget"
        assert page.evaluate("state.military.assessments.length") == 0
        # Old v13 female subject flags stay preserved, but never receive new call-ups.
        page.evaluate("state.military.subject=true;state.life.year=state.character.birthYear+30;enforceMilitary()")
        assert page.evaluate("state.phase") == "termBudget"
        page.close()
        # Exact old v13 fields survive migration, including difficulty and history.
        page = browser.new_page()
        page.goto(URL)
        page.evaluate("(s)=>{state=migrateSave(s);state.development.difficulty='hard';render()}", legacy_state())
        assert page.evaluate("""() => {
          const original=JSON.parse(JSON.stringify(state));
          const copy=migrateSave(original);
          return validSave(copy) && JSON.stringify(copy)===JSON.stringify(original);
        }""")
        assert page.evaluate("""() => {
          save(); const raw=localStorage.getItem(SLOT_CONFIG.key);
          state.money++;save();
          const key=SLOT_CONFIG.key+':before-ux-v1', backup=localStorage.getItem(key);
          state.money++;save();
          return backup===raw && localStorage.getItem(key)===backup;
        }""")
        assert page.evaluate("""() => {
          const key=SLOT_CONFIG.key+':before-ux-v1', raw=localStorage.getItem(SLOT_CONFIG.key);
          localStorage.removeItem(key);
          const setter=Storage.prototype.setItem;
          Storage.prototype.setItem=function(k,v){if(k===key)throw Error('backup quota');return setter.call(this,k,v)};
          state.money++;const ok=save();
          Storage.prototype.setItem=setter;
          return !ok && localStorage.getItem(SLOT_CONFIG.key)===raw;
        }""")
        page.close()
        assert not errors, errors
        browser.close()
    measures["admissions_clicks_after_selection_to_decision_four_applications"] = 2
    (OUT / "after.json").write_text(json.dumps(measures, ensure_ascii=False, indent=2), encoding="utf-8")
    print("PASS UX: 4입력·5핵심행동·원서/결과 고정·남성 일정/18개월·여성 제외·v13·PC/모바일")
    print(json.dumps(measures, ensure_ascii=False))


if __name__ == "__main__":
    run()
