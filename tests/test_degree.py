"""통합 5단계: 실제 3행동/학기·논문/시험/심사·연장·기존 석사 이전."""
# 프로젝트 루트에서 실행: python3 tests/test_degree.py
from playwright.sync_api import sync_playwright
from test_career import graduate_page
from test_game import click, phase


def complete_degree(page):
    """확률만 고정하고 모든 정산·연구·심사를 UI로 수행."""
    degree = page.evaluate("state.postgraduate.active.degree")
    plans = [
        ["연구 주제 선정", "전공 심화 공부", "논문 자료 분석"],
        ["논문 자료 분석", "지도교수 면담", "학회 발표 준비"],
        ["연구실 실험", "학위 논문 작성", "수업 조교(TA)"],
        ["학위 논문 작성", "연구 조교(RA)", "대학원 휴식"],
    ] if degree == "masters" else [
        ["연구 주제 선정", "전공 심화 공부", "논문 자료 분석"],
        ["전공 심화 공부", "지도교수 면담", "학회 발표 준비"],
        ["연구실 실험", "논문 자료 분석", "학술 논문 투고"],
        ["연구실 실험", "논문 자료 분석", "학술 논문 투고"],
        ["학위 논문 작성", "학위 논문 작성", "박사 자격시험"],
        ["학위 논문 작성", "학위 논문 작성", "수업 조교(TA)"],
        ["공동 연구", "연구 조교(RA)", "대학원 휴식"],
        ["최종 디펜스", "수업 조교(TA)", "대학원 휴식"],
    ]
    for titles in plans:
        assert phase(page) == "graduateTerm"
        if page.locator("#scene button").filter(has_text="대학원 부족액 대출").is_enabled():
            click(page, "대학원 부족액 대출")
        click(page, "대학원 학기 등록 정산")
        if page.locator("#scene button").filter(has_text="잠시 쉬고 생활비 상담").is_enabled():
            click(page, "잠시 쉬고 생활비 상담")
        for title in titles:
            page.evaluate("window.savedDegreeRandom=Math.random;Math.random=()=>0")
            click(page, title)
            page.evaluate("Math.random=window.savedDegreeRandom")
        assert phase(page) == "graduateReport"
        page.locator("#scene button:enabled").last.click()
    assert phase(page) == "graduateDone"


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        errors = []
        page = graduate_page(browser, errors)
        page.evaluate("startDegree(programById('kr-ms'));commit()")
        year = page.evaluate("state.life.year")
        complete_degree(page)
        assert page.evaluate("state.life.year") == year + 2
        assert page.evaluate("state.master.completed && state.master.turn===4")
        click(page, "취업·박사 지원 살펴보기")
        page.evaluate("startDegree(programById('de-phd'));commit()")
        year = page.evaluate("state.life.year")
        complete_degree(page)
        assert page.evaluate("state.life.year") == year + 4
        assert page.evaluate("state.reflection.phdCompleted && state.postgraduate.active.defense")
        click(page, "학위 취득 엔딩")
        snapshot = page.evaluate("JSON.stringify(state.reflection.snapshot)")
        page.reload()
        assert page.evaluate("JSON.stringify(state.reflection.snapshot)") == snapshot
        page.close()
        page = graduate_page(browser, errors)
        page.evaluate("startDegree(programById('kr-ms'));commit()")
        # 준비 없이 4학기 휴식: 졸업 불가, 5학기로 연장.
        for _ in range(4):
            if page.locator("#scene button").filter(has_text="대학원 부족액 대출").is_enabled():
                click(page, "대학원 부족액 대출")
            click(page, "대학원 학기 등록 정산")
            for _ in range(3):
                click(page, "대학원 휴식")
            click(page, "다음 대학원 학기")
        assert page.evaluate("state.postgraduate.active.semester") == 5
        assert page.evaluate("!state.master.completed")
        assert page.evaluate("validSave(state)")
        page.close()
        page = graduate_page(browser, errors)
        page.evaluate("startDegree(programById('kr-ms'));commit()")
        click(page, "대학원 학기 등록 정산")
        click(page, "대학원 연구실·학회 활동")
        click(page, "재현과학 연구실 선택")
        page.evaluate("window.randomQueue=[0]")
        click(page, "연구 프로젝트 진행")
        assert page.evaluate("degreeTerm().actions.length") == 1
        snapshot = page.evaluate("JSON.stringify(state.postgraduate)")
        page.reload()
        assert page.evaluate("JSON.stringify(state.postgraduate)") == snapshot
        click(page, "활동 결과 확인")
        assert phase(page) == "graduateTerm"
        assert page.evaluate("state.postgraduate.active.data") == 2
        page.close()
        page = graduate_page(browser, errors)
        assert page.evaluate("""() => {
          const old=JSON.parse(JSON.stringify(state));old.version=9;delete old.postgraduate;
          old.master={program:'kr-ms',turn:1,actions:['연구 조교(RA)'],research:2,completed:false};
          old.phase='master';const result=migrateSave(old);
          return result.postgraduate.active.semester===3 && result.master.turn===1 &&
            result.life.year===old.life.year && result.money===old.money &&
            result.master.actions[0]===old.master.actions[0] && result.phase==='graduateTerm' && validSave(result);
        }""")
        page.close()
        assert not errors, errors
        browser.close()
        print("PASS 통합 5단계: 석사 4학기/박사 8학기 UI·3행동·단일 정산·학위 요건·연장·엔딩 복원")


if __name__ == "__main__":
    run()
