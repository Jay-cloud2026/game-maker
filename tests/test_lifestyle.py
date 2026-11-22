"""통합 6단계: 운동 제한·실제 장착 효율·가족 한도·인벤토리 복원."""
# 프로젝트 루트에서 실행: python3 tests/test_lifestyle.py
from playwright.sync_api import sync_playwright
from test_campus import start_budget
from test_game import click


def run():
    with sync_playwright() as p:
        b = p.chromium.launch()
        errors = []
        page = start_budget(b, errors)
        page.evaluate("state.money=500;commit()")
        page.locator("#lifestyle-button").click()
        before = page.evaluate("state.energy")
        click(page, "조깅")
        click(page, "헬스")
        assert page.evaluate("state.wellness.maxEnergy") > 100
        assert page.evaluate("state.energy") < before
        assert page.locator("#scene button").filter(has_text="조깅").is_disabled()
        money = page.evaluate("state.money")
        click(page, "정기 용돈 받기")
        assert page.evaluate("state.money") > money
        assert page.locator("#scene button").filter(has_text="정기 용돈 받기").is_disabled()
        for _ in range(2):
            page.evaluate("window.randomQueue=[0]")
            click(page, "부모님께 용돈 요청")
        assert page.locator("#scene button").filter(has_text="부모님께 용돈 요청").is_disabled()
        click(page, "기본 노트북 구매")
        click(page, "기본 노트북 장착")
        assert page.evaluate("equipmentBonus('project')") > 1
        click(page, "고성능 노트북 구매")
        click(page, "고성능 노트북 장착")
        assert page.evaluate("state.inventory.equipped.device") == "pro-laptop"
        assert page.evaluate("equipmentBonus('project')") == 1
        assert page.evaluate("equipmentBonus('research')") > 1
        old = page.evaluate("JSON.stringify({wellness:state.wellness,inventory:state.inventory,household:state.household})")
        page.reload()
        assert page.evaluate("JSON.stringify({wellness:state.wellness,inventory:state.inventory,household:state.household})") == old
        assert page.evaluate("validSave(state)")
        assert page.evaluate("""() => {
          const before=developmentCondition();state.wellness.fatigue=100;
          return developmentCondition()<before;
        }""")
        assert not errors, errors
        b.close()
        print("PASS 통합 6단계: 운동/가족 반복 한도·최대 체력/회복/피로·장착 슬롯·실제 효율·저장 복원")


if __name__ == "__main__":
    run()
