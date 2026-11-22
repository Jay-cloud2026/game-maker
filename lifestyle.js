const LIFESTYLE_PHASES = ['lifestyle'];
const FAMILY_LEVELS = {
  rich: { title: '지원이 넉넉한 가정', initial: 100, allowance: 70, gift: 50 },
  average: { title: '평균적인 가정', initial: 30, allowance: 30, gift: 25 },
  limited: { title: '지원이 제한적인 가정', initial: 0, allowance: 10, gift: 10 },
};
const ITEMS = [
  { id: 'exam-book', title: '수능 문제집', price: 12, slot: 'book', channel: 'academic', bonus: .08, entrance: true },
  { id: 'major-book', title: '전공 서적', price: 20, slot: 'book', channel: 'academic', bonus: .10, college: true },
  { id: 'tablet', title: '태블릿', price: 65, slot: 'device', channel: 'academic', bonus: .10 },
  { id: 'laptop', title: '기본 노트북', price: 90, slot: 'device', channel: 'project', bonus: .10 },
  { id: 'pro-laptop', title: '고성능 노트북', price: 180, slot: 'device', channel: 'research', bonus: .14 },
  { id: 'headphones', title: '노이즈 캔슬링 헤드폰', price: 35, slot: 'audio', channel: 'academic', bonus: .06 },
  { id: 'shoes', title: '운동화', price: 15, slot: 'fitness', channel: 'exercise', bonus: .12 },
  { id: 'gym', title: '헬스장 회원권', price: 45, slot: 'fitness', channel: 'exercise', bonus: .18 },
  { id: 'subscription', title: '연구 자료 구독권', price: 25, slot: 'subscription', channel: 'research', bonus: .10, college: true },
  { id: 'desk', title: '책상 및 의자', price: 50, slot: 'furniture', channel: 'recovery', bonus: .08 },
];
const EXERCISES = [
  { id: 'walk', title: '산책', energy: -5, habit: 1, stress: -6 },
  { id: 'jog', title: '조깅', energy: -10, habit: 2, stress: -7 },
  { id: 'weights', title: '헬스', energy: -15, habit: 3, stress: -5 },
  { id: 'sports', title: '동아리 스포츠', energy: -12, habit: 2, stress: -8 },
];
const FAMILY_ACTION_LABELS = { allowance: '정기 용돈', request: '용돈 요청', holiday: '명절 용돈', reward: '성적 보상', emergency: '긴급 생활비', repair: '관계 회복' };
const ITEM_SLOT_LABELS = { book: '서적', device: '학습 기기', audio: '청취 장비', fitness: '운동 장비', subscription: '자료 구독', furniture: '가구' };
function initialLifestyleFields() {
  return { wellness: { maxEnergy: 100, fatigue: 0, habit: 0, recovery: 1 },
    household: null, inventory: { owned: [], equipped: {}, purchases: [] },
    lifestyle: { returnPhase: 'semester', used: {}, history: [] } };
}
function upgradeLifestyle(value) {
  const result = { ...value, ...initialLifestyleFields(), version: CONFIG.saveVersion };
  if (value.character) result.household = { level: 'average', relationship: 60, requests: {}, received: {}, history: [], origin: 'migrated' };
  return result;
}
function initializeHousehold() {
  const draw = Math.random(), level = draw < .22 ? 'rich' : draw < .75 ? 'average' : 'limited';
  state.household = { level, relationship: 60, requests: {}, received: {}, history: [], origin: 'new', draw };
  state.money = CONFIG.initial.money + FAMILY_LEVELS[level].initial;
  state.character.abilities.economy = { rich: 80, average: 50, limited: 20 }[level];
}
function validLifestyle(value) {
  const w = value.wellness, inv = value.inventory, f = value.household;
  return w && ['maxEnergy','fatigue','habit','recovery'].every(k => Number.isFinite(w[k])) &&
    w.maxEnergy >= 100 && w.maxEnergy <= 130 && w.fatigue >= 0 && w.fatigue <= 100 &&
    inv && Array.isArray(inv.owned) && new Set(inv.owned).size === inv.owned.length &&
    inv.owned.every(id => ITEMS.some(item => item.id === id)) && inv.equipped &&
    Object.entries(inv.equipped).every(([slot,id]) => inv.owned.includes(id) && ITEMS.some(i => i.id === id && i.slot === slot)) &&
    value.lifestyle && value.lifestyle.used && Array.isArray(value.lifestyle.history) &&
    (!value.character || (f && FAMILY_LEVELS[f.level] && Number.isFinite(f.relationship) && f.requests && f.received && Array.isArray(f.history)));
}
function equipmentBonus(channel) {
  if (!state.inventory) return 1;
  return 1 + Math.min(.25, Object.values(state.inventory.equipped).reduce((sum, id) => {
    const i = ITEMS.find(i => i.id === id);
    if (i.entrance && state.life.admissionYear !== null) return sum;
    return sum + (i.channel === channel ? i.bonus : 0);
  }, 0));
}
function lifestylePeriod() {
  if (state.military?.service && !state.military.service.completed) return `service:${state.military.service.months}`;
  const d = state.postgraduate?.active;
  if (d && !d.completed) return `degree:${d.program}:${d.semester}`;
  return `${state.life.year}:${state.life.half}:${state.life.admissionYear === null ? `exam:${state.entrance.attempts.length}` : `ug:${state.semester}`}`;
}
function openLifestyle() { state.lifestyle.returnPhase = state.phase; state.phase = 'lifestyle'; }
function exercise(action, key) {
  if (unavailable({ energy: action.energy })) return false;
  const gain = action.habit * equipmentBonus('exercise') * (.7 + state.development.innate.stamina / 100);
  applyEffects({ energy: action.energy });
  state.wellness.habit = round(Math.min(100, state.wellness.habit + gain));
  state.wellness.maxEnergy = round(100 + state.wellness.habit * .25);
  state.wellness.recovery = 1 + state.wellness.habit / 200;
  applyAbilities({ stress: action.stress, happiness: 2 });
  recordGrowth(action.id === 'sports' ? 'club' : 'rest', key);
  return true;
}
function familyAction(kind) {
  const f = state.household, level = FAMILY_LEVELS[f.level], period = lifestylePeriod();
  const key = ['holiday','reward','emergency'].includes(kind) ? `${kind}:${state.life.year}` : `${kind}:${period}`;
  if (f.received[key]) return;
  let amount = 0, draw = null, success = true;
  if (kind === 'request') {
    const count = f.requests[period] || 0;
    if (count >= 2) return;
    f.requests[period] = count + 1; draw = Math.random();
    success = draw < clamp(.25 + f.relationship / 150 - count * .25 + (f.level === 'rich' ? .15 : 0), .1, .9);
    amount = success ? Math.round(level.gift / (count + 1)) : 0;
    f.relationship = clamp(f.relationship - (success ? 3 : 10), 0, 100);
  } else {
    if (kind === 'allowance') amount = level.allowance;
    if (kind === 'holiday') amount = level.gift;
    if (kind === 'reward') { if (cumulativeGpa() < 3.5) return; amount = level.gift; }
    if (kind === 'emergency') { if (state.money >= 30) return; amount = level.gift; }
    if (kind === 'repair') f.relationship = clamp(f.relationship + 12, 0, 100);
    f.received[key] = true;
  }
  state.money += amount;
  if (!success) applyAbilities({ stress: 8 });
  f.history.push({ key, kind, draw, success, amount, year: state.life.year });
  log(`가족 ${FAMILY_ACTION_LABELS[kind]}: ${success ? `${amount}만원 지원/관계 회복` : '형편과 요청에 대한 갈등으로 이번 지원은 어려웠다'}.`);
}
function renderLifestyle() {
  const scene = setScene('생활·경제·인벤토리', '오래 지속할 수 있는 일상', '운동·수면은 주요 학업 행동과 별도이며 현재 기간당 합계 2회입니다. 아이템 효과는 슬롯별 1개, 합계 최대 25%입니다.');
  const w = state.wellness, period = lifestylePeriod(), used = state.lifestyle.used[period] || 0;
  scene.append(element('p', `에너지 ${state.energy}/${w.maxEnergy} · 피로 ${w.fatigue.toFixed(1)} · 운동 습관 ${w.habit.toFixed(1)} · 회복 효율 ${w.recovery.toFixed(2)} · 생활 행동 ${used}/2`));
  for (const a of EXERCISES) addButton(scene, a.title, `별도 생활 행동 1회 · 에너지 ${a.energy} · 운동 습관 성장`, choose('lifestyle', () => {
    if (used >= 2 || !exercise(a, `exercise:${period}:${used}`)) return;
    state.lifestyle.used[period] = used + 1; state.lifestyle.history.push({ period, action: a.id });
  }), used >= 2 || unavailable({ energy: a.energy }));
  addButton(scene, '충분한 수면', '별도 생활 행동 1회 · 회복 30 · 피로 감소', choose('lifestyle', () => {
    if (used >= 2) return; state.lifestyle.used[period] = used + 1; applyEffects({ energy: 30 }); applyAbilities({ stress: -10 });
  }), used >= 2);
  const f = state.household;
  scene.append(element('h3', `${FAMILY_LEVELS[f.level].title} · 가족 관계 ${f.relationship}`));
  for (const [kind,title] of [['allowance','정기 용돈 받기'],['request','부모님께 용돈 요청'],['holiday','명절 용돈'],['reward','성적 우수 보상'],['emergency','갑작스러운 생활비 지원'],['repair','가족 관계 회복']]) {
    const key = ['holiday','reward','emergency'].includes(kind) ? `${kind}:${state.life.year}` : `${kind}:${period}`;
    const disabled = f.received[key] || (kind === 'request' && (f.requests[period] || 0) >= 2) ||
      (kind === 'reward' && cumulativeGpa() < 3.5) || (kind === 'emergency' && state.money >= 30);
    addButton(scene, title, '정기/요청/관계는 기간별 제한 · 특별 지원은 연도별 1회 · 요청은 기간당 최대 2회', choose('lifestyle', () => familyAction(kind)), disabled);
  }
  scene.append(element('h3', '상점·장착 (만원)'));
  for (const i of ITEMS) {
    const owned = state.inventory.owned.includes(i.id), equipped = state.inventory.equipped[i.slot] === i.id;
    const condition = i.college && state.life.admissionYear === null;
    addButton(scene, `${i.title} ${owned ? equipped ? '해제' : '장착' : '구매'}`,
      `${i.price}만원 · 슬롯 ${ITEM_SLOT_LABELS[i.slot]} · ${DEVELOPMENT_CONFIG.skillLabels[i.channel] || (i.channel === 'exercise' ? '운동' : '회복')} 효율 +${Math.round(i.bonus * 100)}%${condition ? ' · 대학 입학 필요' : ''}`,
      choose('lifestyle', () => {
        if (!owned) {
          if (condition || state.money < i.price) return;
          state.money -= i.price; state.inventory.owned.push(i.id);
          state.inventory.purchases.push({ id: i.id, price: i.price, year: state.life.year });
        } else if (equipped) delete state.inventory.equipped[i.slot];
        else state.inventory.equipped[i.slot] = i.id;
      }), !owned && (condition || state.money < i.price));
  }
  addButton(scene, '생활 관리 마치기', '', choose('lifestyle', () => { state.phase = state.lifestyle.returnPhase; }), false, true);
}
