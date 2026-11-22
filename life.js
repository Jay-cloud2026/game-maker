// 기존 학부·취업·대학원 흐름 앞에 붙는 인생 시뮬레이션 2단계.
// 화면 함수는 난수를 사용하지 않습니다. 생성·접수 시 결과를 확정하고 commit()으로 저장합니다.
const LIFE_PHASES = ['character', 'hsReady', 'hsReport', 'collegeExplore', 'collegeReview',
  'collegeMail', 'collegeDecision', 'collegeEnrollment', 'retake', 'retakeReady', 'alternative'];
const universityById = id => UNIVERSITIES.find(university => university.id === id);
const randomBetween = (low, high) => low + Math.random() * (high - low);
const randomInt = (low, high) => Math.floor(randomBetween(low, high + 1));
const characterAge = () => state.character ? state.life.year - state.character.birthYear : null;
const entranceAttempt = () => state.entrance.attempts[state.entrance.attempts.length - 1];

function initialLifeFields() {
  return {
    character: null,
    life: {
      year: LIFE_CONFIG.startYear, half: 0, timeKeys: [], origin: 'new',
      university: null, major: null, admissionYear: null, graduationYear: null,
      highestDegree: '고등학교 졸업', shortResearchTurns: 0,
    },
    entrance: { attempts: [], selection: [], retry: null, selectedOffer: null },
  };
}
function legacyCharacter() {
  return {
    name: '이어온 학생', gender: '', birthYear: LIFE_CONFIG.birthYear, startAge: 18,
    personality: 'steady', interest: '생명·화학', highSchool: '이전 기록 없음',
    abilities: Object.fromEntries(Object.keys(LIFE_CONFIG.abilityLabels).map(key =>
      [key, key === 'stress' ? 20 : key === 'happiness' ? 65 : 50])),
  };
}
function migrateSave(value) {
  const loaded = migrateHistoricalSave(value);
  if (value.version === CONFIG.saveVersion) return loaded;
  const degree = value.version < 10 ? upgradeDegrees(value.version < 9 ? upgradeGraduateAdmissions(value.version < 8 ? upgradeDevelopmentState(loaded) : loaded) : loaded) : loaded;
  const military = value.version < 12 ? upgradeMilitary(value.version < 11 ? upgradeLifestyle(degree) : degree) : degree;
  return upgradeLifeAssessment(military);
}
function migrateHistoricalSave(value) {
  if (!value || ![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, CONFIG.saveVersion].includes(value.version)) throw new Error('지원하지 않는 저장 버전');
  const loaded = JSON.parse(JSON.stringify(value)); // 원본을 수정하지 않는 순수 마이그레이션
  if (loaded.version === CONFIG.saveVersion) {
    if (loaded.social && !loaded.social.discussionUsed) loaded.social.discussionUsed = {};
    return loaded;
  }
  if (loaded.version === 12) {
    if (!validBaseSave(loaded) || !validLifeFields(loaded) || !validCampusFields(loaded) ||
      !validSocialFields(loaded) || !validStudyFields(loaded) || !validCareerFields(loaded) ||
      !validReflectionFields(loaded) || !validDevelopmentFields(loaded) || !validGraduateAdmissions(loaded) ||
      !validDegreeFields(loaded) || !validLifestyle(loaded) || !validMilitary(loaded) || !validPhaseContext(loaded)) throw new Error('잘못된 버전 12 저장본');
    return loaded;
  }
  if (loaded.version === 11) {
    if (!validBaseSave(loaded) || !validLifeFields(loaded) || !validDegreeFields(loaded) || !validLifestyle(loaded) ||
      !validDevelopmentFields(loaded) || !validGraduateAdmissions(loaded) || !validCareerFields(loaded)) throw new Error('잘못된 버전 11 저장본');
    return loaded;
  }
  if (loaded.version === 10) {
    if (!validBaseSave(loaded) || !validLifeFields(loaded) || !validDegreeFields(loaded) || !validDevelopmentFields(loaded) ||
      !validGraduateAdmissions(loaded) || !validCareerFields(loaded)) throw new Error('잘못된 버전 10 저장본');
    return loaded;
  }
  if (loaded.version === 9) {
    if (!validBaseSave(loaded) || !validLifeFields(loaded) || !validCampusFields(loaded) || !validSocialFields(loaded) ||
      !validStudyFields(loaded) || !validCareerFields(loaded) || !validReflectionFields(loaded) ||
      !validDevelopmentFields(loaded) || !validGraduateAdmissions(loaded) || !validPhaseContext(loaded)) throw new Error('잘못된 버전 9 저장본');
    return loaded;
  }
  if (loaded.version === 8) {
    if (!validBaseSave(loaded) || !validLifeFields(loaded) || !validCampusFields(loaded) ||
        !validSocialFields(loaded) || !validStudyFields(loaded) || !validCareerFields(loaded) ||
        !validReflectionFields(loaded) || !validDevelopmentFields(loaded) ||
        !validPhaseContext(loaded)) throw new Error('잘못된 버전 8 저장본');
    return loaded;
  }
  if (loaded.version === 7) {
    if (!validBaseSave(loaded) || !validLifeFields(loaded) || !validCampusFields(loaded) ||
        !validSocialFields(loaded) || !validStudyFields(loaded) || !validCareerFields(loaded) ||
        !validReflectionFields(loaded) || !validPhaseContext(loaded)) throw new Error('잘못된 버전 7 저장본');
    return loaded;
  }
  if (loaded.version === 6) {
    if (!validBaseSave(loaded) || !validLifeFields(loaded) || !validCampusFields(loaded) || !validSocialFields(loaded) ||
      !validStudyFields(loaded) || !validCareerFields(loaded)) throw new Error('잘못된 버전 6 저장본');
    return upgradeReflectionState(loaded);
  }
  if (loaded.version === 5) {
    if (!validBaseSave(loaded) || !validLifeFields(loaded) || !validCampusFields(loaded) || !validSocialFields(loaded) || !validStudyFields(loaded)) throw new Error('잘못된 버전 5 저장본');
    return upgradeReflectionState(upgradeCareerState(loaded));
  }
  if (loaded.version === 4) {
    if (!validBaseSave(loaded) || !validLifeFields(loaded) || !validCampusFields(loaded) || !validSocialFields(loaded)) throw new Error('잘못된 버전 4 저장본');
    return upgradeReflectionState(upgradeCareerState(upgradeStudyState(loaded)));
  }
  if (loaded.version === 3) {
    if (!validBaseSave(loaded) || !validLifeFields(loaded) || !validCampusFields(loaded)) throw new Error('잘못된 버전 3 저장본');
    return upgradeReflectionState(upgradeCareerState(upgradeStudyState(upgradeSocialState(loaded))));
  }
  if (loaded.version === 2) {
    if (!validBaseSave(loaded) || !validLifeFields(loaded)) throw new Error('잘못된 버전 2 저장본');
    return upgradeReflectionState(upgradeCareerState(upgradeStudyState(upgradeSocialState(upgradeCampusState(loaded)))));
  }
  if (!validBaseSave(loaded) || !CORE_PHASES.includes(loaded.phase)) throw new Error('잘못된 이전 저장본');
  const additions = initialLifeFields();
  additions.character = legacyCharacter(); // 이전 플레이에는 입시 성적·합격 결과를 꾸며 넣지 않습니다.
  const finishedUndergrad = Boolean(loaded.terms[7].vacationDone) && !(loaded.semester === 8 && loaded.phase === 'vacationResult');
  const academicHalves = finishedUndergrad ? 8 : loaded.semester - 1;
  additions.life = {
    ...additions.life, origin: 'legacy', university: LIFE_CONFIG.legacyUniversity,
    major: '생명·화학', admissionYear: LIFE_CONFIG.legacyAdmissionYear,
    graduationYear: finishedUndergrad ? LIFE_CONFIG.legacyAdmissionYear + 4 : null,
    highestDegree: loaded.master?.completed ? '석사' : finishedUndergrad ? '학사' : '학부 재학',
    year: LIFE_CONFIG.legacyAdmissionYear + Math.floor(academicHalves / 2) + loaded.jobTurns + (loaded.master?.turn || 0),
    half: academicHalves % 2,
    timeKeys: [
      ...Array.from({ length: academicHalves }, (_, index) => `undergraduate:${index + 1}`),
      ...Array.from({ length: loaded.jobTurns }, (_, index) => `job:${index + 1}`),
      ...Array.from({ length: loaded.master?.turn || 0 }, (_, index) => `master:${loaded.master.program}:${index + 1}`),
    ],
  };
  if (loaded.phase === 'ending' && loaded.ending.includes('박사')) additions.life.highestDegree = '박사 진학';
  return upgradeReflectionState(upgradeCareerState(upgradeStudyState(upgradeSocialState(upgradeCampusState({ ...loaded, ...additions, version: 2 })))));
}
function validLifeFields(value) {
  const life = value.life;
  const entrance = value.entrance;
  if (!life || !Number.isInteger(life.year) || ![0, 1].includes(life.half) || !Array.isArray(life.timeKeys) ||
      !entrance || !Array.isArray(entrance.attempts) || !Array.isArray(entrance.selection) ||
      entrance.selection.length > LIFE_CONFIG.admissions.maxApplications) return false;
  if (value.phase === 'character') return value.character === null && entrance.attempts.length === 0;
  const character = value.character;
  if (!character || typeof character.name !== 'string' || !Number.isInteger(character.birthYear) ||
      !character.abilities || !Object.keys(LIFE_CONFIG.abilityLabels).every(key =>
        Number.isFinite(character.abilities[key]) && character.abilities[key] >= 0 && character.abilities[key] <= 100)) return false;
  if (life.university && !universityById(life.university)) return false;
  if (!entrance.attempts.every(attempt =>
    Number.isInteger(attempt.year) && attempt.exam && Number.isFinite(attempt.exam.percentile) &&
    Array.isArray(attempt.exam.subjects) && attempt.exam.subjects.length === LIFE_CONFIG.exam.subjects.length &&
    attempt.exam.subjects.every(subject => Number.isFinite(subject.score) && Number.isFinite(subject.grade)) &&
    Array.isArray(attempt.applications) && attempt.applications.every(app =>
      universityById(app.university) && typeof app.accepted === 'boolean' && Number.isFinite(app.probability))
  )) return false;
  if (LIFE_PHASES.includes(value.phase) && value.phase !== 'alternative' && !entrance.attempts.length) return false;
  if (['retake', 'retakeReady'].includes(value.phase) &&
      (!entrance.retry || !Array.isArray(entrance.retry.actions) || entrance.retry.actions.length > LIFE_CONFIG.retake.actions)) return false;
  if (value.phase === 'collegeEnrollment' &&
      !entrance.attempts.at(-1)?.applications.some(app => app.university === entrance.selectedOffer && app.accepted && app.opened)) return false;
  return true;
}
function advanceTime(halves, key) {
  if (state.life.timeKeys.includes(key)) return; // 단계 재실행·재접속으로 나이 중복 증가 방지
  state.life.timeKeys.push(key);
  const total = state.life.half + halves;
  state.life.year += Math.floor(total / 2);
  state.life.half = total % 2;
}
function applyAbilities(effects = {}) {
  if (!state.character) return;
  for (const [key, value] of Object.entries(effects)) {
    if (learningAbilityChange(key, value)) continue;
    state.character.abilities[key] = round(clamp((state.character.abilities[key] || 0) + value, 0, 100));
  }
}
function abilityEffectsText(effects = {}) {
  return Object.entries(effects).map(([key, value]) =>
    `${LIFE_CONFIG.abilityLabels[key]} ${value > 0 ? '+' : ''}${value}`).join(' · ');
}
function generateCharacter(fields) {
  const abilities = {};
  for (const key of Object.keys(LIFE_CONFIG.abilityLabels)) abilities[key] = randomInt(...LIFE_CONFIG.abilityRange);
  const skillKeys = ['academic', 'researchAptitude', 'sociability', 'creativity', 'diligence', 'economy', 'language'];
  const strong = randomInt(0, skillKeys.length - 1);
  const weak = (strong + randomInt(1, skillKeys.length - 1)) % skillKeys.length;
  abilities[skillKeys[strong]] = randomInt(...LIFE_CONFIG.strongRange);
  abilities[skillKeys[weak]] = randomInt(...LIFE_CONFIG.weakRange);
  for (const [key, boost] of Object.entries(LIFE_CONFIG.personalities[fields.personality].boosts)) {
    abilities[key] = clamp(abilities[key] + boost, 0, 100);
  }
  abilities.stress = randomInt(12, 30);
  abilities.happiness = randomInt(55, 80);
  abilities.motivation = randomInt(45, 85);
  return { ...fields, highSchool: fields.highSchool?.trim() ||
    `${DEVELOPMENT_CONFIG.highSchools[randomInt(0, DEVELOPMENT_CONFIG.highSchools.length - 1)]}고등학교`, abilities };
}
function scoreGrade(percentile) {
  const index = LIFE_CONFIG.exam.gradeThresholds.findIndex(threshold => percentile >= threshold);
  return index < 0 ? 9 : index + 1;
}
function generateExam(previous = null, retry = null) {
  const config = LIFE_CONFIG.exam;
  const abilities = state.character.abilities;
  const shared = randomBetween(...(previous ? config.retryNoise : config.sharedNoise));
  const latent = randomBetween(10, 99);
  const potential = state.development?.innate.intelligence ?? abilities.academic;
  const base = (abilities.academic * .75 + potential * .25) * config.academicWeight +
    abilities.diligence * config.diligenceWeight + latent * config.latentWeight;
  const subjects = config.subjects.map((name, index) => {
    let score;
    if (previous) {
      const gain = Math.min(DEVELOPMENT_CONFIG.retryGeneralCap, retry.general) +
        Math.min(DEVELOPMENT_CONFIG.retrySubjectCap, retry.subjects[name] || 0);
      score = previous.subjects[index].score + Math.min(DEVELOPMENT_CONFIG.retryMaximumIncrease,
        gain + shared + randomBetween(...config.retrySubjectNoise));
    } else {
      const interestBoost = (name === '수학' && /생명|컴퓨터|기계/.test(state.character.interest)) ? 5 : 0;
      const languageBoost = name === '영어' ? (abilities.language - 50) * .18 : 0;
      score = base + shared + randomBetween(...config.subjectNoise) + interestBoost + languageBoost;
    }
    score = round(clamp(score, 1, 99.9));
    return { name, score, grade: scoreGrade(score) };
  });
  const percentile = round(subjects.reduce((sum, subject) => sum + subject.score, 0) / subjects.length);
  const schoolScore = previous?.schoolScore ?? round(clamp(abilities.academic * .6 + abilities.diligence * .4 + randomBetween(-18, 18), 1, 99));
  const schoolGrade = previous?.schoolGrade ?? round(clamp(9 - schoolScore * .08, 1, 9));
  const activity = previous?.activity ?? round(clamp(abilities.sociability * .3 + (state.development?.innate.creativity ?? abilities.creativity) * .35 +
    abilities.diligence * .35 + randomBetween(-20, 20), 1, 99));
  return {
    subjects, percentile, schoolScore, schoolGrade, activity,
    recordCompetitiveness: previous?.recordCompetitiveness ?? round(schoolScore * .7 + activity * .3),
    mockPercentile: round(clamp(percentile + randomBetween(-12, 12), 1, 99.9)),
  };
}
function createEntranceAttempt(exam) {
  return {
    id: state.entrance.attempts.length + 1, year: state.life.year, revealed: false, exam,
    submitted: false, applications: [], decision: null,
  };
}
function admissionProbability(university, exam) {
  const inputs = { school: exam.schoolScore, exam: exam.percentile, activity: exam.activity };
  const score = Object.entries(university.weights).reduce((sum, [key, weight]) => sum + inputs[key] * weight, 0);
  return clamp(1 / (1 + Math.exp(-(score - university.difficulty - difficultyConfig().competition) / LIFE_CONFIG.admissions.logisticScale)),
    LIFE_CONFIG.admissions.minProbability, LIFE_CONFIG.admissions.maxProbability);
}
function probabilityLabel(probability) {
  return probability >= .7 ? '안정 지원' : probability >= .35 ? '적정 지원' : '도전 지원';
}
function examFeedback(exam) {
  const strongest = [...exam.subjects].sort((a, b) => b.score - a.score)[0];
  const weakest = [...exam.subjects].sort((a, b) => a.score - b.score)[0];
  return `${strongest.name}에서 상대적인 강점이 보입니다. ${weakest.name}은 보완 여지가 있지만, 대학별 전형 비중에 따라 다른 기회를 찾을 수 있습니다.`;
}
function renderHighSchoolReport(parent, attempt) {
  const exam = attempt.exam;
  parent.append(element('h3', `${attempt.year + 1}학년도 대학수학능력시험 성적표`));
  const table = element('table');
  const head = element('tr');
  ['과목', '등급', '가상 백분위'].forEach(text => head.append(element('th', text)));
  const thead = element('thead');
  thead.append(head); table.append(thead);
  const body = element('tbody');
  exam.subjects.forEach(subject => {
    const row = element('tr');
    [subject.name, `${subject.grade}등급`, subject.score.toFixed(1)].forEach(text => row.append(element('td', text)));
    body.append(row);
  });
  table.append(body);
  parent.append(table);
  list(parent, [
    `종합 백분위 ${exam.percentile.toFixed(1)} · 내신 평균 ${exam.schoolGrade.toFixed(1)}등급`,
    `모의고사 종합 백분위 ${exam.mockPercentile.toFixed(1)}`,
    `비교과 활동 ${exam.activity.toFixed(1)} / 100 · 학생부 경쟁력 ${exam.recordCompetitiveness.toFixed(1)} / 100`,
  ]);
  parent.append(element('p', examFeedback(exam)));
  const suitable = UNIVERSITIES.filter(university => admissionProbability(university, exam) >= .35);
  parent.append(element('p', suitable.length ? `지원 검토: ${suitable.map(university => university.name).join(', ')}` :
    '현재는 도전 지원이 많습니다. 합격 가능성은 0이 아니며, 재수나 직업 교육도 선택할 수 있습니다.', 'muted'));
}
function formField(parent, id, title, input) {
  const label = element('label', title);
  label.htmlFor = id; input.id = id;
  parent.append(label, input);
  return input;
}
function selectOptions(values, defaultValue) {
  const select = element('select');
  for (const [value, title] of values) {
    const option = element('option', title); option.value = value;
    select.append(option);
  }
  if (defaultValue !== undefined) select.value = defaultValue;
  return select;
}
function renderCharacter() {
  const scene = setScene('새 이야기 · 고등학교 졸업', '어떤 나로 시작할까?',
    '고등학교를 마친 18세. 네 가지 정보로 나만의 이야기를 시작하세요.');
  const form = element('form', undefined, 'character-form');
  const name = element('input'); name.type = 'text'; name.maxLength = 24; name.required = true; name.value = '새봄';
  formField(form, 'character-name', '이름', name);
  const gender = selectOptions([['여성', '여성'], ['남성', '남성']]);
  formField(form, 'character-gender', '성별', gender);
  const genderNotice = element('p', undefined, 'muted');
  const updateGender = () => { genderNotice.textContent = gender.value === '남성' ?
    '남성: 병역 의무가 게임 진행에 포함됩니다.' : '여성: 병역 의무 이벤트가 적용되지 않습니다.'; };
  gender.addEventListener('change', updateGender); updateGender();
  const birth = element('input'); birth.type = 'number'; birth.min = '1900'; birth.max = '2100'; birth.required = true; birth.value = LIFE_CONFIG.birthYear;
  formField(form, 'character-birth', '출생 연도', birth);
  const highSchool = element('input'); highSchool.maxLength = 40;
  formField(form, 'character-high-school', '고등학교 이름 (비우면 가상 학교 자동 생성)', highSchool);
  const preview = element('p', undefined, 'muted');
  function updatePreview() {
    preview.textContent = `18세 · ${Number(birth.value) + 18}년 시작`;
  }
  birth.addEventListener('input', updatePreview); updatePreview();
  form.append(genderNotice, element('p', '병역은 게임 내 단순화된 규칙이며 현실의 모든 법적 예외를 설명하지 않습니다.', 'muted'));
  form.append(preview, element('p', '능력치와 고교 성적은 시작할 때 한 번 생성해 저장합니다. 각 인물에게 서로 다른 강점과 약점이 생깁니다.', 'muted'));
  const submit = element('button', '캐릭터 생성하고 시작', 'primary'); submit.type = 'submit';
  form.append(submit);
  const submitChoice = choose('character', () => {
    state.character = generateCharacter({
      name: name.value.trim(), gender: gender.value, birthYear: Number(birth.value), startAge: 18,
      personality: Object.keys(LIFE_CONFIG.personalities)[randomInt(0, Object.keys(LIFE_CONFIG.personalities).length - 1)],
      interest: LIFE_CONFIG.interests[randomInt(0, LIFE_CONFIG.interests.length - 1)], highSchool: highSchool.value,
    });
    state.development = makeDevelopment(state.character, false, {
      militarySubject: gender.value === '남성',
    });
    state.development.setup.militaryRule = 'gender-v1';
    for (const channel of ['academic', 'language', 'social', 'diligence']) syncLearnedAbility(channel);
    state.life.year = state.character.birthYear + state.character.startAge;
    state.money = Math.max(30, CONFIG.initial.money + Math.round((state.character.abilities.economy - 50) * 1.5));
    initializeHousehold();
    state.military.subject = state.development.setup.militarySubject;
    state.entrance.attempts.push(createEntranceAttempt(generateExam()));
    state.phase = 'hsReady';
    log(`${state.character.highSchool} 졸업. ${characterAge()}세, 나의 첫 대학 입시가 시작된다.`);
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (form.reportValidity() && name.value.trim()) submitChoice();
    else if (!name.value.trim()) { name.setCustomValidity('이름을 입력해 주세요.'); name.reportValidity(); }
  });
  name.addEventListener('input', () => name.setCustomValidity(''));
  scene.append(form);
}
function renderEntranceExplore() {
  const attempt = entranceAttempt();
  const scene = setScene(`${attempt.year + 1}학년도 · 가상 통합 전형`, '대학과 전공을 탐색하자',
    `한 모집에 최대 ${LIFE_CONFIG.admissions.maxApplications}곳, 대학당 1개 전공에 지원합니다. 접수비는 원서 접수 때 한 번 지출합니다. 확률은 합격 보장이 아닙니다.`);
  const selectedList = element('div', undefined, 'selection-summary');
  selectedList.append(element('h3', `선택 ${state.entrance.selection.length} / ${LIFE_CONFIG.admissions.maxApplications}곳`));
  list(selectedList, state.entrance.selection.map(c => `${universityById(c.university).name} · ${c.major}`));
  const total = state.entrance.selection.reduce((sum, c) => sum + universityById(c.university).fee, 0);
  addButton(selectedList, '접수비를 내고 원서 접수', `${total}만원 · 제출 후 결과를 바로 확인합니다.`,
    choose('collegeExplore', submitCollegeApplications), !state.entrance.selection.length || state.money < total, true);
  scene.append(selectedList);
  for (const university of UNIVERSITIES) {
    const card = element('div', undefined, 'opportunity');
    const selected = state.entrance.selection.find(choice => choice.university === university.id);
    const probability = admissionProbability(university, attempt.exam);
    card.append(element('h3', university.name), element('p', `${probabilityLabel(probability)} · 접수비 ${university.fee}만원 · 고교 졸업 지원 가능`));
    const detail = element('details'); detail.append(element('summary', '비용·평가 기준'));
    list(detail, [
      `합격 가능성 ${(probability * 100).toFixed(1)}% (합격 보장 아님)`,
      `내신 ${Math.round(university.weights.school * 100)}% · 수능 ${Math.round(university.weights.exam * 100)}% · 비교과 ${Math.round(university.weights.activity * 100)}%`,
      `접수비 ${university.fee}만원 · 학기 등록금 ${university.tuition}만원 · 예상 주거비 ${university.housing}만원`,
      `${university.scholarship.title}: 수능 백분위 ${university.scholarship.minimum} 이상이면 ${university.scholarship.amount}만원 · 기숙사 ${university.dorm ? '있음' : '없음'}`,
      `${university.opportunities} / ${university.future}`,
    ]); card.append(detail);
    const major = selectOptions(university.majors.map(value => [value, value]),
      selected?.major || (university.majors.includes(state.character.interest) ? state.character.interest : university.majors[0]));
    formField(card, `major-${university.id}`, '지원 전공', major);
    if (selected) major.addEventListener('change', choose('collegeExplore', () => {
      const choice = state.entrance.selection.find(c => c.university === university.id);
      if (choice) choice.major = major.value;
    }));
    const full = !selected && state.entrance.selection.length >= LIFE_CONFIG.admissions.maxApplications;
    addButton(card, selected ? `${university.name} 선택 취소` : `${university.name} 지원 목록에 담기`,
      selected ? selected.major : full ? '지원 가능 대학 수를 모두 선택했습니다.' : '이 단계에서는 접수비를 지출하지 않습니다.',
      choose('collegeExplore', () => {
        if (selected) state.entrance.selection = state.entrance.selection.filter(choice => choice.university !== university.id);
        else if (state.entrance.selection.length < LIFE_CONFIG.admissions.maxApplications) state.entrance.selection.push({ university: university.id, major: major.value });
      }), full);
    scene.append(card);
  }
  const choices = choiceContainer(scene);
  addButton(choices, '이번 모집에서 지원하지 않기', '재수·직업 교육 등의 선택을 확인합니다.', choose('collegeExplore', () => { state.phase = 'collegeDecision'; }));
}
function submitCollegeApplications() {
  const attempt = entranceAttempt(), choices = state.entrance.selection;
  const total = choices.reduce((sum, c) => sum + universityById(c.university).fee, 0);
  if (attempt.submitted || !choices.length || choices.length > LIFE_CONFIG.admissions.maxApplications || state.money < total) return;
  attempt.applications = choices.map(choice => {
    const university = universityById(choice.university);
    const probability = admissionProbability(university, attempt.exam), draw = Math.random();
    return { ...choice, fee: university.fee, probability, draw, accepted: draw < probability, opened: true,
      scholarship: attempt.exam.percentile >= university.scholarship.minimum ? university.scholarship.amount : 0 };
  });
  state.money -= total; attempt.submitted = true; state.phase = 'collegeMail';
  log(`${choices.length}곳 지원 완료. ${attempt.applications.filter(a => a.accepted).length}곳 합격. 결과와 접수비 ${total}만원을 저장했다.`);
}
function renderCollegeReview() {
  const choices = state.entrance.selection;
  const total = choices.reduce((sum, choice) => sum + universityById(choice.university).fee, 0);
  const scene = setScene('원서 접수', '지원 내용을 확인하자', `총 접수비 ${total}만원 · 잔액 ${state.money}만원. 접수 후에는 이번 모집의 지원 대학을 바꿀 수 없습니다.`);
  list(scene, choices.map(choice => `${universityById(choice.university).name} · ${choice.major} · 접수비 ${universityById(choice.university).fee}만원`));
  const buttons = choiceContainer(scene);
  addButton(buttons, '접수비를 내고 원서 접수', state.money < total ? '선택 불가: 잔액 부족. 지원 목록으로 돌아가 대학 수를 줄일 수 있습니다.' : '합격 결과는 이 순간 확정 저장되며 메일에서 공개합니다.',
    choose('collegeReview', submitCollegeApplications), state.money < total, true);
  addButton(buttons, '지원 목록 수정', '아직 비용을 지불하지 않았습니다.', choose('collegeReview', () => { state.phase = 'collegeExplore'; }));
}
function renderCollegeMail() {
  const attempt = entranceAttempt();
  const accepted = attempt.applications.filter(a => a.accepted).length;
  const scene = setScene('대학 합격 발표', accepted ? `${accepted}곳 합격! 새로운 출발선입니다` : '이번 도전은 여기까지, 다음 길은 열려 있습니다',
    accepted ? '준비해 온 시간이 진학 기회로 이어졌습니다. 합격한 대학을 비교해 보세요.' : '재수로 다시 준비하거나 직업 교육·취업으로 출발할 수 있습니다.');
  const choices = choiceContainer(scene);
  for (const app of attempt.applications) {
    const university = universityById(app.university);
    const card = element('div', undefined, app.accepted ? 'result-card achievement' : 'result-card');
    card.append(element('h3', `${university.name} · ${app.accepted ? '합격' : '불합격'}`), element('p', app.major));
    if (app.accepted && app.scholarship) card.append(element('p', `입학 장학금 ${app.scholarship}만원 · 첫 학기 등록금 감면`));
    scene.append(card);
  }
  scene.append(choices);
  addButton(choices, '진학 선택으로', '합격한 대학 비교 또는 재도전',
    choose('collegeMail', () => { attempt.applications.forEach(a => { a.opened = true; }); state.phase = 'collegeDecision'; }), false, true);
}
function beginRetake() {
  const attempt = entranceAttempt();
  if (attempt.decision === 'retake') return;
  attempt.decision = 'retake';
  state.entrance.selection = [];
  state.entrance.selectedOffer = null;
  state.entrance.retry = { fromAttempt: attempt.id, actions: [], general: 0, subjects: {}, generatedAttempt: null };
  advanceTime(2, `retake:${attempt.id}`);
  applyEffects({ energy: LIFE_CONFIG.retake.energyRecovery });
  state.phase = 'retake';
  log(`${state.entrance.attempts.length}번째 입시를 마치고 재도전을 선택했다. 1년이 흘러 ${characterAge()}세가 되었다.`);
}
function renderCollegeDecision() {
  const attempt = entranceAttempt();
  const accepted = attempt.applications.filter(app => app.accepted && app.opened);
  const scene = setScene(`${attempt.year + 1}학년도 · 진학 결정`, accepted.length ? `${accepted.length}곳의 합격 제안` : '합격 제안 없이 마친 모집',
    '대학의 이름만으로 미래가 결정되지는 않습니다. 관심 전공과 비용, 캠퍼스 기회를 비교해 주세요.');
  for (const app of accepted) {
    const university = universityById(app.university);
    const card = element('div', undefined, 'opportunity');
    card.append(element('h3', `${university.name} · ${app.major}`));
    list(card, [
      `${university.region} · ${university.type}`,
      `학기 등록금 ${university.tuition} − 입학 장학금 ${app.scholarship} = ${Math.max(0, university.tuition - app.scholarship)}만원`,
      `예상 학기 주거비 ${university.housing}만원 · 기숙사 ${university.dorm ? '제공' : '미제공'}`,
      `${university.opportunities} / ${university.future}`,
      '입학 장학금은 첫 학기 정산에서 한 번 감면합니다. 실제 주거비는 입학 후 거주 형태에 따라 결정합니다.',
    ]);
    addButton(card, `${university.name} 등록 결정`, '선택 후 입학 화면에서 대학 생활을 시작합니다.', choose('collegeDecision', () => {
      state.entrance.selectedOffer = university.id; state.phase = 'collegeEnrollment';
    }));
    scene.append(card);
  }
  const choices = choiceContainer(scene);
  addButton(choices, '재수 준비', `1년 경과 · 재수 주요 행동 ${LIFE_CONFIG.retake.actions}회 · 과거 성적과 지원 결과는 보관`,
    choose('collegeDecision', beginRetake));
  addButton(choices, '대학 외의 길 살펴보기',
    state.entrance.attempts.length >= LIFE_CONFIG.retake.alternativesAfter ? '여러 번의 도전 끝에, 직업 교육과 취업도 적극적으로 검토할 수 있습니다.' : '직업 교육·취업으로 시작하거나 나중에 입시에 재도전할 수 있습니다.',
    choose('collegeDecision', () => { state.phase = 'alternative'; }));
}
function renderCollegeEnrollment() {
  const attempt = entranceAttempt();
  const app = attempt.applications.find(item => item.university === state.entrance.selectedOffer);
  const university = universityById(app.university);
  const scene = setScene('입학을 앞두고', `${university.name}에 오신 것을 환영합니다`,
    `${attempt.year + 1}년 입학 예정 · ${app.major}. 입학과 동시에 1학년 1학기, 주요 행동 3회의 기존 대학 생활로 이어집니다.`);
  const choices = choiceContainer(scene);
  addButton(choices, '대학 생활 시작', '입학 시 다음 해로 이동합니다. 등록 확정은 한 번만 반영됩니다.', choose('collegeEnrollment', () => {
    if (state.life.admissionYear !== null) return;
    advanceTime(2, `enrollment:${attempt.id}`);
    state.life.university = university.id;
    state.life.major = app.major;
    state.life.admissionYear = state.life.year;
    state.life.highestDegree = '학부 재학';
    attempt.decision = `enrolled:${university.id}`;
    initializeNPCs();
    openTermBudget();
    log(`${university.name} ${app.major} 입학. ${characterAge()}세, 1학년 1학기를 시작한다.`);
  }), false, true);
  addButton(choices, '합격 제안 다시 비교', '아직 입학을 확정하지 않았습니다.', choose('collegeEnrollment', () => { state.phase = 'collegeDecision'; }));
}
function renderRetake() {
  const retry = state.entrance.retry;
  const scene = setScene(`${state.life.year}년 · 재수 ${state.entrance.attempts.length}회차`, '다시 준비하는 한 해',
    `남은 주요 행동 ${LIFE_CONFIG.retake.actions - retry.actions.length}회. 다음 수능은 유지되거나 하락할 수도 있습니다. 내신·고교 비교과 기록은 그대로 유지됩니다.`);
  const choices = choiceContainer(scene);
  for (const action of RETAKE_ACTIONS) {
    const reason = unavailable(action.effects);
    addButton(choices, action.title, `${action.text} ${effectsText(action.effects)} · ${abilityEffectsText(action.abilities)}${reason ? ` · 선택 불가: ${reason}` : ''}`,
      choose('retake', () => {
        if (retry.actions.length >= LIFE_CONFIG.retake.actions || unavailable(action.effects)) return;
        applyEffects(action.effects);
        applyAbilities(action.abilities);
        retry.actions.push(action.id);
        recordGrowth(action.id, `retry:${retry.fromAttempt}:${retry.actions.length}`);
        retry.general += (action.general || 0) * .35 * learningPerformance('academic') *
          (action.selfManaged ? .6 + state.character.abilities.diligence / 100 : 1);
        const subject = action.weakest ? [...entranceAttempt().exam.subjects].sort((a, b) => a.score - b.score)[0].name : action.subject;
        if (subject) retry.subjects[subject] = (retry.subjects[subject] || 0) + action.boost * .4 * learningPerformance('academic');
        log(`재수 활동 ${retry.actions.length}/${LIFE_CONFIG.retake.actions}: ${action.title}. ${effectsText(action.effects)}.`);
        if (retry.actions.length >= LIFE_CONFIG.retake.actions) state.phase = 'retakeReady';
      }), reason);
  }
}
function renderRetakeReady() {
  const scene = setScene('재수 준비 완료', '다시 시험장으로',
    '이번 한 해의 선택과 시험 당일의 변동을 반영합니다. 새 성적은 한 번 생성하고 지난 성적과 함께 보관합니다.');
  addButton(choiceContainer(scene), '다음 수능 성적 생성', '주요 행동 추가 소모 없음', choose('retakeReady', () => {
    const retry = state.entrance.retry;
    if (retry.generatedAttempt) return;
    const exam = generateExam(entranceAttempt().exam, retry);
    const attempt = createEntranceAttempt(exam);
    retry.generatedAttempt = attempt.id;
    state.entrance.attempts.push(attempt);
    state.entrance.selection = [];
    state.phase = 'hsReady';
    log(`${attempt.year + 1}학년도 재도전 수능을 마쳤다. 새로운 성적이 도착했다.`);
  }), false, true);
}
function renderAlternative() {
  const scene = setScene('또 다른 시작', '대학만이 유일한 길은 아니다',
    '첫 버전의 대체 경로입니다. 무료 직업 교육을 1년 이수한 뒤 기존 취업·직장 턴으로 연결합니다. 학사 학위 없이 석사·박사에는 지원할 수 없습니다.');
  const choices = choiceContainer(scene);
  addButton(choices, '직업 교육 후 취업 준비', '1년 경과 · 실무 경험 +1 · 무료 교육 · 이전 입시 기록 유지', choose('alternative', () => {
    advanceTime(2, `vocational:${state.jobTurns}:${entranceAttempt().id}`);
    state.practice++;
    state.flags.alternativeCareer = true;
    log('직업 교육을 이수하고 취업을 준비했다. 대학 외의 길에서 첫 경험을 쌓았다.');
    startHiring();
  }));
  addButton(choices, '대학 선택으로 돌아가기', '합격 제안·재수 선택을 다시 확인합니다.', choose('alternative', () => { state.phase = 'collegeDecision'; }));
}
function renderLifeScene() {
  switch (state.phase) {
    case 'character': renderCharacter(); break;
    case 'hsReady': {
      const scene = setScene('고등학교 성적 도착', `${entranceAttempt().year + 1}학년도 성적표`, '성적과 능력치가 생성되어 보관되었습니다. 확인해도, 새로고침해도 다시 추첨하지 않습니다.');
      addButton(choiceContainer(scene), '고등학교 성적표 공개', '과목별 등급·종합 백분위·내신·비교과 확인', choose('hsReady', () => {
        entranceAttempt().revealed = true; state.phase = 'hsReport';
      }), false, true); break;
    }
    case 'hsReport': {
      const scene = setScene(`입시 도전 ${state.entrance.attempts.length}회`, '나의 고등학교 성적', '게임용 가상 성적입니다. 대학별 반영 비중에 따라 가능성이 달라집니다.');
      renderHighSchoolReport(scene, entranceAttempt());
      addButton(choiceContainer(scene), '대학과 전공 탐색', '복수 지원과 전형 조건 확인', choose('hsReport', () => { state.phase = 'collegeExplore'; }), false, true);
      break;
    }
    case 'collegeExplore': renderEntranceExplore(); break;
    case 'collegeReview': renderCollegeReview(); break;
    case 'collegeMail': renderCollegeMail(); break;
    case 'collegeDecision': renderCollegeDecision(); break;
    case 'collegeEnrollment': renderCollegeEnrollment(); break;
    case 'retake': renderRetake(); break;
    case 'retakeReady': renderRetakeReady(); break;
    case 'alternative': renderAlternative(); break;
  }
}
function renderLifeSidebar() {
  const character = state.character;
  const university = universityById(state.life.university);
  let schoolLabel = university ? `${university.name} / ${state.life.major}` :
    state.life.admissionYear !== null ? LIFE_CONFIG.legacySchoolLabel : '대학 입학 전';
  const programme = programById(state.flags.acceptedProgram);
  if (state.reflection.profession) schoolLabel = state.reflection.profession;
  else if (state.career.employer) schoolLabel = `${companyById(state.career.employer).name} / ${companyById(state.career.employer).role}`;
  else if (state.career.venture) schoolLabel = '나의 창업팀 운영';
  else if (programme && (state.life.highestDegree === '박사 진학' || state.reflection.phdCompleted || (state.master && !state.master.completed))) {
    schoolLabel = `${programme.country} ${programme.school} / ${programme.lab}`;
  } else if (state.life.graduationYear !== null) schoolLabel = `${state.life.highestDegree} · 출신 학부 ${university?.name || LIFE_CONFIG.legacySchoolLabel}`;
  if (state.postgraduate.active && !state.postgraduate.active.completed && !state.career.employer) {
    const d = state.postgraduate.active, p = programById(d.program);
    schoolLabel = `${p.country} ${p.school} / ${degreeName(d.degree)} ${d.semester}학기`;
  }
  $('life-summary').textContent = character ?
    `${character.name} · ${schoolLabel}` :
    '고등학교 졸업부터 시작하는 나의 이야기';
  $('stress').textContent = character ? `${character.abilities.stress} / 100` : '—';
  $('happiness').textContent = character ? `${character.abilities.happiness} / 100` : '—';
  if (LIFE_PHASES.includes(state.phase)) $('stage').textContent = state.phase === 'character' ? '캐릭터 생성' :
    ['retake', 'retakeReady'].includes(state.phase) ? '재수 준비' : '대학 입시';
  if (state.flags.alternativeCareer && !state.life.admissionYear) $('stage').textContent = '직업 교육·취업';
  const admitted = state.life.admissionYear !== null;
  $('academic-menu').hidden = !admitted;
  $('career-menu').hidden = !admitted && !state.flags.alternativeCareer;
  $('profile-menu').hidden = !character;
  $('entrance-menu').hidden = !character;
  $('profile').replaceChildren();
  if (character) {
    list($('profile'), [
      `${character.name} · 성별 ${character.gender || '선택하지 않음'} · ${character.birthYear}년생`,
      `${character.highSchool} · ${LIFE_CONFIG.personalities[character.personality]?.title || '이전 성격 기록 없음'}`,
      `관심 분야 ${character.interest} · 입학 연도 ${state.life.admissionYear || '미정'}`,
      `최종 학력 ${state.life.highestDegree} · 학업 의욕 ${character.abilities.motivation}`,
    ]);
    const compatibility = element('details');
    compatibility.append(element('summary', '기존 호환·생활 능력 기록 (선천 잠재력과 별개)'));
    list(compatibility, Object.entries(LIFE_CONFIG.abilityLabels).map(([key,title]) => `${title} ${character.abilities[key]} / 100`));
    $('profile').append(compatibility);
    $('profile').append(element('p', `에너지 ${state.energy} / ${state.wellness.maxEnergy}. 선천·후천 역량은 성장 프로필에 구분됩니다. 나이는 현재 연도 − 출생 연도입니다.`, 'muted'));
    if (state.life.origin === 'legacy') $('profile').append(element('p', '기존 저장본의 프로필·연도는 고정 기본값으로 보충했습니다. 기존 성적과 자금은 유지되며 입시를 다시 하지 않습니다.', 'muted'));
  }
  $('entrance-records').replaceChildren();
  if (!state.entrance.attempts.length) $('entrance-records').append(element('p', '기존 저장본에는 대학 입시 기록이 없습니다. 현재 대학 생활부터 이어갑니다.'));
  for (const attempt of state.entrance.attempts) {
    const details = element('details');
    details.append(element('summary', `${attempt.year + 1}학년도 · ${attempt.id}번째 도전`));
    if (attempt.revealed) renderHighSchoolReport(details, attempt);
    else details.append(element('p', '아직 공개하지 않은 성적표입니다.'));
    list(details, attempt.applications.map(app => `${universityById(app.university).name} · ${app.major} · ${app.opened ? app.accepted ? '합격' : '불합격' : '결과 미공개'} · 접수비 ${app.fee}만원`));
    if (attempt.decision) details.append(element('p', attempt.decision === 'retake' ? '진학 대신 재도전 선택' : `${universityById(attempt.decision.split(':')[1])?.name || ''} 입학 확정`));
    $('entrance-records').append(details);
  }
}
