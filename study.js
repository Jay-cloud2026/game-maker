const STUDY_PHASES = ['study', 'studyResult', 'exchange', 'exchangeMail', 'leave', 'leaveReady'];
const labById = id => LABS.find(lab => lab.id === id);
const exchangeById = id => EXCHANGES.find(program => program.id === id);
function initialStudyFields() {
  return { study: {
    returnPhase: 'semester', result: null, labId: null, labs: {}, labChanges: {},
    events: [], papers: [], conferences: [], letters: {}, exams: [], testsUsed: {},
    exchangeApplications: [], exchangePlan: null, exchangeActive: null, exchanges: [],
    contacts: [], leave: null, leaves: [], leaveSequence: 0,
  } };
}
function upgradeStudyState(value) {
  return { ...value, ...initialStudyFields(), version: CONFIG.saveVersion };
}
function validStudyFields(value) {
  const study = value.study;
  return study && Array.isArray(study.events) && Array.isArray(study.exams) &&
    Array.isArray(study.papers) && Array.isArray(study.conferences) && Array.isArray(study.leaves) &&
    Array.isArray(study.exchangeApplications) && Array.isArray(study.exchanges) &&
    Array.isArray(study.contacts) && study.labs && study.letters && study.testsUsed && study.labChanges &&
    (!study.labId || labById(study.labId)) &&
    (!study.exchangePlan || exchangeById(study.exchangePlan.program)) &&
    (!study.exchangeActive || exchangeById(study.exchangeActive.program)) &&
    (!study.leave || (Array.isArray(study.leave.actions) && study.leave.actions.length <= STUDY_CONFIG.leaveActions)) &&
    (!['leave', 'leaveReady'].includes(value.phase) || study.leave) &&
    (value.phase !== 'studyResult' || study.result) &&
    (value.phase !== 'exchangeMail' || study.exchangeApplications.length > 0);
}
function studyPeriod() {
  if (state.postgraduate?.active && !state.postgraduate.active.completed) {
    const d = state.postgraduate.active; return `degree:${d.program}:${d.semester}`;
  }
  return state.study.leave ? `leave:${state.study.leave.id}` :
    state.master && !state.master.completed ? `master:${state.master.program}:${state.master.turn}` : `ug:${state.semester}`;
}
function openStudy(returnPhase) { state.study.returnPhase = returnPhase; state.phase = 'study'; }
function selectedLabRecord() { return state.study.labs[state.study.labId]; }
function labActionEffects(action) {
  const active = action.id === 'lab' || action.id === 'newsLab';
  const lab = active ? labById(state.study.labId) : null;
  return lab ? { ...action, effects: { ...action.effects, energy: action.effects.energy - lab.energyExtra } } : action;
}
function recordLabContribution(amount, text) {
  if (!state.study.labId) return;
  const lab = labById(state.study.labId);
  const record = selectedLabRecord();
  record.contribution = round(record.contribution + amount);
  record.trust = clamp(record.trust + lab.trustGain, 0, 100);
  applyAbilities({ stress: lab.stress });
  changeRelationship('professor', 1, lab.trustGain, text);
}
function onLabAction(action, actualResearch = action.research || 0) {
  if (!state.study.labId || !['lab', 'newsLab'].includes(action.id)) return;
  const lab = labById(state.study.labId);
  const bonus = state.character.abilities.stress >= SOCIAL_CONFIG.strainAt ? lab.bonus / 2 : lab.bonus;
  state.research += bonus;
  recordLabContribution(actualResearch + bonus, `${lab.name}에서 연구 기록을 남겼다.`);
}
function recommendationQuality() {
  const qualities = Object.values(state.study.letters).map(letter => letter.quality);
  return qualities.length ? Math.max(...qualities) : 0;
}
function setStudyResult(text, next = 'study') {
  state.study.result = { text, next };
  state.phase = 'studyResult';
}
function availableStudyAction(effects) {
  if (state.study.returnPhase === 'graduateTerm') {
    return !unavailable(effects) && degreeTerm().paid && degreeTerm().actions.length < 3;
  }
  return !unavailable(effects) &&
    (state.study.returnPhase !== 'semester' || currentTerm().actions.length < 3) &&
    (state.study.returnPhase !== 'master' || (state.master && !state.master.completed && state.master.turn < 2));
}
function spendStudyAction(id, title, effects, research = 0, recommendation = 0) {
  if (state.study.returnPhase === 'graduateTerm') {
    const d = state.postgraduate.active;
    completeDegreeAction({ id, title, energy: effects.energy, money: effects.money, research,
      growth: id, data: id === 'lab-project' ? 2 : 0,
      thesis: id === 'lab-paper' && research >= 3 ? 2 : 0,
      paper: id === 'lab-paper' && research >= 3 ? 1 : 0, conference: id === 'lab-conference' ? 1 : 0 });
    state.recommendations += recommendation;
    return state.phase;
  }
  if (state.study.returnPhase === 'master') {
    completeGraduateTurn({ id, title, effects, research, recommendation, hours: 20, story: title });
    return state.phase;
  }
  applyEffects(effects);
  currentTerm().actions.push(id);
  state.research += research;
  experience(id);
  return 'afterAction';
}
function runResearchActivity(kind) {
  const lab = labById(state.study.labId);
  const record = selectedLabRecord();
  const settings = STUDY_CONFIG[kind];
  const funded = kind === 'conference' && state.flags.conferenceFund;
  const effects = { money: funded ? 0 : settings.money, energy: settings.energy - lab.energyExtra };
  if (!availableStudyAction(graduateAdjustedEffects(effects)) || record.budget < (settings.budget || 0)) return;
  if (settings.minimumContribution && record.contribution < settings.minimumContribution) return;
  const key = `${studyPeriod()}:${kind}`;
  if (state.study.events.some(event => event.key === key)) return;
  let research = settings.research || 0;
  let draw = null, success = true;
  if (kind !== 'conference') {
    draw = Math.random();
    const probability = researchChance(settings.probability);
    success = draw < probability;
    research = kind === 'project' ? (success ? settings.researchSuccess : settings.researchFailure) : success ? 3 : 1;
  }
  record.budget -= settings.budget || 0;
  if (funded) state.flags.conferenceFund = false;
  const title = kind === 'project' ? '연구 프로젝트' : kind === 'paper' ? '논문 공동 저자 참여' : '학회 발표';
  const next = spendStudyAction(`lab-${kind}`, title, effects, research);
  recordLabContribution(research, `${title}에서 ${success ? '결과를 공유했다' : '재현 실패와 개선점을 정리했다'}.`);
  const event = { key, kind, lab: lab.id, year: state.life.year, draw, success, research };
  state.study.events.push(event);
  if (kind === 'paper' && success) state.study.papers.push(event);
  if (kind === 'conference') state.study.conferences.push(event);
  const text = `${lab.name} ${title}: ${success ? '성과를 남겼다' : '재현·심사에 실패했지만 한계를 기록했다'}. 연구 +${research}, 남은 연구비 ${record.budget}만원.`;
  log(text); setStudyResult(text, next);
}
function graduateAdjustedEffects(effects) {
  if (state.study.returnPhase !== 'master') return effects;
  const program = programById(state.master.program);
  return { ...effects, money: (effects.money || 0) + program.stipend - program.tuition };
}
function bestLanguageScore(value = state) { return Math.max(0, ...value.study.exams.map(exam => exam.normalized)); }
function renderStudy() {
  const graduate = ['master','graduateTerm'].includes(state.study.returnPhase);
  const scene = setScene(graduate ? '대학원 연구·학습' : '학부 연구·국제 경험', '다음 질문을 찾아서',
    `연구·어학 공부는 ${graduate ? '대학원 주요 행동 1회' : '주요 행동 1회'}를 사용합니다. 연구실 선택·추천서 요청·시험 접수는 행동을 쓰지 않으며 횟수·비용 제한이 있습니다.`);
  for (const lab of LABS) {
    const selected = state.study.labId === lab.id;
    const choices = choiceContainer(scene);
    addButton(choices, `${lab.name} ${selected ? '선택됨' : '선택'}`,
      `${lab.professor} · ${lab.style} · ${lab.topic} · ${lab.atmosphere} · 주 ${lab.hours}시간 · 초기 연구비 ${lab.budget}만원 · 연구 보너스 ${lab.bonus} · 추가 체력 소모 ${lab.energyExtra}`,
      choose('study', () => {
        if (state.study.labChanges[studyPeriod()]) return;
        state.study.labId = lab.id;
        state.study.labs[lab.id] ||= { budget: lab.budget, contribution: 0, trust: 20 };
        state.study.labChanges[studyPeriod()] = true;
        log(`${lab.name}의 ${lab.professor}를 지도교수로 선택했다. 주 ${lab.hours}시간의 연구 스타일을 고려한다.`);
      }), selected || state.study.labChanges[studyPeriod()]);
  }
  if (state.study.labId) {
    const lab = labById(state.study.labId), record = selectedLabRecord();
    scene.append(element('p', `현재 ${lab.name}: 연구비 ${record.budget}, 기여 ${record.contribution}, 신뢰 ${record.trust}. 연구실은 학부 행동과 석사 연구에 영향을 줍니다.`));
    const choices = choiceContainer(scene);
    for (const [kind, title] of [['project', '연구 프로젝트 진행'], ['conference', '학회 발표 참여'], ['paper', '논문 공동 저자 도전']]) {
      const config = STUDY_CONFIG[kind];
      const effects = graduateAdjustedEffects({ money: kind === 'conference' && state.flags.conferenceFund ? 0 : config.money, energy: config.energy - lab.energyExtra });
      const used = state.study.events.some(event => event.key === `${studyPeriod()}:${kind}`);
      const prerequisite = config.minimumContribution && record.contribution < config.minimumContribution;
      addButton(choices, title, `${graduate ? '석사 1턴' : '주요 행동 1회'} · ${effectsText(effects)} · 연구비 ${config.budget || 0}만원${prerequisite ? ' · 연구 기여 부족' : ''}${used ? ' · 이번 기간 완료' : ''}`,
        choose('study', () => runResearchActivity(kind)), used || prerequisite || record.budget < (config.budget || 0) || !availableStudyAction(effects));
    }
    const letter = state.study.letters[lab.id];
    const quality = round(clamp(record.contribution * 10 + record.trust * .4 + state.study.papers.length * 10, 0, 100));
    const qualifies = record.contribution >= STUDY_CONFIG.recommendation.minimumContribution && record.trust >= STUDY_CONFIG.recommendation.minimumTrust;
    addButton(choices, '지도교수 추천서 요청', `행동 소모 없음 · 기여 ${STUDY_CONFIG.recommendation.minimumContribution}, 신뢰 ${STUDY_CONFIG.recommendation.minimumTrust} 필요 · ${letter ? `현재 품질 ${letter.quality}` : '실제 기여와 신뢰로 품질 결정'}`,
      choose('study', () => {
        if (!qualifies || (letter && quality <= letter.quality)) return;
        if (!letter) state.recommendations++;
        state.study.letters[lab.id] = { quality, year: state.life.year, contribution: record.contribution, trust: record.trust };
        log(`${lab.professor} 추천서를 받았다. 품질 ${quality}, 실제 기여 ${record.contribution}와 신뢰 ${record.trust} 반영.`);
      }), !qualifies || (letter && quality <= letter.quality));
  }
  scene.append(element('h3', '어학 공부와 시험'));
  const language = STUDY_CONFIG.languageStudy;
  const languageEffects = graduateAdjustedEffects({ money: language.money, energy: language.energy });
  const languageChoices = choiceContainer(scene);
  addButton(languageChoices, '어학 공부', `${graduate ? '석사 1턴' : '주요 행동 1회'} · ${effectsText(languageEffects)} · 외국어 능력 +${language.gain}`,
    choose('study', () => {
      if (!availableStudyAction(languageEffects)) return;
      const next = spendStudyAction('language', '어학 공부', language, 0);
      applyAbilities({ language: language.gain, stress: 3 });
      log('어학 공부로 외국어 능력을 키웠다. 시험 성적은 응시 시 변동을 반영한다.');
      setStudyResult('외국어 능력이 상승했다. 교환학생과 해외 면접의 준비가 쌓인다.', next);
    }), !availableStudyAction(languageEffects));
  for (const test of LANGUAGE_TESTS) {
    const key = `${studyPeriod()}:${test.id}`;
    addButton(languageChoices, `${test.id} 응시`, `주요 행동 소모 없음 · ${test.fee}만원 · 기간당 1회 · 점수는 즉시 저장`,
      choose('study', () => {
        if (state.study.testsUsed[key] || state.money < test.fee) return;
        state.money -= test.fee;
        const normalized = clamp(state.character.abilities.language + randomBetween(-10, 10), 1, 100);
        const score = round(clamp(Math.round(normalized / 100 * test.max / test.step) * test.step, 0, test.max));
        const exam = { type: test.id, score, normalized: score / test.max * 100, year: state.life.year, period: studyPeriod() };
        state.study.exams.push(exam); state.study.testsUsed[key] = true;
        log(`${test.id} ${score}점. 응시료 ${test.fee}만원을 지불했고 결과를 보관했다.`);
        setStudyResult(`${test.id} 결과: ${score} / ${test.max}점. 같은 기간에는 다시 응시할 수 없다.`);
      }), state.study.testsUsed[key] || state.money < test.fee);
  }
  addButton(choiceContainer(scene), '진행으로 돌아가기', '', choose('study', () => { state.phase = state.study.returnPhase; }), false, true);
}
function renderStudyResult() {
  const result = state.study.result;
  const scene = setScene('활동 결과', '하나의 경험이 남았다', result.text);
  addButton(choiceContainer(scene), '활동 결과 확인', '결과와 비용은 이미 반영되어 다시 열어도 중복 적용되지 않습니다.', choose('studyResult', () => {
    state.study.result = null;
    if (result.next === 'afterAction') afterAction(); else state.phase = result.next;
  }), false, true);
}
function currentExchangePlan() {
  const plan = state.study.exchangePlan;
  return plan && plan.targetSemester === state.semester ? plan : null;
}
function renderExchange() {
  const scene = setScene('2학년 이후 · 다음 학기 파견', '교환학생에 지원하기',
    '3~6학기에 지원하여 다음 학기 한 학기를 해외에서 보냅니다. 지원 준비는 주요 행동 1회, 접수비는 4만원입니다. 국내 학점과 중복되지 않는 인정 성적표를 받습니다.');
  const already = state.study.exchangeApplications.some(app => app.semester === state.semester);
  for (const program of EXCHANGES) {
    const reason = state.semester < 3 || state.semester > 6 ? '지원 가능 학기 아님' : cumulativeGpa() < STUDY_CONFIG.exchange.minimumGpa ? '공개 누적 학점 미달' :
      bestLanguageScore() < program.minimumLanguage ? '어학 시험 점수 미달' : state.study.exchangePlan ? '이미 수락한 파견 있음' : '';
    addButton(choiceContainer(scene), `${program.country} 교환학생 지원`,
      `${program.school} · 학점 ${STUDY_CONFIG.exchange.minimumGpa} 이상 · 환산 어학 ${program.minimumLanguage} 이상 · 다음 학기 주거비 ${program.housing}, 이동 ${program.travel}만원 · 국제 교류 장학금 ${program.grant}만원${reason ? ` · ${reason}` : ''}`,
      choose('exchange', () => {
        if (reason || already || currentTerm().actions.length >= 3 || state.money < STUDY_CONFIG.exchange.applicationFee) return;
        state.money -= STUDY_CONFIG.exchange.applicationFee;
        currentTerm().actions.push('exchangeApplication');
        const draw = Math.random();
        const scholarshipDraw = Math.random();
        const eligible = cumulativeGpa() >= STUDY_CONFIG.exchange.scholarshipGpa && bestLanguageScore() >= STUDY_CONFIG.exchange.scholarshipLanguage;
        state.study.exchangeApplications.push({
          program: program.id, semester: state.semester, targetSemester: state.semester + 1,
          accepted: draw < STUDY_CONFIG.exchange.probability, draw, scholarshipDraw,
          grant: eligible && scholarshipDraw < STUDY_CONFIG.exchange.scholarshipProbability ? program.grant : 0,
          opened: false, decided: false,
        });
        state.phase = 'exchangeMail'; log(`${program.country} 교환학생에 지원했다. 주요 행동 1회와 접수비를 사용했다.`);
      }), already || reason || state.money < STUDY_CONFIG.exchange.applicationFee || currentTerm().actions.length >= 3);
  }
  addButton(choiceContainer(scene), '학기로 돌아가기', '', choose('exchange', () => { state.phase = 'semester'; }));
}
function renderExchangeMail() {
  const app = state.study.exchangeApplications.at(-1);
  const program = exchangeById(app.program);
  const scene = setScene('교환학생 결과', program.school, app.opened ?
    `${app.accepted ? '선발' : '미선발'} · 국제 교류 장학금 ${app.accepted ? app.grant : 0}만원. 파견 시 등록금·해외 주거비·이동비를 한 번 정산합니다.` : '선발과 장학금 결과는 지원할 때 확정되었으며 메일에서 공개됩니다.');
  const choices = choiceContainer(scene);
  if (!app.opened) addButton(choices, '교환학생 결과 메일 열기', '', choose('exchangeMail', () => { app.opened = true; }));
  else {
    if (app.accepted) addButton(choices, '교환 제안 수락', '다음 학기 해외 생활과 장거리 관계 선택으로 연결됩니다.', choose('exchangeMail', () => {
      if (app.decided) return;
      app.decided = true; state.study.exchangePlan = { program: program.id, targetSemester: app.targetSemester, grant: app.grant };
      log(`${program.country} 교환 제안을 수락했다. 다음 학기에 파견된다.`); afterAction();
    }));
    addButton(choices, app.accepted ? '교환 제안 거절' : '학기 계속하기', '', choose('exchangeMail', () => {
      if (app.decided) return; app.decided = true; log(`${program.country} 교환 결과를 확인하고 현재 학업을 이어간다.`); afterAction();
    }));
  }
}
function startExchangeIfPlanned() {
  const plan = currentExchangePlan();
  if (!plan || state.study.exchangeActive) return;
  state.study.exchangeActive = { ...plan, startedYear: state.life.year };
  log(`${exchangeById(plan.program).country} 교환학생 생활을 시작했다. 이번 학기 성적은 교환 인정 과목으로 보관한다.`);
  openLongDistance({ ...exchangeById(plan.program), context: '교환학생 파견' });
}
function completeExchangeIfActive() {
  const active = state.study.exchangeActive;
  if (!active || active.targetSemester !== state.semester) return;
  const program = exchangeById(active.program);
  state.study.exchanges.push({ ...active, completedYear: state.life.year });
  state.study.contacts.push({ name: program.contact, country: program.country, year: state.life.year });
  applyAbilities({ language: 15, sociability: 5, happiness: 5 });
  recordGrowth('exchange', `exchange:${state.semester}`);
  experience('exchange'); changeRelationship('peer', 4, 4, '해외 생활에서 배운 것을 공유했다.');
  if (schoolPolicy().internationalSeminar) state.academic.internationalSeminar = true;
  state.study.exchangeActive = null; state.study.exchangePlan = null;
  if (state.social.romance?.longDistance) {
    state.social.romance.longDistance = false; romanceRecord('교환학생을 마치고 돌아와 장거리 기간을 마무리했다.');
  }
  log(`${program.country} 교환학생을 마쳤다. 외국어 능력·국제 경험·현지 동료와의 관계가 남았다.`);
}
function startLeave(returnPhase) {
  if (state.study.leave) return;
  state.study.leaveSequence++;
  state.study.leave = { id: state.study.leaveSequence, actions: [], returnPhase, startedYear: state.life.year };
  releaseHousing('휴학'); state.campus.housing.type = 'home';
  advanceTime(2, `leave:${state.study.leave.id}`);
  state.phase = 'leave';
  log(`1년 휴학을 선택했다. ${characterAge()}세, 학기와 학년은 유지하고 별도 활동 3회를 보낸다.`);
}
function renderLeave() {
  const leave = state.study.leave;
  const scene = setScene('휴학 중 · 학부 행동과 별도', `${semesterName()} 복학을 준비하는 시간`,
    `남은 휴학 활동 ${STUDY_CONFIG.leaveActions - leave.actions.length}회. 등록금은 새로 청구하지 않으며 임대 보증금은 퇴거 시 반환했습니다.`);
  const choices = choiceContainer(scene);
  for (const action of LEAVE_ACTIONS) {
    const reason = action.requiresResearch && state.research < action.requiresResearch ? '인턴에 필요한 연구 경험 부족' : unavailable(action.effects);
    addButton(choices, action.title, `${effectsText(action.effects)} · ${abilityEffectsText(action.abilities)}${reason ? ` · ${reason}` : ''}`, choose('leave', () => {
      if (reason || leave.actions.length >= STUDY_CONFIG.leaveActions) return;
      applyEffects(action.effects); applyAbilities(action.abilities);
      state.research += action.research || 0; state.practice += action.practice || 0;
      if (action.id === 'intern') experience('internship');
      changeRelationship(action.id === 'work' ? 'coworker' : 'peer', 3, 3, `휴학 중 ${action.title}의 경험을 나눴다.`);
      leave.actions.push(action.id);
      recordGrowth({ work: 'cafe', intern: 'internship', project: 'club' }[action.id] || action.id,
        `leave:${leave.id}:${leave.actions.length}`);
      log(`${action.title}: ${effectsText(action.effects)}. 휴학 중에도 자금과 관계가 변했다.`);
      if (leave.actions.length >= STUDY_CONFIG.leaveActions) state.phase = 'leaveReady';
    }), reason);
  }
}
function renderLeaveReady() {
  const scene = setScene('복학', '나의 속도로 다시 캠퍼스에',
    `${semesterName()}부터 이어갑니다. 이전 성적과 경험은 유지되고, 휴학의 1년은 나이와 연도에 이미 한 번 반영되었습니다.`);
  addButton(choiceContainer(scene), '복학하기', '학기를 다시 시작하거나 진행하던 방학 결과로 돌아갑니다.', choose('leaveReady', () => {
    const leave = state.study.leave; state.study.leaves.push(leave); state.study.leave = null;
    state.phase = leave.returnPhase; log('휴학 활동을 마치고 복학했다. 기존 학기 기록부터 이어간다.');
  }), false, true);
}
function studyEvidence() {
  const evidence = [];
  if (state.study.papers.length) evidence.push({ id: 'paper', title: '논문 공동 저자 경험', text: `공동 저자 논문 ${state.study.papers.length}편과 재현성 검토 과정`, score: 90 });
  if (state.study.conferences.length) evidence.push({ id: 'conference', title: '학회 발표 경험', text: `학회 ${state.study.conferences.length}회 발표에서 질문에 답한 경험`, score: 85 });
  if (state.study.exchanges.length) evidence.push({ id: 'exchange', title: '교환학생 국제 협업', text: `${state.study.exchanges.map(item => exchangeById(item.program).country).join(', ')} 교환학생과 현지 동료의 협업 경험`, score: 88 });
  return evidence;
}
function renderStudySidebar() {
  const admitted = state.life.admissionYear !== null;
  $('study-menu').hidden = !admitted; $('study-records').replaceChildren();
  if (!admitted) return;
  list($('study-records'), [
    `지도 연구실: ${labById(state.study.labId)?.name || '선택 전'} · 추천서 최고 품질 ${recommendationQuality()}`,
    `논문 ${state.study.papers.length} · 학회 ${state.study.conferences.length} · 교환 ${state.study.exchanges.length}회`,
    ...state.study.exams.map(exam => `${exam.year}년 ${exam.type} ${exam.score}점`),
    ...state.study.contacts.map(contact => `${contact.country}: ${contact.name}`),
    ...state.study.leaves.map(leave => `${leave.startedYear}년 휴학: ${leave.actions.join(', ')}`),
  ]);
  if (state.study.exchangeActive) $('stage').textContent = `${semesterName()} 교환학생`;
  if (['leave', 'leaveReady'].includes(state.phase)) $('stage').textContent = `${semesterName()} 휴학`;
}
