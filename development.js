// 선천적 잠재력은 고정, 후천적 역량은 기록된 유효 활동으로만 성장합니다.
function initialDevelopmentFields() { return { development: null }; }
function difficultyConfig(value = state) { return DIFFICULTIES[value.development?.difficulty || 'normal']; }
function hashCharacter(character) {
  let hash = 2166136261;
  for (const letter of `${character.name}:${character.birthYear}`) hash = Math.imul(hash ^ letter.charCodeAt(0), 16777619) >>> 0;
  return hash || 1;
}
function makeDevelopment(character, migrated = false, options = {}) {
  const innate = {};
  for (const key of Object.keys(DEVELOPMENT_CONFIG.innateLabels)) {
    innate[key] = migrated ? DEVELOPMENT_CONFIG.legacyInnate : randomInt(...DEVELOPMENT_CONFIG.innateRange);
  }
  if (!migrated) {
    const keys = Object.keys(innate), strong = randomInt(0, keys.length - 1);
    const weak = (strong + randomInt(1, keys.length - 1)) % keys.length;
    innate[keys[strong]] = randomInt(...DEVELOPMENT_CONFIG.strengthRange);
    innate[keys[weak]] = randomInt(...DEVELOPMENT_CONFIG.weaknessRange);
  }
  const traits = migrated ? [] : Object.entries(INNATE_TRAITS).filter(([, trait]) => innate[trait.source] >= 74)
    .sort((a, b) => innate[b[1].source] - innate[a[1].source]).slice(0, 2).map(([id]) => id);
  const old = character.abilities;
  const skills = migrated ? {
    academic: old.academic, research: old.researchAptitude, practice: 15, language: old.language,
    social: old.sociability, diligence: old.diligence, project: 15,
  } : {
    academic: 12 + innate.intelligence * .25 + innate.diligence * .12,
    research: 8 + innate.researchAptitude * .25 + innate.creativity * .12,
    practice: randomInt(8, 18), language: 10 + innate.intelligence * .2 + innate.focus * .12,
    social: 10 + innate.sociability * .35, diligence: 15 + innate.diligence * .35, project: 5 + innate.creativity * .15,
  };
  for (const key of Object.keys(skills)) skills[key] = round(clamp(skills[key], 0, migrated ? 100 : 52));
  return {
    schema: 1, origin: migrated ? 'migrated' : 'new', difficulty: options.difficulty || 'normal',
    innate, traits, skills, applied: [], history: [], streak: 0, rng: hashCharacter(character),
    lastFeedback: null, setup: { militarySubject: Boolean(options.militarySubject), highSchool: character.highSchool },
  };
}
function upgradeDevelopmentState(value) {
  if (!value.character) return { ...value, ...initialDevelopmentFields(), version: CONFIG.saveVersion };
  const development = makeDevelopment(value.character, true);
  // 과거와 현재 학기의 처리된 행동에 성장을 소급 지급하지 않습니다.
  value.terms.forEach((term, index) => term.actions.forEach((_, action) => development.applied.push(`ug:${index + 1}:${action + 1}`)));
  for (let i = 0; i < (value.master?.turn || 0); i++) development.applied.push(`master:${value.master.program}:${i + 1}`);
  for (let i = 0; i < value.jobTurns; i++) development.applied.push(`work:${i + 1}`);
  const retry = value.entrance.retry;
  if (retry) retry.actions.forEach((_, index) => development.applied.push(`retry:${retry.fromAttempt}:${index + 1}`));
  development.skills.practice = round(clamp(15 + value.practice * 1.5, 0, 90));
  development.skills.project = round(clamp(15 + (value.experiences.club || 0) * 2.5 + (value.competition?.preparation || 0) * 2, 0, 90));
  return { ...value, development, version: CONFIG.saveVersion };
}
function validDevelopmentFields(value) {
  if (value.phase === 'character') return value.development === null;
  const development = value.development;
  return development && development.schema === 1 && DIFFICULTIES[development.difficulty] &&
    Object.keys(DEVELOPMENT_CONFIG.innateLabels).every(key => Number.isFinite(development.innate?.[key]) && development.innate[key] >= 0 && development.innate[key] <= 100) &&
    Object.keys(DEVELOPMENT_CONFIG.skillLabels).every(key => Number.isFinite(development.skills?.[key]) && development.skills[key] >= 0 && development.skills[key] <= 100) &&
    Array.isArray(development.traits) && development.traits.every(id => INNATE_TRAITS[id]) &&
    Array.isArray(development.applied) && development.applied.every(key => typeof key === 'string') &&
    new Set(development.applied).size === development.applied.length &&
    Array.isArray(development.history) && development.history.every(entry => entry &&
      typeof entry.action === 'string' && entry.gains && Object.entries(entry.gains).every(([key, gain]) =>
        DEVELOPMENT_CONFIG.skillLabels[key] && Number.isFinite(gain) && gain >= 0)) &&
    Number.isInteger(development.rng) && development.rng >= 0 && development.rng <= 4294967295 &&
    Number.isInteger(development.streak) && development.streak >= 0 && development.setup &&
    typeof development.setup.militarySubject === 'boolean';
}
function traitModifier(kind, channel) {
  const traits = state.development?.traits || [];
  if (kind === 'learning') return traits.reduce((value, id) => value * (INNATE_TRAITS[id].learning?.[channel] || 1), 1);
  return traits.reduce((value, id) => value + (INNATE_TRAITS[id][kind] || 0), 0);
}
function developmentCondition(value = state) {
  if (!value.development || !value.character) return 1;
  const innate = value.development.innate;
  const energyPenalty = Math.max(0, 40 - value.energy) / 100 * (1.1 - innate.stamina / 200);
  const stressPenalty = Math.max(0, value.character.abilities.stress - 45) / 160 * (1.2 - innate.resilience / 200);
  const bonus = value.development.traits.reduce((sum, id) =>
    sum + (INNATE_TRAITS[id].condition || 0) + (INNATE_TRAITS[id].endurance || 0), 0);
  return clamp(1 - energyPenalty - stressPenalty - (value.wellness?.fatigue || 0) / 400 + bonus, .45, 1.08);
}
function potentialFor(channel) {
  const innate = state.development.innate;
  const sources = {
    academic: innate.intelligence * .5 + innate.focus * .3 + innate.diligence * .2,
    research: innate.researchAptitude * .5 + innate.focus * .3 + innate.creativity * .2,
    practice: innate.diligence * .5 + innate.focus * .3 + innate.sociability * .2,
    language: innate.intelligence * .4 + innate.focus * .4 + innate.sociability * .2,
    social: innate.sociability * .7 + innate.resilience * .3,
    diligence: innate.diligence * .7 + innate.resilience * .3,
    project: innate.creativity * .5 + innate.diligence * .3 + innate.sociability * .2,
  };
  return sources[channel] || 50;
}
function nextGrowthRandom() {
  state.development.rng = (Math.imul(state.development.rng, 1664525) + 1013904223) >>> 0;
  return state.development.rng / 4294967296;
}
function syncLearnedAbility(channel) {
  const mapping = { academic: 'academic', language: 'language', social: 'sociability', diligence: 'diligence' };
  if (mapping[channel]) state.character.abilities[mapping[channel]] = state.development.skills[channel];
}
function addLearning(channel, rawGain, multiplier = 1) {
  const before = state.development.skills[channel];
  if (before >= DEVELOPMENT_CONFIG.skillCap) return 0;
  const potential = .65 + potentialFor(channel) / 100 * .7;
  const diminishing = Math.pow(Math.max(.02, 1 - before / 100), DEVELOPMENT_CONFIG.diminishingPower);
  const gain = clamp(rawGain * potential * diminishing * multiplier * traitModifier('learning', channel) * equipmentBonus(channel), 0, DEVELOPMENT_CONFIG.perActionCap);
  state.development.skills[channel] = round(Math.min(DEVELOPMENT_CONFIG.skillCap, before + gain));
  syncLearnedAbility(channel);
  return round(state.development.skills[channel] - before);
}
function recordGrowth(action, key) {
  if (!state.development || state.development.applied.includes(key)) return null;
  state.development.applied.push(key);
  const activity = DEVELOPMENT_CONFIG.activities[action] || (action.startsWith('retake:') ? DEVELOPMENT_CONFIG.activities.study : {});
  const roll = nextGrowthRandom();
  const random = DEVELOPMENT_CONFIG.randomRange[0] + roll * (DEVELOPMENT_CONFIG.randomRange[1] - DEVELOPMENT_CONFIG.randomRange[0]);
  const consistent = ['study', 'lab', 'self', 'academy', 'math', 'english', 'weak'].includes(action);
  state.development.streak = consistent ? state.development.streak + 1 : 0;
  const consistency = consistent && state.development.streak >= 3 ? 1 + (state.development.traits.includes('effort') ? .1 : .04) : 1;
  const efficiency = random * developmentCondition() * difficultyConfig().growth * consistency;
  const gains = {};
  for (const [channel, weight] of Object.entries(activity)) {
    const gain = addLearning(channel, DEVELOPMENT_CONFIG.baseGrowth * weight, efficiency);
    if (gain) gains[channel] = gain;
  }
  if (activity.research && state.development.traits.includes('perfectionist')) state.character.abilities.stress = clamp(state.character.abilities.stress + INNATE_TRAITS.perfectionist.stress, 0, 100);
  const entry = { key, action, year: state.life.year, gains, efficiency: round(efficiency), roll };
  state.development.history.push(entry); state.development.lastFeedback = entry;
  return entry;
}
function ensureUndergraduateGrowth() {
  currentTerm().actions.forEach((action, index) => recordGrowth(action, `ug:${state.semester}:${index + 1}`));
}
function learningAbilityChange(key, value) {
  const mapping = { academic: 'academic', language: 'language', sociability: 'social', diligence: 'diligence', creativity: 'project' };
  const channel = mapping[key];
  if (!channel || !state.development || value <= 0) return false;
  addLearning(channel, Math.min(1.5, value * .14), developmentCondition() * difficultyConfig().growth);
  return true;
}
function competencyScores(value = state) {
  if (!value.development) return null;
  const skills = value.development.skills;
  const evidence = value => 100 * (1 - Math.exp(-Math.max(0, value) / 14));
  const projects = (value.experiences.club || 0) + (value.competition?.preparation || 0) +
    (value.academic.project ? 2 : 0) + (value.experiences.industryReferral || 0);
  const hasGrades = value.terms.some(term => term.report);
  const scores = {
    academic: hasGrades ? skills.academic * .65 + cumulativeGpa(value.terms.length,value) / 4.5 * 100 * .35 : skills.academic,
    research: skills.research * .7 + clamp(evidence(value.research) + value.study.papers.length * 7, 0, 100) * .3,
    practice: skills.practice * .65 + evidence(value.practice) * .35,
    language: skills.language * .75 + (value.study.exams.length ? bestLanguageScore(value) : skills.language) * .25,
    social: skills.social * .8 + Math.max(0, ...Object.values(value.social.npcs).map(npc => npc.trust)) * .2,
    diligence: skills.diligence,
    project: skills.project * .65 + evidence(projects) * .35,
  };
  return Object.fromEntries(Object.entries(scores).map(([key, value]) => [key, round(clamp(value, 0, 100))]));
}
function careerRatings(value = state) {
  const scores = competencyScores(value);
  if (!scores) return null;
  const ratings = {};
  for (const [type, weights] of Object.entries(DEVELOPMENT_CONFIG.ratingWeights)) {
    ratings[type] = round(Object.entries(weights).reduce((sum, [key, weight]) => sum + scores[key] * weight, 0));
  }
  return ratings;
}
function learningPerformance(channel) {
  if (!state.development) return 1;
  return clamp((.75 + state.development.skills[channel] / 200) * traitModifier('learning', channel) *
    developmentCondition() * equipmentBonus(channel), .4, 1.3);
}
function actualInterviewScore(evidenceScore) {
  if (!state.development) return evidenceScore;
  return round(clamp((evidenceScore * .75 + competencyScores().social * .25) *
    developmentCondition() * (1 + traitModifier('interview')), 0, 100));
}
function researchChance(base, aptitudeWeight = 300) {
  if (!state.development) return clamp(base + (state.character.abilities.researchAptitude - 50) / aptitudeWeight, .25, .95);
  return clamp(base + (state.development.skills.research - 50) / 200 +
    (state.development.innate.researchAptitude - 50) / 400 + traitModifier('researchQuality') + (equipmentBonus('research') - 1) * .2 -
    (1 - developmentCondition()) * .25, .12, .90);
}
function renderDevelopmentProfile() {
  $('ovr').textContent = state.development ? `${careerRatings().overall.toFixed(1)} / 100` : '—';
  $('development-menu').hidden = !state.development;
  $('development-profile').replaceChildren();
  if (!state.development) return;
  const ratings = careerRatings();
  list($('development-profile'), [`종합 OVR ${ratings.overall.toFixed(1)} · 취업 ${ratings.employment.toFixed(1)} · 석사 ${ratings.masters.toFixed(1)} · 박사 ${ratings.phd.toFixed(1)}`,
    `난이도: ${difficultyConfig().title} · 현재 학습 컨디션 ${(developmentCondition() * 100).toFixed(0)}%`,
    '경쟁력은 준비 상태를 비교하는 지표이며 합격 확률이나 합격 보장이 아닙니다.',
    state.development.origin === 'migrated' ? '이전 저장본: 선천 정보는 미기록 기본값 50, 기존 능력은 후천 이력으로 인정했습니다.' : '선천 특성은 고정이며 실제 활동을 통해 후천 역량이 성장합니다.']);
  const innate = element('details'); innate.append(element('summary', '선천적 잠재력 (고정)'));
  list(innate, Object.entries(DEVELOPMENT_CONFIG.innateLabels).map(([key, title]) => `${title}: ${state.development.innate[key]}`));
  $('development-profile').append(innate);
  list($('development-profile'), state.development.traits.map(id => INNATE_TRAITS[id].title));
  const skills = element('details'); skills.append(element('summary', '후천 역량과 진로 계산'));
  const competencies = competencyScores();
  list(skills, Object.entries(DEVELOPMENT_CONFIG.skillLabels).map(([key, title]) =>
    `${title}: 훈련 ${state.development.skills[key].toFixed(1)} / 경험 포함 ${competencies[key].toFixed(1)}`));
  $('development-profile').append(skills);
  const history = element('details'); history.append(element('summary', '활동별 성장 기록'));
  list(history, state.development.history.slice().reverse().map(entry =>
    `${entry.year}년 ${entry.action}: ${Object.entries(entry.gains).map(([key, gain]) => `${DEVELOPMENT_CONFIG.skillLabels[key]} +${gain}`).join(', ') || '회복·진행 기록'}`));
  $('development-profile').append(history);
}
