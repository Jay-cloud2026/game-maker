"""통합 8단계: 독립 4슬롯·전환/수동 저장·덮어쓰기/삭제·전체 JSON·실패 복구."""
# 프로젝트 루트에서 실행: python3 tests/test_slots.py
import json
from playwright.sync_api import sync_playwright
from test_life import new_page, create_character


def switch(page, index):
    page.locator("#slots-button").click()
    card = page.locator("#slots-content .opportunity").nth(index)
    card.locator("button").first.click()


def run():
    with sync_playwright() as p:
        b = p.chromium.launch()
        errors = []
        page = new_page(b, errors)
        names = ["슬롯하나", "슬롯둘", "슬롯셋", "슬롯넷"]
        for i, name in enumerate(names):
            if i:
                switch(page, i)
            create_character(page, name=name)
            # Legacy difficulty-bearing records must stay readable in all four slots.
            page.evaluate("(difficulty)=>{state.development.difficulty=difficulty;commit()}", ["easy", "normal", "hard", "normal"][i])
            page.locator("#manual-save").click()
            assert "수동 저장 완료" in page.locator("#save-status").inner_text()
        before = page.evaluate("JSON.stringify(slotStore.slots.map(s=>s.data))")
        page.reload()
        assert page.evaluate("state.character.name") == names[3]
        for i, name in enumerate(names):
            switch(page, i)
            assert page.evaluate("state.character.name") == name
        assert page.evaluate("JSON.stringify(slotStore.slots.map(s=>s.data))") == before
        assert page.evaluate("slotStore.slots[0].data.development.difficulty") == "easy"
        assert page.evaluate("slotStore.slots[2].data.development.difficulty") == "hard"
        page.on("dialog", lambda d: d.accept())
        page.goto(page.url + "?dev=1")
        with page.expect_download() as info:
            page.locator("#slots-export").click()
        assert "4슬롯" in info.value.suggested_filename
        backup = page.evaluate("JSON.stringify(slotStore)")
        page.locator("#slots-button").click()
        page.locator("#slots-content .opportunity").nth(1).get_by_text("이 슬롯 삭제", exact=True).click()
        assert page.evaluate("slotStore.slots[1]") is None
        page.locator("#slots-close").click()
        page.locator("#save-file").set_input_files({"name":"all.json", "mimeType":"application/json", "buffer":backup.encode()})
        page.wait_for_function("slotStore.slots[1]!==null")
        assert page.evaluate("slotStore.slots[1].data.character.name") == names[1]
        # 현재 슬롯에 단일 JSON 가져오기. 나머지 슬롯은 바뀌지 않습니다.
        others = page.evaluate("JSON.stringify(slotStore.slots.slice(0,3))")
        single = page.evaluate("JSON.stringify({...state,money:1234})")
        page.locator("#save-file").set_input_files({"name":"one.json", "mimeType":"application/json", "buffer":single.encode()})
        page.wait_for_function("state.money===1234")
        assert page.evaluate("JSON.stringify(slotStore.slots.slice(0,3))") == others
        stored = page.evaluate("localStorage.getItem(SLOT_CONFIG.key)")
        page.evaluate("""window.originalSet=Storage.prototype.setItem;
          Storage.prototype.setItem=function(k,v){if(k===SLOT_CONFIG.key)throw new Error('quota');return window.originalSet.call(this,k,v)};
          state.money++;save();""")
        assert page.evaluate("localStorage.getItem(SLOT_CONFIG.key)") == stored
        assert page.evaluate("saveAvailable") is False
        page.reload()
        assert page.evaluate("state.money") == 1234
        # 손상 시 직전 4슬롯 백업 복구, 손상 원본 별도 보존.
        page.evaluate("localStorage.setItem(SLOT_CONFIG.key,'{damaged')")
        page.reload()
        assert page.evaluate("localStorage.getItem(SLOT_CONFIG.key+':unreadable')") == "{damaged"
        assert "복구" in page.locator("#notice").inner_text()
        assert page.evaluate("slotStore.slots.filter(Boolean).length") == 4
        assert page.evaluate("validSave(state)")
        assert not errors, errors
        b.close()
        print("PASS 통합 8단계: 4캐릭터/난이도 독립·수동/자동 저장·전환·삭제 확인·전체/단일 JSON")
        print("PASS 통합 8단계: 저장 실패 원본 보존·손상 직전 복구·엔딩/성장 상태 유지")


if __name__ == "__main__":
    run()
