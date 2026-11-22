"""통합 7단계: 판정별 복무·기간·자격·복학·연기·전문연구."""
# 프로젝트 루트에서 실행: python3 tests/test_military.py
from playwright.sync_api import sync_playwright
from test_campus import start_budget
from test_career import graduate_page
from test_game import click, phase, reveal


def run():
    with sync_playwright() as p:
        b = p.chromium.launch()
        errors = []
        for grade, title, quarters in [(1, "육군 입대", 6), (4, "사회복무 시작", 7)]:
            page = start_budget(b, errors)
            page.evaluate("(grade)=>{state.character.gender='남성';state.military.subject=true;state.military.grade=grade;commit()}", grade)
            before = page.evaluate("JSON.stringify(state.terms)")
            semester = page.evaluate("state.semester")
            clock = page.evaluate("state.life.year*12+state.life.half*6+(state.life.monthRemainder||0)")
            reveal(page.locator("#military-button")).click()
            click(page, title)
            for i in range(quarters):
                page.evaluate("window.savedMilitaryRandom=Math.random;Math.random=()=>0")
                click(page, "자격증 준비" if i < 3 else "자격시험 응시" if i == 3 else "복무 중 운동")
                page.evaluate("Math.random=window.savedMilitaryRandom")
            assert phase(page) == "militaryComplete"
            assert page.evaluate("state.military.certificates.length") == 1
            assert page.evaluate("state.military.service.months") == quarters * 3
            assert page.evaluate("state.life.year*12+state.life.half*6+(state.life.monthRemainder||0)") == clock + quarters * 3
            stored = page.evaluate("JSON.stringify(state.military)")
            page.reload()
            assert page.evaluate("JSON.stringify(state.military)") == stored
            click(page, "전역 후 원래 진행으로")
            assert page.evaluate("JSON.stringify(state.terms)") == before
            assert page.evaluate("state.semester") == semester
            assert phase(page) == "termBudget"
            assert page.evaluate("validSave(state)")
            page.close()
        page = graduate_page(b, errors)
        page.evaluate("""state.master={program:'kr-ms',turn:2,actions:['연구 프로젝트'],research:8,completed:true};
          state.character.gender='남성';state.research=10;state.military.subject=true;state.military.grade=3;state.phase='hub';commit()""")
        assert phase(page) == "militaryBoard"  # 졸업 후 학적 없음: 자동 연기 불가.
        click(page, "나래정밀 기업부설연구소")
        page.evaluate("window.randomQueue=[0,0]")
        click(page, "석사 후 지정연구기관 채용·편입 지원")
        click(page, "전문연구요원 편입 시작")
        for _ in range(12):
            page.evaluate("window.savedMilitaryRandom=Math.random;Math.random=()=>0")
            click(page, "복무 연구 프로젝트")
            page.evaluate("Math.random=window.savedMilitaryRandom")
        assert phase(page) == "militaryComplete"
        assert page.evaluate("state.military.service.research") == 24
        assert page.evaluate("careerEvidence().some(e=>e.id==='serviceResearch')")
        page.close()
        page = graduate_page(b, errors)
        page.evaluate("""state.master={program:'kr-ms',turn:4,actions:[],research:10,completed:true};
          startDegree(programById('kr-phd'));
          Object.assign(state.postgraduate.active,{semester:5,topic:1,knowledge:4,qualify:true,feedback:1,conference:1,data:12});
          state.character.gender='남성';state.military.subject=true;state.military.grade=2;state.research=15;commit()""")
        reveal(page.locator("#military-button")).click()
        click(page, "한울대학교 지정 자연계대학원")
        page.evaluate("window.randomQueue=[0,0]")
        click(page, "박사 편입대상자 선발 지원")
        click(page, "전문연구요원 편입 시작")
        for title in ["복무 논문 작성"] * 4 + ["복무 연구 프로젝트", "복무 학회 발표", "복무 중 학위 디펜스", "복무 중 휴식"]:
            page.evaluate("window.savedMilitaryRandom=Math.random;Math.random=()=>0")
            click(page, title)
            page.evaluate("Math.random=window.savedMilitaryRandom")
        assert page.evaluate("state.reflection.phdCompleted && state.military.service.months===24")
        click(page, "학위 취득 후 연구기관 전직")
        for _ in range(4):
            click(page, "복무 연구 프로젝트")
        assert phase(page) == "militaryComplete"
        assert page.evaluate("state.military.service.transferred && state.military.service.months===36")
        click(page, "전역 후 원래 진행으로")
        assert phase(page) == "graduateDone"
        page.close()
        page = start_budget(b, errors)
        assert page.evaluate("""() => {
          state.military.subject=true;state.military.grade=1;
          state.life.year=state.character.birthYear+24;
          const inAge=militaryDeferment().allowed;state.life.year++;
          return inAge&&!militaryDeferment().allowed;
        }""")
        # 판정은 에너지와 무관한 독립 추첨.
        page.evaluate("state.energy=0;state.military.grade=null;openMilitary();window.randomQueue=[.8];commit()")
        click(page, "병역판정검사")
        assert page.evaluate("state.military.grade") == 4
        assert not errors, errors
        b.close()
        print("PASS 통합 7단계: 육군18/사회21/연구36개월·자격 준비/응시·연구 성과·학기 보존/복원·연령 한도")


if __name__ == "__main__":
    run()
