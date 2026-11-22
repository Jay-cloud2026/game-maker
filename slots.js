// 네 캐릭터를 하나의 원자적 localStorage 레코드로 저장. 이전 레코드는 먼저 백업.
const SLOT_CONFIG = { key: `${CONFIG.saveKey}:slots-v1`, count: 4, format: 'life-slots-1' };
let slotStore = { format: SLOT_CONFIG.format, revision: 0, active: 0, slots: Array(4).fill(null) };
function parseSlotStore(raw) {
  const parsed = JSON.parse(raw);
  if (parsed.format !== SLOT_CONFIG.format || !Number.isInteger(parsed.revision) || parsed.revision < 0 ||
      !Number.isInteger(parsed.active) || parsed.active < 0 || parsed.active >= 4 ||
      !Array.isArray(parsed.slots) || parsed.slots.length !== 4) throw new Error('잘못된 슬롯 형식');
  for (const slot of parsed.slots) {
    if (!slot) continue;
    if (!slot.data || typeof slot.savedAt !== 'string') throw new Error('잘못된 슬롯');
    slot.data = migrateSave(slot.data);
    if (!validSave(slot.data)) throw new Error('슬롯 캐릭터 검증 실패');
  }
  return parsed;
}
function writeSlotStore(next, confirmedReplace = false) {
  if (preserveUnreadableSave) return false;
  try {
    const raw = localStorage.getItem(SLOT_CONFIG.key);
    if (raw) {
      let current;
      try { current = JSON.parse(raw); }
      catch { localStorage.setItem(`${SLOT_CONFIG.key}:unreadable`, raw); current = { revision: slotStore.revision }; }
      if (current.revision !== slotStore.revision && !confirmedReplace) throw new Error('다른 창에서 저장됨');
      localStorage.setItem(`${SLOT_CONFIG.key}:previous`, raw);
    }
    const serialized = JSON.stringify({ ...next, revision: slotStore.revision + 1 });
    // 쓰기 도중 예외가 나면 원래 키는 유지됩니다. 검증된 현재 메모리만 직렬화합니다.
    localStorage.setItem(SLOT_CONFIG.key, serialized);
    slotStore = JSON.parse(serialized); saveAvailable = true;
    return true;
  } catch {
    saveAvailable = false;
    return false;
  }
}
function saveActiveSlot() {
  if (preserveUnreadableSave) return false;
  try {
    if (!validSave(state)) { saveAvailable = false; return false; }
  } catch { saveAvailable = false; return false; }
  const next = JSON.parse(JSON.stringify(slotStore));
  next.slots[next.active] = { data: JSON.parse(JSON.stringify(state)), savedAt: new Date().toISOString(), ovr: careerRatings()?.overall || 0 };
  return writeSlotStore(next);
}
function loadSlotSystem() {
  let raw;
  try { raw = localStorage.getItem(SLOT_CONFIG.key); } catch { saveAvailable = false; return false; }
  if (!raw) return false; // 기존 단일 저장은 기존 boot의 버전별 백업 후 첫 슬롯에 저장.
  try {
    const original = JSON.parse(raw);
    if (original.slots?.some(slot => slot && slot.data?.version !== CONFIG.saveVersion) &&
        !localStorage.getItem(`${SLOT_CONFIG.key}:before-assessment`)) localStorage.setItem(`${SLOT_CONFIG.key}:before-assessment`,raw);
    slotStore = parseSlotStore(raw);
    state = slotStore.slots[slotStore.active]?.data || freshState();
    const captured = ensureMemoirSnapshot();
    const previousForty = state.lifeAssessment.forty;
    updateFortyMilestone();
    if (captured || previousForty !== state.lifeAssessment.forty ||
        original.slots?.some(slot => slot && slot.data?.version !== CONFIG.saveVersion)) saveActiveSlot();
    render(); return true;
  } catch {
    try {
      const previous = localStorage.getItem(`${SLOT_CONFIG.key}:previous`);
      const recovered = parseSlotStore(previous);
      // 복구 전에 손상 레코드를 따로 보존합니다.
      localStorage.setItem(`${SLOT_CONFIG.key}:unreadable`, raw);
      localStorage.setItem(SLOT_CONFIG.key, JSON.stringify(recovered));
      slotStore = recovered;
      state = slotStore.slots[slotStore.active]?.data || freshState();
      state.notice = '최근 저장이 손상되어 직전 슬롯 백업을 복구했습니다. 손상 원본도 별도 보존했습니다.';
      ensureMemoirSnapshot(); updateFortyMilestone(); saveActiveSlot();
      render(); return true;
    } catch {
      state = freshState(); preserveUnreadableSave = true; saveAvailable = false;
      state.notice = '슬롯 저장을 읽지 못했습니다. 원본을 보존합니다. JSON 백업을 가져오거나 명시적으로 새로 시작할 수 있습니다.';
      render(); return true;
    }
  }
}
function selectSlot(index) {
  if (index === slotStore.active) return;
  if (preserveUnreadableSave) { alert('읽지 못한 저장을 보존 중입니다. 먼저 백업 파일을 복원하세요.'); return; }
  if (state.character && !saveActiveSlot()) { alert('현재 캐릭터를 저장하지 못해 전환하지 않았습니다. JSON으로 내보내 주세요.'); return; }
  const next = JSON.parse(JSON.stringify(slotStore)); next.active = index;
  if (!writeSlotStore(next)) return;
  state = slotStore.slots[index]?.data || freshState();
  const captured = ensureMemoirSnapshot(), previousForty = state.lifeAssessment.forty;
  updateFortyMilestone();
  if (captured || previousForty !== state.lifeAssessment.forty) saveActiveSlot();
  $('slots-dialog').close(); render();
}
function deleteSlot(index) {
  if (!slotStore.slots[index] || !confirm(`${index + 1}번 슬롯을 삭제할까요? 직전 전체 저장은 복구 백업으로 남습니다.`)) return;
  const next = JSON.parse(JSON.stringify(slotStore)); next.slots[index] = null;
  if (!writeSlotStore(next)) return;
  if (index === slotStore.active) state = freshState();
  render(); renderSlots();
}
function copyToSlot(index) {
  if (index === slotStore.active || !confirm(`${index + 1}번 슬롯에 현재 캐릭터를 복사할까요? 기존 캐릭터가 있으면 덮어씁니다.`)) return;
  const next = JSON.parse(JSON.stringify(slotStore));
  next.slots[index] = { data: JSON.parse(JSON.stringify(state)), savedAt: new Date().toISOString(), ovr: careerRatings()?.overall || 0 };
  if (writeSlotStore(next)) renderSlots();
}
function renderSlots() {
  const root = $('slots-content'); root.replaceChildren();
  renderLifeComparison(root);
  slotStore.slots.forEach((slot,index) => {
    const card = element('div', undefined, 'opportunity');
    card.append(element('h3', `${index + 1}번 슬롯${index === slotStore.active ? ' · 현재' : ''}`));
    if (slot?.data.character) {
      const d = slot.data, c = d.character, job = companyById(d.career.employer);
      const pg = d.postgraduate.active;
      const school = pg && !pg.completed ? programById(pg.program).school : universityById(d.life.university)?.name || '대학 입학 전/이전 학교 미기록';
      // 요약 계산 중 state를 교체하거나 RNG를 사용하지 않습니다.
      const skills = d.development.skills;
      const ovr = round(Object.entries(DEVELOPMENT_CONFIG.ratingWeights.overall).reduce((sum,[key,weight]) => sum + skills[key] * weight, 0));
      list(card, [
        `${c.name} · ${d.life.year - c.birthYear}세 · ${c.highSchool}`,
        `현재 ${job?.name || school} · ${pg && !pg.completed ? `${degreeName(pg.degree)} ${pg.semester}학기` : semesterName(d.semester)}`,
        `${slot.ovr === undefined ? '이전 훈련 OVR' : 'OVR'} ${slot.ovr ?? ovr} · 진로 ${d.life.highestDegree} · 난이도 ${DIFFICULTIES[d.development.difficulty].title}`,
        `저장 ${slot.savedAt} · ${d.ending ? '엔딩 달성 이력 있음' : '진행 중'}`,
      ]);
    } else card.append(element('p', '빈 슬롯 · 새 캐릭터 시작'));
    addButton(card, slot?.data.character ? '이 슬롯 이어하기' : '이 슬롯 새 게임', '', () => selectSlot(index), index === slotStore.active);
    addButton(card, '현재 캐릭터를 이 슬롯에 복사', '기존 캐릭터 덮어쓰기 전 확인', () => copyToSlot(index), index === slotStore.active || !state.character);
    addButton(card, '이 슬롯 삭제', '삭제 전 확인', () => deleteSlot(index), !slot);
    root.append(card);
  });
}
function openSlots() { renderSlots(); $('slots-dialog').showModal(); }
function importAllSlots(parsed) {
  const next = parseSlotStore(JSON.stringify(parsed));
  if (!confirm('4개 슬롯 전체를 가져올까요? 현재 전체 슬롯은 직전 백업으로 남습니다.')) return;
  preserveUnreadableSave = false;
  if (!writeSlotStore(next, true)) throw new Error('슬롯 쓰기 실패');
  state = slotStore.slots[slotStore.active]?.data || freshState();
  const captured = ensureMemoirSnapshot(), previousForty = state.lifeAssessment.forty;
  updateFortyMilestone();
  if (captured || previousForty !== state.lifeAssessment.forty) saveActiveSlot();
  render();
}
