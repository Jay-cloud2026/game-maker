// 상태 전이는 choose()에서 한 번만 처리하고 저장합니다. 성적은 term.report에 확정 저장합니다.
const $ = id => document.getElementById(id);
let state;
let saveAvailable = true;
let preserveUnreadableSave = false;
let renderRevision = 0;
const CORE_PHASES = ['semester', 'campus', 'tutorInterview', 'competitionRole', 'competitionCrisis',
  'competitionFinal', 'competitionResult', 'reportReady', 'report', 'vacation', 'vacationResult',
  'hub', 'job', 'jobNext', 'application', 'graduateDocuments', 'interview', 'mail', 'offers', 'master', 'masterDone', 'ending'];
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const round = value => Math.round(value * 100) / 100;
const semesterName = (number = state.semester) => number > 8 ? `초과 ${number - 8}학기` : `${Math.ceil(number / 2)}학년 ${number % 2 ? 1 : 2}학기`;
const currentTerm = () => state.terms[state.semester - 1];
const programById = id => PROGRAMS.find(program => program.id === id);
const degreeName = degree => degree === 'masters' ? '석사' : '박사';
function newTerm() {
  return { actions: [], meal: null, event: null, eventDone: false, report: null, vacationDone: false };
}
function freshState() {
  return {
    version: CONFIG.saveVersion, phase: 'character', semester: 1, ...CONFIG.initial,
    terms: Array.from({ length: CONFIG.semesters }, newTerm),
    experiences: {}, firstParticipation: {}, flags: {}, history: [],
    research: 0, recommendations: 0, practice: 0, savings: 0,
    competition: null, degree: 'masters', applications: [], round: 0,
    master: null, jobTurns: 0, ending: '', notice: '이름과 시작 시점을 정해 나만의 이야기를 시작해 보세요.',
    ...initialLifeFields(),
    ...initialCampusFields(),
    ...initialSocialFields(),
    ...initialStudyFields(),
    ...initialCareerFields(),
    ...initialReflectionFields(),
    ...initialDevelopmentFields(),
    ...initialGraduateAdmissionsFields(),
    ...initialDegreeFields(),
    ...initialLifestyleFields(),
    ...initialMilitaryFields(),
    ...initialLifeAssessmentFields(),
  };
}
function contextLabel() {
  if (state.postgraduate?.active && !state.postgraduate.active.completed) return `${degreeName(state.postgraduate.active.degree)} ${state.postgraduate.active.semester}학기`;
  if (state.reflection.phdCompleted) return '박사 이후 커리어';
  if (['leave', 'leaveReady'].includes(state.phase)) return '휴학·복학';
  if (LIFE_PHASES.includes(state.phase)) return ['retake', 'retakeReady'].includes(state.phase) ? '재수 준비' : '대학 입시';
  if (state.master?.completed) return '석사 졸업 이후';
  if (state.master) return `석사 ${Math.min(state.master.turn + 1, 2)}턴`;
  if (state.phase === 'job' || state.phase === 'jobNext') return '직장 생활';
  return semesterName();
}
function log(text) {
  state.notice = text;
  state.history.unshift({ label: contextLabel(), text, year: state.life.year, age: characterAge() });
}
function effectsText(effects = {}) {
  return Object.entries(effects).filter(([, value]) => value).map(([key, value]) =>
    `${key === 'money' ? '생활비' : '체력'} ${value > 0 ? '+' : ''}${value}${key === 'money' ? '만원' : ''}`
  ).join(' · ') || '자원 소모 없음';
}
function unavailable(effects = {}) {
  const reasons = [];
  if (state.money + (effects.money || 0) < 0) reasons.push('생활비 부족');
  if (state.energy + (effects.energy || 0) < 0) reasons.push('체력 부족');
  return reasons.join(' · ');
}
function applyEffects(effects = {}) {
  state.money = Math.max(0, state.money + (effects.money || 0));
  const energy = effects.energy || 0, w = state.wellness;
  const recovery = energy > 0 ? (w?.recovery || 1) * equipmentBonus('recovery') : 1;
  state.energy = round(clamp(state.energy + energy * recovery, 0, w?.maxEnergy || CONFIG.maxEnergy));
  if (w) w.fatigue = round(clamp(w.fatigue + (energy < 0 ? -energy * .18 : -energy * .4), 0, 100));
}
function experience(id) {
  state.experiences[id] = (state.experiences[id] || 0) + 1;
  if (!state.firstParticipation[id]) state.firstParticipation[id] = state.semester;
}
function save() {
  return saveActiveSlot();
}
function validBaseSave(value) {
  return value &&
    Number.isInteger(value.semester) && value.semester >= 1 && value.semester <= value.terms?.length &&
    ['money', 'energy', 'research', 'recommendations', 'practice', 'savings'].every(key => Number.isFinite(value[key]) && value[key] >= 0) && value.energy <= (value.wellness?.maxEnergy || CONFIG.maxEnergy) &&
    Array.isArray(value.terms) && value.terms.length >= 8 &&
    value.terms.every(term => Array.isArray(term.actions) && term.actions.length <= 3 &&
      (!term.report || (Number.isFinite(term.report.gpa) && Array.isArray(term.report.courses) && term.report.courses.length > 0 &&
        term.report.courses.every(course => Number.isFinite(course.point) && course.point >= 0 && course.point <= 4.5 && Number.isFinite(course.credits) && course.credits > 0)))) &&
    Array.isArray(value.history) && Array.isArray(value.applications) && value.flags && value.experiences && value.firstParticipation &&
    (!value.master || (programById(value.master.program) && Array.isArray(value.master.actions))) &&
    (!value.competition || (CONFIG.competition.roles[value.competition.role] || value.phase === 'competitionRole')) &&
    value.applications.every(app => programById(app.id) && ['applied', 'interviewed', 'opened'].includes(app.status));
}
function validSave(value) {
  return value && value.version === CONFIG.saveVersion && [...CORE_PHASES, ...LIFE_PHASES, ...CAMPUS_PHASES, ...SOCIAL_PHASES, ...STUDY_PHASES, ...CAREER_PHASES, ...MEMOIR_PHASES, ...DEGREE_PHASES, ...LIFESTYLE_PHASES, ...MILITARY_PHASES].includes(value.phase) &&
    validBaseSave(value) && validLifeFields(value) && validCampusFields(value) && validSocialFields(value) && validStudyFields(value) && validCareerFields(value) && validReflectionFields(value) && validPhaseContext(value) && validDevelopmentFields(value) && validGraduateAdmissions(value) && validDegreeFields(value) && validLifestyle(value) && validMilitary(value) && validLifeAssessment(value);
}
function validPhaseContext(value) {
  const phase = value.phase, term = value.terms[value.semester - 1];
  if (phase === 'report' && !term.report) return false;
  if (phase === 'campus' && !CAMPUS_EVENTS[term.event]) return false;
  if (phase.startsWith('competition') && (!value.competition || (phase !== 'competitionRole' && !value.competition.role))) return false;
  if (['competitionResult'].includes(phase) && !value.competition?.result) return false;
  if (['master', 'masterDone'].includes(phase) && (!value.master || !programById(value.master.program))) return false;
  if (phase === 'master' && (value.master.completed || value.master.turn >= 2)) return false;
  if (phase === 'masterDone' && (!value.master.completed || value.master.turn < 2)) return false;
  if (phase === 'interview' && !value.applications.some(app => app.status === 'applied')) return false;
  if (phase === 'jobInterview' && !value.career.applications.some(app => app.documentPassed && !app.interviewed)) return false;
  if (phase === 'jobResults' && !value.career.applications.some(app => app.interviewed)) return false;
  if (phase === 'phdEpilogue' && programById(value.flags.acceptedProgram)?.degree !== 'phd') return false;
  return true;
}
function boot() {
  if (loadSlotSystem()) return;
  let raw;
  try { raw = localStorage.getItem(CONFIG.saveKey); }
  catch { saveAvailable = false; }
  if (raw) {
    try {
      const original = JSON.parse(raw);
      const loaded = migrateSave(original);
      if (!validSave(loaded)) throw new Error('invalid save');
      state = loaded;
      ensureMemoirSnapshot();
      updateFortyMilestone();
      try {
        if (!localStorage.getItem(`${CONFIG.saveKey}:before-slots`)) localStorage.setItem(`${CONFIG.saveKey}:before-slots`, raw);
      } catch { preserveUnreadableSave = true; saveAvailable = false; }
      if (original.version !== CONFIG.saveVersion) {
        // 원래 키는 유지하고, 이전 저장본도 별도 키에 한 번 백업합니다.
        try {
          const backupKey = `${CONFIG.saveKey}:backup-v${original.version}`;
          if (!localStorage.getItem(backupKey)) localStorage.setItem(backupKey, raw);
        } catch {
          saveAvailable = false;
          preserveUnreadableSave = true; // 원본 백업 실패 시 원래 저장 키를 덮어쓰지 않습니다.
        }
        state.notice = `이전 저장본을 버전 ${CONFIG.saveVersion}로 이전했습니다. 현재 진행을 유지하며 지난 학기와 현재 학기 비용은 소급 청구하지 않습니다.`;
        save();
      } else state.notice = `자동 저장한 진행을 불러왔습니다. ${String(state.notice || '').replace(/^(자동 저장한 진행을 불러왔습니다\.\s*)+/, '')}`;
      if (!preserveUnreadableSave && !localStorage.getItem(SLOT_CONFIG.key)) {
        localStorage.setItem(`${CONFIG.saveKey}:before-slots`, raw); save();
      }
    } catch {
      state = freshState();
      // 읽을 수 없는 저장본을 자동으로 덮어쓰지 않습니다.
      saveAvailable = false;
      preserveUnreadableSave = true;
      state.notice = '저장 내용을 읽을 수 없어 새 화면을 열었습니다. 기존 저장본은 유지합니다. 새로 시작을 누르면 초기화됩니다.';
      render();
      return;
    }
  } else state = freshState();
  render();
}
function commit() { if (state.development) ensureUndergraduateGrowth(); enforceMilitary(); ensureMemoirSnapshot(); updateFortyMilestone(); save(); render(); }
function choose(phase, callback) {
  const revision = renderRevision;
  let used = false;
  return () => {
    if (used || state.phase !== phase || revision !== renderRevision) return;
    used = true;
    callback();
    commit();
  };
}
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function addButton(parent, title, detail, callback, disabled = false, primary = false) {
  const button = element('button', undefined, primary ? 'primary' : '');
  button.type = 'button';
  button.disabled = Boolean(disabled);
  button.append(element('strong', title));
  if (detail) button.append(element('small', detail));
  button.addEventListener('click', callback);
  parent.append(button);
  return button;
}
function setScene(badge, title, text) {
  const scene = $('scene');
  scene.replaceChildren();
  const heading = element('h2', title);
  heading.tabIndex = -1;
  scene.append(element('span', badge, 'badge'), heading, element('p', text, 'muted'));
  heading.focus({ preventScroll: true });
  return scene;
}
function choiceContainer(parent) {
  const choices = element('div', undefined, 'choices');
  parent.append(choices);
  return choices;
}
function list(parent, texts) {
  const ul = element('ul');
  texts.forEach(text => ul.append(element('li', text)));
  parent.append(ul);
}
function cumulativeGpa(upTo = state.terms.length, value = state) {
  const courses = effectiveTranscript(upTo, value);
  const credits = courses.reduce((sum, course) => sum + course.credits, 0);
  return credits ? round(courses.reduce((sum, course) => sum + course.point * course.credits, 0) / credits) : 0;
}
function makeReport() {
  const term = currentTerm();
  if (term.report) return; // 재열람·새로고침·중복 클릭으로 다시 생성하지 않습니다.
  const counts = {};
  for (const id of term.actions) {
    const action = ACTIONS.find(item => item.id === id);
    const key = action?.experience || id;
    counts[key] = (counts[key] || 0) + 1;
  }
  const courses = COURSES.map(course => {
    const efficiency = learningPerformance('academic');
    const raw = course.base + (counts.study || 0) * course.study * efficiency + (counts.lab || 0) * course.lab * efficiency +
      (counts.club || 0) * course.club + (counts.rest || 0) * .1 +
      (counts.tutor || 0) * .1 + (counts.competitionPrep || 0) * .1;
    const point = clamp(Math.round(raw * 2) / 2, 0, 4.5);
    const grades = ['F', 'F', 'D0', 'D+', 'C0', 'C+', 'B0', 'B+', 'A0', 'A+'];
    return { name: course.name, credits: course.credits, point, grade: grades[Math.round(point * 2)] };
  });
  applyAcademicReport(courses, counts);
  if (state.study.exchangeActive) courses.forEach(course => { course.name = `교환 인정 ${course.name}`; });
  const credits = courses.reduce((sum, course) => sum + course.credits, 0);
  term.report = { courses, gpa: round(courses.reduce((sum, course) => sum + course.point * course.credits, 0) / credits) };
  if (term.report.gpa < CAMPUS_CONFIG.warningBelow && !state.academic.warnings.includes(state.semester)) {
    state.academic.warnings.push(state.semester);
    log(`${semesterName()} 학사경고. 다음 학기 휴식·공부·재수강으로 회복할 수 있다.`);
  }
  // 누적 평점은 확정 성적표의 과목을 매번 집계하므로 중복 반영될 수 없습니다.
  log(`${semesterName()} 성적표를 공개했다. 학기 평점 ${term.report.gpa.toFixed(2)}.`);
}
function renderReport(parent, term, index) {
  const table = element('table');
  const head = element('thead');
  const row = element('tr');
  ['과목', '학점', '성적'].forEach(text => row.append(element('th', text)));
  head.append(row);
  table.append(head);
  const body = element('tbody');
  for (const course of term.report.courses) {
    const tr = element('tr');
    [`${course.name}${course.repeated ? ' (재수강)' : ''}`, `${course.credits}`, `${course.grade} (${course.point.toFixed(1)})`].forEach(text => tr.append(element('td', text)));
    body.append(tr);
  }
  table.append(body);
  parent.append(table, element('p', `학기 평점 ${term.report.gpa.toFixed(2)} · 누적 평점 ${cumulativeGpa(index + 1).toFixed(2)} / 4.50`));
}
function careerEvidence() {
  const evidence = [];
  if (state.experiences.lab) evidence.push({ id: 'lab', title: '연구실 경험', text: `연구실 참여 ${state.experiences.lab}회: 실험 노트와 후속 질문`, score: 75 });
  if (state.competition?.result) {
    const role = CONFIG.competition.roles[state.competition.role];
    evidence.push({ id: 'competition', title: `대회 ${role.title} 기여`, text: `${state.competition.result.team}과 별개로, ${state.competition.result.individual || role.task}`, score: 85 });
  }
  if (state.experiences.internship) evidence.push({ id: 'internship', title: '유급 인턴 경험', text: `유급 인턴 ${state.experiences.internship}회: 실무 인수인계와 협업`, score: 80 });
  if (state.military?.certificates.length) evidence.push({ id: 'certificate', title: '복무 중 자격증', text: state.military.certificates.join(', '), score: 70 });
  if (state.military?.history.some(s => s.research > 0)) evidence.push({ id: 'serviceResearch', title: '전문연구 복무 성과', text: '지정연구기관에서 수행한 연구·논문·기술 개발', score: 82 });
  if (state.jobTurns) evidence.push({ id: 'job', title: '직장 실무 경험', text: `직장 ${state.jobTurns}턴: 고객 요구를 실제 결과물로 바꾼 경험`, score: 85 });
  if (state.master?.actions.length) evidence.push({ id: 'master', title: '석사 연구 성과', text: `석사 연구 성과 ${state.master.research}, 조교·발표 기록 ${state.master.actions.join(', ')}`, score: 90 });
  if (state.experiences.club) evidence.push({ id: 'club', title: '동아리 협업', text: `프로젝트 ${state.experiences.club}회: 역할 조율과 결과물`, score: 65 });
  if (state.academic.project) evidence.push({ id: 'capstone', title: '졸업 프로젝트', text: '졸업 프로젝트에서 주제를 정하고 결과물을 완성한 경험', score: 75 });
  if (state.academic.industryProject) evidence.push({ id: 'industry', title: '산학 프로젝트', text: '대학의 산학 프로젝트에서 실무 요구를 분석한 경험', score: 75 });
  evidence.push(...studyEvidence());
  if (state.experiences.industryReferral) evidence.push({ id: 'referral', title: '선배 소개 산학 협업', text: '동아리 활동을 기억한 선배의 소개로 현장 협업에 참여한 경험', score: 82 });
  evidence.push({ id: 'motivation', title: '앞으로의 학습 계획', text: '현재 부족한 점과 다음 연구·학습 계획을 솔직하게 설명', score: 40 });
  return evidence;
}
function renderSidebar() {
  $('stage').textContent = state.master ? (state.master.completed ? '석사 졸업' : `석사 ${state.master.turn + 1} / 2턴`) :
    state.life.graduationYear !== null ? '학사 졸업 이후' : semesterName();
  if (state.postgraduate.active && !state.postgraduate.active.completed) {
    const d = state.postgraduate.active; $('stage').textContent = `${degreeName(d.degree)} ${d.semester}학기`;
  }
  if (state.phase === 'ending' && state.ending.includes('박사')) $('stage').textContent = '박사 진학';
  if (state.reflection.phdCompleted) $('stage').textContent = '박사 학위 이후';
  if (['job', 'jobNext'].includes(state.phase)) $('stage').textContent = '직장 생활';
  if (state.reflection.selected) $('stage').textContent = '인생 엔딩';
  if (state.phase === 'ending' && state.ending.endsWith(' 취업')) $('stage').textContent = '취업 엔딩';
  $('money').textContent = `${state.money}만원`;
  $('energy').textContent = `${state.energy} / ${state.wellness?.maxEnergy || CONFIG.maxEnergy}`;
  $('lifestyle-button').hidden = !state.character || state.phase === 'lifestyle';
  $('military-button').hidden = !state.character || MILITARY_PHASES.includes(state.phase);
  $('notice').textContent = state.notice;
  $('history').replaceChildren();
  for (const record of state.history) {
    const li = element('li');
    li.append(element('small', `${record.year ? `${record.year}년 · ` : ''}${record.label}`), document.createTextNode(record.text));
    $('history').append(li);
  }
  $('reports').replaceChildren();
  state.terms.forEach((term, index) => {
    if (!term.report) return;
    const details = element('details');
    details.append(element('summary', semesterName(index + 1)));
    renderReport(details, term, index);
    $('reports').append(details);
  });
  if (!$('reports').children.length) $('reports').append(element('p', '아직 공개된 성적표가 없습니다.'));
  $('career').replaceChildren();
  list($('career'), careerEvidence().filter(item => item.id !== 'motivation').map(item => item.text));
  $('career').append(element('p', `연구 경험 ${state.research} · 추천서 ${state.recommendations} · 실무 경험 ${state.practice} · 직장 저축 ${state.savings}만원`));
  if (state.competition) $('career').append(element('p', `대회 예산 ${state.competition.budget}만원 (개인 생활비와 별도)`));
  $('save-status').textContent = saveAvailable ? `${slotStore.active + 1}번 슬롯 · 선택할 때마다 자동 저장됩니다.` : '자동 저장 실패/충돌 또는 손상 원본 보호 중입니다. 창을 닫기 전에 JSON으로 내보내 주세요.';
  renderLifeSidebar();
  renderCampusSidebar();
  renderSocialSidebar();
  renderStudySidebar();
  renderCareerSidebar();
  renderTimelineSidebar();
  renderDevelopmentProfile();
  renderGraduateAdmissionsSidebar();
  renderAssessmentSidebar();
}
function beginCampusEvent() {
  const term = currentTerm();
  term.event = state.semester >= 3 && state.firstParticipation.lab < state.semester && !state.flags.recommendedEvent
    ? 'recommendation' : selectRandomCampusEvent();
  state.phase = 'campus';
}
function afterAction() {
  ensureUndergraduateGrowth();
  const term = currentTerm();
  if (interruptForSocialEvent()) return;
  if (term.actions.length === 2 && !term.eventDone) beginCampusEvent();
  else if (term.actions.length >= 3) {
    state.phase = state.semester === 6 && state.competition && !state.competition.result ? 'competitionFinal' : 'reportReady';
  } else state.phase = 'semester';
}
function performAction(action) {
  if (state.campus.ledgers[state.semester]?.status === 'pending') return;
  if (currentTerm().actions.length >= 3 || unavailable(action.effects) || (action.requires && !state.flags[action.requires])) return;
  const actualEffects = { ...action.effects };
  if (['cafe','tutor'].includes(action.id)) actualEffects.money = Math.round(actualEffects.money * (.8 + .2 * Math.min(1, developmentCondition())));
  applyEffects(actualEffects);
  currentTerm().actions.push(action.id);
  experience(action.experience || action.id);
  const researchGain = socialActionResearch(action);
  state.research += researchGain;
  onLabAction(action, researchGain);
  state.recommendations += action.recommendation || 0;
  log(`${action.title}: ${action.feedback} (${effectsText(actualEffects)})`);
  checkSocialOpportunities();
  afterAction();
}
function renderSemester() {
  const term = currentTerm();
  const scene = setScene(state.semester > 8 ? '졸업 요건 보완 학기' : `${state.semester} / 8학기`, semesterName(),
    `남은 주요 행동 ${3 - term.actions.length}회. 이번 학기 성적은 아직 공개되지 않았습니다.`);
  const progress = element('div', undefined, 'progress');
  for (let i = 0; i < 3; i++) progress.append(element('span', undefined, i < term.actions.length ? 'done' : ''));
  scene.append(progress);
  addButton(scene, '학기 재정·주거 확인', `현재 주거 ${housingById(state.campus.housing.type).title} · 대출 ${state.campus.debt}만원 · 주요 행동 소모 없음`,
    choose('semester', () => openTermBudget()));
  addButton(scene, '사람들과 시간 보내기', 'NPC 대화·과제 돕기·연애 · 교류는 학기당 1회, 과제 돕기는 주요 행동 1회',
    choose('semester', () => { state.phase = 'relationships'; }));
  addButton(scene, '연구실·어학 활동', '지도교수·프로젝트·학회·논문·어학 시험', choose('semester', () => openStudy('semester')));
  if (state.semester >= 3 && state.semester <= 6) addButton(scene, '교환학생 살펴보기', '다음 학기 파견 · 지원 준비는 주요 행동 1회', choose('semester', () => { state.phase = 'exchange'; }));
  const policy = schoolPolicy();
  scene.append(element('p', `대학 특성: 연구실 성과 보너스 +${policy.researchBonus}, 카페 수입 보너스 +${policy.cafeBonus}만원, 인턴 선발 경험 기준 ${policy.internshipThreshold}회.`, 'muted'));
  scene.append(element('p', '한 학기에 근로를 2회 이상 하면 과제에 쓸 시간이 부족해집니다. 공부·휴식·재수강으로 균형을 잡을 수 있습니다.', 'muted'));
  if (state.competition && [5, 6].includes(state.semester)) {
    scene.append(element('p', `대회 역할: ${CONFIG.competition.roles[state.competition.role].title} · 준비 ${state.competition.preparation}회 · 대회 예산 ${state.competition.budget}만원 (개인 생활비 아님)`));
  }
  const choices = choiceContainer(scene);
  for (const original of ACTIONS) {
    const action = labActionEffects(universityAction(original));
    if (action.requires && action.id !== 'tutor' && !state.flags[action.requires]) continue;
    const reason = action.requires && !state.flags[action.requires] ? '소개 면담을 먼저 완료해야 합니다' : unavailable(action.effects);
    addButton(choices, action.title, `${effectsText(action.effects)}${reason ? ` · 선택 불가: ${reason}` : ''}`,
      choose('semester', () => performAction(action)), reason);
  }
  if (!state.flags.tutorApproved) addButton(choices, '과외 소개 면담', '주요 행동 소모 없음 · 담당자와 일정과 지도 과목을 확인합니다.',
    choose('semester', () => { state.phase = 'tutorInterview'; }));
  if (state.semester === 5 && !state.competition) {
    addButton(choices, '국제 팀 대회에 지원', '선택 활동 · 주요 행동 1회 · 역할 선택 후 두 학기 동안 준비',
      choose('semester', () => {
        currentTerm().actions.push('competitionJoin');
        experience('competitionJoin');
        state.competition = { role: null, budget: CONFIG.competition.initialBudget, preparation: 0, crisis: null, result: null,
          teammate: state.social.unlocked.competitionTeam ? 'peer' : null, support: state.social.unlocked.competitionTeam ? 1 : 0 };
        state.phase = 'competitionRole';
      }));
  }
  if ([5, 6].includes(state.semester) && state.competition) {
    const cost = state.competition.crisis === 'scope' ? CONFIG.competition.reducedCost : CONFIG.competition.preparationCost;
    const reason = state.energy < 15 ? '체력 부족' : state.competition.budget < cost ? '대회 예산 부족' : '';
    addButton(choices, '국제 대회 준비', `주요 행동 1회 · 체력 -15 · 대회 예산 -${cost}만원${reason ? ` · ${reason}` : ''}`,
      choose('semester', () => {
        if (reason) return;
        state.energy -= 15;
        state.competition.budget -= cost;
        state.competition.preparation++;
        currentTerm().actions.push('competitionPrep');
        experience('competitionPrep');
        log(`${CONFIG.competition.roles[state.competition.role].title} 역할로 대회를 준비했다. 대회 예산 ${state.competition.budget}만원.`);
        afterAction();
      }), reason);
  }
  renderAcademicActions(scene);
  if (state.flags.industryInvite) addButton(scene, '선배의 산학 협업 참여', '주요 행동 1회 · 체력 -15 · 생활비 +20 · 실무 경험 +2 · 연구 +1',
    choose('semester', () => {
      if (state.energy < 15 || currentTerm().actions.length >= 3) return;
      state.flags.industryInvite = false; state.practice += 2;
      performAction({ id: 'industryReferral', title: '선배의 산학 협업', effects: { money: 20, energy: -15 }, research: 1, feedback: '예전 프로젝트에서 이어진 소개를 실제 현장 경험으로 연결했다.' });
    }), state.energy < 15);
  renderMeals(scene);
}
function renderMeals(scene) {
  scene.append(element('h3', '이번 학기의 한 끼'));
  if (currentTerm().meal) {
    scene.append(element('p', currentTerm().meal === 'skip' ? '이번 학기는 식사를 건너뛰기로 했다.' : `${MEALS.find(meal => meal.id === currentTerm().meal).title} 선택 완료 · 주요 행동 소모 없음`));
    return;
  }
  scene.append(element('p', '주요 행동과 별도로 한 번 선택합니다. 먹지 않아도 학기를 마칠 수 있습니다.', 'muted'));
  const choices = choiceContainer(scene);
  for (const meal of MEALS) {
    const reason = state.money < meal.price ? '잔액 부족' : '';
    addButton(choices, meal.title, `${meal.menu} · ${meal.price}만원 · 체력 +${meal.recovery}${reason ? ` · 선택 불가: ${reason}` : ''}`,
      choose('semester', () => {
        if (currentTerm().meal || state.money < meal.price) return;
        applyEffects({ money: -meal.price, energy: meal.recovery });
        currentTerm().meal = meal.id;
        let news = '';
        if (meal.id === 'friends') {
          changeRelationship('peer', 8, 4, '함께 식사하며 서로의 활동 소식을 나눴다.');
          applyAbilities({ stress: -5, happiness: 4 });
          if (state.experiences.lab) {
            state.flags.labNews = true;
            news = ' 연구실 경험을 들은 동기가 추가 연구실 모집을 소개했다. 다음 주요 행동에서 참여할 수 있다.';
          } else {
            state.flags.clubNews = true;
            news = state.experiences.club ? ' 지난 프로젝트를 기억한 동기가 새 동아리 프로젝트를 소개했다.' : ' 동기가 초보자도 참여할 동아리 프로젝트를 소개했다.';
            news += ' 다음 주요 행동에서 합류할 수 있다.';
          }
        }
        log(`${meal.title}: ${meal.price}만원, 체력 +${meal.recovery}.${news}`);
        checkSocialOpportunities();
      }), reason);
  }
  addButton(choices, '식사 건너뛰기', '비용·행동 소모 없음', choose('semester', () => {
    if (!currentTerm().meal) { currentTerm().meal = 'skip'; log('이번 학기의 별도 식사 선택을 건너뛰었다.'); }
  }));
}
function renderCampus() {
  const event = CAMPUS_EVENTS[currentTerm().event];
  const scene = setScene('학기 중 이야기 · 행동 소모 없음', event.title, event.text);
  const choices = choiceContainer(scene);
  for (const option of event.choices) {
    const reason = unavailable(option.effects);
    addButton(choices, option.title, `${effectsText(option.effects)}${reason ? ` · ${reason}` : ''}`, choose('campus', () => {
      if (unavailable(option.effects)) return;
      applyEffects(option.effects);
      state.recommendations += option.recommendation || 0;
      state.research += option.research || 0;
      if (option.presentation) experience('presentation');
      if (option.flag) state.flags[option.flag] = true;
      if (currentTerm().event === 'recommendation') state.flags.recommendedEvent = true;
      currentTerm().eventDone = true;
      log(option.story);
      afterAction();
    }), reason);
  }
}
function renderCompetition() {
  const c = state.competition;
  if (state.phase === 'competitionRole') {
    const scene = setScene('3학년 1학기 · 선택 활동', '팀에서 어떤 역할을 맡을까?',
      `${CONFIG.competition.title}: iGEM에서 착안한 가상 대회입니다. 개인 생활비와 별도로 대회 예산 ${c.budget}만원이 배정됐습니다.`);
    const choices = choiceContainer(scene);
    for (const [id, role] of Object.entries(CONFIG.competition.roles)) addButton(choices, role.title, role.task,
      choose('competitionRole', () => { c.role = id; log(`국제 팀 대회에 지원해 ${role.title} 역할을 맡았다.`); afterAction(); }));
  } else if (state.phase === 'competitionCrisis') {
    const scene = setScene('3학년 2학기 · 팀의 위기', '예산은 줄고 팀원 한 명이 떠났다',
      `대회 예산 ${c.budget}만원. 남은 업무를 재분배해야 한다. 개인 생활비로 메우지 않고 해결책을 찾아보자.`);
    const choices = choiceContainer(scene);
    addButton(choices, '지원금 신청과 역할 재배분', `대회 예산 +${CONFIG.competition.grant}만원 · 행정 준비 체력 -8`,
      choose('competitionCrisis', () => {
        c.crisis = 'grant'; c.budget += CONFIG.competition.grant;
        applyEffects({ energy: -8 });
        log('지원금을 확보하고 떠난 팀원의 업무를 재배분했다. 개인 생활비는 사용하지 않았다.');
        state.phase = 'semester';
      }));
    addButton(choices, '발표 범위 축소와 핵심 업무 집중', `이후 준비 비용 ${CONFIG.competition.reducedCost}만원 · 팀원 이탈에 맞춰 업무 축소`,
      choose('competitionCrisis', () => {
        c.crisis = 'scope';
        log('발표 범위를 좁히고 남은 팀원의 역할을 재정리했다. 제한된 예산을 지켰다.');
        state.phase = 'semester';
      }));
  } else if (state.phase === 'competitionFinal') {
    const scene = setScene('3학년 2학기 · 최종 발표', '국제 무대에 서다',
      `준비 ${c.preparation}회 · 역할 ${CONFIG.competition.roles[c.role].title} · 남은 대회 예산 ${c.budget}만원`);
    addButton(choiceContainer(scene), '최종 발표와 결과 공개', '팀 성적과 개인 기여를 별도로 기록합니다.',
      choose('competitionFinal', () => {
        c.result = {
          team: c.preparation > 0 && c.preparation + (c.support || 0) >= CONFIG.competition.awardPreparation ? '우수 협업상 입상' : '본선 발표 완료 · 미입상',
          individual: CONFIG.competition.roles[c.role].task + (c.teammate ? `. ${semesterName(state.social.unlocked.helpedPeer)}에 도왔던 동기 박서우와 다시 협업했다` : ''),
        };
        state.research += c.preparation;
        experience('competition');
        log(`대회 팀 성적: ${c.result.team}. 개인 기여: ${c.result.individual}. 입상 여부와 관계없이 면접에서 설명할 수 있다.`);
        state.phase = 'competitionResult';
      }), false, true);
  } else {
    const scene = setScene('대회 결과', c.result.team, `나의 기여: ${c.result.individual}. 이 경험은 취업·대학원 면접 선택지로 남습니다.`);
    addButton(choiceContainer(scene), '학기 마무리로', '', choose('competitionResult', () => { state.phase = 'reportReady'; }));
  }
}
function renderReportPhase() {
  if (state.phase === 'reportReady') {
    const scene = setScene('주요 행동 3회 완료', `${semesterName()}의 마지막 페이지`,
      '과제와 발표를 모두 마쳤다. 지금부터 성적표를 확인할 수 있다. 식사를 선택하지 않아도 괜찮다.');
    addButton(choiceContainer(scene), '성적표 열기', '과목별 성적, 학기 평점과 누적 평점 공개',
      choose('reportReady', () => { makeReport(); state.phase = 'report'; }), false, true);
  } else {
    const scene = setScene('확정 성적표', semesterName(), '이 성적표는 기록에 보관됩니다. 다시 열어도 결과는 바뀌지 않습니다.');
    renderReport(scene, currentTerm(), state.semester - 1);
    addButton(choiceContainer(scene), '방학 계획 세우기', '유급 인턴 또는 회복의 시간', choose('report', () => { state.phase = 'vacation'; }));
  }
}
function renderVacation() {
  const scene = setScene('방학 · 주요 행동과 별도', '다음 학기 사이의 시간',
    `유급 인턴은 전공·연구·동아리 경험 합계 ${schoolPolicy().internshipThreshold}회 이상이면 선발됩니다. 지원 결과는 지원 후 공개됩니다.`);
  const choices = choiceContainer(scene);
  addButton(choices, '유급 인턴 지원', `선발 시 생활비 +${CONFIG.internship.income}만원 · 체력 ${CONFIG.internship.energy} · 실무 경험 +${CONFIG.internship.experience}`,
    choose('vacation', () => {
      if (currentTerm().vacationDone) return;
      const count = (state.experiences.study || 0) + (state.experiences.lab || 0) + (state.experiences.club || 0);
      const selected = count >= schoolPolicy().internshipThreshold;
      if (selected) {
        applyEffects({ money: CONFIG.internship.income, energy: CONFIG.internship.energy });
        experience('internship'); state.practice += CONFIG.internship.experience;
        recordGrowth('internship', `vacation:${state.semester}`);
      }
      currentTerm().vacationResult = selected ? '선발 메일이 도착했다. 유급 인턴으로 일하며 실무 경험과 생활비를 얻었다.' : '이번 인턴은 불합격했다. 부족한 경험을 확인하고 방학에는 쉬어 가기로 했다.';
      completeVacation();
    }));
  addButton(choices, '방학 동안 쉬기', `체력 +${CONFIG.vacationRecovery}`, choose('vacation', () => {
    if (currentTerm().vacationDone) return;
    currentTerm().vacationResult = '방학 동안 일정을 비우고 충분히 쉬었다.';
    completeVacation();
  }));
}
function completeVacation() {
  currentTerm().vacationDone = true;
  applyEffects({ energy: CONFIG.vacationRecovery });
  log(`${currentTerm().vacationResult} 방학 회복 체력 +${CONFIG.vacationRecovery}.`);
  state.phase = 'vacationResult';
}
function renderVacationResult() {
  const scene = setScene('방학 결과', '방학의 기록', currentTerm().vacationResult);
  addButton(choiceContainer(scene), state.semester >= 8 ? '졸업 후 진로 보기' : '다음 학기로',
    '성적표와 경험을 보관하고, 8학기 이후에는 졸업 요건을 확인합니다.', choose('vacationResult', finaliseUndergraduateTerm), false, true);
  addButton(choiceContainer(scene), '1년 휴학 신청', '학년은 유지 · 휴학 활동 3회 · 기존 성적·자금 기록 보존', choose('vacationResult', () => startLeave('vacationResult')));
}
function renderHub() {
  const mastersDone = Boolean(state.master?.completed);
  const degree = mastersDone ? 'phd' : 'masters';
  const scene = setScene(state.reflection.phdCompleted ? '박사 학위 이후' : mastersDone ? '석사 졸업 이후' : '학사 졸업 이후', '다음 페이지를 선택하자',
    `지원에 실패하거나 제안을 거절해도 다시 준비할 수 있습니다. ${mastersDone ? `석사 연구 성과 ${state.master.research}` : `학부 누적 평점 ${cumulativeGpa().toFixed(2)}`} · 추천서 ${state.recommendations}`);
  list(scene, careerEvidence().filter(item => item.id !== 'motivation').map(item => item.text));
  const choices = choiceContainer(scene);
  addButton(choices, '취업 지원', '실제 경험을 면접에 활용한 뒤 첫 직장에서 일하는 턴을 플레이합니다.',
    choose('hub', startHiring));
  if (!state.reflection.phdCompleted) addButton(choices, `${degreeName(degree)} 지원`, '복수 지원 → 면접 → 결과 메일 → 제안 비교 → 진학 결정',
    choose('hub', () => startApplications(degree)));
  else addButton(choices, '연구·교육 커리어 마무리', '박사 이후 실제 경험에 따라 열린 진로를 선택합니다.', choose('hub', () => { state.phase = 'endingChoice'; }));
  addButton(choices, '단기 연구 활동 후 다음 모집 준비',
    `생활비 +${CONFIG.shortResearch.money}만원 · 연구 +${CONFIG.shortResearch.research} · 추천서 +1 · 체력 회복 +${CONFIG.shortResearch.energy}`,
    choose('hub', () => {
      applyEffects(CONFIG.shortResearch);
      state.research += CONFIG.shortResearch.research;
      if (state.master?.completed) state.master.research += CONFIG.shortResearch.research;
      recordGrowth('research', `shortResearch:${state.life.shortResearchTurns + 1}`);
      state.recommendations++;
      experience('lab');
      state.life.shortResearchTurns++;
      advanceTime(LIFE_CONFIG.time.shortResearch, `shortResearch:${state.life.shortResearchTurns}`);
      log('단기 연구에 참여해 결과물을 보완했다. 다음 모집에서 연구 경험과 추천서가 강화된다.');
    }));
}
function renderJob() {
  const scene = setScene('취업 면접과 첫 직장', '경험을 업무로 바꾸는 한 턴',
    `면접에서 설명할 경험을 고르고 실제로 일합니다. 급여 +${CONFIG.job.income}만원 · 체력 ${CONFIG.job.energy} · 실무 경험 +${CONFIG.job.experience} · 이 중 저축 ${CONFIG.job.savings}만원`);
  if (state.life.graduationYear !== null && state.campus.debt > 0) scene.append(element('p',
    `이번 급여에서 학자금 ${Math.min(state.campus.debt, Math.floor(CONFIG.job.income * CAMPUS_CONFIG.loan.repaymentRate))}만원을 자동 상환합니다.`, 'muted'));
  const choices = choiceContainer(scene);
  for (const evidence of careerEvidence()) addButton(choices, `${evidence.title} 활용해 면접 보고 일하기`, evidence.text,
    choose('job', () => {
      applyEffects({ money: CONFIG.job.income, energy: CONFIG.job.energy });
      state.practice += CONFIG.job.experience;
      state.jobTurns++;
      recordGrowth('workBalance', `work:${state.jobTurns}`);
      state.career.years = Math.max(state.career.years, state.jobTurns);
      const repayment = state.life.graduationYear !== null ? repayLoan(Math.floor(CONFIG.job.income * CAMPUS_CONFIG.loan.repaymentRate), `salary:${state.jobTurns}`) : 0;
      const saved = Math.min(CONFIG.job.savings, CONFIG.job.income - repayment);
      state.savings += saved;
      advanceTime(LIFE_CONFIG.time.workTurn, `job:${state.jobTurns}`);
      log(`취업 면접: ${evidence.text}. 첫 직장에서 한 턴 일했다. 실무 +${CONFIG.job.experience}, 급여 ${CONFIG.job.income}만원, 대출 상환 ${repayment}만원, 저축 ${saved}만원.`);
      state.phase = 'jobNext';
    }));
}
function renderJobNext() {
  const scene = setScene('직장 생활 이후', '계속 일할까, 다시 공부할까?',
    `직장 경험 ${state.jobTurns}턴 · 누적 저축 ${state.savings}만원 (현재 생활비 잔액에 포함). 저축 외 급여도 현재 잔액에 포함됩니다.`);
  const choices = choiceContainer(scene);
  addButton(choices, '직장 생활 계속하기', '한 턴 더 일하며 경력을 쌓습니다.', choose('jobNext', () => { applyEffects({ energy: 25 }); state.phase = state.career.employer ? 'workTurn' : 'job'; }));
  const degree = state.master?.completed ? 'phd' : 'masters';
  if (hasBachelor() && !state.reflection.phdCompleted) {
    addButton(choices, `국내외 ${degreeName(degree)} 지원`, '직장과 인턴 경험도 대학원 면접에서 사용할 수 있습니다.', choose('jobNext', () => startApplications(degree)));
  } else if (!hasBachelor()) {
    addButton(choices, '대학 입시에 다시 도전', '대학원 지원은 학사 학위 취득 후 가능합니다. 1년의 입시 재도전을 시작합니다.',
      choose('jobNext', () => {
        // 직장 생활 후에는 이전 재수 결정과 별개로 새 준비 기간을 시작할 수 있습니다.
        entranceAttempt().decision = 'careerReturn';
        beginRetake();
      }));
  }
  addButton(choices, '현재 커리어로 마무리', '직장 생활을 이어가는 결말', choose('jobNext', () => {
    state.ending = '경험을 쌓으며 성장하는 직장인'; state.phase = 'ending'; log('직장 생활을 계속하며 나의 길을 만들어 가기로 했다.');
  }));
  appendCareerChoices(scene);
}
function startApplications(degree) {
  if (!hasBachelor()) { log('학사 학위 취득 전에는 대학원에 지원할 수 없습니다.'); return; }
  if (degree === 'phd' && !state.master?.completed) { log('이 박사 모집은 석사 학위 취득 후 지원할 수 있습니다.'); return; }
  archiveGraduateApplications();
  state.degree = degree;
  state.applications = [];
  state.round++;
  state.phase = 'application';
}
function programDetail(program) {
  const p = program.admissions;
  return `${program.country} · ${program.school} · ${program.topic} / 난이도 ${p.difficulty} · 최소 GPA ${p.gpa}, 권장 ${p.recommendedGpa}, 연구 ${p.research}, 추천서 ${p.recommendations}, 어학 ${p.language} · 면접 ${Math.round(program.weights.interview * 100)}% / 턴당 등록금 ${program.tuition}만원, 생활비 지원 ${program.stipend}만원, 예상 생활비 ${p.living}만원, 이사 ${program.moving}만원 / ${program.assistant} / ${p.mentor}`;
}
function renderApplications() {
  const scene = setScene(`${degreeName(state.degree)} 모집 ${state.round}회차 · 1단계 지원`, '어디에 지원할까?',
    '원하는 프로그램에 각각 지원할 수 있습니다. 국가·학교·연구 주제와 비용을 먼저 살펴보세요.');
  const choices = choiceContainer(scene);
  for (const program of PROGRAMS.filter(item => item.degree === state.degree)) {
    const submitted = state.applications.some(app => app.id === program.id);
    const missing = graduateEligibility(program);
    addButton(choices, `${program.country} ${program.title} 지원${submitted ? ' 완료' : ''}`,
      `${programDetail(program)}${missing.length ? ` / 조건 미달: ${missing.join(', ')} (접수하면 서류 탈락)` : ' / 최소 조건 충족 · 합격 보장 아님'}`,
      choose('application', () => {
        if (state.applications.some(app => app.id === program.id)) return;
        submitGraduateApplication(program);
      }), submitted);
  }
  addButton(choices, '지원 마감하고 면접 준비', `${state.applications.length}곳 지원 · 서류 심사 통과자만 면접을 봅니다.`,
    choose('application', () => {
      if (state.applications.length) state.phase = state.applications.some(app => app.ruleset === GRAD_ADMISSIONS.ruleset) ?
        'graduateDocuments' : state.applications.some(app => app.status === 'applied') ? 'interview' : 'mail';
    }), !state.applications.length, true);
  addButton(choices, '지원 취소하고 진로 화면으로', '다음 모집에서 다시 지원할 수 있습니다.', choose('application', () => { state.phase = 'hub'; }));
}
function evaluationInputs(interview) {
  return {
    gpa: cumulativeGpa() / 4.5 * 100,
    research: clamp((state.degree === 'phd' ? (state.master?.research || 0) * 12 : state.research * 12), 0, 100),
    recommendation: clamp(Math.max(state.recommendations * 25, recommendationQuality()), 0, 100),
    interview,
  };
}
function renderInterview() {
  const app = state.applications.find(item => item.status === 'applied');
  const program = programById(app.id);
  const scene = setScene('3단계 · 면접', `${program.country} ${program.school}`,
    `“${program.topic}에 어떤 경험을 연결할 수 있나요?” 실제로 플레이한 경험만 선택지에 나타납니다.`);
  const choices = choiceContainer(scene);
  for (const evidence of app.evidenceOptions || careerEvidence()) addButton(choices, evidence.title, evidence.text,
    choose('interview', () => {
      app.interview = app.ruleset ? evidence.score : actualInterviewScore(evidence.score);
      app.evidence = evidence.text;
      app.status = 'interviewed';
      const inputs = app.ruleset ? graduateInputs(app.snapshot, app.interview) : evaluationInputs(app.interview);
      app.inputs = inputs;
      if (app.ruleset) {
        app.score = graduateWeightedScore(inputs, app.selectionRules.weights);
        app.finalProbability = graduateProbability(app.score, app.selectionRules);
        app.finalDraw = Math.random();
        app.accepted = app.finalDraw < app.finalProbability;
      } else {
        app.score = round(Object.entries(program.weights).reduce((sum, [key, weight]) => sum + (inputs[key] || 0) * weight, 0));
        app.accepted = app.score >= program.threshold;
      }
      log(`${program.school} 면접에서 이야기했다: ${evidence.text}.`);
      if (!state.applications.some(item => item.status === 'applied')) state.phase = 'mail';
    }));
}
function renderMail() {
  const scene = setScene('4단계 · 결과 메일', '편지함에 새 메일이 도착했다',
    '면접이 끝난 각 지원처의 메일을 따로 열어 확인하세요. 결과는 확정 저장되어 다시 열어도 바뀌지 않습니다.');
  const choices = choiceContainer(scene);
  for (const app of state.applications) {
    const program = programById(app.id);
    if (app.status === 'opened') {
      scene.append(element('p', `${program.country} ${program.school}: ${app.accepted ? '합격' : '불합격'} · 기록된 평가 ${app.score.toFixed(1)}${app.document && !app.document.passed ? ' · 서류 탈락' : ''}`));
      continue;
    }
    addButton(choices, `${program.country} ${program.school} 결과 메일 열기`, '열기 전에는 합격 여부가 표시되지 않습니다.',
      choose('mail', () => {
        if (app.status === 'opened') return;
        app.status = 'opened';
        log(`${program.school} 결과 메일: ${app.accepted ? '합격' : '불합격'}. 면접 내용: ${app.evidence}.`);
      }));
  }
  addButton(choices, '진학 제안 비교하기', '모든 메일을 열면 합격 조건을 비교합니다.',
    choose('mail', () => { if (state.applications.every(app => app.status === 'opened')) state.phase = 'offers'; }),
    state.applications.some(app => app.status !== 'opened'), true);
}
function renderOffers() {
  const accepted = state.applications.filter(app => app.accepted);
  const scene = setScene('5단계 · 진학 결정', accepted.length ? `${accepted.length}곳의 제안을 비교하자` : '이번 모집은 아쉽게 마무리됐다',
    '제안을 거절해도 취업하거나 단기 연구 후 다음 모집에 재지원할 수 있습니다. 금액은 만원, 지원·등록금은 턴당입니다.');
  for (const app of accepted) {
    const program = programById(app.id);
    const card = element('div', undefined, 'opportunity');
    card.append(element('h3', `${program.country} · ${program.school}`), element('p', `${program.title} / ${program.lab}`));
    list(card, [
      `연구 주제: ${program.topic}`,
      `등록금 ${program.tuition} · 생활비 지원 ${program.stipend} · 초기 이사 비용 ${program.moving}`,
      `조교 조건: ${program.assistant}`,
      `면접에서 연결된 과거 경험: ${app.evidence}`,
      '석사는 매 턴 생활비 지원 − 등록금 정산 후 선택한 활동의 수입·비용을 반영합니다.',
    ]);
    const reason = state.money < program.moving ? '초기 이사 비용을 감당할 생활비가 부족합니다' : '';
    addButton(card, '이 제안 수락', reason || `초기 이사 비용 ${program.moving}만원 지출`, choose('offers', () => {
      if (state.money < program.moving) return;
      state.money -= program.moving;
      if (state.career.employer) endEmployment(`${degreeName(state.degree)} 진학을 위해 퇴사`);
      state.flags.acceptedProgram = program.id;
      log(`${program.country} ${program.school} ${degreeName(state.degree)} 제안을 수락했다. 초기 이사 비용 ${program.moving}만원.`);
      startDegree(program);
      openLongDistance(program);
    }), reason);
    scene.append(card);
  }
  addButton(choiceContainer(scene), accepted.length ? '모든 제안 거절하고 다시 준비' : '진로 화면으로 돌아가기',
    '취업·단기 연구·다음 모집 선택 가능', choose('offers', () => {
      log(accepted.length ? '진학 제안을 거절하고 다음 기회를 준비하기로 했다.' : '불합격 이후 다음 기회를 준비하기로 했다.');
      state.phase = 'hub';
    }));
}
function renderMaster() {
  const master = state.master;
  const program = programById(master.program);
  const net = program.stipend - program.tuition;
  const scene = setScene(`석사 ${master.turn + 1} / 2턴`, `${program.country} ${program.school}`,
    `${program.lab} · ${program.topic}. 연구 성과 ${master.research}. 이번 턴 생활비 지원 ${program.stipend} − 등록금 ${program.tuition} = ${net}만원 정산 예정.`);
  scene.append(element('p', `RA/TA 제안: ${program.assistant}. 조교는 이번 턴의 주요 시간을 사용하며 다른 프로젝트와 동시에 선택하지 않습니다.`, 'muted'));
  addButton(scene, '대학원 연구실·학회 활동', '지도교수 선택과 연구·학회 활동을 석사 턴으로 진행합니다.', choose('master', () => openStudy('master')));
  const choices = choiceContainer(scene);
  for (const action of GRAD_ACTIONS) {
    const lab = labById(state.study.labId);
    const effects = { money: net + (action.effects.money || 0), energy: action.effects.energy - (lab?.energyExtra || 0) };
    const reason = unavailable(effects);
    addButton(choices, action.title, `주 ${action.hours}시간 · 활동 ${effectsText(action.effects)} · 등록금·지원 포함 순잔액 변화 ${effects.money >= 0 ? '+' : ''}${effects.money}만원 · 연구 +${action.research} · 추천서 경험 +${action.recommendation}${reason ? ` · ${reason}` : ''}`,
      choose('master', () => {
        if (unavailable(effects)) return;
        completeGraduateTurn({ ...action, effects: { ...action.effects, energy: effects.energy } });
      }), reason);
  }
  const supportUsed = (master.supportTurns || []).includes(master.turn);
  addButton(choices, '잠시 쉬고 생활비 상담', '턴당 한 번 · 턴을 소모하지 않음 · 체력 +25 · 긴급 생활비 30만원 지원', choose('master', () => {
    if ((master.supportTurns || []).includes(master.turn)) return;
    (master.supportTurns ||= []).push(master.turn);
    applyEffects({ money: 30, energy: 25 });
    log('연구실과 생활비를 상담하고 컨디션을 회복했다. 30만원의 긴급 지원을 받았다.');
  }), supportUsed);
}
function completeGraduateTurn(action) {
  const master = state.master;
  if (!master || master.completed || master.turn >= 2) return;
  const program = programById(master.program);
  const effects = { money: program.stipend - program.tuition + (action.effects.money || 0), energy: action.effects.energy };
  if (unavailable(effects)) return;
  applyEffects(effects);
  const lab = labById(state.study.labId);
  const bonus = lab && ['research', 'RA', 'presentation'].includes(action.id) ? lab.bonus : 0;
  const research = (action.research || 0) + bonus;
  master.actions.push(action.title); master.research += research; state.research += research;
  state.recommendations += action.recommendation || 0;
  if (research && !action.id.startsWith('lab-')) recordLabContribution(research, `${action.title}에서 석사 연구에 기여했다.`);
  log(`석사 ${master.turn + 1}턴: ${action.story || action.title} 주 ${action.hours}시간, 순잔액 ${effects.money}만원.`);
  master.turn++;
  recordGrowth(action.id, `master:${master.program}:${master.turn}`);
  advanceTime(LIFE_CONFIG.time.masterTurn, `master:${master.program}:${master.turn}`);
  applyEffects({ energy: 20 });
  state.phase = 'master';
  if (master.turn >= 2) {
    master.completed = true; state.life.highestDegree = '석사'; state.phase = 'masterDone';
    log(`석사 2턴을 마쳤다. 연구 성과 ${master.research}, 추천서 ${state.recommendations}.`);
  }
}
function renderEnding() {
  const program = programById(state.flags.acceptedProgram);
  const scene = setScene('지금까지의 커리어', state.ending, '쉬어 간 학기도, 입상하지 못한 발표도 다음 선택의 재료가 되었다.');
  scene.append(element('p', `${state.character.name} · ${characterAge()}세 · ${state.life.year}년 · 최종 학력 ${state.life.highestDegree}`));
  scene.append(element('p', `보증금 자산 ${state.campus.housing.deposit}만원 · 학자금 대출 ${state.campus.debt}만원 · 누적 상환 ${state.campus.repaid}만원`));
  list(scene, state.social.romanceHistory.map(record => `${record.year}년: ${record.text}`));
  if (program?.degree === 'phd') {
    scene.append(element('h3', `${program.country} · ${program.lab}`));
    list(scene, [`연구 주제: ${program.topic}`, `등록금 ${program.tuition}만원 · 생활비 지원 ${program.stipend}만원`, `박사 조교 조건: ${program.assistant}`]);
  }
  list(scene, careerEvidence().filter(item => item.id !== 'motivation').map(item => item.text));
  scene.append(element('p', `학부 누적 평점 ${cumulativeGpa().toFixed(2)} · 생활비 ${state.money}만원 · 실무 ${state.practice} · 추천서 ${state.recommendations}`));
  const details = element('details');
  details.append(element('summary', '주요 커리어 기록 펼치기'));
  list(details, state.history.slice().reverse().map(record => `${record.year ? `${record.year}년 · ` : ''}${record.label}: ${record.text}`));
  scene.append(details);
  appendEndingMemoir(scene);
  addButton(choiceContainer(scene), '다시 시작', '캐릭터 생성과 고교 졸업부터 새로운 선택으로', () => resetGame(), false, true);
}
function render() {
  renderRevision++;
  renderSidebar();
  if (MILITARY_PHASES.includes(state.phase)) { $('stage').textContent = state.phase === 'service' ? '군/연구 복무' : '병역 일정'; renderMilitary(); return; }
  if (state.phase === 'lifestyle') { renderLifestyle(); return; }
  if (DEGREE_PHASES.includes(state.phase)) { $('stage').textContent = `${degreeName(state.postgraduate.active.degree)} ${state.postgraduate.active.semester}학기`; renderDegree(); return; }
  if (state.phase === 'graduateDocuments') { renderGraduateDocuments(); return; }
  if (LIFE_PHASES.includes(state.phase)) { renderLifeScene(); return; }
  if (state.phase === 'termBudget') { renderBudget(); return; }
  if (state.phase === 'graduationReview') { renderGraduationReview(); return; }
  if (state.phase === 'relationships') { renderRelationships(); return; }
  if (state.phase === 'relationshipEvent') { renderRelationshipEvent(); return; }
  if (state.phase === 'wellbeing') { renderWellbeing(); return; }
  if (state.phase === 'study') { renderStudy(); return; }
  if (state.phase === 'studyResult') { renderStudyResult(); return; }
  if (state.phase === 'exchange') { renderExchange(); return; }
  if (state.phase === 'exchangeMail') { renderExchangeMail(); return; }
  if (state.phase === 'leave') { renderLeave(); return; }
  if (state.phase === 'leaveReady') { renderLeaveReady(); return; }
  if (state.phase === 'jobBoard') { renderJobBoard(); return; }
  if (state.phase === 'jobDocuments') { renderJobDocuments(); return; }
  if (state.phase === 'jobInterview') { renderJobInterview(); return; }
  if (state.phase === 'jobResults') { renderJobResults(); return; }
  if (state.phase === 'jobDecision') { renderJobDecision(); return; }
  if (state.phase === 'employmentDecision') { renderEmploymentDecision(); return; }
  if (state.phase === 'workTurn') { renderWorkTurn(); return; }
  if (state.phase === 'workEvent') { renderWorkEvent(); return; }
  if (state.phase === 'venture') { renderVenture(); return; }
  if (state.phase === 'endingChoice') { renderEndingChoices(); return; }
  if (state.phase === 'phdEpilogue') { renderPhdEpilogue(); return; }
  switch (state.phase) {
    case 'semester': renderSemester(); break;
    case 'campus': renderCampus(); break;
    case 'tutorInterview': {
      const scene = setScene('소개 면담', '과외를 맡기 전에', '소개 담당자가 가능한 과목과 시간을 묻는다. 면담을 마쳐야 과외를 선택할 수 있다.');
      addButton(choiceContainer(scene), '전공 기초 과목과 가능한 시간을 설명한다', '과외 선택지 해금 · 주요 행동 소모 없음', choose('tutorInterview', () => {
        state.flags.tutorApproved = true; log('과외 소개 면담을 마쳤다. 이후 과외로 생활비를 벌 수 있다.'); state.phase = 'semester';
      }));
      break;
    }
    case 'competitionRole': case 'competitionCrisis': case 'competitionFinal': case 'competitionResult': renderCompetition(); break;
    case 'reportReady': case 'report': renderReportPhase(); break;
    case 'vacation': renderVacation(); break;
    case 'vacationResult': renderVacationResult(); break;
    case 'hub': renderHub(); break;
    case 'job': renderJob(); break;
    case 'jobNext': renderJobNext(); break;
    case 'application': renderApplications(); break;
    case 'interview': renderInterview(); break;
    case 'mail': renderMail(); break;
    case 'offers': renderOffers(); break;
    case 'master': renderMaster(); break;
    case 'masterDone': {
      const scene = setScene('석사 졸업', '두 턴의 연구를 마쳤다', `연구 성과 ${state.master.research}. 국내 석사에서 해외 박사로, 또는 다시 취업으로 이어갈 수 있습니다.`);
      addButton(choiceContainer(scene), '취업·박사 지원 살펴보기', '', choose('masterDone', () => { state.phase = 'hub'; }));
      break;
    }
    case 'ending': renderEnding(); break;
  }
}
function resetGame() {
  if (!confirm('현재 진행을 지우고 캐릭터 생성부터 다시 시작할까요?')) return;
  preserveUnreadableSave = false;
  state = freshState();
  commit();
}
$('restart').addEventListener('click', resetGame);
$('slots-button').addEventListener('click', openSlots);
$('life-review-button').addEventListener('click', () => openLifeReview());
$('forty-review-button').addEventListener('click', () => openLifeReview(state.lifeAssessment.forty?.recordId));
$('slots-close').addEventListener('click', () => $('slots-dialog').close());
$('manual-save').addEventListener('click', () => {
  const ok = save(); render(); $('save-status').textContent = ok ? `${slotStore.active + 1}번 슬롯 수동 저장 완료` : '수동 저장 실패. JSON 백업으로 보관해 주세요.';
});
$('slots-export').addEventListener('click', () => {
  if (state.character) save();
  downloadFile(JSON.stringify(slotStore,null,2), '인생-전체-4슬롯.json', 'application/json');
});
$('lifestyle-button').addEventListener('click', () => { if (state.character && state.phase !== 'lifestyle') { openLifestyle(); commit(); } });
$('military-button').addEventListener('click', () => { if (state.character && !MILITARY_PHASES.includes(state.phase)) { openMilitary(); commit(); } });
$('journal-button').addEventListener('click', openJournal);
$('journal-close').addEventListener('click', () => $('journal-dialog').close());
$('journal-download').addEventListener('click', downloadMemoir);
$('save-export').addEventListener('click', () => downloadFile(JSON.stringify(state, null, 2), '이번-학기-저장.json', 'application/json'));
$('save-import').addEventListener('click', () => $('save-file').click());
$('save-file').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (parsed.format === SLOT_CONFIG.format) { importAllSlots(parsed); return; }
    const loaded = migrateSave(parsed);
    if (!validSave(loaded)) throw new Error('잘못된 저장본');
    if (!confirm('현재 진행 대신 선택한 저장 파일을 불러올까요? 현재 자동 저장본은 별도 백업합니다.')) return;
    try {
      localStorage.setItem(`${CONFIG.saveKey}:before-import`, JSON.stringify(state));
    } catch { throw new Error('현재 진행 백업 실패'); }
    const previous = state; preserveUnreadableSave = false; state = loaded; ensureMemoirSnapshot(); updateFortyMilestone();
    if (!save()) { state = previous; throw new Error('가져오기 저장 실패'); }
    render();
  } catch {
    $('save-status').textContent = '저장 파일을 불러오지 못했습니다. 현재 진행과 기존 저장 데이터는 그대로 유지했습니다.';
  } finally { event.target.value = ''; }
});
boot();
