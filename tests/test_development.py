"""통합 확장 2단계: 생성·실제 행동 성장·선천 효과·독립 난수·v7 보존."""
# 프로젝트 루트에서 실행: python3 tests/test_development.py
import json
from playwright.sync_api import sync_playwright
from test_life import new_page
from test_campus import start_budget
from test_game import click, prepare_term


def test_creation(browser, errors):
    page = new_page(browser, errors)
    page.locator("#character-high-school").fill("나의고등학교")
    page.locator("#character-gender").select_option("남성")
    assert page.locator("#character-difficulty").count() == 0
    click(page, "캐릭터 생성하고 시작")
    assert page.evaluate("state.character.highSchool") == "나의고등학교"
    assert page.evaluate("state.development.difficulty") == "normal"
    assert page.evaluate("state.development.setup.militarySubject")
    initial = page.evaluate("JSON.stringify(state.development)")
    page.reload()
    assert page.evaluate("JSON.stringify(state.development)") == initial
    assert page.evaluate("window.randomCalls") == 0
    # 다양한 생성: 모든 선천 잠재력 최상위가 아닌 확실한 강점·약점, 낮은 초기 훈련.
    assert page.evaluate("""() => {
      Math.random=window.originalRandom || Math.random;
      for(let i=0;i<150;i++){
        const c=generateCharacter({name:'검증'+i,birthYear:2008,personality:'steady'});
        const d=makeDevelopment(c);
        if(Math.max(...Object.values(d.innate))<82 || Math.min(...Object.values(d.innate))>30 ||
          Math.max(...Object.values(d.skills))>52 || d.traits.length>2)return false;
      } return true;
    }""")
    page.close()


def test_growth(browser, errors):
    page = start_budget(browser, errors)
    prepare_term(page)
    innate = page.evaluate("JSON.stringify(state.development.innate)")
    before = page.evaluate("state.development.skills.academic")
    calls = page.evaluate("window.randomCalls")
    click(page, "전공 공부")
    assert before < page.evaluate("state.development.skills.academic") <= before + 2
    assert page.evaluate("window.randomCalls") == calls
    growth = page.evaluate("JSON.stringify(state.development)")
    page.evaluate("ensureUndergraduateGrowth();commit();render();render()")
    assert page.evaluate("JSON.stringify(state.development)") == growth
    page.reload()
    assert page.evaluate("JSON.stringify(state.development)") == growth
    assert page.evaluate("JSON.stringify(state.development.innate)") == innate
    assert page.evaluate("Object.values(careerRatings()).every(n=>n>=0&&n<=100)")
    page.locator("#character-drawer > summary").click()
    assert page.locator("#ovr").inner_text().endswith("/ 100")
    assert page.evaluate("""() => {
      const original=JSON.stringify(state);
      const run=(level,difficulty,energy,stress,traits=[])=>{
        state=JSON.parse(original);state.development.skills.academic=level;
        state.development.difficulty=difficulty;state.development.traits=traits;
        state.energy=energy;state.character.abilities.stress=stress;
        recordGrowth('study','test:unique');return state.development.skills.academic-level;
      };
      const low=run(20,'normal',90,10), high=run(85,'normal',90,10);
      const easy=run(20,'easy',90,10), hard=run(20,'hard',90,10);
      const tired=run(20,'normal',5,95), quick=run(20,'normal',90,10,['quick']);
      state=JSON.parse(original);
       return low>high && easy===hard && low>tired && quick>low;
    }""")
    assert page.evaluate("""() => {
      const original=JSON.stringify(state);
      state.development.skills.academic=20;
      for(let i=0;i<12;i++)recordGrowth('study',`test:long:${i}`);
      const gradual=state.development.skills.academic<40;
      state.development.skills.research=50;state.development.traits=[];
      const basic=researchChance(.7), interview=actualInterviewScore(80);
      state.development.traits=['creative','social'];
      const affected=researchChance(.7)>basic && actualInterviewScore(80)>interview;
      state=JSON.parse(original);return gradual && affected;
    }""")
    page.close()


def test_v7_preserved(browser, errors):
    page = start_budget(browser, errors)
    prepare_term(page)
    click(page, "전공 공부")
    old = page.evaluate("""() => {
      const old=JSON.parse(JSON.stringify(state));delete old.development;
      delete old.wellness;delete old.household;delete old.inventory;delete old.lifestyle;
      old.version=7;return old;
    }""")
    raw = json.dumps(old, ensure_ascii=False)
    page.evaluate("(raw)=>{localStorage.removeItem(SLOT_CONFIG.key);localStorage.setItem(CONFIG.saveKey,raw)}", raw)
    page.reload()
    actual = page.evaluate("JSON.parse(JSON.stringify(state))")
    for key, value in old.items():
        if key not in ("version", "notice"):
            assert actual[key] == value, key
    assert page.evaluate("localStorage.getItem(CONFIG.saveKey+':backup-v7')") == raw
    assert page.evaluate("state.development.innate.intelligence") == 50
    assert page.evaluate("state.development.history.length") == 0
    page.evaluate("ensureUndergraduateGrowth();commit()")
    assert page.evaluate("state.development.history.length") == 0
    assert page.evaluate("validSave(state)")
    # 백업 실패 환경은 원본 키를 덮어쓰지 않습니다.
    page.evaluate("(raw)=>{localStorage.removeItem(SLOT_CONFIG.key);localStorage.removeItem(CONFIG.saveKey+':backup-v7');localStorage.setItem(CONFIG.saveKey,raw)}", raw)
    page.add_init_script("""const set=Storage.prototype.setItem;
      Storage.prototype.setItem=function(k,v){
        if(k.endsWith(':backup-v7'))throw new Error('quota');return set.call(this,k,v);
      };""")
    page.reload()
    assert page.evaluate("preserveUnreadableSave")
    assert page.evaluate("localStorage.getItem(CONFIG.saveKey)") == raw
    page.close()


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        errors = []
        test_creation(browser, errors)
        test_growth(browser, errors)
        test_v7_preserved(browser, errors)
        assert not errors, errors
        browser.close()
        print("PASS 통합 2단계: 생성·잠재력 고정·완만한 실제 성장·OVR·특성/컨디션·기본 밸런스")
        print("PASS 통합 2단계: 독립 성장 난수·재접속/중복 방지·v7 필드 보존·백업 실패 보호")


if __name__ == "__main__":
    run()
