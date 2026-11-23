// A small, persisted contact ledger; no separate NPC management screen or outcome rerolls.
const NPC_OFFERS = {
  study: { npc: 'peer', title: '박서우의 스터디 제안', cause: '함께 쌓은 신뢰를 바탕으로 시험 준비를 함께하자고 합니다.', next: '이번 학기 공부를 선택하면 성적표에 스터디 기여가 반영됩니다.' },
  internship: { npc: 'senior', title: '취업한 선배에게서 온 인턴 추천', cause: '예전에 함께 활동했던 윤도현이 회사의 유급 인턴 모집을 알려 왔습니다.', next: '이번 또는 다음 학기 성적표의 유급 인턴 지원에서 추천 전형을 이용할 수 있습니다. 합격은 준비와 추첨으로 결정됩니다.' },
  project: { npc: 'professor', title: '교수님의 연구 프로젝트 제안', cause: '꾸준히 남긴 연구 기록과 신뢰를 보고 공동 과제에 초대했습니다.', next: '다음 연구·프로젝트 활동에 참여하면 실제 기여에 기반한 추천서를 받습니다.' },
  collaboration: { npc: 'labmate', title: '최지윤의 공동 논문 제안', cause: '함께 연구해 온 동료가 자료를 나누고 공동 저자로 연구하자고 합니다.', next: '다음 연구 활동에서 공동 연구를 진행합니다. 심사에 통과하면 실제 논문 기록으로 남습니다.' },
  job: { npc: 'senior', title: '선배가 전달한 채용 정보와 면접 조언', cause: '취업 후에도 이어 온 관계를 기억한 선배가 실제 지원 공고를 보내 왔습니다.', next: '추천 공고와 면접 증빙이 열립니다. 학위·지원 조건과 선발 심사는 그대로 적용됩니다.' },
  support: { npc: 'peer', title: '친구에게서 온 안부 연락', cause: '바쁜 시기를 지켜본 박서우가 잠깐 쉬며 이야기를 나누자고 합니다.', next: '행복 +8 · 스트레스 -15. 중요한 준비를 이어갈 여유가 생깁니다.' },
  promise: { npc: null, title: '연인이 제안한 중요한 약속', cause: '서로의 다음 진로와 함께 보낼 시간을 차분히 이야기하자고 합니다.', next: '행복 +10 · 스트레스 -10. 두 사람의 약속을 관계 기록에 남깁니다.' },
};
function npcPeriod() { return state.life.year * 2 + state.life.half; }
function npcUndergraduate() { return state.life.admissionYear !== null && state.life.graduationYear === null; }
function npcCareerStage(id) {
  const years = Math.max(0, state.life.year - state.life.admissionYear);
  if (id === 'senior') return years >= 6 ? '미래정밀솔루션으로 이직' : years >= 2 ? '한빛테크놀로지 취업' : '졸업·취업 준비';
  if (id === 'peer') return years >= 4 ? '다온웨이브 취업' : '같은 과 재학';
  if (id === 'labmate') return years >= 6 ? '공동 연구원' : years >= 4 ? '대학원 진학' : '연구실 동료';
  if (id === 'junior') return years >= 6 ? '첫 직장 입사' : '후배·전공 공부';
  return npcTemplate(id)?.type || '';
}
function npcNote(text) {
  state.history.unshift({ label: '인간관계의 다음 이야기', text, year: state.life.year, age: characterAge() });
}
function offerStillRelevant(offer) {
  if (offer.kind === 'study' && currentTerm().actions.length >= 3) return false;
  if (['study','internship'].includes(offer.kind)) return npcUndergraduate() && state.semester <= offer.expiresSemester;
  if (offer.kind === 'promise') return state.social.romance?.npc === offer.npc;
  if (offer.kind === 'job') return !npcUndergraduate();
  return true;
}
function updateNPCContacts() {
  if (!state.character || !Object.keys(state.social.npcs).length || state.life.admissionYear === null ||
      state.phase === 'ending' || state.lifeAssessment.finalId) return;
  const safe = ['semester','graduateTerm','hub','jobBoard','jobNext','workTurn','vacation','report'];
  if (!safe.includes(state.phase)) return;
  const ledger = state.social.outreach ||= { schema: 1, offers: [], careers: {}, lastPeriod: null, letters: [] };
  for (const id of ['senior','peer','labmate','junior']) {
    if (!state.social.npcs[id]) continue;
    const stage = npcCareerStage(id), previous = ledger.careers[id];
    if (!previous || previous.stage !== stage) {
      ledger.careers[id] = { stage, year: state.life.year };
      if (previous) npcNote(`${npcTemplate(id).name}의 소식: ${previous.stage} → ${stage}. 이어 온 관계는 다음 제안에 연결됩니다.`);
    }
  }
  for (const offer of ledger.offers) if (offer.status === 'pending' && !offerStillRelevant(offer)) offer.status = 'expired';
  if (ledger.offers.some(o => o.status === 'pending') || ledger.lastPeriod === npcPeriod()) return;
  const ties = (id, intimacy, trust) => {
    const npc = state.social.npcs[id];
    return npc && npc.intimacy >= intimacy && npc.trust >= trust;
  };
  const eligible = {
    internship: npcUndergraduate() && state.semester >= 5 && state.life.year - state.life.admissionYear >= 2 && ties('senior',30,25),
    job: !npcUndergraduate() && ties('senior',30,30),
    project: state.research >= 2 && ties('professor',15,35) && !state.social.unlocked.professorRecommendation,
    collaboration: state.research >= 4 && ties('labmate',30,35),
    promise: Boolean(state.social.romance),
    support: state.character.abilities.stress >= 55 && ties('peer',30,25),
    study: npcUndergraduate() && state.phase === 'semester' && currentTerm().actions.length < 3 && ties('peer',30,20),
  };
  const kind = Object.keys(eligible).find(k => eligible[k] && !ledger.offers.some(o => o.kind === k));
  if (!kind) return;
  const config = NPC_OFFERS[kind], npc = config.npc || state.social.romance.npc;
  const history = state.social.npcs[npc].history;
  const metYear = history.length ? Math.min(...history.map(h => h.year)) : state.life.year;
  ledger.offers.push({ id: `npc:${kind}`, kind, npc, status: 'pending', year: state.life.year,
    period: npcPeriod(), expiresSemester: state.semester + 1, metYear, career: ledger.careers[npc]?.stage || npcTemplate(npc).type,
    ...(kind === 'job' ? { company: ledger.careers.senior?.stage.includes('미래정밀') ? 'mirae' : 'hanbit' } : {}) });
  ledger.lastPeriod = npcPeriod();
  npcNote(`${npcTemplate(npc).name}에게 먼저 연락이 왔다: ${config.title}.`);
}
function resolveNPCOffer(id, accept) {
  const ledger = state.social.outreach, offer = ledger?.offers.find(o => o.id === id);
  if (!offer || offer.status !== 'pending' || !offerStillRelevant(offer)) return;
  offer.status = accept ? 'accepted' : 'declined';
  let result = '이번에는 현재 준비에 집중하기로 했습니다. 관계에 불이익은 없습니다.';
  if (accept) {
    switch (offer.kind) {
      case 'study': ledger.study = { offer: id, semester: state.semester, used: false }; result = '스터디 일정이 잡혔습니다. 이번 학기 공부 행동을 하면 GPA에 실제 반영됩니다.'; break;
      case 'internship': ledger.internship = { offer: id, source: offer.npc, expiresSemester: offer.expiresSemester, used: false };
        result = '선배 추천 인턴 모집이 열렸습니다. 성적표에서 유급 인턴 지원을 선택하세요. 합격 여부는 지원 시 확정합니다.'; break;
      case 'project': ledger.project = { offer: id, used: false };
        result = '교수님의 공동 과제가 열렸습니다. 다음 연구 행동에서 실제 기여를 쌓으면 추천서로 연결됩니다.'; break;
      case 'collaboration': ledger.collaboration = { offer: id, used: false };
        result = '공동 논문 준비를 시작했습니다. 다음 연구 행동에서 자료를 만들고 심사를 받습니다.'; break;
      case 'job': ledger.job = { offer: id, company: offer.company, used: false };
        result = `${companyById(ledger.job.company).name} 추천 공고와 선배의 면접 조언이 열렸습니다. 취업 지원 화면에서 확인하세요.`; break;
      case 'support': applyAbilities({ happiness: 8, stress: -15 }); result = '친구와 숨을 돌렸습니다. 행복 +8 · 스트레스 -15. 준비 중인 진로는 그대로 이어갑니다.'; break;
      case 'promise':
        applyAbilities({ happiness: 10, stress: -10 });
        changeRelationship(offer.npc, 5, 8, '서로의 진로를 응원하고 중요한 시간을 함께 보내기로 약속했다.');
        romanceRecord(`${npcTemplate(offer.npc).name}과 다음 진로와 만남에 대한 약속을 정했다.`);
        result = '서로의 진로와 함께할 시간을 약속했습니다. 행복 +10 · 스트레스 -10. 관계 기록에 보관했습니다.'; break;
    }
  }
  offer.result = result; ledger.lastResult = { id, text: result, period: npcPeriod() };
  log(`${NPC_OFFERS[offer.kind].title}: ${result}`);
}
function renderNPCContact() {
  const box = $('npc-contact'); box.replaceChildren(); box.hidden = true;
  const ledger = state.social.outreach;
  if (!ledger || !['semester','graduateTerm','hub','jobBoard','jobNext','workTurn','vacation','report'].includes(state.phase)) return;
  const offer = ledger.offers.find(o => o.status === 'pending' && offerStillRelevant(o));
  if (offer) {
    box.hidden = false;
    const config = NPC_OFFERS[offer.kind], years = Math.max(0, state.life.year - offer.metYear);
    box.append(element('span', '먼저 도착한 연락', 'badge'), element('h2', config.title),
      element('p', `${years ? `${years}년 전부터 이어 온 관계 · ` : ''}${offer.career}`),
      element('p', config.cause), element('p', config.next));
    const buttons = choiceContainer(box);
    addButton(buttons, '제안 받아들이기', '주요 행동을 추가로 소모하지 않습니다. 참여가 필요한 기회는 기존 행동으로 진행합니다.',
      choose(state.phase, () => resolveNPCOffer(offer.id, true)), false, true);
    addButton(buttons, '이번에는 현재 일에 집중하기', '관계를 해치지 않으며 같은 제안을 반복하지 않습니다.',
      choose(state.phase, () => resolveNPCOffer(offer.id, false)));
  } else if (ledger.lastResult?.period === npcPeriod()) {
    box.hidden = false; box.append(element('h3', '관계가 만든 변화'), element('p', ledger.lastResult.text));
  }
}
function activeInternshipReferral() {
  const referral = state.social.outreach?.internship;
  return referral && !referral.used && npcUndergraduate() && state.semester <= referral.expiresSemester ? referral : null;
}
function npcJobSupport(company) {
  const lead = state.social.outreach?.job;
  return lead && !lead.used && lead.company === company.id ? { bonus: 3, source: '윤도현 선배의 채용 정보·면접 조언', offer: lead.offer } : null;
}
function consumeNPCResearchSupport(id, key) {
  const ledger = state.social.outreach;
  if (!ledger) return;
  const degree = key.startsWith('degree:') ? state.postgraduate.active : null;
  const addContribution = () => {
    state.research++;
    if (degree) {
      degree.research++;
      if (degree.degree === 'masters') state.master.research++;
    }
  };
  if (id === 'study' && ledger.study && !ledger.study.used && ledger.study.semester === state.semester) {
    ledger.study.used = true; currentTerm().npcStudy = { source: '박서우', bonus: .15 };
    applyAbilities({ stress: -5 });
    ledger.lastResult = { period: npcPeriod(), text: '박서우와 준비한 스터디를 실제 공부에 활용했습니다. 이번 성적표 과목 평점 +0.15(상한 4.5)에 반영됩니다.' };
  }
  if (!['lab','newsLab','experiment','analysis','project','paper','collaboration','research'].includes(id)) return;
  if (ledger.project && !ledger.project.used) {
    ledger.project.used = true; addContribution();
    const quality = Math.min(85, 60 + state.research * 2);
    ledger.letters.push({ source: '김은솔 교수', quality, year: state.life.year, key });
    if (!state.social.unlocked.professorRecommendation) {
      state.social.unlocked.professorRecommendation = true; state.recommendations++;
    }
    ledger.lastResult = { period: npcPeriod(), text: '교수님의 공동 과제에 기여했습니다. 연구 +1 · 실제 추천서를 받았습니다. 다음 대학원 원서의 추천서 조건·평가에 반영됩니다.' };
    npcNote(ledger.lastResult.text);
  }
  if (ledger.collaboration && !ledger.collaboration.used) {
    ledger.collaboration.used = true;
    const probability = researchChance(.8), draw = Math.random(), accepted = draw < probability;
    ledger.collaboration.result = { probability, draw, accepted, year: state.life.year, key };
    addContribution();
    if (accepted) {
      state.study.papers.push({ kind: 'npc-collaboration', source: '최지윤', program: degree?.program || null, year: state.life.year, key });
      if (degree) degree.paper++;
    }
    ledger.lastResult = { period: npcPeriod(), text: accepted ?
      '최지윤과 만든 공동 논문이 심사를 통과했습니다! 연구 +1 · 논문 1편이 대학원·연구직 평가와 연봉 산정에 반영됩니다.' :
      '공동 논문은 수정 요구를 받았습니다. 연구 경험 +1은 남지만 논문 실적은 지급되지 않습니다. 다음 연구를 준비할 수 있습니다.' };
    npcNote(ledger.lastResult.text);
  }
}
function npcRecommendationQuality() {
  return Math.max(0, ...(state.social.outreach?.letters || []).map(letter => letter.quality));
}
function validNPCOutreach(social) {
  const o = social.outreach;
  return o === undefined || (o && o.schema === 1 && Array.isArray(o.offers) && o.careers &&
    Array.isArray(o.letters) && o.letters.every(l => Number.isFinite(l.quality) && l.quality >= 0 && l.quality <= 100) &&
    new Set(o.offers.map(x => x.id)).size === o.offers.length &&
    o.offers.every(x => NPC_OFFERS[x.kind] && npcTemplate(x.npc) && Number.isFinite(x.year) &&
      ['pending','accepted','declined','expired'].includes(x.status)));
}
