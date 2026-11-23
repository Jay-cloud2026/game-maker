// 원서 제출 시 지원 자격·역량·증빙·선발 설정을 캡처하고 각 추첨을 저장합니다.
function initialGraduateAdmissionsFields() { return { graduateAdmissions: { history: [] } }; }
function upgradeGraduateAdmissions(value) {
  return { ...value, ...initialGraduateAdmissionsFields(), version: CONFIG.saveVersion };
}
function validGraduateAdmissions(value) {
  if (!value.graduateAdmissions || !Array.isArray(value.graduateAdmissions.history)) return false;
  if (!value.graduateAdmissions.history.every(entry => entry &&
      Number.isInteger(entry.round) && Number.isInteger(entry.year) && ['masters', 'phd'].includes(entry.degree) &&
      Array.isArray(entry.applications) && entry.applications.every(app => app && programById(app.id) &&
        ['applied', 'interviewed', 'opened'].includes(app.status)))) return false;
  return value.applications.every(app => {
    if (app.ruleset === undefined) return true; // 이전 원서는 기존 확정 결과/처리 규칙을 유지.
    return app.ruleset === GRAD_ADMISSIONS.ruleset && app.snapshot &&
      ['gpa', 'research', 'mastersResearch', 'recommendations', 'recommendationQuality', 'language', 'papers', 'conferences', 'difficulty']
        .every(key => Number.isFinite(app.snapshot[key])) &&
      app.selectionRules && Number.isFinite(app.selectionRules.difficulty) && app.selectionRules.scale > 0 &&
      ['documentFloor', 'documentCeiling', 'finalFloor', 'finalCeiling'].every(key =>
        Number.isFinite(app.selectionRules[key]) && app.selectionRules[key] >= 0 && app.selectionRules[key] <= 1) &&
      app.selectionRules.weights && Object.entries(app.selectionRules.weights).every(([key, weight]) =>
        ['gpa', 'research', 'recommendation', 'language', 'interview'].includes(key) && Number.isFinite(weight) && weight >= 0) &&
      Object.entries(app.selectionRules.weights).filter(([key]) => key !== 'interview').reduce((sum, [, weight]) => sum + weight, 0) > 0 &&
      Array.isArray(app.evidenceOptions) && app.evidenceOptions.length > 0 &&
      app.evidenceOptions.every(item => typeof item.text === 'string' && Number.isFinite(item.score)) &&
      app.document && typeof app.document.passed === 'boolean' &&
      Array.isArray(app.document.missing) && app.document.missing.every(reason => typeof reason === 'string') &&
      typeof app.document.opened === 'boolean' && Number.isFinite(app.document.score) &&
      Number.isFinite(app.document.probability) && app.document.probability >= 0 && app.document.probability <= 1 &&
      (app.document.draw === null || (Number.isFinite(app.document.draw) && app.document.draw >= 0 && app.document.draw < 1)) &&
      (app.finalDraw === undefined || (Number.isFinite(app.finalDraw) && app.finalDraw >= 0 && app.finalDraw < 1)) &&
      (app.finalProbability === undefined || (Number.isFinite(app.finalProbability) && app.finalProbability >= 0 && app.finalProbability <= 1));
  }) && (value.phase !== 'graduateDocuments' || value.applications.length > 0);
}
function renderGraduateAdmissionsSidebar() {
  $('graduate-admissions-records').replaceChildren();
  $('graduate-admissions-menu').hidden = !state.graduateAdmissions.history.length && !state.applications.length;
  const history = [...state.graduateAdmissions.history, {
    round: state.round, year: state.life.year, degree: state.degree, applications: state.applications,
  }];
  list($('graduate-admissions-records'), history.flatMap(entry => entry.applications.map(app => {
    const result = app.status === 'opened' ? app.accepted ? '합격' : '불합격' :
      app.document?.opened ? app.document.passed ? '서류 통과 · 최종 결과 미공개' : '서류 불합격' : '결과 미공개';
    return `${entry.year}년 ${entry.round}회차 ${programById(app.id).school} ${degreeName(entry.degree)}: ${result}`;
  })));
}
function archiveGraduateApplications() {
  if (!state.applications.length) return;
  state.graduateAdmissions.history.push({
    round: state.round, degree: state.degree, year: state.life.year,
    applications: JSON.parse(JSON.stringify(state.applications)),
  });
}
function graduateSnapshot(degree) {
  return {
    degree, gpa: cumulativeGpa(), bachelor: hasBachelor(), masters: Boolean(state.master?.completed),
    research: state.research, mastersResearch: state.master?.research || 0,
    recommendations: state.recommendations, recommendationQuality: recommendationQuality(),
    language: Math.max(state.development?.skills.language || state.character.abilities.language, bestLanguageScore()),
    papers: state.study.papers.length, conferences: state.study.conferences.length,
    difficulty: difficultyConfig().competition,
    npcRecommendations: (state.social.outreach?.letters || []).map(letter => ({ ...letter })),
  };
}
function graduateEligibility(program, snapshot = graduateSnapshot(program.degree)) {
  const policy = program.admissions;
  const reasons = [];
  if (!snapshot.bachelor) reasons.push('학사 학위 필요');
  if (program.degree === 'phd' && !snapshot.masters) reasons.push('석사 학위 필요');
  if (snapshot.gpa < policy.gpa) reasons.push(`GPA ${policy.gpa} 이상 필요`);
  if (snapshot.research < policy.research) reasons.push(`연구 경험 ${policy.research} 이상 필요`);
  if (snapshot.recommendations < policy.recommendations) reasons.push(`추천서 ${policy.recommendations}개 필요`);
  if (snapshot.language < policy.language) reasons.push(`어학 역량/시험 환산 ${policy.language} 이상 필요`);
  return reasons;
}
function graduateInputs(snapshot, interview = 0) {
  return {
    gpa: snapshot.gpa / 4.5 * 100,
    research: clamp(100 * (1 - Math.exp(-snapshot.research / 12)) +
      snapshot.papers * 5 + snapshot.conferences * 2, 0, 100),
    recommendation: clamp(Math.max(snapshot.recommendations * 20, snapshot.recommendationQuality), 0, 100),
    language: clamp(snapshot.language, 0, 100), interview,
  };
}
function graduateWeightedScore(inputs, weights, documents = false) {
  const entries = Object.entries(weights).filter(([key]) => !documents || key !== 'interview');
  const sum = entries.reduce((total, [, weight]) => total + weight, 0);
  return round(entries.reduce((total, [key, weight]) => total + inputs[key] * weight, 0) / sum);
}
function graduateProbability(score, rules, documents = false) {
  return clamp(1 / (1 + Math.exp(-(score - rules.difficulty) / rules.scale)),
    documents ? rules.documentFloor : rules.finalFloor,
    documents ? rules.documentCeiling : rules.finalCeiling);
}
function submitGraduateApplication(program) {
  if (state.applications.some(app => app.id === program.id)) return;
  const snapshot = graduateSnapshot(program.degree), missing = graduateEligibility(program, snapshot);
  const selectionRules = {
    ...GRAD_ADMISSIONS, weights: { ...program.weights },
    difficulty: program.admissions.difficulty + snapshot.difficulty,
  };
  const score = graduateWeightedScore(graduateInputs(snapshot), selectionRules.weights, true);
  const probability = missing.length ? 0 : graduateProbability(score, selectionRules, true);
  const draw = missing.length ? null : Math.random();
  const passed = !missing.length && draw < probability;
  state.applications.push({
    id: program.id, ruleset: GRAD_ADMISSIONS.ruleset, status: passed ? 'applied' : 'interviewed',
    snapshot, selectionRules, evidenceOptions: careerEvidence().map(item => ({
      ...item, score: actualInterviewScore(item.score),
    })),
    document: { score, probability, draw, passed, missing, opened: false },
    interview: 0, evidence: '', score: passed ? null : score, accepted: passed ? null : false,
  });
  log(`${program.country} ${program.school} ${degreeName(program.degree)}에 원서를 제출했다. 서류 심사는 결과 화면에서 확인한다.`);
}
function renderGraduateDocuments() {
  const scene = setScene('2단계 · 서류 심사', '연구 준비를 담은 지원서',
    '지원 당시 학점·연구·추천서·어학으로 심사합니다. 최소 조건 미달은 서류 탈락이며, 조건을 충족해도 통과를 보장하지 않습니다.');
  const choices = choiceContainer(scene);
  for (const app of state.applications) {
    const program = programById(app.id), document = app.document;
    if (app.snapshot?.npcRecommendations?.length) scene.append(element('p',
      `${program.school}: 교수님의 공동 과제 추천서가 지원 당시 추천서 조건과 서류 평가에 반영되었습니다.`));
    if (!document) {
      scene.append(element('p', `${program.country} ${program.school}: 이전 원서의 면접·결과 기록을 유지합니다.`));
      continue;
    }
    if (document.opened) {
      scene.append(element('p', `${program.country} ${program.school}: ${document.passed ? '서류 통과' : '서류 불합격'}${document.missing.length ? ` · ${document.missing.join(', ')}` : ''}`));
    } else addButton(choices, `${program.country} ${program.school} 서류 결과 확인`, '원서 제출 시 확정 저장한 결과 공개',
      choose('graduateDocuments', () => { document.opened = true; }));
  }
  const ready = state.applications.every(app => !app.document || app.document.opened);
  const passed = state.applications.some(app => app.status === 'applied');
  addButton(choices, passed ? '서류 통과 대학원 면접으로' : '최종 결과 확인으로',
    '서류 탈락한 원서는 면접 없이 불합격 처리됩니다.', choose('graduateDocuments', () => {
      if (ready) state.phase = passed ? 'interview' : 'mail';
    }), !ready, true);
}
