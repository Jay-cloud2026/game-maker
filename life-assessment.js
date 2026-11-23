// 순수 평가 함수는 전달받은 캐릭터만 읽습니다. RNG/보상/전역 state 교체를 하지 않습니다.
function initialLifeAssessmentFields() {
  return { lifeAssessment: { schema: 1, path: 'auto', records: [], finalId: null, resume: null,
    forty: null, lastAge: null, pendingForty: false } };
}
function upgradeLifeAssessment(value) {
  const addition = initialLifeAssessmentFields();
  if (value.character) {
    const age = value.life.year - value.character.birthYear;
    addition.lifeAssessment.lastAge = age;
    addition.lifeAssessment.pendingForty = age >= LIFE_ASSESSMENT_CONFIG.milestoneAge;
  }
  return { ...value, ...addition, version: CONFIG.saveVersion };
}
function assessmentScale(value, target) { return clamp(Math.max(0, value) / target * 100, 0, 100); }
function assessmentFacts(value) {
  const c = value.career, w = value.wellness, abilities = value.character.abilities;
  const company = companyById(c.employer);
  const work = c.workHistory.filter(r => r && companyById(r.company));
  const enterpriseWork = work.filter(r => companyById(r.company)?.type === '대기업');
  const researchWork = work.filter(r => r.action === 'research');
  const projects = work.filter(r => ['project','innovation'].includes(r.action)).length;
  let salaryRaises = 0;
  for (let i = 1; i < work.length; i++) {
    if (!work[i].salaryReview && !work[i - 1].salaryReview && work[i].company === work[i - 1].company && work[i].salary > work[i - 1].salary) salaryRaises++;
  }
  if (company && !work.at(-1)?.salaryReview && work.at(-1)?.company === company.id && c.salary > work.at(-1).salary) salaryRaises++;
  const promotions = Math.max(salaryRaises, c.events.filter(e => e.kind === 'promotion' && e.accepted).length);
  const ventures = [...c.ventures, ...(c.venture ? [c.venture] : [])].filter(Boolean);
  const bestVenture = ventures.reduce((best, v) => !best || v.traction > best.traction ? v : best, null);
  const ties = Object.values(value.social.npcs).map(n => ({
    trust: n.trust, intimacy: n.intimacy,
    score: n.trust * LIFE_ASSESSMENT_CONFIG.relationships.trustWeight + n.intimacy * LIFE_ASSESSMENT_CONFIG.relationships.intimacyWeight,
  })).sort((a,b) => b.score - a.score);
  const channelGains = {};
  const seen = new Set();
  for (const entry of value.development.history) {
    if (seen.has(entry.key)) continue;
    seen.add(entry.key);
    for (const [key, gain] of Object.entries(entry.gains)) channelGains[key] = (channelGains[key] || 0) + gain;
  }
  const teachingFromDegrees = value.postgraduate.records.reduce((sum,d) => sum + (Number(d?.teaching) || 0), 0);
  const living = company?.living || (value.postgraduate.active && !value.postgraduate.active.completed ?
    programById(value.postgraduate.active.program).admissions.living * 2 : CAMPUS_CONFIG.livingCost * 6);
  const assets = value.money + value.campus.housing.deposit + (c.venture?.budget || 0);
  return {
    years: Math.max(c.years, value.jobTurns, work.length), projects, practice: value.practice, promotions,
    enterpriseYears: enterpriseWork.length,
    enterpriseProjects: enterpriseWork.filter(r => ['project','innovation'].includes(r.action)).length,
    performance: Number.isFinite(c.performance) ? c.performance : 0, researchWork: researchWork.length, research: value.research,
    papers: value.study.papers.length, conferences: value.study.conferences.length,
    teaching: Math.max(teachingFromDegrees, value.reflection.teaching,
      value.master?.actions.filter(a => a.includes('TA')).length || 0),
    phd: value.reflection.phdCompleted, masters: Boolean(value.master?.completed),
    satisfaction: clamp(Number(c.satisfaction) || 0,0,100), employed: Boolean(company), ventureActive: Boolean(c.venture),
    traction: bestVenture?.traction || 0, ventureTurns: bestVenture?.turns || 0,
    salary: company ? c.salary : 0, living, assets, debt: value.campus.debt,
    netWorth: assets - value.campus.debt,
    energy: value.energy, maxEnergy: w.maxEnergy, fatigue: w.fatigue, habit: w.habit,
    happiness: abilities.happiness, stress: abilities.stress,
    npcScore: ((ties[0]?.score || 0) + (ties[1]?.score || 0)) / 2,
    strongTies: ties.filter(n => n.trust >= 60 && n.intimacy >= 40).length,
    familyRelationship: value.household?.relationship || 0,
    channelGains,
  };
}
function assessmentAxes(facts) {
  const config = LIFE_ASSESSMENT_CONFIG;
  const reserveTarget = Math.max(config.economy.minimumBuffer, facts.living * config.economy.reserveYears);
  const surplus = Math.max(0, facts.salary - facts.living);
  const health = config.health;
  const gains = Object.values(facts.channelGains).reduce((a,b) => a + b, 0);
  const breadth = Object.values(facts.channelGains).filter(g => g >= config.growth.channelMinimum).length;
  return {
    economy: round(assessmentScale(facts.netWorth, reserveTarget) * config.economy.reserveWeight +
      assessmentScale(surplus, Math.max(100, facts.living * config.economy.incomeMargin)) * config.economy.incomeWeight),
    health: round(clamp(facts.energy / facts.maxEnergy * 100, 0, 100) * health.energy +
      (100 - facts.fatigue) * health.fatigue + facts.happiness * health.happiness +
      (100 - facts.stress) * health.stress + assessmentScale(facts.habit, health.habitTarget) * health.habit),
    relationships: round(clamp(facts.npcScore * config.relationships.npcWeight + facts.familyRelationship * config.relationships.familyWeight,0,100)),
    growth: round(assessmentScale(gains, config.growth.gainsTarget) * config.growth.gainWeight +
      assessmentScale(breadth, Object.keys(DEVELOPMENT_CONFIG.skillLabels).length) * config.growth.breadthWeight),
  };
}
function inferLifePath(value) {
  const selected = value.reflection.selected;
  if (value.career.venture || selected === 'founder') return 'founder';
  if (selected === 'balance') return 'balanced';
  if (['professor','overseasPhd','seniorResearcher'].includes(selected)) return 'researcher';
  const company = companyById(value.career.employer);
  if (company?.type === '대기업') return 'corporate';
  if (['정부출연연구소','대학 연구직'].includes(company?.type)) return 'researcher';
  if (company) return 'specialist';
  if (value.reflection.phdCompleted || value.postgraduate.active?.degree === 'phd') return 'researcher';
  return 'balanced';
}
function careerPathScore(path, f) {
  const p = LIFE_PATHS[path], t = p.targets;
  let parts;
  if (path === 'corporate') parts = { projects: assessmentScale(f.enterpriseProjects,t.projects),
    years: assessmentScale(f.enterpriseYears,t.years), promotions: assessmentScale(f.promotions,t.promotions),
    practice: assessmentScale(f.practice,t.practice) };
  if (path === 'researcher') parts = { papers: assessmentScale(f.papers,t.papers), research: assessmentScale(f.research,t.research),
    conferences: assessmentScale(f.conferences,t.conferences), teaching: assessmentScale(f.teaching,t.teaching),
    degree: f.phd ? 100 : f.masters ? 70 : 0 };
  if (path === 'founder') parts = { traction: assessmentScale(f.traction,t.traction), turns: assessmentScale(f.ventureTurns,t.turns) };
  if (path === 'balanced') parts = { years: assessmentScale(f.years,t.years), satisfaction: f.employed ? f.satisfaction : 0 };
  if (path === 'specialist') parts = { practice: assessmentScale(f.practice,t.practice), projects: assessmentScale(f.projects,t.projects),
    years: assessmentScale(f.years,t.years) };
  return round(clamp(Object.entries(p.careerWeights).reduce((sum,[key,weight]) => sum + parts[key] * weight, 0),0,100));
}
function sssMissing(path, facts, axes) {
  const required = LIFE_PATHS[path].sss, missing = [];
  const labels = { years:'실제 경력', projects:'업무 프로젝트', practice:'실무 경험', performance:'누적 업무 성과',
    papers:'논문', research:'연구 성과', conferences:'학회', researchWork:'지속 연구 업무', teaching:'교육·지도',
    traction:'고객 검증', turns:'사업 운영 반기', health:'건강·행복', relationships:'관계', habit:'운동 습관',
    happiness:'행복', strongTies:'깊은 관계' };
  const data = { ...facts, ...axes, turns: facts.ventureTurns };
  if (path === 'corporate') { data.years = facts.enterpriseYears; data.projects = facts.enterpriseProjects; }
  for (const [key,min] of Object.entries(required)) if (data[key] < min) missing.push(`${labels[key]} ${round(data[key])}/${min}`);
  if (path === 'researcher' && !facts.masters && !facts.phd) missing.push('연구 학위와 이후 실적 필요');
  if (path === 'balanced' && !facts.employed) missing.push('안정적 직업 유지 필요');
  return missing;
}
function lifeAchievements(value, facts) {
  const result = [];
  if (value.life.graduationYear !== null) result.push({ id:'bachelor', title:'학사 졸업' });
  if (facts.masters) result.push({ id:'masters', title:'석사 학위' });
  if (facts.phd) result.push({ id:'phd', title:'박사 학위' });
  if (value.competition?.result) result.push({ id:'competition', title:value.competition.result.team });
  if (facts.projects) result.push({ id:'projects', title:`업무 프로젝트 ${facts.projects}회` });
  if (facts.promotions) result.push({ id:'promotion', title:`확인된 연봉 승진 ${facts.promotions}회` });
  if (facts.papers) result.push({ id:'papers', title:`논문 ${facts.papers}편` });
  if (facts.conferences) result.push({ id:'conferences', title:`학회 ${facts.conferences}회` });
  if (facts.traction) result.push({ id:'venture', title:`고객 검증 ${facts.traction}회` });
  if (facts.strongTies) result.push({ id:'ties', title:`깊은 관계 ${facts.strongTies}명` });
  if (value.study.exchanges.length) result.push({ id:'exchange', title:`교환학생 ${value.study.exchanges.length}회` });
  if (value.military.service?.completed) result.push({ id:'service', title:`${MILITARY_CONFIG.service[value.military.service.type].title} 복무 완료` });
  return result;
}
function evaluateLife(value, requestedPath = 'auto') {
  const facts = assessmentFacts(value), common = assessmentAxes(facts), paths = {};
  for (const [path, policy] of Object.entries(LIFE_PATHS)) {
    const axes = { career: careerPathScore(path,facts), ...common };
    const total = round(Object.entries(policy.weights).reduce((sum,[key,weight]) => sum + axes[key] * weight, 0));
    const missing = sssMissing(path,facts,axes);
    const grade = LIFE_ASSESSMENT_CONFIG.grades.find(grade => total >= grade.minimum &&
      Object.entries(grade.floors).every(([key,min]) => axes[key] >= min) &&
      (grade.id !== 'SSS' || !missing.length));
    paths[path] = { axes, total, grade: grade.id, gradeTitle: grade.title, sssMissing: missing,
      sssFloors: Object.entries(LIFE_ASSESSMENT_CONFIG.grades[0].floors).filter(([key,min]) => axes[key] < min)
        .map(([key,min]) => `${LIFE_ASSESSMENT_CONFIG.axisLabels[key]} ${axes[key]}/${min}`) };
  }
  const path = requestedPath === 'auto' ? inferLifePath(value) : requestedPath;
  const company = companyById(value.career.employer), pg = value.postgraduate.active;
  const service = value.military.service && !value.military.service.completed ? value.military.service : null;
  const institution = service?.type === 'research' ? RESEARCH_INSTITUTIONS.find(i =>
    i.id === (service.institution || value.military.candidate?.institution || value.military.institution)) : null;
  const snapshot = {
    name: value.character.name, age: value.life.year - value.character.birthYear, year: value.life.year,
    education: value.life.highestDegree,
    job: (company && value.career.employmentHistory.at(-1)?.contract?.role) || company?.role || (service ? `${MILITARY_CONFIG.service[service.type].title} 복무 중` : value.career.venture ? '창업팀 운영' : pg && !pg.completed ? `${degreeName(pg.degree)} 연구 중` :
      value.reflection.profession ? `${value.reflection.profession} (기존 후일담 기록)` : '진로 준비·개인 생활'),
    organization: company?.name || (institution?.title || (service ? '배정 복무기관 (세부 소속 미기록)' :
      value.career.venture ? '나의 창업팀' : pg && !pg.completed ? programById(pg.program).school : '현재 소속 미기록')),
    salary: facts.salary, netWorth: facts.netWorth, ratings: careerRatings(value),
    health: { energy:facts.energy, maxEnergy:facts.maxEnergy, fatigue:facts.fatigue, habit:facts.habit, happiness:facts.happiness, stress:facts.stress },
    relationships: NPCS.filter(n => value.social.npcs[n.id]).map(n => ({
      name:n.name, trust:value.social.npcs[n.id].trust, intimacy:value.social.npcs[n.id].intimacy,
    })).sort((a,b) => b.trust + b.intimacy - a.trust - a.intimacy).slice(0,3),
    achievements: lifeAchievements(value,facts),
    timeline: JSON.parse(JSON.stringify(value.history.slice().reverse())),
    endingType: value.ending || '진행 중',
  };
  return { rulesVersion: LIFE_ASSESSMENT_CONFIG.version, path, paths, snapshot,
    rules: JSON.parse(JSON.stringify({ grades:LIFE_ASSESSMENT_CONFIG.grades, paths:LIFE_PATHS })) };
}
function assessmentRecord(kind = 'interim', path = state.lifeAssessment.path) {
  const a = state.lifeAssessment, report = evaluateLife(state,path);
  const signature = JSON.stringify({ kind, report });
  const existing = a.records.find(record => record.signature === signature);
  if (existing) return existing;
  const record = { id:`review-${a.records.length + 1}`, kind, signature, createdAt:new Date().toISOString(), ...report };
  a.records.push(record); return record;
}
function ensureEndingAssessment() {
  if (state.phase !== 'ending') {
    // 엔딩 위에서 생활/복무 메뉴를 열거나 제안을 둘러보는 것은 최종 평가를 취소하지 않습니다.
    if (state.lifeAssessment && !['lifestyle','militaryBoard','service','militaryComplete','endingChoice'].includes(state.phase)) state.lifeAssessment.finalId = null;
    return false;
  }
  if (!state.character || !state.lifeAssessment) return false;
  const final = state.lifeAssessment.records.find(r => r.id === state.lifeAssessment.finalId);
  if (final?.snapshot.endingType === state.ending) return false;
  state.lifeAssessment.finalId = assessmentRecord('final').id; return true;
}
function updateFortyMilestone() {
  const a = state.lifeAssessment;
  if (!state.character || !a) return;
  const age = characterAge();
  if (!a.forty && age >= LIFE_ASSESSMENT_CONFIG.milestoneAge &&
      (a.pendingForty || a.lastAge === null || a.lastAge < LIFE_ASSESSMENT_CONFIG.milestoneAge)) {
    a.forty = { recordId:assessmentRecord('forty').id, acknowledged:false };
    a.pendingForty = false;
  }
  a.lastAge = age;
}
function validLifeAssessment(value) {
  const a = value.lifeAssessment;
  const validReport = report => report && typeof report.id === 'string' &&
    ['interim','forty','final'].includes(report.kind) && report.rulesVersion === 1 && LIFE_PATHS[report.path] &&
    report.snapshot && typeof report.snapshot.name === 'string' && Number.isFinite(report.snapshot.age) &&
    Array.isArray(report.snapshot.timeline) && Array.isArray(report.snapshot.relationships) && Array.isArray(report.snapshot.achievements) &&
    report.snapshot.ratings && Object.keys(DEVELOPMENT_CONFIG.ratingWeights).every(k => Number.isFinite(report.snapshot.ratings[k])) &&
    report.snapshot.health && ['energy','maxEnergy','fatigue','habit','happiness','stress'].every(k => Number.isFinite(report.snapshot.health[k])) &&
    Number.isFinite(report.snapshot.netWorth) && Number.isFinite(report.snapshot.salary) &&
    report.snapshot.timeline.every(row => row && typeof row.text === 'string') &&
    report.rules && Array.isArray(report.rules.grades) && report.rules.grades.length > 0 &&
    report.rules.paths && Object.keys(LIFE_PATHS).every(path => report.rules.paths[path]?.weights &&
      Object.keys(LIFE_ASSESSMENT_CONFIG.axisLabels).every(key => Number.isFinite(report.rules.paths[path].weights[key]))) &&
    typeof report.signature === 'string' &&
    Object.keys(LIFE_PATHS).every(path => report.paths?.[path] && report.paths[path].axes &&
      Object.keys(LIFE_ASSESSMENT_CONFIG.axisLabels).every(key => Number.isFinite(report.paths[path].axes[key]) &&
        report.paths[path].axes[key] >= 0 && report.paths[path].axes[key] <= 100) &&
      LIFE_ASSESSMENT_CONFIG.grades.some(g => g.id === report.paths[path].grade) &&
      Array.isArray(report.paths[path].sssMissing) && Array.isArray(report.paths[path].sssFloors) &&
      Number.isFinite(report.paths[path].total));
  return a && a.schema === 1 && (a.path === 'auto' || LIFE_PATHS[a.path]) && Array.isArray(a.records) &&
    a.records.every(validReport) && new Set(a.records.map(r => r.id)).size === a.records.length &&
    (a.finalId === null || a.records.some(r => r.id === a.finalId && r.kind === 'final')) &&
    (a.forty === null || (typeof a.forty.acknowledged === 'boolean' && a.records.some(r => r.id === a.forty.recordId && r.kind === 'forty'))) &&
    (a.lastAge === null || Number.isFinite(a.lastAge)) && typeof a.pendingForty === 'boolean' &&
    (!a.resume || (typeof a.resume.phase === 'string' && typeof a.resume.ending === 'string' &&
      [...CORE_PHASES,...LIFE_PHASES,...CAMPUS_PHASES,...SOCIAL_PHASES,...STUDY_PHASES,...CAREER_PHASES,...MEMOIR_PHASES,...DEGREE_PHASES,...LIFESTYLE_PHASES,...MILITARY_PHASES].includes(a.resume.phase) &&
      validReflectionFields({ reflection:a.resume.reflection })));
}
function renderAssessmentReport(parent, report, timeline = false) {
  const s = report.snapshot, r = report.paths[report.path];
  parent.append(element('h3', `${LIFE_PATHS[report.path].title} · ${r.grade} — ${r.gradeTitle}`));
  parent.append(element('p', `종합 ${r.total.toFixed(1)} / 100 · 평가 규칙 v${report.rulesVersion}. 현재 기록에 대한 게임 평가이며 사람의 가치를 뜻하지 않습니다.`));
  list(parent, [
    `${s.name} · ${s.age}세 · ${s.education}`,
    `${s.organization} / ${s.job} · 연봉 ${s.salary ? `${s.salary}만원` : '고정 연봉 미기록'} · 순자산 ${s.netWorth}만원`,
    `OVR ${s.ratings.overall.toFixed(1)} · 취업 ${s.ratings.employment.toFixed(1)} · 석사 ${s.ratings.masters.toFixed(1)} · 박사 ${s.ratings.phd.toFixed(1)} (표시용·평가에 재합산하지 않음)`,
    `에너지 ${s.health.energy}/${s.health.maxEnergy} · 피로 ${s.health.fatigue} · 운동 ${s.health.habit.toFixed(1)} · 행복 ${s.health.happiness} · 스트레스 ${s.health.stress}`,
    ...Object.entries(r.axes).map(([key,score]) => `${LIFE_ASSESSMENT_CONFIG.axisLabels[key]}: ${score.toFixed(1)} (가중치 ${Math.round(report.rules.paths[report.path].weights[key] * 100)}%)`),
  ]);
  const details = element('details'); details.append(element('summary','다섯 진로별 평가와 최고 등급 조건'));
  for (const [path, result] of Object.entries(report.paths)) {
    details.append(element('p', `${LIFE_PATHS[path].title}: ${result.grade} · ${result.total.toFixed(1)}점`));
    const missing = [...result.sssMissing,...result.sssFloors];
    details.append(element('p', missing.length ? `SSS 보완: ${missing.join(' · ')}` :
      result.total < report.rules.grades[0].minimum ? `SSS 종합점수 ${report.rules.grades[0].minimum} 필요` : 'SSS 조건 충족', 'muted'));
  }
  parent.append(details);
  parent.append(element('h3','대표 업적 (기존 기록에서 확인)'));
  list(parent,s.achievements.length ? s.achievements.map(a => a.title) : ['새로운 경험을 쌓아 가는 중']);
  parent.append(element('h3','주요 인간관계'));
  list(parent,s.relationships.map(n => `${n.name}: 신뢰 ${n.trust} · 친밀도 ${n.intimacy}`));
  parent.append(element('p', LIFE_PATHS[report.path].description,'muted'));
  if (timeline) {
    const t = element('details'); t.append(element('summary','주요 인생 타임라인'));
    list(t,s.timeline.map(row => `${row.year || '이전 연도 미상'}: ${row.text}`)); parent.append(t);
  }
}
function openLifeReview(recordId = null) {
  if (!state.character) return;
  const a = state.lifeAssessment;
  const report = recordId ? a.records.find(r => r.id === recordId) : assessmentRecord();
  if (!report) return;
  const root = $('life-review-content'); root.replaceChildren();
  root.append(element('h2',report.kind === 'forty' ? `${LIFE_ASSESSMENT_CONFIG.milestoneAge}세 인생 이정표${report.snapshot.age !== 40 ? ` · 현재 ${report.snapshot.age}세 기록` : ''}` :
    report.kind === 'final' ? '저장된 최종 인생 평가' : '현재까지의 인생 중간 결산'));
  root.append(element('p','결산만 확인하면 게임은 끝나지 않으며, 돈·경험·나이·능력치 보상도 발생하지 않습니다.'));
  const select = selectOptions([['auto','현재 진로에 맞춰 추천'],...Object.entries(LIFE_PATHS).map(([id,p]) => [id,p.title])],a.path);
  formField(root,'life-path','평가할 삶의 방향 (변경 시 새 중간 결산)',select);
  select.addEventListener('change',() => { a.path = select.value; openLifeReview(); });
  renderAssessmentReport(root,report,true);
  addButton(root,'계속 진행하기','결산 화면만 닫습니다.',() => {
    if (report.kind === 'forty') a.forty.acknowledged = true;
    save(); $('life-review-dialog').close(); render();
  },false,true);
  addButton(root,'이 결산으로 인생 마무리','선택한 경우에만 정상 엔딩으로 기록. 추가 수입·시간 보상 없음.',() => {
    if (!confirm('현재 기록으로 인생을 마무리할까요? 결산 전 진행도 보관합니다.')) return;
    if (state.phase !== 'ending') {
      a.resume = { phase:state.phase, ending:state.ending,
        reflection:JSON.parse(JSON.stringify(state.reflection)) };
    }
    if (!state.ending || state.phase !== 'ending') state.ending = `${LIFE_PATHS[report.path].title} · 나의 인생 마무리`;
    const final = assessmentRecord('final',report.path);
    a.finalId = final.id;
    if (report.kind === 'forty') a.forty.acknowledged = true;
    state.phase = 'ending';
    if (a.resume) state.reflection.snapshot = null;
    $('life-review-dialog').close(); commit();
  });
  save();
  if (!$('life-review-dialog').open) $('life-review-dialog').showModal();
}
function appendEndingAssessment(scene) {
  const a = state.lifeAssessment, report = a.records.find(r => r.id === a.finalId);
  if (report) {
    renderAssessmentReport(scene,report);
    addButton(scene,'최종 인생 평가 다시 보기','기록 당시의 등급·기준을 유지',() => openLifeReview(report.id));
  }
  if (a.resume) addButton(scene,'결산 전 진행으로 계속','원래 선택 화면과 기록을 복원합니다.',choose('ending',() => {
    const resume = a.resume; state.phase = resume.phase; state.ending = resume.ending;
    state.reflection = resume.reflection; a.resume = null; a.finalId = null;
  }));
}
function renderAssessmentSidebar() {
  $('life-review-button').hidden = !state.character;
  const milestone = state.lifeAssessment.forty;
  $('forty-review-button').hidden = !milestone;
  if (milestone) $('forty-review-button').textContent = milestone.acknowledged ? '40세 이정표 다시 보기' : '40세 인생 결산 도착 · 확인하기';
}
function renderLifeComparison(parent) {
  parent.append(element('h3','네 삶의 비교 · 저장 시점 기준'));
  const wrap = element('div',undefined,'comparison-scroll');
  const table = element('table'), head = element('tr');
  ['슬롯·이름','나이','학력','직업·소속','연봉','순자산','OVR','평가','대표 업적','엔딩 유형'].forEach(t => head.append(element('th',t)));
  const thead = element('thead'); thead.append(head); table.append(thead);
  const tbody = element('tbody');
  slotStore.slots.forEach((slot,index) => {
    const row = element('tr');
    if (!slot?.data.character) {
      for (const text of [`${index + 1} · 빈 슬롯`,...Array(9).fill('—')]) row.append(element('td',text));
    } else {
      const data = slot.data;
      const report = data.phase === 'ending' ? data.lifeAssessment.records.find(r => r.id === data.lifeAssessment.finalId) : null;
      const current = evaluateLife(data,data.lifeAssessment.path);
      const evaluation = report || current;
      const s = current.snapshot, r = evaluation.paths[evaluation.path];
      for (const text of [
        `${index + 1} · ${s.name}`,`${s.age}세`,s.education,`${s.organization} / ${s.job}`,
        s.salary ? `${s.salary}만원` : '미기록',`${s.netWorth}만원`,s.ratings.overall.toFixed(1),
        `${r.grade} · ${LIFE_PATHS[evaluation.path].title}${report ? ` (최종·${report.snapshot.age}세 평가)` : ' (현재)'}`,
        s.achievements.slice(0,4).map(a => a.title).join(' · ') || '진행 중',
        data.ending || '진행 중',
      ]) row.append(element('td',text));
    }
    tbody.append(row);
  });
  table.append(tbody); wrap.append(table); parent.append(wrap);
}
