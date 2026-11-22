// 3단계. 등록·이사·장학금·상환은 저장된 원장으로 중복 적용을 막습니다.
const CAMPUS_PHASES = ['termBudget', 'graduationReview'];
const housingById = id => HOUSING.find(housing => housing.id === id);
function initialCampusFields() {
  return {
    campus: {
      housing: { type: 'home', deposit: 0, refundRate: 1, active: false },
      ledgers: {}, debt: 0, borrowed: 0, repaid: 0, transactions: [],
      transactionSequence: 0, preparationTurns: 0, budgetReturnPhase: 'semester',
    },
    academic: {
      project: false, industryProject: false, internationalSeminar: false,
      retakes: {}, warnings: [], recognized: { major: 0, general: 0 },
      requiredWaivers: [], legacyProjectWaiver: false, legacyGraduationApproved: false,
    },
  };
}
function schoolPolicy(value = state) {
  return { internshipThreshold: CONFIG.internship.minimumExperience,
    ...UNIVERSITY_POLICIES.default, ...(UNIVERSITY_POLICIES[value.life.university] || {}) };
}
function campusSchool() {
  return universityById(state.life.university) || CAMPUS_CONFIG.legacySchool;
}
function upgradeCampusState(value) {
  const additions = initialCampusFields();
  const admitted = value.life.admissionYear !== null;
  if (admitted) {
    // v1/v2에는 학기 정산이 없었으므로 현재 학기까지 새 채무를 만들지 않습니다.
    for (let semester = 1; semester <= value.semester; semester++) {
      additions.campus.ledgers[semester] = { status: 'waived', migration: true, charged: 0 };
    }
    additions.academic.legacyProjectWaiver = true;
    additions.academic.legacyGraduationApproved = value.life.graduationYear !== null ||
      (value.semester === 8 && value.phase === 'vacationResult');
    const completed = value.life.graduationYear !== null ? 8 : value.semester - 1;
    for (let index = 0; index < completed; index++) {
      const courses = value.terms[index].report?.courses || [];
      const major = courses.filter((_, courseIndex) => courseIndex !== 3).reduce((sum, course) => sum + (course.point >= 1 ? course.credits : 0), 0);
      const general = courses.filter((_, courseIndex) => courseIndex === 3).reduce((sum, course) => sum + (course.point >= 1 ? course.credits : 0), 0);
      // 과거 버전에 없던 과목은 이수 인정으로 보충하되 성적표·평점은 만들지 않습니다.
      additions.academic.recognized.major += Math.max(0, 9 - major);
      additions.academic.recognized.general += Math.max(0, 3 - general);
    }
    additions.academic.requiredWaivers = CAMPUS_CONFIG.graduation.required.filter(id => {
      const semester = Number(id.split('-')[0].slice(1));
      return semester <= completed;
    });
  }
  return { ...value, ...additions, version: CONFIG.saveVersion };
}
function validCampusFields(value) {
  const campus = value.campus;
  const academic = value.academic;
  return campus && academic && housingById(campus.housing?.type) &&
    ['debt', 'borrowed', 'repaid', 'preparationTurns', 'transactionSequence'].every(key => Number.isFinite(campus[key]) && campus[key] >= 0) &&
    Number.isFinite(campus.housing.deposit) && campus.housing.deposit >= 0 &&
    Number.isFinite(campus.housing.refundRate) && campus.housing.refundRate >= 0 && campus.housing.refundRate <= 1 &&
    campus.ledgers && Object.values(campus.ledgers).every(ledger =>
      ['pending', 'settled', 'waived'].includes(ledger.status) &&
      (ledger.status !== 'pending' || (housingById(ledger.housingChoice) && ledger.applications && ledger.eligibility))) &&
    Array.isArray(campus.transactions) && academic.retakes && Array.isArray(academic.warnings) &&
    Array.isArray(academic.requiredWaivers) && Number.isFinite(academic.recognized?.major) &&
    Number.isFinite(academic.recognized?.general) &&
    (value.phase !== 'termBudget' || Boolean(campus.ledgers[value.semester]));
}
function ledgerTransaction(kind, amount, text) {
  state.campus.transactionSequence++;
  state.campus.transactions.push({
    id: state.campus.transactionSequence, kind, amount, text,
    year: state.life.year, term: state.semester, balance: state.money, debt: state.campus.debt,
  });
}
function openTermBudget(returnPhase = 'semester') {
  if (!state.campus.ledgers[state.semester]) {
    const previous = state.terms.slice(0, state.semester - 1).filter(term => term.report).at(-1);
    state.campus.ledgers[state.semester] = {
      status: 'pending', housingChoice: state.campus.housing.type === 'dorm' && !campusSchool().dorm ? 'home' : state.campus.housing.type,
      applications: {}, eligibility: {
        gpa: previous?.report.gpa || 0, research: state.research, money: state.money,
        economy: state.character.abilities.economy,
      },
    };
    prepareSocialTerm();
  }
  state.campus.budgetReturnPhase = returnPhase;
  state.phase = 'termBudget';
}
function entryScholarship() {
  if (state.semester !== 1) return 0;
  return state.entrance.attempts.flatMap(attempt => attempt.applications)
    .find(app => app.university === state.life.university && app.accepted)?.scholarship || 0;
}
function termQuote() {
  const ledger = state.campus.ledgers[state.semester];
  if (ledger?.status !== 'pending') return ledger?.quote || null;
  const school = campusSchool();
  const plan = currentExchangePlan();
  const exchange = plan ? exchangeById(plan.program) : null;
  const housing = exchange ? { ...housingById('dorm'), deposit: 0, rent: exchange.housing, energy: 0, happiness: 5 } : housingById(ledger.housingChoice);
  const tuition = Math.round(school.tuition * (state.semester > 8 ? CAMPUS_CONFIG.extraTuitionRate : 1));
  const rent = housing.rent ?? Math.round(school.housing * housing.rentFactor);
  const living = Math.round(CAMPUS_CONFIG.livingCost * difficultyConfig().living);
  const travel = exchange?.travel || 0;
  const entry = Math.min(tuition, entryScholarship());
  const awarded = Object.values(ledger.applications).reduce((sum, result) => sum + (result.accepted ? result.amount : 0), 0);
  const exchangeGrant = plan?.grant || 0;
  const discount = Math.min(tuition + rent + living + travel, entry + awarded + exchangeGrant);
  const refund = Math.floor(state.campus.housing.deposit * state.campus.housing.refundRate);
  const cashFlow = tuition + rent + living + travel - discount + housing.deposit - refund;
  return {
    school: school.name, housing: housing.title, housingId: housing.id,
    tuition, rent, living, travel, exchangeGrant, foreign: Boolean(exchange), entry, awarded, discount, refund, deposit: housing.deposit,
    cashFlow, commute: housing.commute, energy: housing.energy, happiness: housing.happiness,
  };
}
function scholarshipEligibility(scholarship, snapshot) {
  if (scholarship.minimumGpa && snapshot.gpa < scholarship.minimumGpa) return '직전 공개 성적이 조건에 미달합니다';
  if (scholarship.minimumResearch && snapshot.research < scholarship.minimumResearch) return '연구 경험이 부족합니다';
  if (scholarship.maximumMoney && snapshot.money > scholarship.maximumMoney && snapshot.economy > scholarship.maximumEconomy) return '생활비 지원 기준에 해당하지 않습니다';
  return '';
}
function applyScholarship(id) {
  const ledger = state.campus.ledgers[state.semester];
  const scholarship = SCHOLARSHIPS.find(item => item.id === id);
  if (ledger.status !== 'pending' || ledger.applications[id]) return;
  const reason = scholarshipEligibility(scholarship, ledger.eligibility);
  const draw = reason ? null : Math.random();
  const probability = clamp(scholarship.probability * difficultyConfig().scholarship, .05, .97);
  const accepted = !reason && draw < probability;
  ledger.applications[id] = { accepted, amount: accepted ? scholarship.amount : 0, draw,
    probability, reason: reason || (accepted ? '선발' : '이번 학기 미선발') };
  log(`${scholarship.title}: ${accepted ? `선발, ${scholarship.amount}만원 정산 감면 예정` : ledger.applications[id].reason}. 결과는 이번 학기에 다시 추첨하지 않는다.`);
}
function borrowForBudget() {
  const ledger = state.campus.ledgers[state.semester];
  if (ledger.status !== 'pending') return;
  const amount = Math.max(0, termQuote().cashFlow + (ledger.reserveFunded ? 0 : CAMPUS_CONFIG.loan.activityReserve) - state.money);
  if (!amount) return;
  if (state.campus.debt + amount > CAMPUS_CONFIG.loan.limit) return;
  state.money += amount;
  state.campus.debt += amount;
  state.campus.borrowed += amount;
  ledger.reserveFunded = true;
  ledgerTransaction('loan', amount, '학기 정산 부족액 대출');
  log(`학자금 ${amount}만원을 대출받았다. 무이자이며 졸업 후 급여의 ${CAMPUS_CONFIG.loan.repaymentRate * 100}%로 자동 상환한다.`);
}
function settleTerm() {
  const ledger = state.campus.ledgers[state.semester];
  if (ledger.status !== 'pending') return;
  const quote = termQuote();
  const housing = housingById(quote.housingId);
  if ((!quote.foreign && housing.requiresDorm && !campusSchool().dorm) || state.money < quote.cashFlow) return;
  state.money -= quote.cashFlow;
  state.campus.housing = { type: housing.id, deposit: quote.deposit, refundRate: housing.refundRate, active: true };
  ledger.status = 'settled'; ledger.quote = quote; ledger.charged = quote.cashFlow;
  applyEffects({ energy: quote.energy });
  applyAbilities({ happiness: quote.happiness });
  ledgerTransaction('settlement', -quote.cashFlow,
    `등록금 ${quote.tuition}, 주거비 ${quote.rent}, 기본 생활비 ${quote.living}, 감면 ${quote.discount}, 보증금 납부 ${quote.deposit}/반환 ${quote.refund}`);
  log(`${semesterName()} 시작! 이번 지출 ${quote.cashFlow}만원 · 장학금 감면 ${quote.discount}만원. 주거·대출 내역은 인생 기록에 보관했습니다.`);
  state.phase = state.campus.budgetReturnPhase;
  startExchangeIfPlanned();
}
function releaseHousing(reason) {
  if (!state.campus.housing.active) return;
  const refund = Math.floor(state.campus.housing.deposit * state.campus.housing.refundRate);
  state.campus.housing.deposit = 0;
  state.campus.housing.active = false;
  state.money += refund;
  ledgerTransaction('depositReturn', refund, `${reason}: 보증금 반환`);
  log(`${reason}으로 퇴거했다. 계약에 따라 보증금 ${refund}만원을 반환받았다.`);
}
function repayLoan(amount, key) {
  if (state.campus.transactions.some(transaction => transaction.key === key)) return 0;
  const payment = Math.min(amount, state.campus.debt, state.money);
  if (payment <= 0) return 0;
  state.money -= payment;
  state.campus.debt -= payment;
  state.campus.repaid += payment;
  ledgerTransaction('repayment', -payment, '학자금 대출 상환');
  state.campus.transactions.at(-1).key = key;
  log(`학자금 ${payment}만원 상환. 남은 대출 ${state.campus.debt}만원.`);
  return payment;
}
function universityAction(action) {
  const policy = schoolPolicy();
  return {
    ...action, effects: { ...action.effects, money: (action.effects.money || 0) + (action.id === 'cafe' ? policy.cafeBonus : 0) },
    research: (action.research || 0) + (action.id === 'lab' ? policy.researchBonus : 0),
  };
}
function effectiveTranscript(upTo = state.terms.length, value = state) {
  const selected = new Map();
  const policy = schoolPolicy(value).retakePolicy;
  value.terms.slice(0, upTo).forEach((term, index) => {
    term.report?.courses.forEach((course, courseIndex) => {
      const entry = { ...course, id: course.id || `s${index + 1}-c${courseIndex}`,
        category: course.category || (courseIndex === 3 ? 'general' : 'major') };
      const previous = selected.get(entry.id);
      if (!previous || policy === 'latest' || entry.point > previous.point) selected.set(entry.id, entry);
    });
  });
  return [...selected.values()];
}
function academicProgress() {
  const transcript = effectiveTranscript();
  const passed = transcript.filter(course => course.point >= 1);
  const major = passed.filter(course => course.category === 'major').reduce((sum, course) => sum + course.credits, state.academic.recognized.major);
  const general = passed.filter(course => course.category === 'general').reduce((sum, course) => sum + course.credits, state.academic.recognized.general);
  const missingRequired = CAMPUS_CONFIG.graduation.required.filter(id =>
    !state.academic.requiredWaivers.includes(id) && !passed.some(course => course.id === id));
  const policy = schoolPolicy();
  const issues = [];
  const requirements = CAMPUS_CONFIG.graduation;
  if (major < requirements.major) issues.push(`전공 ${requirements.major - major}학점 부족`);
  if (general < requirements.general) issues.push(`교양 ${requirements.general - general}학점 부족`);
  if (major + general < requirements.total) issues.push(`총 ${requirements.total - major - general}학점 부족`);
  if (missingRequired.length) issues.push(`필수 과목 미이수 ${missingRequired.length}개 (재수강 필요)`);
  if (cumulativeGpa() < requirements.minimumGpa) issues.push(`누적 평점 ${requirements.minimumGpa.toFixed(1)} 미달`);
  if (requirements.project && !state.academic.project && !state.academic.legacyProjectWaiver) issues.push('졸업 프로젝트 미완료');
  if (!state.academic.legacyProjectWaiver) {
    if (state.research < policy.requiredResearch) issues.push(`대학 추가 요건: 연구 경험 ${policy.requiredResearch} 필요`);
    if (policy.industryProject && !state.academic.industryProject) issues.push('대학 추가 요건: 산학 프로젝트 미완료');
    if (policy.internationalSeminar && !state.academic.internationalSeminar) issues.push('대학 추가 요건: 국제 소통 세미나 미완료');
  }
  return { major, general, total: major + general, missingRequired, issues };
}
function finaliseUndergraduateTerm() {
  completeExchangeIfActive();
  advanceTime(LIFE_CONFIG.time.undergraduateTerm, `undergraduate:${state.semester}`);
  if (state.semester >= 8) {
    const progress = academicProgress();
    if (!state.academic.legacyGraduationApproved && progress.issues.length) {
      state.phase = 'graduationReview';
      log(`졸업 요건 확인: ${progress.issues.join(', ')}. 초과 학기에서 보완할 수 있다.`);
      return;
    }
    state.life.graduationYear = state.life.year;
    state.life.highestDegree = '학사';
    releaseHousing('학부 졸업');
    log(`${state.semester}개 학기를 마치고 졸업했다. ${characterAge()}세, 학점·프로젝트 요건을 확인했다.`);
    state.phase = 'hub';
  } else {
    state.semester++;
    openTermBudget(state.semester === 6 && state.competition ? 'competitionCrisis' : 'semester');
  }
}
function renderAcademicActions(scene) {
  const choices = choiceContainer(scene);
  if (state.semester >= 7 && !state.academic.project && !state.academic.legacyProjectWaiver) {
    addButton(choices, '졸업 프로젝트', `주요 행동 1회 · ${effectsText(CAMPUS_CONFIG.project)}`, choose('semester', () => {
      if (unavailable(CAMPUS_CONFIG.project) || currentTerm().actions.length >= 3) return;
      applyEffects(CAMPUS_CONFIG.project); currentTerm().actions.push('capstone');
      state.academic.project = true; experience('capstone'); log('졸업 프로젝트를 완성했다. 연구·협업 결과를 졸업 포트폴리오에 담았다.'); afterAction();
    }), unavailable(CAMPUS_CONFIG.project));
  }
  for (const [flag, title, id] of [
    ['industryProject', '산학 프로젝트', 'industry'],
    ['internationalSeminar', '국제 소통 세미나', 'seminar'],
  ]) {
    if (!schoolPolicy()[flag] || state.academic[flag]) continue;
    addButton(choices, title, `대학 추가 졸업 요건 · 주요 행동 1회 · ${effectsText(CAMPUS_CONFIG.seminar)}`, choose('semester', () => {
      if (unavailable(CAMPUS_CONFIG.seminar) || currentTerm().actions.length >= 3) return;
      applyEffects(CAMPUS_CONFIG.seminar); currentTerm().actions.push(id); state.academic[flag] = true;
      if (id === 'industry') state.practice++; else applyAbilities({ language: 5 });
      experience(id); log(`${title}를 이수했다. 졸업 요건과 ${id === 'industry' ? '실무 경험' : '외국어 능력'}에 반영됐다.`); afterAction();
    }), unavailable(CAMPUS_CONFIG.seminar));
  }
  const planned = state.academic.retakes[state.semester] || [];
  for (const course of effectiveTranscript(state.semester - 1).filter(course =>
    course.point <= CAMPUS_CONFIG.retake.eligibleAtMost && !planned.includes(course.id))) {
    const effects = { money: CAMPUS_CONFIG.retake.money, energy: CAMPUS_CONFIG.retake.energy };
    addButton(choices, `${course.name} 재수강 [${course.id}]`,
      `기존 ${course.point.toFixed(1)} · 주요 행동 1회 · ${effectsText(effects)} · 상한 ${CAMPUS_CONFIG.retake.maximum.toFixed(1)} · ${schoolPolicy().retakePolicy === 'highest' ? '높은 성적' : '최근 성적'} 반영`,
      choose('semester', () => {
        if (unavailable(effects) || currentTerm().actions.length >= 3) return;
        applyEffects(effects);
        (state.academic.retakes[state.semester] ||= []).push(course.id);
        currentTerm().actions.push(`retake:${course.id}`);
        log(`${course.name} 재수강에 참여했다. 새 성적은 이번 성적표 공개 때 확정된다.`);
        afterAction();
      }), unavailable(effects));
  }
}
function applyAcademicReport(courses, counts) {
  const workCount = (counts.cafe || 0) + (counts.tutor || 0);
  const migratedTerm = state.campus.ledgers[state.semester]?.migration;
  const penalty = (!migratedTerm && workCount >= CAMPUS_CONFIG.workPenalty.threshold ?
    (workCount - 1) * CAMPUS_CONFIG.workPenalty.perAction : 0) +
    (!migratedTerm && state.social.strainTerms[state.semester] ? SOCIAL_CONFIG.strainGradePenalty : 0);
  const grade = point => ['F', 'F', 'D0', 'D+', 'C0', 'C+', 'B0', 'B+', 'A0', 'A+'][Math.round(point * 2)];
  courses.forEach((course, index) => {
    course.id = `s${state.semester}-c${index}`;
    course.category = index === 3 ? 'general' : 'major';
    course.point = Math.max(0, Math.round((course.point - penalty) * 2) / 2);
    if (course.point < 1) course.point = 0;
    course.grade = grade(course.point);
  });
  for (const id of state.academic.retakes[state.semester] || []) {
    const old = effectiveTranscript(state.semester - 1).find(course => course.id === id);
    const point = Math.min(CAMPUS_CONFIG.retake.maximum, Math.max(1, old.point + CAMPUS_CONFIG.retake.improvement + (counts.study || 0) * .5));
    courses.push({ ...old, point, grade: grade(point), repeated: true });
  }
}
function renderBudget() {
  const ledger = state.campus.ledgers[state.semester];
  if (ledger.status !== 'pending') {
    const scene = setScene('학기 정산 기록', semesterName(),
      ledger.status === 'waived' ? '업데이트 이전에 시작한 학기입니다. 소급 청구하지 않으며 주거 선택은 다음 학기부터 적용합니다.' : '이미 정산한 학기입니다. 다시 열어도 비용과 보증금을 차감하지 않습니다.');
    if (ledger.quote) list(scene, [
      `등록금 ${ledger.quote.tuition}, 주거비 ${ledger.quote.rent}, 기본 생활비 ${ledger.quote.living}, 감면 ${ledger.quote.discount}만원`,
      `보증금 납부 ${ledger.quote.deposit}, 이전 보증금 반환 ${ledger.quote.refund}만원 · 실제 현금 지출 ${ledger.charged}만원`,
    ]);
    addButton(choiceContainer(scene), '학기로 돌아가기', '', choose('termBudget', () => { state.phase = state.campus.budgetReturnPhase; }));
    return;
  }
  const school = campusSchool();
  const scene = setScene('학기 시작 · 주요 행동 소모 없음', `${semesterName()}의 재정과 주거`,
    `${school.name}. 주거·장학금·대출을 결정한 뒤 등록합니다. 보증금은 지출이 아닌 반환 가능한 자산입니다.`);
  const beforeDetails = scene.children.length;
  const choices = choiceContainer(scene);
  if (currentExchangePlan()) scene.append(element('p', '이번 학기는 해외 교류대학 기숙사를 이용합니다. 국내 보증금을 반환하며 국내 주거비와 중복 청구하지 않습니다.'));
  for (const housing of currentExchangePlan() ? [] : HOUSING) {
    const unavailableDorm = housing.requiresDorm && !school.dorm;
    const selected = ledger.housingChoice === housing.id;
    addButton(choices, `${housing.title}${selected ? ' 선택됨' : ' 선택'}`,
      `보증금 ${housing.deposit} · 학기 주거비 ${housing.rent ?? Math.round(school.housing * housing.rentFactor)}만원 · 편도 ${housing.commute}분 · 체력 ${housing.energy} · 행복도 ${housing.happiness >= 0 ? '+' : ''}${housing.happiness} · 사생활 ${housing.privacy} · 퇴거 시 보증금 ${housing.refundRate * 100}% 반환${unavailableDorm ? ' · 선택 불가: 기숙사 미제공' : ''}`,
      choose('termBudget', () => { if (!unavailableDorm) ledger.housingChoice = housing.id; }), unavailableDorm || selected);
  }
  scene.append(element('h3', '이번 학기 장학금 신청'));
  scene.append(element('p', '선발 결과는 신청 즉시 저장합니다. 선발액은 정산 감면으로 한 번만 적용하며 초과분은 현금 지급하지 않습니다.', 'muted'));
  const scholarships = choiceContainer(scene);
  for (const scholarship of SCHOLARSHIPS) {
    const result = ledger.applications[scholarship.id];
    const reason = scholarshipEligibility(scholarship, ledger.eligibility);
    addButton(scholarships, `${scholarship.title} 신청${result ? ' 완료' : ''}`,
      result ? `${result.reason}${result.accepted ? ` · ${result.amount}만원 감면 예정` : ''}` :
        `${scholarship.description} · ${scholarship.amount}만원 · 조건 충족 시 선발률 ${(clamp(scholarship.probability * difficultyConfig().scholarship, .05, .97) * 100).toFixed(1)}%${reason ? ` · ${reason}` : ''}`,
      choose('termBudget', () => applyScholarship(scholarship.id)), Boolean(result));
  }
  const quote = termQuote();
  scene.append(element('h3', '정산 예정 내역'));
  list(scene, [
    `등록금 ${quote.tuition} + 주거비 ${quote.rent} + 기본 생활비 ${quote.living} + 해외 이동비 ${quote.travel}만원`,
    `입학 장학금 ${quote.entry} + 신청 장학금 ${quote.awarded} + 국제 교류 장학금 ${quote.exchangeGrant} → 실제 감면 ${quote.discount}만원`,
    `새 보증금 ${quote.deposit} − 이전 보증금 반환 ${quote.refund}만원`,
    `이번 현금 필요액 ${quote.cashFlow}만원 · 보유 생활비 ${state.money}만원 · 남은 대출 ${state.campus.debt}만원`,
  ]);
  const shortfall = Math.max(0, quote.cashFlow - state.money);
  const borrowing = Math.max(0, quote.cashFlow + (ledger.reserveFunded ? 0 : CAMPUS_CONFIG.loan.activityReserve) - state.money);
  const overLimit = state.campus.debt + borrowing > CAMPUS_CONFIG.loan.limit;
  const funding = choiceContainer(scene);
  addButton(funding, '부족액 학자금 대출', `정산 부족액 ${shortfall}만원과 등록 후 활동비 예비 ${ledger.reserveFunded ? 0 : CAMPUS_CONFIG.loan.activityReserve}만원 목표를 포함 · 총 대출 ${borrowing}만원 · 무이자 · 한도 ${CAMPUS_CONFIG.loan.limit}만원${overLimit ? ' · 한도 초과' : ''}`,
    choose('termBudget', borrowForBudget), !borrowing || overLimit);
  addButton(funding, '등록 전 단기 근로', `등록을 반년 유예 · 주요 행동 소모 없음 · 수입 +${CAMPUS_CONFIG.preparationWork.income}만원 · 체력 회복 +${CAMPUS_CONFIG.preparationWork.energy} · 학년은 유지`,
    choose('termBudget', () => {
      state.campus.preparationTurns++;
      advanceTime(CAMPUS_CONFIG.preparationWork.halves, `preparation:${state.campus.preparationTurns}`);
      applyEffects({ money: CAMPUS_CONFIG.preparationWork.income, energy: CAMPUS_CONFIG.preparationWork.energy });
      ledgerTransaction('preparationWork', CAMPUS_CONFIG.preparationWork.income, '등록 유예 중 단기 근로');
      log('등록을 반년 유예하고 단기 근로로 생활비를 마련했다. 학기는 아직 시작하지 않았다.');
    }));
  addButton(funding, '정산 확정하고 학기 시작', shortfall ? `선택 불가: ${shortfall}만원 부족` : '비용·보증금·주거 효과를 한 번만 적용합니다.',
    choose('termBudget', settleTerm), Boolean(shortfall), true);
  addButton(funding, '1년 휴학 신청', '등록 전 휴학 · 현재 학년 유지 · 임대 보증금 반환 · 별도 활동 3회', choose('termBudget', () => startLeave('termBudget')));
  const nodes = Array.from(scene.children).slice(beforeDetails);
  scene.append(element('p', `${quote.housing} · 현재 정산액 ${quote.cashFlow}만원 · 대출 잔액 ${state.campus.debt}만원`));
  addButton(scene, '장학금 자동 신청하고 학기 시작',
    `자격에 맞는 장학금을 한 번씩 신청합니다. 부족하면 무이자 대출 최대 ${borrowing}만원(활동비 포함)에 동의하고 시작합니다. 주거 변경·대출 없는 진행은 아래에서 선택하세요.`,
    choose('termBudget', () => {
      for (const scholarship of SCHOLARSHIPS) if (!scholarshipEligibility(scholarship, ledger.eligibility)) applyScholarship(scholarship.id);
      borrowForBudget(); settleTerm();
    }), overLimit, true);
  foldDetails(scene, '주거 변경·직접 정산·휴학', nodes);
}
function renderGraduationReview() {
  const progress = academicProgress();
  const scene = setScene('졸업 요건 확인', '아직 마무리할 일이 남았다',
    `전공 ${progress.major}/${CAMPUS_CONFIG.graduation.major}, 교양 ${progress.general}/${CAMPUS_CONFIG.graduation.general}, 총 ${progress.total}/${CAMPUS_CONFIG.graduation.total}학점.`);
  list(scene, progress.issues);
  addButton(choiceContainer(scene), '초과 학기 등록 준비', `다음 학기 등록금은 정규 학기의 ${CAMPUS_CONFIG.extraTuitionRate * 100}% · 주요 행동 3회 · 누락된 프로젝트·필수 과목 보완`,
    choose('graduationReview', () => {
      state.semester++;
      state.terms.push(newTerm());
      openTermBudget();
    }), false, true);
}
function renderCampusSidebar() {
  const admitted = state.life.admissionYear !== null;
  $('assets-menu').hidden = !admitted;
  $('academic-progress-menu').hidden = !admitted;
  $('assets').replaceChildren();
  $('academic-progress').replaceChildren();
  if (!admitted) return;
  const housing = housingById(state.campus.housing.type);
  list($('assets'), [
    `생활비 ${state.money}만원 · 보증금 자산 ${state.campus.housing.deposit}만원`,
    `순자산 ${state.money + state.campus.housing.deposit - state.campus.debt}만원 (현금 + 보증금 − 대출)`,
    `학자금 대출 ${state.campus.debt}만원 · 누적 차입 ${state.campus.borrowed} · 상환 ${state.campus.repaid}만원`,
    `현재 ${housing.title}${state.campus.housing.active ? '' : ' (활성 임대 계약 없음)'} · 편도 ${housing.commute}분`,
    `학자금은 무이자이며 졸업 후 직장 급여의 ${CAMPUS_CONFIG.loan.repaymentRate * 100}%를 잔액 범위에서 자동 상환합니다.`,
  ]);
  if (state.campus.debt > 0) addButton($('assets'), '대출 직접 상환',
    `${Math.min(CAMPUS_CONFIG.loan.manualPayment, state.campus.debt, state.money)}만원 · 잔액 범위에서 상환 · 행동 소모 없음`, choose(state.phase, () =>
      repayLoan(CAMPUS_CONFIG.loan.manualPayment, `manual:${state.campus.transactionSequence + 1}`)), state.money <= 0);
  const transactions = element('details');
  transactions.append(element('summary', '정산·대출 원장'));
  list(transactions, state.campus.transactions.slice().reverse().map(transaction =>
    `${transaction.year}년 ${semesterName(transaction.term)}: ${transaction.text} (${transaction.amount >= 0 ? '+' : ''}${transaction.amount}만원), 현금 ${transaction.balance}, 대출 ${transaction.debt}`));
  $('assets').append(transactions);
  const progress = academicProgress();
  list($('academic-progress'), [
    `전공 ${progress.major}/${CAMPUS_CONFIG.graduation.major} · 교양 ${progress.general}/${CAMPUS_CONFIG.graduation.general} · 총 ${progress.total}/${CAMPUS_CONFIG.graduation.total}학점`,
    `졸업 프로젝트: ${state.academic.project ? '완료' : state.academic.legacyProjectWaiver ? '이전 저장본 요건 인정' : '7학기 이후 주요 행동으로 완료 필요'}`,
    `학사경고 ${state.academic.warnings.length}회 · 재수강은 ${schoolPolicy().retakePolicy === 'highest' ? '높은' : '최근'} 성적 반영, 중복 학점 없음`,
    '과목은 매 학기 12학점 규모로 압축되어 있습니다. 필수 과목은 1·2학기 전공 이론과 실험입니다.',
  ]);
  if (state.academic.recognized.major + state.academic.recognized.general) $('academic-progress').append(element('p',
    `이전 버전 이수 인정: 전공 ${state.academic.recognized.major}, 교양 ${state.academic.recognized.general}학점. 과거 성적표와 평점은 수정하지 않았습니다.`));
  if (state.phase === 'termBudget') $('stage').textContent = `${semesterName()} 등록 준비`;
  else if (state.phase === 'graduationReview') $('stage').textContent = '졸업 요건 보완';
}
