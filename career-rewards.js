// Amounts are annual 만원. Only NEW applications capture these rules.
const CAREER_REWARDS = {
  hanbit: { fields: ['컴퓨터·데이터','기계·환경'], degree: [0,0,400,850], score: [0,0,3,7], paper: 60, project: 25, experience: 180, negotiation: 600 },
  mirae: { fields: ['기계·환경','컴퓨터·데이터'], degree: [0,0,250,500], score: [0,0,2,4], paper: 25, project: 20, experience: 200, negotiation: 500 },
  daon: { fields: ['컴퓨터·데이터'], degree: [0,0,0,0], score: [0,0,0,0], paper: 0, project: 0, experience: 220, negotiation: 500 },
  gonggam: { fields: ['컴퓨터·데이터','경영·사회'], degree: [0,0,0,0], score: [0,0,0,0], paper: 0, project: 0, experience: 100, negotiation: 150 },
  neulbom: { fields: ['생명·화학','컴퓨터·데이터','기계·환경'], degree: [0,0,600,1400], score: [0,0,5,11], paper: 100, project: 40, experience: 140, negotiation: 600 },
  'hanul-lab': { fields: ['생명·화학','컴퓨터·데이터'], degree: [0,0,400,1100], score: [0,0,4,10], paper: 90, project: 30, experience: 100, negotiation: 400 },
};
const PROGRAM_FIELDS = {
  'kr-ms': ['생명·화학','컴퓨터·데이터'], 'us-ms': ['생명·화학','컴퓨터·데이터'],
  'jp-ms': ['생명·화학','컴퓨터·데이터'], 'kr-phd': ['생명·화학'],
  'us-phd': ['생명·화학'], 'de-phd': ['생명·화학','컴퓨터·데이터'],
  'jp-phd': ['생명·화학','컴퓨터·데이터'], 'de-ms': ['기계·환경','컴퓨터·데이터'],
  'kr-tech-ms': ['컴퓨터·데이터'], 'kr-tech-phd': ['컴퓨터·데이터'],
  'kr-applied-ms': ['기계·환경','컴퓨터·데이터'], 'kr-applied-phd': ['기계·환경','컴퓨터·데이터'],
};
function completedDegreeLevel(value = state) {
  return value.reflection.phdCompleted || value.life.highestDegree === '박사' ||
    value.postgraduate.records.some(d => d.completed && d.degree === 'phd') ? 3 :
    value.master?.completed || value.postgraduate.records.some(d => d.completed && d.degree === 'masters') ? 2 :
      value.life.graduationYear !== null || Boolean(value.master) ? 1 : 0;
}
function careerRecognition(company, value = state) {
  const policy = CAREER_REWARDS[company.id], level = completedDegreeLevel(value);
  const degree = [...value.postgraduate.records, ...(value.postgraduate.active?.completed ? [value.postgraduate.active] : [])]
    .filter(d => d.completed && d.degree === (level === 3 ? 'phd' : 'masters')).at(-1);
  const program = degree?.program || (level === 2 && value.master?.completed ? value.master.program :
    level === 3 && programById(value.flags.acceptedProgram)?.degree === 'phd' ? value.flags.acceptedProgram : null);
  // Legacy degrees with no program retain their recorded major; never infer from a new interest.
  const fields = level >= 2 && program ? PROGRAM_FIELDS[program] || [] : [value.life.major || value.character.interest];
  const related = fields.some(field => policy.fields.includes(field));
  const degreeBonus = related ? policy.degree[level] : 0;
  const researchBonus = related && level >= 2 ? Math.min(5, value.study.papers.length) * policy.paper +
    Math.min(6, value.experiences.lab || 0) * policy.project : 0;
  const experienceBonus = Math.min(10, Math.max(0, value.career.years)) * policy.experience;
  const subtotal = Math.round(company.salary + degreeBonus + researchBonus + experienceBonus);
  const previous = value.career.employmentHistory.at(-1);
  const negotiation = previous && previous.company !== company.id && value.career.years > 0 ?
    Math.max(0, Math.min(Math.round(value.career.salary * 1.04), subtotal + policy.negotiation) - subtotal) : 0;
  let role = company.role;
  if (level === 3 && related && value.research >= 8 && value.study.papers.length) {
    if (company.id === 'neulbom') role = '선임 전문연구원';
    else if (company.id === 'hanul-lab') role = '박사후 전문연구원';
    else if (company.id === 'hanbit') role = '전문 R&D 엔지니어';
  }
  return { ruleset: 1, level, program, fields, related, base: company.salary, degreeBonus,
    researchBonus, experienceBonus: Math.round(experienceBonus), negotiation, salary: subtotal + negotiation,
    scoreBonus: related ? policy.score[level] : 0, role };
}
function recognitionReasons(recognition) {
  if (!recognition) return ['이전 계약의 확정 연봉을 유지합니다.'];
  const r = recognition, reasons = [`기업 기본 연봉 ${r.base}만원`];
  if (r.level >= 2) reasons.push(!r.related ? '전공 적합성 부족: 학위 우대 미적용' :
    r.degreeBonus ? `${r.level === 3 ? '박사' : '석사'} 학위 우대: 초봉 +${r.degreeBonus}만원` : '이 직무는 학위보다 실무 성과를 우대합니다.');
  if (r.researchBonus) reasons.push(`연구실·논문 실적: +${r.researchBonus}만원`);
  if (r.scoreBonus) reasons.push(`관련 학위: 직무 평가 +${r.scoreBonus}점 (합격 보장 아님)`);
  if (r.experienceBonus) reasons.push(`기존 실무 경력 인정: +${r.experienceBonus}만원`);
  if (r.negotiation) reasons.push(`이전 연봉을 반영한 이직 협상: +${r.negotiation}만원`);
  return reasons;
}
function currentCareerRole() {
  return state.career.employmentHistory.at(-1)?.contract?.role || companyById(state.career.employer)?.role || '';
}
function annualSalaryReview(company, action, salary) {
  const rate = .01 + company.growth / 10000 + Math.min(80, state.career.performance) / 8000 +
    (action.id === 'research' && company.researchUse >= 90 && state.research >= 8 ? .004 : 0);
  return { rate, raise: Math.round(salary * rate), nextSalary: salary + Math.round(salary * rate) };
}
