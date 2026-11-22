const MEMOIR_PHASES = ['endingChoice', 'phdEpilogue'];
function initialReflectionFields() {
  return { reflection: { selected: null, snapshot: null, profession: null, phdCompleted: false, teaching: 0, epilogues: [] } };
}
function upgradeReflectionState(value) { return { ...value, ...initialReflectionFields(), version: CONFIG.saveVersion }; }
function validReflectionFields(value) {
  const snapshot = value.reflection?.snapshot;
  return value.reflection && Array.isArray(value.reflection.epilogues) && Number.isFinite(value.reflection.teaching) &&
    (!snapshot || (typeof snapshot.name === 'string' && Array.isArray(snapshot.timeline) && Array.isArray(snapshot.experiences) &&
      Array.isArray(snapshot.relationships) && Array.isArray(snapshot.romance) &&
      (!snapshot.employment || validEmploymentContract(snapshot.employment)))) &&
    (!value.reflection.selected || ENDINGS.some(ending => ending.id === value.reflection.selected));
}
function lifeMetrics() {
  const accepted = programById(state.flags.acceptedProgram);
  const ventures = [...state.career.ventures, ...(state.career.venture ? [state.career.venture] : [])];
  const company = companyById(state.career.employer || state.career.employmentHistory.at(-1)?.company);
  return {
    research: state.research, practice: state.practice, recommendations: state.recommendations,
    careerYears: Math.max(state.career.years, state.jobTurns), performance: state.career.performance,
    traction: Math.max(0, ...ventures.map(venture => venture.traction)),
    happiness: state.character?.abilities.happiness || 0,
    relationshipTrust: Math.max(0, ...Object.values(state.social.npcs).map(npc => npc.trust)),
    teaching: state.reflection.teaching + (state.master?.actions.filter(action => action.includes('TA')).length || 0),
    degree: state.reflection.phdCompleted || state.life.highestDegree === '박사' ? 3 : state.master?.completed ? 2 : hasBachelor() ? 1 : 0,
    phd: state.reflection.phdCompleted || state.life.highestDegree === '박사',
    international: state.study.exchanges.length + (state.master?.completed && programById(state.master.program).country !== '대한민국' ? 1 : 0) +
      (state.reflection.phdCompleted && accepted?.country !== '대한민국' ? 1 : 0),
    companyTypes: company ? [company.type] : [],
  };
}
function endingRequirements(rule) {
  const metrics = lifeMetrics();
  return Object.entries(rule.requirements).every(([key, required]) =>
    key === 'companyTypes' ? required.some(type => metrics.companyTypes.includes(type)) :
      key === 'phd' ? metrics.phd : metrics[key] >= required);
}
function memoirData() {
  const character = state.character;
  const university = universityById(state.life.university);
  const company = companyById(state.career.employer);
  return {
    name: character.name, age: characterAge(), year: state.life.year,
    highSchool: character.highSchool, university: university?.name || (state.life.admissionYear ? LIFE_CONFIG.legacySchoolLabel : '대학 진학 전'),
    major: state.life.major || character.interest, attempts: state.entrance.attempts.length,
    retakes: Math.max(0, state.entrance.attempts.length - 1),
    admissionYear: state.life.admissionYear, graduationYear: state.life.graduationYear,
    degree: state.life.highestDegree,
    profession: state.reflection.profession || (state.career.venture ? '사업 운영 중' : company?.role ||
      (state.career.legacy ? '기존 직장 종사자 (소속 기록 없음)' : state.jobTurns ? '직장 경험을 가진 진로 준비자' : '다음 진로 준비 중')),
    savings: state.savings, money: state.money, deposit: state.campus.housing.deposit,
    debt: state.campus.debt, ventureAssets: state.career.venture?.budget || 0,
    happiness: character.abilities.happiness, stress: character.abilities.stress,
    metrics: lifeMetrics(), experiences: careerEvidence().filter(item => item.id !== 'motivation'),
    employment: JSON.parse(JSON.stringify(state.career.employmentHistory.at(-1)?.contract || null)),
    relationships: NPCS.filter(template => state.social.npcs[template.id]).map(template => ({
      name: template.name, type: template.type, ...JSON.parse(JSON.stringify(state.social.npcs[template.id])),
    })).sort((a, b) => b.trust + b.intimacy - a.trust - a.intimacy),
    romance: JSON.parse(JSON.stringify(state.social.romanceHistory)),
    timeline: JSON.parse(JSON.stringify(state.history.slice().reverse())),
    ending: state.reflection.selected ? ENDINGS.find(rule => rule.id === state.reflection.selected).title : state.ending || '진행 중인 나의 이야기',
  };
}
function ensureMemoirSnapshot() {
  if (state.phase === 'ending' && !state.reflection.snapshot) state.reflection.snapshot = memoirData();
  return ensureEndingAssessment();
}
function renderMemoir(parent, data, includeTimeline = true) {
  parent.append(element('h3', '나의 인생 기록'));
  list(parent, [
    `${data.name} · ${data.age}세 · ${data.year}년 · 연도 기준 나이`,
    `고등학교: ${data.highSchool} · 대학: ${data.university} / ${data.major}`,
    `입시 ${data.attempts ? `${data.attempts}회` : '이전 기록 없음'} · 재수 ${data.retakes}회`,
    `대학 입학 ${data.admissionYear || '미정'}년 · 학부 졸업 ${data.graduationYear || '미정'}년`,
    `최종 학력 ${data.degree} · 최종 직업 ${data.profession}`,
    `누적 저축 ${data.savings} · 현금 ${data.money} · 보증금 ${data.deposit} · 사업 자산 ${data.ventureAssets} · 대출 ${data.debt}만원`,
    `순자산 ${data.money + data.deposit + data.ventureAssets - data.debt}만원 · 행복도 ${data.happiness} · 스트레스 ${data.stress}`,
    `최종 엔딩: ${data.ending}`,
  ]);
  if (data.employment) {
    const job = data.employment;
    parent.append(element('h3', '취업 성공 기록'));
    list(parent, [
      `${job.company} · ${job.role} · 신입 계약 연봉 ${job.salary}만원`,
      `입사 ${job.age}세 (${job.startYear}년) · 당시 학력 ${job.education} · 대학 GPA ${job.gpa.toFixed(2)} / 4.50`,
      `인턴 경험 ${job.internships}회`,
      `취업 성공 스토리: ${job.story}`,
      ...job.projects.map(project => `주요 프로젝트: ${project.text}`),
    ]);
  }
  parent.append(element('h3', '주요 연구·대회·실무 성과'));
  list(parent, data.experiences.map(item => item.text));
  parent.append(element('h3', '기억에 남는 사람들'));
  list(parent, data.relationships.filter(npc => npc.history.length || npc.trust >= 35).map(npc =>
    `${npc.name} (${npc.type}) · 친밀도 ${npc.intimacy}, 신뢰 ${npc.trust} · ${npc.history.at(-1)?.text || '함께한 시간을 기억한다.'}`));
  parent.append(element('h3', '연애와 중요한 관계 선택'));
  list(parent, data.romance.length ? data.romance.map(record => `${record.year}년: ${record.text}`) : ['연애를 선택하지 않은 시간에도 나만의 길과 관계를 쌓았다.']);
  if (includeTimeline) {
    parent.append(element('h3', '연도별 인생 타임라인'));
    const groups = new Map();
    for (const record of data.timeline) {
      const year = record.year || '이전 연도 미상';
      if (!groups.has(year)) groups.set(year, []);
      groups.get(year).push(`${record.label}: ${record.text}`);
    }
    for (const [year, texts] of groups) {
      const details = element('details');
      details.append(element('summary', `${year}${typeof year === 'number' ? '년' : ''} · ${texts.length}개의 기록`));
      list(details, texts); parent.append(details);
    }
  }
}
function renderEndingChoices() {
  const scene = setScene('멀티 엔딩 · 실제 경험으로 열린 길', '어떤 삶으로 이어갈까?',
    '대학 이름이나 학점 하나로 정하지 않습니다. 연구·경력·인간관계·행복과 실제 선택이 기회를 엽니다. 엔딩의 후일담 시간과 수입도 한 번만 반영합니다.');
  for (const rule of ENDINGS) {
    if (!endingRequirements(rule)) continue;
    addButton(choiceContainer(scene), rule.title, `${rule.narrative} · 후일담 ${rule.years}년 · 수입 ${rule.income}만원`,
      choose('endingChoice', () => {
        if (state.reflection.selected || !endingRequirements(rule)) return;
        state.lifeAssessment.resume = null;
        state.reflection.selected = rule.id; state.reflection.profession = rule.profession;
        if (!state.life.timeKeys.includes(`ending:${rule.id}`)) {
          state.money += rule.income;
          const repayment = repayLoan(Math.floor(rule.income * CAMPUS_CONFIG.loan.repaymentRate), `ending:${rule.id}`);
          state.savings += rule.income - repayment;
          advanceTime(rule.years * 2, `ending:${rule.id}`);
          if (state.jobTurns) state.career.years += rule.years;
        }
        state.ending = rule.title; state.phase = 'ending'; state.reflection.snapshot = null;
        log(`${rule.title}: ${rule.narrative} ${rule.years}년의 후일담을 지나 나의 삶을 돌아본다.`);
      }));
  }
  addButton(choiceContainer(scene), '현재 기록으로 돌아가기', '', choose('endingChoice', () => { state.phase = 'ending'; }));
}
function renderPhdEpilogue() {
  const program = programById(state.flags.acceptedProgram);
  const income = (program.stipend - program.tuition - EPILOGUE_CONFIG.yearlyLiving) * EPILOGUE_CONFIG.phdYears;
  const scene = setScene('박사 진학 이후의 장기 선택', `${program.country} ${program.lab}`,
    `${program.topic}. 박사 과정을 ${EPILOGUE_CONFIG.phdYears}년으로 압축합니다. 지원금·등록금·생활비를 합산한 순수입 ${income}만원. 학위를 마친 뒤 연구·교육·산업 진로가 달라집니다.`);
  for (const option of PHD_EPILOGUES) addButton(choiceContainer(scene), option.title,
    `4년 · 연구 +${option.research} · 교육 경험 ${option.teaching} · 실무 +${option.practice}`,
    choose('phdEpilogue', () => {
      if (state.reflection.phdCompleted || state.money + income < 0) return;
      state.money += income; state.research += option.research; state.practice += option.practice;
      state.reflection.phdCompleted = true; state.reflection.teaching += option.teaching;
      state.recommendations++; state.life.highestDegree = '박사';
      state.reflection.epilogues.push({ id: option.id, year: state.life.year, programme: program.id });
      advanceTime(EPILOGUE_CONFIG.phdYears * 2, `phdCompletion:${program.id}`);
      log(`${option.title}를 선택해 박사 과정을 마쳤다. 연구 성과와 교육·실무 경험을 다음 기회로 연결한다.`);
      state.reflection.snapshot = null; state.phase = 'endingChoice';
    }), state.money + income < 0);
  addButton(choiceContainer(scene), '박사 진학 기록으로 돌아가기', '아직 학위를 완료하지 않은 상태로 마무리합니다.', choose('phdEpilogue', () => { state.phase = 'ending'; }));
}
function appendEndingMemoir(scene) {
  const snapshot = state.reflection.snapshot;
  if (snapshot) renderMemoir(scene, snapshot);
  appendEndingAssessment(scene);
  if (!state.reflection.selected) {
    const program = programById(state.flags.acceptedProgram);
    if (program?.degree === 'phd' && !state.reflection.phdCompleted) addButton(choiceContainer(scene), '박사 과정 이후의 삶 이어가기',
      '기존 박사 진학 기록을 보존하고 학기제 연구·논문·학위 심사를 시작합니다.', choose('ending', () => {
        state.lifeAssessment.resume = null; state.reflection.snapshot = null; startDegree(program);
      }));
    addButton(choiceContainer(scene), '인생 엔딩 고르기', '현재 경험으로 열린 결말을 확인합니다.', choose('ending', () => { state.phase = 'endingChoice'; }));
    if (hasBachelor()) addButton(choiceContainer(scene), '아직 커리어를 더 이어가기', '학위·저축·경험을 보존하고 다음 진로를 탐색합니다.', choose('ending', () => {
      state.lifeAssessment.resume = null;
      state.reflection.snapshot = null; state.reflection.profession = null;
      state.phase = state.career.employer ? 'jobNext' : 'hub';
    }));
  }
}
function renderTimelineSidebar() {
  $('timeline-menu').hidden = !state.character;
  $('timeline-records').replaceChildren();
  $('journal-button').hidden = !state.character;
  if (!state.character) return;
  const records = state.history.slice().reverse();
  list($('timeline-records'), records.map(record => `${record.year || '이전 연도 미상'}${record.year ? '년' : ''}: ${record.text}`));
}
function openJournal() {
  if (!state.character) return;
  $('journal-content').replaceChildren();
  renderMemoir($('journal-content'), state.reflection.snapshot || memoirData());
  $('journal-dialog').showModal();
}
function downloadFile(text, filename, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
  URL.revokeObjectURL(url);
}
function downloadMemoir() {
  if (!state.character) return;
  const data = state.reflection.snapshot || memoirData();
  const text = `나의 인생 기록\n${data.name} · ${data.age}세 · ${data.year}년\n${data.ending}\n${data.degree} / ${data.profession}\n\n` +
    data.timeline.map(record => `${record.year || '이전 연도 미상'}: ${record.text}`).join('\n');
  downloadFile(text, `나의-인생-기록-${data.year}.txt`);
}
