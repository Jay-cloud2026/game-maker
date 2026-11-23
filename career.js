const CAREER_PHASES = ['jobBoard', 'jobDocuments', 'jobInterview', 'jobResults', 'jobDecision', 'employmentDecision', 'workTurn', 'workEvent', 'venture'];
const companyById = id => COMPANIES.find(company => company.id === id);
function initialCareerFields() {
  return { career: {
    round: 0, selected: [], applications: [], hiringHistory: [], employer: null, salary: 0,
    years: 0, companyYears: 0, performance: 0, satisfaction: 60, employmentHistory: [],
    workHistory: [], pendingEvent: null, events: [], trainingTurns: 0, venture: null,
    ventures: [], campusSeen: [], campusRolls: {}, legacy: false,
  } };
}
function upgradeCareerState(value) {
  const addition = initialCareerFields();
  addition.career.legacy = ['job', 'jobNext'].includes(value.phase);
  addition.career.years = value.jobTurns;
  return { ...value, ...addition, version: CONFIG.saveVersion };
}
function validEmploymentContract(contract) {
  return contract && typeof contract.company === 'string' && typeof contract.role === 'string' &&
    Number.isFinite(contract.salary) && Number.isFinite(contract.age) && Number.isInteger(contract.startYear) &&
    typeof contract.education === 'string' && Number.isFinite(contract.gpa) &&
    Number.isFinite(contract.internships) && typeof contract.story === 'string' &&
    Array.isArray(contract.projects) && contract.projects.every(project => typeof project.text === 'string');
}
function validCareerFields(value) {
  const career = value.career;
  return career && Array.isArray(career.selected) && Array.isArray(career.applications) &&
    Array.isArray(career.hiringHistory) && Array.isArray(career.workHistory) && Array.isArray(career.events) &&
    Array.isArray(career.employmentHistory) && Array.isArray(career.ventures) && Array.isArray(career.campusSeen) &&
    career.campusRolls && Number.isFinite(career.years) && Number.isFinite(career.salary) &&
    (!career.employer || companyById(career.employer)) &&
    career.applications.every(app => companyById(app.id) && (!app.hiringSnapshot || (
      app.hiringSnapshot.inputs && Object.values(app.hiringSnapshot.inputs).every(Number.isFinite) &&
      app.hiringSnapshot.weights && Object.values(app.hiringSnapshot.weights).every(Number.isFinite) &&
      ['floor', 'ceiling', 'referral', 'salary'].every(key => Number.isFinite(app.hiringSnapshot[key])) &&
      Object.entries(app.hiringSnapshot.weights).filter(([key]) => key !== 'interview').reduce((sum, [, weight]) => sum + weight, 0) > 0 &&
      Number.isFinite(app.hiringSnapshot.threshold) && app.hiringSnapshot.scale > 0 &&
      Array.isArray(app.hiringSnapshot.evidenceOptions) &&
      app.hiringSnapshot.evidenceOptions.every(evidence => Number.isFinite(evidence.score) && typeof evidence.text === 'string')))) &&
    career.employmentHistory.every(record => !record.contract || validEmploymentContract(record.contract)) &&
    (!['workTurn', 'employmentDecision'].includes(value.phase) || career.employer) &&
    (value.phase !== 'employmentDecision' || career.employmentHistory.at(-1)?.contract) &&
    (value.phase !== 'workEvent' || career.pendingEvent) &&
    (value.phase !== 'venture' || career.venture);
}
function hasBachelor() { return state.life.graduationYear !== null || Boolean(state.master); }
function startHiring() {
  state.career.round++; state.career.selected = []; state.career.applications = [];
  advanceTime(CAREER_CONFIG.hiringHalves, `hiring:${state.career.round}`);
  state.phase = 'jobBoard';
  log(`채용 ${state.career.round}회차를 준비한다. 반년의 준비 기간을 보냈다.`);
}
function jobInputs(interview = 0) {
  return {
    gpa: cumulativeGpa() / 4.5 * 100,
    practice: clamp((state.practice * 10 + (state.experiences.club || 0) * 8 + (state.academic.project ? 15 : 0)) * .75 +
      (state.development?.skills.practice || 0) * .25, 0, 100),
    research: clamp((state.research * 10 + state.study.papers.length * 10) * .75 +
      (state.development?.skills.research || 0) * .25, 0, 100),
    interview,
  };
}
function referralBonus() {
  return state.social.npcs.peer?.trust >= 50 || state.social.npcs.senior?.trust >= 45 || state.flags.festivalNetwork ? CAREER_CONFIG.referralBonus : 0;
}
function jobScore(company, interview = null) {
  const inputs = jobInputs(interview || 0);
  const weights = Object.entries(company.weights).filter(([key]) => interview !== null || key !== 'interview');
  const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
  return round(weights.reduce((sum, [key, weight]) => sum + inputs[key] * weight, 0) / total + referralBonus() + careerRecognition(company).scoreBonus);
}
function hiringProbability(score, threshold) { return clamp(1 / (1 + Math.exp(-(score - threshold) / 12)), .05, .95); }
function hiringEligibility(company) {
  const p = company.hiring, reasons = [];
   const degree = completedDegreeLevel();
  if (degree < p.degree) reasons.push(p.degree === 2 ? '석사 학위 필요' : '학사 학위 필요');
  if (cumulativeGpa() < p.gpa) reasons.push(`GPA ${p.gpa} 이상 필요`);
  if (state.practice < p.practice) reasons.push(`실무 경험 ${p.practice} 이상 필요`);
  if (state.research < p.research) reasons.push(`연구 경험 ${p.research} 이상 필요`);
  return reasons;
}
function hiringSnapshot(company) {
  const recognition = careerRecognition(company);
  const npcSupport = npcJobSupport(company);
  return {
    inputs: jobInputs(), weights: { ...company.weights }, referral: referralBonus() + (npcSupport?.bonus || 0), npcSupport,
    threshold: company.hiring.difficulty + difficultyConfig().competition,
    scale: HIRING_CONFIG.scale, floor: HIRING_CONFIG.minProbability, ceiling: HIRING_CONFIG.maxProbability,
    evidenceOptions: careerEvidence().map(item => ({ ...item, score: actualInterviewScore(item.score) })),
    salary: recognition.salary, role: recognition.role, recognition, company: company.name,
    education: ['고등학교 졸업','학사','석사','박사'][recognition.level], gpa: cumulativeGpa(),
    projects: careerEvidence().filter(item => ['club', 'competition', 'capstone', 'industry', 'referral', 'paper'].includes(item.id)),
    internships: state.experiences.internship || 0,
  };
}
function snapshotJobScore(snapshot, interview = null) {
  const inputs = { ...snapshot.inputs, interview: interview || 0 };
  const entries = Object.entries(snapshot.weights).filter(([key]) => interview !== null || key !== 'interview');
  return round(entries.reduce((sum, [key, weight]) => sum + inputs[key] * weight, 0) /
     entries.reduce((sum, [, weight]) => sum + weight, 0) + snapshot.referral + (snapshot.recognition?.scoreBonus || 0));
}
function snapshotHiringProbability(score, snapshot) {
  return clamp(1 / (1 + Math.exp(-(score - snapshot.threshold) / snapshot.scale)), snapshot.floor, snapshot.ceiling);
}
function renderJobBoard() {
  const scene = setScene(`채용 ${state.career.round}회차 · 1단계`, '채용 공고와 지원서',
    `최대 ${CAREER_CONFIG.maxApplications}곳에 지원합니다. 나이와 대학 이름은 평가에 직접 반영하지 않고 실제 경험과 면접을 봅니다.`);
  for (const company of COMPANIES) {
    const selected = state.career.selected.includes(company.id);
    const reason = hiringEligibility(company).join(' · ');
    const recognition = careerRecognition(company);
    const npcSupport = npcJobSupport(company);
    const card = element('div', undefined, 'opportunity'); scene.append(card);
    addButton(card, `${company.name} ${selected ? '선택 취소' : '지원 선택'}`,
      `${npcSupport ? '선배 추천 공고 · ' : ''}${recognition.role} · 예상 제안 연봉 ${recognition.salary}만원 · ${reason || '지원 가능 (합격 보장 아님)'}`,
      choose('jobBoard', () => {
        if (selected) state.career.selected = state.career.selected.filter(id => id !== company.id);
        else if (!reason && state.career.selected.length < CAREER_CONFIG.maxApplications) state.career.selected.push(company.id);
      }), (!selected && reason) || (!selected && state.career.selected.length >= CAREER_CONFIG.maxApplications));
    const details = element('details'); details.append(element('summary', '조건·근무환경 상세'),
      element('p', `${company.type} · ${company.hiring.industry} · 학위 ${['제한 없음', '학사 이상', '석사 이상'][company.hiring.degree]} · 최소 GPA ${company.hiring.gpa}, 실무 ${company.hiring.practice}, 연구 ${company.hiring.research} · 연간 생활비 ${company.living}만원 · ${company.benefits} · 워라밸 ${company.balance}`));
    card.append(details);
    list(details, recognitionReasons(recognition));
  }
  const choices = choiceContainer(scene);
  addButton(choices, '지원서 제출', `${state.career.selected.length}곳 · 접수비 없음 · 서류 결과는 지금 확정하여 저장`, choose('jobBoard', () => {
    if (!state.career.selected.length) return;
    state.career.applications = state.career.selected.map(id => {
      const company = companyById(id), snapshot = hiringSnapshot(company), missing = hiringEligibility(company);
      const score = snapshotJobScore(snapshot), probability = missing.length ? 0 : snapshotHiringProbability(score, snapshot);
      const draw = missing.length ? null : Math.random();
      return { id, documentScore: score, documentProbability: probability, documentDraw: draw,
        hiringSnapshot: snapshot, missing, documentPassed: !missing.length && draw < probability,
        documentOpened: false, interviewed: false, accepted: null, opened: false };
    });
    if (state.social.outreach?.job && state.career.applications.some(app => app.hiringSnapshot.npcSupport)) state.social.outreach.job.used = true;
    state.phase = 'jobDocuments'; log('지원서를 제출했다. 서류 결과는 각 공고에서 확인한다.');
  }), !state.career.selected.length, true);
  addButton(choices, '직무 준비 프로젝트', '반년 경과 · 지원금 +50만원 · 실무 경험 +2 · 다음 서류 평가에 반영',
    choose('jobBoard', () => {
      state.career.trainingTurns++;
      advanceTime(CAREER_CONFIG.training.halves, `jobTraining:${state.career.trainingTurns}`);
      state.money += CAREER_CONFIG.training.money; state.practice += CAREER_CONFIG.training.practice;
      experience('jobTraining');
      recordGrowth('jobTraining', `jobTraining:${state.career.trainingTurns}`);
      log('직무 준비 프로젝트로 결과물과 실무 경험을 보완했다.');
    }));
  addButton(choices, '채용 준비에서 돌아가기', '기존 직장이 있으면 계속 근무할 수 있습니다.',
    choose('jobBoard', () => { state.phase = state.career.employer ? 'jobNext' : hasBachelor() ? 'hub' : 'jobBoard'; }));
}
function renderJobDocuments() {
  const scene = setScene('2단계 · 서류 결과', '지원서에 담긴 경험', '서류 결과를 모두 확인한 뒤 통과한 기업의 면접으로 진행합니다.');
  const choices = choiceContainer(scene);
  for (const app of state.career.applications) {
    const company = companyById(app.id);
    if (app.documentOpened) scene.append(element('p', `${company.name}: ${app.documentPassed ? '서류 통과' : '서류 불합격'}`));
    else addButton(choices, `${company.name} 서류 결과 확인`, '', choose('jobDocuments', () => {
      app.documentOpened = true; log(`${company.name} 서류 ${app.documentPassed ? '통과' : '불합격'}.`);
    }));
  }
  const ready = state.career.applications.every(app => app.documentOpened);
  const passed = state.career.applications.some(app => app.documentPassed);
  addButton(choices, passed ? '기업 면접으로' : '지원 결과 정리', '', choose('jobDocuments', () => {
    if (!ready) return;
    state.phase = passed ? 'jobInterview' : 'jobDecision';
    if (!passed) archiveHiring();
  }), !ready, true);
}
function renderJobInterview() {
  const app = state.career.applications.find(app => app.documentPassed && !app.interviewed);
  const company = companyById(app.id);
  const scene = setScene('3단계 · 기업 면접', `${company.name} · ${company.role}`, '실제 경험을 하나 골라 구체적으로 설명합니다. NPC의 소개와 프로젝트 기록도 반영합니다.');
  for (const evidence of app.hiringSnapshot?.evidenceOptions || careerEvidence()) addButton(choiceContainer(scene), evidence.title, evidence.text,
    choose('jobInterview', () => {
      const score = app.hiringSnapshot ? snapshotJobScore(app.hiringSnapshot, evidence.score) :
        jobScore(company, actualInterviewScore(evidence.score));
      const probability = app.hiringSnapshot ? snapshotHiringProbability(score, app.hiringSnapshot) : hiringProbability(score, company.threshold);
      const draw = Math.random();
      Object.assign(app, { interviewed: true, score, probability, draw, accepted: draw < probability, evidence: evidence.text });
      log(`${company.name} 면접: ${evidence.text}.`);
      if (!state.career.applications.some(app => app.documentPassed && !app.interviewed)) state.phase = 'jobResults';
    }));
}
function archiveHiring() {
  if (state.career.hiringHistory.some(round => round.round === state.career.round)) return;
  state.career.hiringHistory.push({ round: state.career.round, year: state.life.year,
    applications: JSON.parse(JSON.stringify(state.career.applications)) });
}
function renderJobResults() {
  const scene = setScene('4단계 · 최종 합격 발표', '기업에서 온 결과 메일', '면접에서 확정 저장한 결과를 한 곳씩 공개합니다.');
  const choices = choiceContainer(scene);
  for (const app of state.career.applications.filter(app => app.interviewed)) {
    const company = companyById(app.id);
    if (app.opened) scene.append(element('p', `${company.name}: ${app.accepted ? '최종 합격' : '최종 불합격'}`));
    else addButton(choices, `${company.name} 최종 메일 열기`, '', choose('jobResults', () => {
      app.opened = true; log(`${company.name} 최종 ${app.accepted ? '합격' : '불합격'}.`);
    }));
  }
  const ready = state.career.applications.filter(app => app.interviewed).every(app => app.opened);
  addButton(choices, '입사 제안 비교', '', choose('jobResults', () => {
    if (!ready) return; archiveHiring(); state.phase = 'jobDecision';
  }), !ready, true);
}
function renderJobDecision() {
  const accepted = state.career.applications.filter(app => app.accepted);
  const scene = setScene('5단계 · 입사 결정', accepted.length ? '어떤 환경에서 일할까?' : '다음 기회를 준비하자',
    '불합격하거나 제안을 거절해도 준비 프로젝트·재지원·대학원 지원을 계속할 수 있습니다.');
  for (const app of accepted) {
    const company = companyById(app.id);
    const salary = app.hiringSnapshot?.salary ?? company.salary;
    const card = element('div', undefined, 'result-card'); scene.append(card);
    card.append(element('h3', `${company.name} · 연봉 ${salary}만원`));
    list(card, recognitionReasons(app.hiringSnapshot?.recognition));
    addButton(card, `${company.name} 입사`, `${company.type} · ${app.hiringSnapshot?.role || company.role} · 연봉 ${salary}, 생활비 ${company.living}만원 · ${company.benefits} · 워라밸 ${company.balance}`,
      choose('jobDecision', () => {
        if (state.career.employer) endEmployment('이직');
        state.career.employer = company.id; state.career.salary = salary;
        state.career.companyYears = 0; state.career.legacy = false;
         const contract = {
          ...(app.hiringSnapshot || { ...hiringSnapshot(company), recognition: null, npcSupport: null }),
          salary, role: app.hiringSnapshot?.role || company.role, age: characterAge(), startYear: state.life.year,
          story: app.evidence || '기존 채용 결과에 따라 입사 제안을 수락했다.',
        };
        state.career.employmentHistory.push({ company: company.id, role: contract.role, startYear: state.life.year, endYear: null, contract });
        state.phase = 'employmentDecision'; log(`${company.name} ${company.role}로 입사했다. 계약 연봉 ${salary}만원. 취업 엔딩 또는 계속 근무를 선택한다.`);
      }));
  }
  const choices = choiceContainer(scene);
  addButton(choices, '다음 채용에 다시 지원', '다음 회차 반년의 준비 기간', choose('jobDecision', startHiring));
  if (hasBachelor()) addButton(choices, '진로 화면으로 돌아가기', '', choose('jobDecision', () => { state.phase = state.career.employer ? 'jobNext' : 'hub'; }));
}
function renderEmploymentDecision() {
  const record = state.career.employmentHistory.at(-1), contract = record.contract;
  const scene = setScene('정상 진로 달성 · 취업 성공', `${contract.company} 입사`,
    `${contract.role} · 계약 연봉 ${contract.salary}만원 · 입사 ${contract.age}세 · 최종 학력 ${contract.education} · 대학 GPA ${contract.gpa.toFixed(2)} / 4.50`);
  scene.append(element('p', `면접에서 연결한 경험: ${contract.story}`));
  list(scene, recognitionReasons(contract.recognition));
  if (contract.npcSupport) scene.append(element('p', `${contract.npcSupport.source}: 실제 서류·면접 평가 +${contract.npcSupport.bonus}점 반영`));
  addButton(choiceContainer(scene), '취업 엔딩으로 마무리', '급여나 경력을 미리 지급하지 않고 현재의 성취와 전체 인생을 기록합니다.',
    choose('employmentDecision', () => {
      state.ending = `${contract.company} 취업`;
      state.reflection.profession = contract.role; state.reflection.snapshot = null;
      state.phase = 'ending'; log(`${contract.company} ${contract.role} 취업을 정상 엔딩으로 기록했다.`);
    }), false, true);
  addButton(choiceContainer(scene), '직장 생활 계속 진행', '1년 단위 업무·급여·승진·이직·대학원 재지원을 이어갑니다.',
    choose('employmentDecision', () => { state.phase = 'workTurn'; }));
}
function endEmployment(reason) {
  const record = state.career.employmentHistory.at(-1);
  if (record && record.endYear === null) { record.endYear = state.life.year; record.reason = reason; }
  if (state.career.employer) log(`${companyById(state.career.employer).name}에서 ${reason}했다.`);
  state.career.employer = null;
}
function renderWorkTurn() {
  const company = companyById(state.career.employer);
  const scene = setScene('6단계 · 직장 생활 1년', `${company.name} · ${currentCareerRole()} ${state.career.companyYears + 1}년차`,
    `연봉 ${state.career.salary} − 생활비 ${company.living} = 가용 급여 ${state.career.salary - company.living}만원. 학자금은 가용 급여의 ${CAMPUS_CONFIG.loan.repaymentRate * 100}% 범위에서 상환합니다.`);
  const choices = choiceContainer(scene);
  for (const action of WORK_ACTIONS) {
    const reason = action.minimumResearch && state.research < action.minimumResearch ? '연구 경험 부족' : '';
    addButton(choices, action.title, `1년 · 실무 +${action.practice}, 업무 성과 +${action.performance}, 스트레스 ${action.stress} · ${company.benefits}${reason ? ` · ${reason}` : ''}`,
      choose('workTurn', () => {
        if (reason) return;
         const paidSalary = state.career.salary;
         const bonus = Math.floor(paidSalary * (action.bonus || 0));
        const available = state.career.salary - company.living + bonus;
        state.money += available; state.practice += action.practice; state.research += action.research || 0;
        state.jobTurns++; state.career.years++; state.career.companyYears++;
        if (action.id === 'research') consumeNPCResearchSupport('research', `work:${state.jobTurns}`);
        recordGrowth({ project: 'workProject', research: 'workResearch', balance: 'workBalance', innovation: 'workInnovation' }[action.id],
          `work:${state.jobTurns}`);
        const repayment = repayLoan(Math.floor(available * CAMPUS_CONFIG.loan.repaymentRate), `salary:${state.jobTurns}`);
        const saved = Math.max(0, available - repayment);
        state.savings += saved; state.career.performance += round(action.performance * (.5 + .5 * Math.min(1, developmentCondition())));
        state.career.satisfaction = clamp(state.career.satisfaction + (company.balance - 65) / 5 + action.happiness, 0, 100);
        applyAbilities({ stress: action.stress, happiness: action.happiness, creativity: action.creativity || 0 });
        applyEffects({ energy: action.energy || -10 });
        if (action.venture) state.flags.ventureIdea = true;
        advanceTime(2, `job:${state.jobTurns}`);
        state.career.workHistory.push({ year: state.life.year, company: company.id, action: action.id,
          salary: paidSalary, incentive: bonus, living: company.living, income: available, repayment, saved });
        const salaryReview = annualSalaryReview(company, action, paidSalary);
        Object.assign(state.career.workHistory.at(-1), { salaryReview });
        state.career.salary = salaryReview.nextSalary;
        if (action.id === 'research' && company.researchUse >= WORK_RESEARCH_REVIEW.minimumResearchUse) {
          const kind = state.career.companyYears % 2 === 0 ? 'paper' : 'conference';
          const probability = researchChance(WORK_RESEARCH_REVIEW.probability), draw = Math.random();
          const accepted = draw < probability;
          const outcome = { kind, probability, draw, accepted, company:company.id, year:state.life.year };
          state.career.workHistory.at(-1).researchOutcome = outcome;
          if (accepted) (kind === 'paper' ? state.study.papers : state.study.conferences).push(outcome);
          log(`연구직 연간 ${kind === 'paper' ? '논문 심사' : '학회 발표'}: ${accepted ? '성과 기록' : '보완 필요'}. 결과는 저장했다.`);
        }
        log(`${company.name}에서 ${action.title}. 인센티브 ${bonus}만원 포함 가용 급여 ${available}, 대출 상환 ${repayment}, 저축 +${saved}만원. 경력·성과 인상 +${salaryReview.raise}만원 → 다음 연봉 ${state.career.salary}만원.`);
        chooseWorkEvent();
      }), reason);
  }
}
function chooseWorkEvent() {
  let kind = 'project';
  if (state.career.companyYears === 2 && state.career.performance >= CAREER_CONFIG.promotionPerformance) kind = 'promotion';
  else if (state.career.companyYears === 3) kind = 'transfer';
  else if (state.flags.ventureIdea && !state.career.events.some(event => event.kind === 'venture')) kind = 'venture';
  else if (state.character.abilities.stress >= 75) kind = 'conflict';
  else if (Math.random() < CAREER_CONFIG.eventProbability * difficultyConfig().eventRisk) kind = 'conflict';
  const event = { kind, year: state.life.year, turn: state.jobTurns, resolved: false };
  state.career.pendingEvent = event; state.career.events.push(event); state.phase = 'workEvent';
}
function renderWorkEvent() {
  const event = state.career.pendingEvent;
  const titles = { promotion: '승진 제안', transfer: '새로운 팀의 이직 제안', venture: '창업을 권하는 동료', conflict: '상사와의 업무 조율', project: '프로젝트를 마친 뒤' };
  const scene = setScene('직장 생활 이벤트', titles[event.kind], '이번 턴의 급여·경험·나이는 이미 반영됐습니다. 다음 선택을 해도 다시 지급하지 않습니다.');
  const choices = choiceContainer(scene);
  const resolve = next => {
    event.resolved = true;
    // JSON 복원 후에는 pendingEvent와 events의 객체 참조가 달라져도 같은 기록을 완료합니다.
    state.career.events.filter(record => record.turn === event.turn && record.kind === event.kind).forEach(record => {
      record.resolved = true; if (event.accepted !== undefined) record.accepted = event.accepted;
    });
    state.career.pendingEvent = null; state.phase = next;
  };
  if (event.kind === 'promotion') addButton(choices, '승진을 수락한다', `연봉 ${CAREER_CONFIG.promotionRate * 100}% 인상 · 책임과 스트레스 +8`, choose('workEvent', () => {
    event.accepted = true;
    const before = state.career.salary;
    state.career.salary = Math.round(before * (1 + CAREER_CONFIG.promotionRate));
    event.salaryIncrease = state.career.salary - before;
    applyAbilities({ stress: 8 }); log(`승진 수락! 연봉 +${event.salaryIncrease}만원 → ${state.career.salary}만원. 다음 근무 급여에 반영됩니다.`); resolve('jobNext');
  }));
  if (event.kind === 'transfer') addButton(choices, '이직 공고를 살펴본다', '새 합격을 수락하기 전에는 현재 직장을 유지합니다.', choose('workEvent', () => { resolve('jobNext'); startHiring(); }));
  if (event.kind === 'venture') addButton(choices, '창업 아이디어를 준비한다', '다음 화면에서 자본과 위험을 확인합니다.', choose('workEvent', () => { state.flags.ventureIdea = true; resolve('jobNext'); }));
  addButton(choices, event.kind === 'conflict' ? '대화로 업무량을 조율한다' : '지금의 균형을 지키며 다음을 준비한다',
    '스트레스 -12 · 직장 만족도 +5', choose('workEvent', () => {
      applyAbilities({ stress: -12, happiness: 3 });
      state.career.satisfaction = clamp(state.career.satisfaction + 5, 0, 100);
      log('직장의 역할과 개인 시간을 조율했다.'); resolve('jobNext');
    }));
}
function appendCareerChoices(scene) {
  const choices = choiceContainer(scene);
  if (state.career.employer) {
    scene.append(element('p', `${companyById(state.career.employer).name} · 경력 ${state.career.years}년 · 업무 성과 ${state.career.performance} · 직장 만족도 ${round(state.career.satisfaction)}`));
    addButton(choices, '이직 지원', '현 직장을 유지하며 새로운 공고에 지원', choose('jobNext', startHiring));
    addButton(choices, '퇴사하고 재정비', '저축·학위·경력은 보존합니다.', choose('jobNext', () => { endEmployment('퇴사'); state.phase = hasBachelor() ? 'hub' : 'jobBoard'; }));
  }
  if (state.flags.ventureIdea || state.career.years >= 2) addButton(choices, '창업 시작', `개인 자금 ${CAREER_CONFIG.ventureCapital}만원을 사업 계정으로 이동 · 반년씩 운영`,
    choose('jobNext', () => {
      if (state.money < CAREER_CONFIG.ventureCapital) return;
      state.money -= CAREER_CONFIG.ventureCapital; endEmployment('창업을 위한 퇴사');
      state.career.venture = { budget: CAREER_CONFIG.ventureCapital, turns: 0, traction: 0, history: [], startedYear: state.life.year };
      state.phase = 'venture'; log('작은 사업을 시작했다. 사업 계정은 개인 생활비와 분리한다.');
    }), state.money < CAREER_CONFIG.ventureCapital);
}
function renderVenture() {
  const venture = state.career.venture;
  const scene = setScene('창업 · 반년 단위', '작은 제품에서 시작하기', `사업 자금 ${venture.budget}만원 · 고객 검증 ${venture.traction}회 · 개인 생활비 ${state.money}만원`);
  const choices = choiceContainer(scene);
  for (const [id, title] of [['product', '제품 개발과 고객 검증'], ['balance', '작은 규모로 안정 운영']]) addButton(choices, title,
    `사업 자금 ${CAREER_CONFIG.ventureCost}만원 사용 · 반년 경과 · 결과는 저장`, choose('venture', () => {
      if (venture.budget < CAREER_CONFIG.ventureCost) return;
      const draw = Math.random();
      const success = draw < clamp(.45 + state.character.abilities.creativity / 300 + state.practice / 200, .25, .95);
      venture.budget -= CAREER_CONFIG.ventureCost;
      venture.budget += success ? CAREER_CONFIG.ventureSuccessRevenue : CAREER_CONFIG.ventureFailureRevenue;
      venture.turns++; if (success) venture.traction++;
      const allowance = Math.min(20, venture.budget); venture.budget -= allowance; state.money += allowance;
      advanceTime(1, `venture:${venture.startedYear}:${venture.turns}`);
      applyAbilities({ stress: id === 'balance' ? -10 : 5, happiness: success ? 5 : -2 });
      venture.history.push({ year: state.life.year, draw, success, id });
      recordGrowth(id === 'product' ? 'workInnovation' : 'workBalance',
        `venture-growth:${state.career.ventures.length + 1}:${venture.startedYear}:${venture.turns}`);
      log(`${title}: ${success ? '고객의 반응을 얻었다' : '가설을 수정할 점을 찾았다'}. 사업 자금 ${venture.budget}만원.`);
    }), venture.budget < CAREER_CONFIG.ventureCost);
  addButton(choices, '창업 경험으로 인생 기록 마무리', '실제 운영 기록과 행복·자산·경력을 함께 회고합니다.', choose('venture', () => { state.ending = '작은 도전으로 시작한 창업가'; state.phase = 'ending'; }));
  addButton(choices, '사업 정리 후 재취업 준비', '남은 사업 자금을 반환받고 새 채용에 지원', choose('venture', () => {
    state.money += venture.budget; venture.closedYear = state.life.year; venture.budget = 0;
    state.career.ventures.push(venture); state.career.venture = null; startHiring();
  }));
}
function selectRandomCampusEvent() {
  const eligible = RANDOM_CAMPUS_EVENTS.filter(event => !state.career.campusSeen.includes(event.id) &&
    (!event.needs || state.experiences[event.needs]) && (!event.minimumResearch || state.research >= event.minimumResearch));
  if (!eligible.length) return 'project';
  const weighted = eligible.map(event => ({ event, weight: event.weight +
    (event.id === 'familyCost' && state.money < 50 ? 2 : 0) +
    (event.id === 'seniorProject' && state.social.npcs.senior?.trust >= 30 ? 2 : 0) }));
  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  const draw = Math.random(); let cursor = draw * total;
  let selected = weighted.at(-1).event;
  for (const item of weighted) { cursor -= item.weight; if (cursor < 0) { selected = item.event; break; } }
  state.career.campusSeen.push(selected.id); state.career.campusRolls[state.semester] = { draw, id: selected.id };
  return selected.id;
}
function renderCareerSidebar() {
  $('employment-records').replaceChildren();
  $('employment-menu').hidden = !hasBachelor() && !state.flags.alternativeCareer;
  list($('employment-records'), [
    `현재 직장: ${companyById(state.career.employer)?.name || '미입사·퇴사 상태'}`,
    `경력 ${state.career.years}년 · 업무 성과 ${state.career.performance} · 만족도 ${round(state.career.satisfaction)}`,
    ...state.career.workHistory.map(record => `${record.year}년 ${companyById(record.company).name}: ${record.income}만원 수입, 상환 ${record.repayment}`),
    ...state.career.hiringHistory.flatMap(round => round.applications.map(app => `${round.year}년 ${companyById(app.id).name}: ${app.accepted ? '합격' : '불합격'} / ${app.evidence || '서류 단계'}`)),
  ]);
  const labels = { jobBoard: '채용 지원', jobDocuments: '서류 심사', jobInterview: '기업 면접',
    jobResults: '최종 합격 발표', jobDecision: '입사 결정', employmentDecision: '취업 성공', workTurn: '직장 생활', workEvent: '직장 이벤트', venture: '사업 운영' };
  if (labels[state.phase]) $('stage').textContent = labels[state.phase];
}
