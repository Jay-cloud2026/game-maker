// 학기제 대학원: 등록 원장, 행동 결과, 심사 결과는 생성 시 저장합니다.
const DEGREE_PHASES = ['graduateTerm', 'graduateReport', 'graduateDone'];
const DEGREE_LABELS = { data: '연구 자료', thesis: '학위 논문', knowledge: '전공 지식', feedback: '교수 피드백', conference: '학회 발표' };
const DEGREE_ACTIONS = [
  { id: 'advanced', title: '전공 심화 공부', energy: -12, knowledge: 2, growth: 'study' },
  { id: 'topic', title: '연구 주제 선정', energy: -10, topic: 1, growth: 'research' },
  { id: 'experiment', title: '연구실 실험', energy: -18, data: 3, research: 2, risk: true, growth: 'research' },
  { id: 'analysis', title: '논문 자료 분석', energy: -14, data: 2, research: 1, growth: 'research' },
  { id: 'project', title: '연구 프로젝트', energy: -18, data: 2, research: 2, growth: 'research' },
  { id: 'conference', title: '학회 발표 준비', energy: -12, conference: 1, growth: 'presentation', requires: 'data' },
  { id: 'RA', title: '연구 조교(RA)', energy: -18, money: 60, research: 1, data: 1, growth: 'RA' },
  { id: 'TA', title: '수업 조교(TA)', energy: -12, money: 50, knowledge: 1, teaching: 1, growth: 'TA' },
  { id: 'meeting', title: '지도교수 면담', energy: -6, feedback: 1, growth: 'presentation' },
  { id: 'thesis', title: '학위 논문 작성', energy: -14, thesis: 2, growth: 'research', requires: 'data' },
  { id: 'paper', title: '학술 논문 투고', energy: -18, paper: 1, risk: true, growth: 'research', requires: 'data' },
  { id: 'grant', title: '연구비 신청', energy: -10, money: 50, risk: true, growth: 'presentation' },
  { id: 'collaboration', title: '공동 연구', energy: -14, research: 1, data: 2, growth: 'research' },
  { id: 'mentoring', title: '연구실 후배 지도', energy: -10, teaching: 1, feedback: 1, growth: 'TA' },
  { id: 'qualify', title: '박사 자격시험', energy: -15, qualify: 1, risk: true, growth: 'study', phd: true, requires: 'knowledge' },
  { id: 'defense', title: '최종 디펜스', energy: -15, defense: 1, risk: true, growth: 'presentation', phd: true, requires: 'thesis' },
  { id: 'rest', title: '대학원 휴식', energy: 40, growth: 'rest' },
];
function initialDegreeFields() { return { postgraduate: { active: null, records: [] } }; }
function degreePolicy(program) {
  const phd = program.degree === 'phd';
  return { semesters: phd ? (program.id === 'kr-tech-phd' ? 10 : program.id === 'kr-applied-phd' ? 6 : 8) : 4,
    data: phd ? 12 : 6, thesis: phd ? 8 : 4, papers: phd ? (program.id === 'kr-tech-phd' ? 3 : 2) : 0,
    knowledge: phd ? 4 : 2, feedback: 1, conference: 1 };
}
function newDegree(program, semester = 1) {
  return { program: program.id, degree: program.degree, semester, terms: [], actions: [], research: 0,
    topic: 0, data: 0, thesis: 0, paper: 0, knowledge: 0, feedback: 0, conference: 0, teaching: 0,
    qualify: false, defense: false, completed: false, policy: degreePolicy(program), admissionAge: characterAge() };
}
function upgradeDegrees(value) {
  value = { ...value, ...initialDegreeFields(), version: CONFIG.saveVersion };
  if (value.master && !value.master.completed) {
    const m = value.master, p = programById(m.program);
    const d = { ...newDegreeForMigration(p, value), semester: Math.min(4, m.turn * 2 + 1),
      research: m.research, data: m.turn ? 3 : 0, knowledge: m.turn ? 2 : 0,
      topic: m.turn ? 1 : 0, feedback: m.turn ? 1 : 0, legacyMaster: JSON.parse(JSON.stringify(m)) };
    value.postgraduate.active = d;
    if (value.phase === 'master') value.phase = 'graduateTerm';
    if (value.study.returnPhase === 'master') value.study.returnPhase = 'graduateTerm';
    if (value.study.result?.next === 'master') value.study.result.next = 'graduateTerm';
  }
  return value;
}
function newDegreeForMigration(program, value) {
  // 전역 state에 의존하지 않는 이전 기본값.
  return { program: program.id, degree: program.degree, semester: 1, terms: [], actions: [], research: 0,
    topic: 0, data: 0, thesis: 0, paper: 0, knowledge: 0, feedback: 0, conference: 0, teaching: 0,
    qualify: false, defense: false, completed: false, policy: degreePolicy(program),
    admissionAge: value.life.year - value.character.birthYear };
}
function validDegreeFields(value) {
  const p = value.postgraduate;
  if (!p || !Array.isArray(p.records)) return false;
  const d = p.active;
  return (!d || (programById(d.program) && d.degree === programById(d.program).degree &&
    Number.isInteger(d.semester) && d.semester > 0 && Array.isArray(d.terms) && Array.isArray(d.actions) &&
    d.terms.every(t => Number.isInteger(t.semester) && Array.isArray(t.actions) && t.actions.length <= 3) &&
    ['research','topic','data','thesis','paper','knowledge','feedback','conference','teaching'].every(k => Number.isFinite(d[k]) && d[k] >= 0) &&
    d.policy && d.policy.semesters > 0)) && (!DEGREE_PHASES.includes(value.phase) || d) &&
    (value.phase !== 'graduateReport' || (d?.terms.find(t => t.semester === d.semester)?.result &&
      Array.isArray(d.terms.find(t => t.semester === d.semester).result.missing) &&
      typeof d.terms.find(t => t.semester === d.semester).result.passed === 'boolean')) &&
    (value.phase !== 'graduateDone' || d?.completed);
}
function startDegree(program) {
  const d = newDegree(program);
  state.postgraduate.active = d;
  if (d.degree === 'masters') state.master = { program: program.id, turn: 0, actions: [], research: 0, completed: false };
  state.life.highestDegree = d.degree === 'phd' ? '박사 재학' : '학사';
  state.phase = 'graduateTerm';
}
function degreeTerm() {
  const d = state.postgraduate.active;
  let t = d.terms.find(t => t.semester === d.semester);
  if (!t) { t = { semester: d.semester, paid: false, actions: [], result: null, support: false }; d.terms.push(t); }
  return t;
}
function degreeMissing(d = state.postgraduate.active) {
  const missing = [];
  if (d.semester < d.policy.semesters) missing.push(`기본 ${d.policy.semesters}학기`);
  for (const key of ['data','thesis','knowledge','feedback','conference']) if (d[key] < d.policy[key]) missing.push(`${DEGREE_LABELS[key]} ${d[key]}/${d.policy[key]}`);
  if (!d.topic) missing.push('연구 주제');
  if (d.degree === 'phd') {
    if (d.paper < d.policy.papers) missing.push(`논문 ${d.paper}/${d.policy.papers}`);
    if (!d.qualify) missing.push('자격시험');
    if (!d.defense) missing.push('디펜스');
  }
  return missing;
}
function degreeActionReason(action) {
  const d = state.postgraduate.active, t = degreeTerm();
  if (t.actions.length >= 3) return '이번 학기 행동 완료';
  if (!t.paid) return '등록 정산 필요';
  if (action.phd && d.degree !== 'phd') return '박사 과정 전용';
  if (action.requires && d[action.requires] < (action.id === 'defense' ? d.policy.thesis : 2)) return `${DEGREE_LABELS[action.requires]} 준비 부족`;
  if (action.id === 'defense' && (!d.qualify || d.paper < d.policy.papers)) return '자격시험·논문 필요';
  if (['qualify','defense'].includes(action.id) && (d[action.id] || t.actions.some(a => a.id === action.id))) return '이미 응시/완료';
  return unavailable({ money: Math.min(0, action.money || 0), energy: action.energy || 0 });
}
function completeDegreeAction(action) {
  const d = state.postgraduate.active, t = degreeTerm();
  if (degreeActionReason(action)) return false;
  const draw = action.risk ? Math.random() : null;
  const probability = researchChance(action.id === 'defense' ? .8 : .76);
  const success = draw === null || draw < probability;
  applyEffects({ energy: action.energy || 0, money: success ? action.money || 0 : 0 });
  for (const key of ['topic','knowledge','feedback','conference','teaching','data','thesis','paper']) {
    d[key] += success ? action[key] || 0 : key === 'data' ? 1 : 0;
  }
  if (action.qualify && success) d.qualify = true;
  if (action.defense && success) d.defense = true;
  const research = success ? action.research || 0 : 0;
  state.research += research; d.research += research;
  if (research && state.study.labId) recordLabContribution(research, `${action.title} 대학원 연구 기여`);
  if (action.id === 'meeting') state.recommendations++;
  if (action.id === 'paper' && success) state.study.papers.push({ kind: 'degree-paper', program: d.program, semester: d.semester, year: state.life.year });
  if (action.id === 'conference') state.study.conferences.push({ kind: 'degree-conference', program: d.program, year: state.life.year });
  if (action.id === 'rest') applyAbilities({ stress: -20, happiness: 5 });
  else applyAbilities({ stress: success ? 3 : 7 });
  if (success) consumeNPCResearchSupport(action.id, `degree:${d.program}:${d.semester}:${t.actions.length + 1}`);
  const record = { id: action.id, title: action.title, success, draw, probability, research };
  t.actions.push(record); d.actions.push(record);
  recordGrowth(action.growth || action.id, `degree:${d.program}:${d.semester}:${t.actions.length}`);
  if (d.degree === 'masters') {
    state.master.actions.push(action.title); state.master.research += research;
  }
  log(`${degreeName(d.degree)} ${d.semester}학기 ${action.title}: ${success ? '성과/피드백을 기록했다' : '실패·자료 부족으로 수정이 필요하다'}.`);
  state.phase = 'graduateTerm';
  if (t.actions.length === 3) {
    const missing = degreeMissing(d), draw = missing.length ? null : Math.random();
    t.result = { missing, draw, passed: !missing.length && draw < researchChance(.9), year: state.life.year };
    advanceTime(1, `degree:${d.program}:${d.semester}`);
    if (d.degree === 'masters') state.master.turn = d.semester;
    state.phase = 'graduateReport';
  }
  return true;
}
function renderDegree() {
  const d = state.postgraduate.active, p = programById(d.program);
  if (state.phase === 'graduateDone') {
    const scene = setScene(`${degreeName(d.degree)} 학위 취득`, '긴 연구의 시간을 마쳤다', `${p.school} · ${d.semester}학기 · 논문 ${d.paper} · 연구 ${d.research}`);
    const reward = element('div', undefined, 'result-card achievement');
    reward.append(element('h3', `${degreeName(d.degree)} 학위가 다음 기회로 이어집니다`),
      element('p', d.degree === 'masters' ? '관련 연구개발 직무에서 초봉·직무 평가 우대를 받을 수 있습니다. 늘봄융합연구원의 석사 지원 자격이 열렸습니다.' :
        '관련 전문 연구직에서 학위 우대와 연구 실적에 따른 전문 직책을 받을 수 있습니다. 교수 진로는 기존 연구·교육·추천서 요건을 충족하면 열립니다.'),
      element('p', '전공·직무가 맞아야 우대합니다. 지원 화면에서 예상 연봉과 실제 적용 근거를 확인하세요.'));
    scene.append(reward);
    addButton(scene, d.degree === 'masters' ? '취업·박사 지원 살펴보기' : '취업·다음 진로 살펴보기', '', choose('graduateDone', () => { state.phase = 'hub'; }));
    addButton(scene, '학위 취득 엔딩', '현재 성취와 전체 타임라인 보관', choose('graduateDone', () => {
      state.ending = `${p.country} ${p.school} ${degreeName(d.degree)} 학위 취득`; state.reflection.snapshot = null; state.phase = 'ending'; log(state.ending);
    }));
    return;
  }
  const t = degreeTerm();
  if (state.phase === 'graduateReport') {
    const r = t.result;
    const scene = setScene('대학원 학기 성과·심사', `${d.semester}학기 결과`,
      r.passed ? '학위 심사를 통과했습니다.' : `졸업 보완: ${r.missing.join(', ') || '심사위원의 논문 수정 요구'}. 다음 학기 보완할 수 있습니다.`);
    list(scene, t.actions.map(a => `${a.title}: ${a.success ? '진행' : '실패·수정'}`));
    addButton(scene, r.passed ? '학위 취득 확정' : '다음 대학원 학기', '시간과 정산은 한 번만 반영', choose('graduateReport', () => {
      if (r.passed) {
        d.completed = true; state.life.highestDegree = degreeName(d.degree);
        if (d.degree === 'masters') state.master.completed = true;
        else { state.reflection.phdCompleted = true; state.reflection.teaching += d.teaching; }
        state.postgraduate.records.push(JSON.parse(JSON.stringify(d)));
        state.phase = 'graduateDone'; log(`${p.school} ${degreeName(d.degree)} 학위를 취득했다.`);
      } else { d.semester++; state.phase = 'graduateTerm'; applyEffects({ energy: 35 }); }
    }), false, true);
    return;
  }
  const scene = setScene(`${degreeName(d.degree)} ${d.semester}학기 · 기본 ${d.policy.semesters}학기`, `${p.school} / ${p.lab}`,
    `남은 주요 행동 ${3 - t.actions.length}회 · ${degreeMissing(d).length ? `다음 목표: ${degreeMissing(d)[0]}` : '학위 심사 준비 완료'}`);
  const firstDetail = scene.children.length;
  addButton(scene, '대학원 연구실·학회 활동', '기존 연구실·어학·추천서 시스템과 연결 · 등록 정산 후 활동 가능',
    choose('graduateTerm', () => openStudy('graduateTerm')));
  if (!t.paid) {
    const cost = Math.round((p.tuition + p.admissions.living) * difficultyConfig().living) - p.stipend;
    addButton(scene, '대학원 학기 등록 정산', `등록금·생활비 − 지원금 = ${cost}만원`, choose('graduateTerm', () => {
      if (state.money < cost) return;
      t.settlement = { tuition: p.tuition, living: p.admissions.living, stipend: p.stipend, net: cost, year: state.life.year };
      applyEffects({ money: -cost }); t.paid = true;
      log(`${degreeName(d.degree)} ${d.semester}학기 등록·생활비 ${cost}만원을 한 번 정산했다.`);
    }), state.money < cost, true);
    addButton(scene, '대학원 부족액 대출', '부족액만 학자금 원장에 반영', choose('graduateTerm', () => {
      const amount = Math.max(0, cost - state.money); state.money += amount; state.campus.debt += amount; state.campus.borrowed += amount;
      log(`대학원 등록을 위해 ${amount}만원을 대출했다.`);
    }), state.money >= cost);
  }
  for (const a of DEGREE_ACTIONS.filter(a => !a.phd || d.degree === 'phd')) {
    const reason = degreeActionReason(a);
    addButton(scene, a.title, `주요 행동 1회 · 에너지 ${a.energy}${reason ? ` · ${reason}` : ''}`, choose('graduateTerm', () => completeDegreeAction(a)), reason);
  }
  addButton(scene, '잠시 쉬고 생활비 상담', '학기당 1회 · 행동 소모 없음 · 체력 30, 자금 30 지원', choose('graduateTerm', () => {
    if (t.support) return; t.support = true; applyEffects({ energy: 30, money: 30 });
  }), t.support);
  compactDegree(scene, firstDetail, d, t);
}
