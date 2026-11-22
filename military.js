const MILITARY_PHASES = ['militaryBoard', 'service', 'militaryComplete'];
function initialMilitaryFields() {
  return { military: { subject: false, grade: null, assessments: [], returnPhase: 'semester',
    service: null, history: [], applications: [], institution: null, candidate: false, overseas: {},
    preparation: 0, certificateProgress: 0, certificates: [] } };
}
function upgradeMilitary(value) {
  const addition = initialMilitaryFields();
  addition.military.subject = Boolean(value.development?.setup.militarySubject);
  return { ...value, ...addition, version: CONFIG.saveVersion };
}
function validMilitary(value) {
  const m = value.military, s = m?.service;
  return m && typeof m.subject === 'boolean' && (m.grade === null || (Number.isInteger(m.grade) && m.grade >= 1 && m.grade <= 7)) &&
    Array.isArray(m.assessments) && Array.isArray(m.history) && Array.isArray(m.applications) &&
    Array.isArray(m.certificates) && Number.isFinite(m.certificateProgress) && m.overseas &&
    (!s || (MILITARY_CONFIG.service[s.type] && Number.isFinite(s.months) && s.months >= 0 &&
      Number.isFinite(s.duration) && s.duration > 0 && Array.isArray(s.activities) && s.before?.skills &&
      (!s.completed || (s.after && Number.isFinite(s.age))))) &&
    (!['service', 'militaryComplete'].includes(value.phase) || s);
}
function advanceMonths(months, key) {
  if (state.life.timeKeys.includes(key)) return;
  state.life.timeKeys.push(key);
  const total = state.life.half * 6 + (state.life.monthRemainder || 0) + months;
  state.life.year += Math.floor(total / 12); state.life.half = Math.floor((total % 12) / 6);
  state.life.monthRemainder = total % 6;
}
function militaryDeferment() {
  const m = state.military;
  if (!m?.subject || m.service?.completed || [5,6].includes(m.grade)) return { allowed: false, limit: null, reason: '복무 의무 없음/완료' };
  const d = state.postgraduate.active;
  let limit = null, abroad = false, key = '';
  if (d && !d.completed) {
    limit = d.degree === 'phd' ? MILITARY_CONFIG.defer.phd : d.policy.semesters > 4 ? MILITARY_CONFIG.defer.longMasters : MILITARY_CONFIG.defer.masters;
    abroad = programById(d.program).country !== '대한민국'; key = d.program;
  } else if (state.life.admissionYear !== null && state.life.graduationYear === null) {
    limit = MILITARY_CONFIG.defer.undergraduate;
    abroad = Boolean(state.study.exchangeActive || currentExchangePlan()); key = `exchange:${state.semester}`;
  }
  const withinAge = limit !== null && characterAge() <= limit;
  return { limit, abroad, key, withinAge, allowed: withinAge && (!abroad || m.overseas[key]),
    reason: limit === null ? '재학생 학적 없음 (재수·취업은 자동 연기 사유 아님)' :
      !withinAge ? `제한연령 ${limit}세 초과 · 자동 연기 종료` :
        abroad && !m.overseas[key] ? '국외 재학 연기 서류 제출 필요' : `${limit}세가 되는 해 말까지 재학생 연기 (휴학 포함)` };
}
function openMilitary() {
  if (MILITARY_PHASES.includes(state.phase)) return;
  state.military.returnPhase = state.phase; state.phase = 'militaryBoard';
}
function enforceMilitary() {
  const m = state.military;
  // Old records are not rewritten. Female characters never receive new call-ups.
  if (state.character?.gender === '여성') return;
  if (!m?.subject || [5,6].includes(m.grade) || m.service?.completed || (m.service && !m.service.completed)) return;
  if (state.development?.setup.militaryRule === 'gender-v1' && characterAge() >= 19 &&
      state.semester >= (m.nextPromptSemester || 3) && ['semester','termBudget'].includes(state.phase)) {
    openMilitary(); return;
  }
  if (characterAge() >= MILITARY_CONFIG.callupAge && !militaryDeferment().allowed &&
      ['semester','termBudget','retake','graduateTerm','hub','jobBoard','workTurn'].includes(state.phase)) openMilitary();
}
function automaticService() {
  const m = state.military;
  if (!m.subject || state.character.gender === '여성') return;
  if (m.grade === null || m.grade === 7) assessMilitary();
  // Re-examinations retain their actual elapsed time, without repeated forms.
  for (let i = 0; m.grade === 7 && i < 3; i++) assessMilitary();
  if ([5,6].includes(m.grade)) { log('병역 일정을 확인했다. 내부 판정에 따라 복무 없이 원래 생활을 이어간다.'); state.phase = m.returnPhase; return; }
  if (m.candidate && !researchEligibility(m.candidate.route).length &&
      (m.candidate.route !== 'phd' || (state.postgraduate.active.semester > MILITARY_CONFIG.phdCourseworkSemesters &&
       state.postgraduate.active.knowledge >= 4 && state.postgraduate.active.qualify))) beginService('research');
  else beginService(m.grade === 4 ? 'social' : 'army');
}
function assessMilitary() {
  const m = state.military;
  if (m.grade !== null && m.grade !== 7) return;
  if (characterAge() < MILITARY_CONFIG.assessmentAge) return;
  if (m.grade === 7) advanceMonths(6, `medical-recheck:${m.assessments.length}`);
  const draw = Math.random(); let cumulative = 0, grade = 7;
  MILITARY_CONFIG.gradeWeights.some((weight,index) => { cumulative += weight; if (draw < cumulative) { grade = index + 1; return true; } return false; });
  // 재검 반복으로 무한히 시간이 진행되지 않도록 두 번째 재검에는 확정 처분.
  if (grade === 7 && m.assessments.length >= 2) grade = 3;
  m.grade = grade; m.assessments.push({ grade, draw, year: state.life.year });
  log(`게임용 의학 판정 ${grade}급. 게임 체력·운동·돈과 무관한 독립 판정이다.`);
}
function researchEligibility(route) {
  const m = state.military, d = state.postgraduate.active, institution = RESEARCH_INSTITUTIONS.find(i => i.id === m.institution);
  const reasons = [];
  if (![1,2,3,4].includes(m.grade)) reasons.push('현역/보충역 판정 필요');
  if (!/생명|화학|컴퓨터|데이터|기계|환경/.test(`${state.life.major || ''} ${state.character.interest}`)) reasons.push('자연·이공계 전공 필요');
  if (state.research < MILITARY_CONFIG.researchMinimum) reasons.push(`연구 경험 ${MILITARY_CONFIG.researchMinimum} 필요`);
  if (characterAge() + 3 > MILITARY_CONFIG.researchFinishAge) reasons.push('35세까지 복무 완료 불가');
  if (!institution?.designated || institution.university !== (route === 'phd')) reasons.push('경로에 맞는 병역지정 연구기관 선택 필요');
  if (route === 'employment' && !state.master?.completed) reasons.push('석사 학위 필요');
  if (route === 'phd' && (!d || d.degree !== 'phd' || d.completed || programById(d.program).country !== '대한민국')) reasons.push('국내 지정 자연계 박사과정 재학 필요');
  return reasons;
}
function applyResearchService(route) {
  const m = state.military;
  if (researchEligibility(route).length) return;
  const key = `${route}:${lifestylePeriod()}:${m.preparation}`;
  if (m.applications.some(a => a.key === key)) return;
  const hireDraw = Math.random(), selectionDraw = Math.random();
  const hire = hireDraw < MILITARY_CONFIG.hireProbability;
  const selected = hire && selectionDraw < clamp(MILITARY_CONFIG.selectionProbability + (state.development.skills.research - 50) / 300, .15, .85);
  m.applications.push({ key, route, institution: m.institution, hireDraw, selectionDraw, hire, selected, year: state.life.year });
  if (selected) {
    m.candidate = { route, institution: m.institution };
    log('연구기관 채용/수학 확인과 별도 편입대상자 선발을 통과했다. 수료·편입 요건을 확인한다.');
  } else log('전문연구 선발 불합격. 연구 준비 후 재지원하거나 판정에 맞는 일반 복무를 선택할 수 있다.');
}
function beginService(type) {
  const m = state.military;
  if (m.service || !m.subject) return;
  if (type === 'army' && ![1,2,3].includes(m.grade)) return;
  if (type === 'social' && m.grade !== 4) return;
  const phd = type === 'research' && m.candidate?.route === 'phd';
  if (type === 'research' && (!m.candidate || researchEligibility(m.candidate.route).length)) return;
  const d = state.postgraduate.active;
  if (phd && (d.semester <= MILITARY_CONFIG.phdCourseworkSemesters || d.knowledge < 4 || !d.qualify)) return;
  if (state.career.employer) endEmployment('복무를 위한 휴직/퇴사');
  m.service = { type, months: 0, duration: MILITARY_CONFIG.service[type].months, elapsed: 0,
    activities: [], completed: false, income: 0, research: 0, phd, grace: 0, transferred: false,
    before: { skills: { ...state.development.skills }, money: state.money, year: state.life.year, age: characterAge() } };
  state.phase = 'service'; log(`${MILITARY_CONFIG.service[type].title} 복무 시작. 학부 학기는 일시 중지한다.`);
}
function serviceActivity(action) {
  const m = state.military, s = m.service, config = MILITARY_CONFIG.service[s.type];
  if (!s || s.completed) return;
  if (action.research !== undefined && s.type !== 'research') return;
  if (action.id === 'exam' && m.certificateProgress < 60) return;
  if (s.phd && s.months >= MILITARY_CONFIG.phdDegreeMonths && state.reflection.phdCompleted && !s.transferred) return;
  const draw = Math.random(), eventDraw = Math.random();
  const success = draw < (action.id === 'exam' ? clamp(.4 + m.certificateProgress / 300 + state.development.skills.academic / 300, .2, .9) : researchChance(.85));
  const excluded = s.phd && s.months >= MILITARY_CONFIG.phdDegreeMonths && !state.reflection.phdCompleted;
  if (excluded && s.grace >= MILITARY_CONFIG.phdGraceMonths) return;
  const quarter = Math.min(MILITARY_CONFIG.quarter, s.duration - s.months);
  s.elapsed += quarter; if (!excluded) s.months += quarter; else s.grace += quarter;
  advanceMonths(quarter, `service:${s.before.year}:${s.type}:${s.elapsed}`);
  const risk = eventDraw < .15 * difficultyConfig().eventRisk;
  applyEffects({ money: config.income + (action.id === 'saving' ? 40 : 0), energy: action.id === 'rest' ? 35 : -8 });
  s.income += config.income + (action.id === 'saving' ? 40 : 0);
  applyAbilities({ stress: action.id === 'rest' ? -20 : risk ? 15 : config.stress, happiness: risk ? -3 : 1 });
  if (action.id === 'certificate') m.certificateProgress = Math.min(100, m.certificateProgress + 24);
  if (action.id === 'exam' && success && !m.certificates.includes('기초 데이터 활용 자격')) {
    m.certificates.push('기초 데이터 활용 자격'); state.practice += 1;
  }
  if (action.id === 'exercise') exercise(EXERCISES[0], `military-exercise:${s.elapsed}`);
  if (s.type === 'army') {
    recordGrowth('rest', `service-habit:${s.elapsed}`);
    state.wellness.habit = Math.min(100, state.wellness.habit + .5);
    state.wellness.maxEnergy = round(100 + state.wellness.habit * .25);
  }
  if (s.type === 'social') { state.practice += .25; recordGrowth('cafe', `service-social:${s.elapsed}`); }
  const research = success ? action.research || 0 : 0; state.research += research; s.research += research;
  if (action.id === 'paper' && success) state.study.papers.push({ kind: 'military', year: state.life.year });
  if (action.id === 'conference' && success) state.study.conferences.push({ kind: 'military', year: state.life.year });
  const skillsBefore = { ...state.development.skills };
  const growthRecord = recordGrowth(action.growth, `service-activity:${s.elapsed}`);
  // 복무 유형별 학습 시간 차이. 결과 난수/성장 키는 그대로 보존.
  for (const key of Object.keys(skillsBefore)) {
    state.development.skills[key] = round(skillsBefore[key] +
      (state.development.skills[key] - skillsBefore[key]) * config.learning);
    if (growthRecord && growthRecord.gains[key] !== undefined) {
      growthRecord.gains[key] = round(state.development.skills[key] - skillsBefore[key]);
    }
  }
  for (const key of ['academic','language','social','diligence']) syncLearnedAbility(key);
  if (s.phd && !state.reflection.phdCompleted) {
    const d = state.postgraduate.active;
    if (s.elapsed % 6 === 0) d.semester++; // 수료 후 연구 기간만 경과. 수업 학점은 부여하지 않음.
    d.data += research; d.research += research;
    if (action.id === 'paper' && success) { d.paper++; d.thesis += 2; }
    if (action.id === 'conference' && success) { d.conference++; d.feedback++; }
    if (action.id === 'defense' && success && d.thesis >= d.policy.thesis && d.paper >= d.policy.papers) d.defense = true;
    if (degreeMissing(d).length === 0) {
      d.completed = true; state.reflection.phdCompleted = true; state.life.highestDegree = '박사';
      state.postgraduate.records.push(JSON.parse(JSON.stringify(d))); log('복무 중 수료 후 논문 연구와 디펜스를 마쳐 박사 학위를 취득했다.');
    }
  }
  s.activities.push({ id: action.id, success, draw, eventDraw, risk, excluded, months: quarter, year: state.life.year });
  log(`복무 ${s.months}/${s.duration}개월 · ${action.title}: ${success ? '성과' : '실패/보완'}${excluded ? ' · 학위 취득 유예기간은 복무 미산입' : ''}${risk ? ' · 적응 스트레스 사건' : ''}.`);
  if (s.months >= s.duration) {
    s.completed = true; s.age = characterAge(); s.after = { ...state.development.skills };
    m.history.push(JSON.parse(JSON.stringify(s))); state.phase = 'militaryComplete';
  }
}
function renderMilitary() {
  const m = state.military, s = m.service;
  if (state.phase === 'militaryComplete') {
    const scene = setScene('복무 완료', `${MILITARY_CONFIG.service[s.type].title} ${s.months}개월`,
      `전역/소집해제 ${s.age}세 · 모은 자금 ${s.income}만원 · 연구 ${s.research} · 자격 ${m.certificates.join(', ') || '없음'}`);
    const detail = element('details'); detail.append(element('summary', '복무 중 성장 기록'));
    list(detail, Object.keys(s.before.skills).map(k => `${DEVELOPMENT_CONFIG.skillLabels[k]} +${round(s.after[k] - s.before.skills[k])}`));
    scene.append(detail);
    addButton(scene, '전역 후 원래 진행으로', '학부 성적·학기·기존 정산은 유지합니다.', choose('militaryComplete', () => {
      state.phase = state.postgraduate.active?.completed && s.phd ? 'graduateDone' :
        m.returnPhase === 'workTurn' && !state.career.employer ? 'hub' : m.returnPhase;
      applyEffects({ energy: 40 });
    }), false, true);
    return;
  }
  if (state.phase === 'service') {
    const scene = setScene('3개월마다 자기계발', `${MILITARY_CONFIG.service[s.type].title} ${s.months}/${s.duration}개월`,
      `경과 ${s.elapsed}개월 · 자격 준비 ${m.certificateProgress}/100 · 피로/스트레스는 생활 관리에서 회복할 수 있습니다.${s.phd ? ' 수료 후 박사 연구 병행. 24개월 내 학위, 이후 연구현장 12개월. 학위 유예기간은 복무 미산입.' : ''}`);
    if (s.phd && s.months >= MILITARY_CONFIG.phdDegreeMonths && state.reflection.phdCompleted && !s.transferred) {
      addButton(scene, '학위 취득 후 연구기관 전직', `새빛융합 지정연구기관 채용동의에 따른 잔여 ${MILITARY_CONFIG.phdFieldMonths}개월 연구현장 복무`, choose('service', () => { s.transferred = true; s.institution = 'saebit'; log('학위 취득 후 지정연구기관으로 전직했다.'); }));
      return;
    }
    const firstDetail = scene.children.length;
    for (const action of MILITARY_ACTIVITIES.filter(a => a.research === undefined || s.type === 'research')) {
      const disabled = (action.id === 'exam' && m.certificateProgress < 60) ||
        (action.id === 'defense' && (!s.phd || state.postgraduate.active.thesis < state.postgraduate.active.policy.thesis));
      addButton(scene, action.title, '3개월 · 선택한 역량만 성장 · 시험/연구는 실패할 수 있음', choose('service', () => serviceActivity(action)), disabled);
    }
    if (s.phd && s.grace >= MILITARY_CONFIG.phdGraceMonths) addButton(scene, '편입 취소 후 일반 복무 전환', '학위 유예 한도 종료. 남은 복무는 비례 환산한 게임용 기간으로 처리', choose('service', () => {
      const type = m.grade === 4 ? 'social' : 'army', unit = MILITARY_CONFIG.quarter;
      const duration = Math.max(unit, Math.ceil(MILITARY_CONFIG.service[type].months * (1 - s.months / MILITARY_CONFIG.service.research.months) / unit) * unit);
      m.history.push({ ...s, cancelled: true }); m.service = null; m.candidate = false; beginService(type); m.service.duration = duration;
    }));
    const nodes = Array.from(scene.children).slice(firstDetail);
    addButton(scene, s.phd ? '6개월 연구·복무 이어가기' : '남은 복무를 마치고 돌아오기',
      s.phd ? '학위 심사·전직 등 중요한 선택에서는 멈춥니다.' : '반복 관리는 자동으로 · 실제 복무 기간과 급여·성장 기록을 모두 반영합니다.',
      choose('service', () => {
        for (let i = 0; i < (s.phd ? 2 : 20) && state.phase === 'service'; i++) {
          if (s.phd && ((s.months >= MILITARY_CONFIG.phdDegreeMonths && state.reflection.phdCompleted && !s.transferred) ||
              s.grace >= MILITARY_CONFIG.phdGraceMonths)) break;
          const d = state.postgraduate.active;
          const id = state.energy < 30 || state.character.abilities.stress >= 80 ? 'rest' : !s.phd ?
            (s.type === 'research' ? 'project' : 'saving') :
            d.paper < d.policy.papers || d.thesis < d.policy.thesis ? 'paper' :
              d.conference < d.policy.conference || d.feedback < d.policy.feedback ? 'conference' : !d.defense ? 'defense' : 'project';
          serviceActivity(MILITARY_ACTIVITIES.find(a => a.id === id));
        }
      }), false, true);
    foldDetails(scene, '복무 중 세부 활동 선택', nodes);
    return;
  }
  const defer = militaryDeferment();
  const scene = setScene('병역·입영 일정', m.subject ? '언제 다녀올까요?' : '병역 의무 없음',
    `${characterAge()}세 · 학업은 잠시 멈추지만 나이와 시간은 실제로 흐릅니다. 복무 경로와 행정 절차는 내부에서 처리합니다.`);
  const firstDetail = scene.children.length;
  if (m.subject && (m.grade === null || m.grade === 7)) addButton(scene, m.grade === 7 ? '재신체검사' : '병역판정검사',
    '19세 이후 · 7급은 6개월 후 재검 · 구매/운동으로 변경 불가', choose('militaryBoard', assessMilitary), characterAge() < 19);
  if (m.subject && !s) {
    if ([1,2,3].includes(m.grade)) addButton(scene, '육군 입대', '18개월 · 3개월마다 자기계발', choose('militaryBoard', () => beginService('army')));
    if (m.grade === 4) addButton(scene, '사회복무 시작', '21개월 · 행정 경험·운동·어학·자격', choose('militaryBoard', () => beginService('social')));
    if (defer.withinAge && defer.abroad) addButton(scene, '국외 재학 연기 서류 제출', '연령 한도 안에서만 적용', choose('militaryBoard', () => { m.overseas[defer.key] = true; }));
    for (const i of RESEARCH_INSTITUTIONS) addButton(scene, i.title, `${i.field} · 가상 병역지정기관`, choose('militaryBoard', () => { m.institution = i.id; }));
    for (const [route,title] of [['employment','석사 후 지정연구기관 채용·편입 지원'],['phd','박사 편입대상자 선발 지원']]) {
      const reasons = researchEligibility(route), key = `${route}:${lifestylePeriod()}:${m.preparation}`;
      addButton(scene, title, reasons.join(' · ') || '학력/전공·기관 확인 후 별도 채용/선발 추첨', choose('militaryBoard', () => applyResearchService(route)),
        reasons.length || m.applications.some(a => a.key === key));
    }
    if (m.candidate) addButton(scene, '전문연구요원 편입 시작', '36개월 · 박사 경로는 수료(4학기·전공지식·자격시험) 후 편입', choose('militaryBoard', () => beginService('research')),
      m.candidate.route === 'phd' && (state.postgraduate.active.semester <= MILITARY_CONFIG.phdCourseworkSemesters || state.postgraduate.active.knowledge < 4 || !state.postgraduate.active.qualify));
    addButton(scene, '연구 선발 재준비', '3개월 경과 · 연구 +0.5 · 새로운 선발 회차', choose('militaryBoard', () => {
      m.preparation++; advanceMonths(3, `research-prepare:${m.preparation}`); state.research += .5; recordGrowth('research', `research-prepare:${m.preparation}`);
    }));
    const last = m.applications.at(-1);
    if (last) scene.append(element('p', `최근 선발: ${last.selected ? '통과' : '불합격'} · 채용/기관 확인 ${last.hire ? '통과' : '미통과'}`));
  }
  const canReturn = !m.subject || [5,6].includes(m.grade) || s?.completed || characterAge() < 20 || defer.allowed;
  addButton(scene, '병역 일정 확인 후 돌아가기', canReturn ? '연기/완료 상태로 계속 진행' : '자동 연기 불가. 판정에 맞는 복무 경로를 정하세요.',
    choose('militaryBoard', () => { m.nextPromptSemester = state.semester + 2; state.phase = m.returnPhase; }), !canReturn);
  const nodes = Array.from(scene.children).slice(firstDetail);
  if (m.subject && !s && state.character.gender !== '여성') addButton(scene, '지금 복무 시작',
    '상황에 맞는 복무 경로를 자동 결정합니다. 복무 완료 후 현재 진행으로 돌아옵니다.',
    choose('militaryBoard', automaticService), characterAge() < MILITARY_CONFIG.assessmentAge, true);
  if (canReturn || characterAge() < 20) addButton(scene, m.subject && !s?.completed ? '나중에 다녀오기' : '원래 진행으로',
    '다음 주요 시점에 다시 안내합니다. 연기 한도 이후에는 복무를 먼저 진행합니다.',
    choose('militaryBoard', () => { m.nextPromptSemester = state.semester + 2; state.phase = m.returnPhase; }));
  foldDetails(scene, '이전 병역 기록·전문연구 경로', nodes);
}
