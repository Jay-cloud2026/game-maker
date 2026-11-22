// 4단계: 모든 NPC 반응·고백·갈등 추첨은 선택/학기 전환에서 확정 후 저장합니다.
const SOCIAL_PHASES = ['relationships', 'relationshipEvent', 'wellbeing'];
const npcTemplate = id => NPCS.find(npc => npc.id === id);
const withPerson = name => `${name}${(name.charCodeAt(name.length - 1) - 0xac00) % 28 ? '과' : '와'}`;
function createNPCStates() {
  return Object.fromEntries(NPCS.map(npc => [npc.id, {
    intimacy: npc.initialIntimacy, trust: npc.initialTrust, history: [],
    romanceStage: 'met', lastConfession: null,
  }]));
}
function initialSocialFields(admitted = false) {
  return { social: {
    npcs: admitted ? createNPCStates() : {}, interactionUsed: {}, unlocked: {}, actionsApplied: [],
    romance: null, romanceHistory: [], pendingEvent: null, eventReturnPhase: 'semester',
    burnoutAcknowledged: {}, strainTerms: {}, termEvents: {}, discussionUsed: {},
  } };
}
function upgradeSocialState(value) {
  return { ...value, ...initialSocialFields(value.life.admissionYear !== null), version: CONFIG.saveVersion };
}
function validSocialFields(value) {
  const social = value.social;
  return social && social.npcs && social.interactionUsed && social.unlocked &&
    Array.isArray(social.actionsApplied) && Array.isArray(social.romanceHistory) &&
    social.burnoutAcknowledged && social.strainTerms && social.termEvents && social.discussionUsed &&
    Object.entries(social.npcs).every(([id, npc]) => npcTemplate(id) && Array.isArray(npc.history) &&
      Number.isFinite(npc.intimacy) && npc.intimacy >= 0 && npc.intimacy <= 100 &&
      Number.isFinite(npc.trust) && npc.trust >= 0 && npc.trust <= 100) &&
    (!social.romance || Boolean(social.npcs[social.romance.npc])) &&
    (!social.pendingEvent || (['conflict', 'discussion', 'distance'].includes(social.pendingEvent.kind) && social.npcs[social.pendingEvent.npc])) &&
    (value.phase !== 'relationshipEvent' || Boolean(social.pendingEvent));
}
function initializeNPCs() {
  if (!Object.keys(state.social.npcs).length) state.social.npcs = createNPCStates();
}
function relationshipLabel(npc) {
  return npc.intimacy >= 80 ? '절친한 사이' : npc.intimacy >= 60 ? '가까운 친구' :
    npc.intimacy >= 40 ? '친한 사이' : '알아가는 사이';
}
function changeRelationship(id, intimacy, trust, text) {
  const npc = state.social.npcs[id];
  if (!npc) return;
  npc.intimacy = clamp(npc.intimacy + intimacy, 0, 100);
  npc.trust = clamp(npc.trust + trust, 0, 100);
  npc.history.push({ year: state.life.year, semester: state.semester, text, intimacy, trust });
}
function checkSocialOpportunities() {
  for (const template of NPCS) {
    const npc = state.social.npcs[template.id];
    if (!npc || (template.availableSemester || 1) > state.semester) continue;
    if (template.opportunity === 'recommendation') {
      if (npc.trust >= 50 && state.research >= 4 && !state.social.unlocked.professorRecommendation) {
        state.social.unlocked.professorRecommendation = true;
        state.recommendations++;
        log(`${template.name}: 실제 연구 기여 ${state.research}와 신뢰 ${npc.trust}를 바탕으로 추천서를 써 주기로 했다. 친밀도만으로 얻은 기회는 아니다.`);
      }
      continue;
    }
    if (!template.opportunity || npc.intimacy < SOCIAL_CONFIG.invitation.intimacy || npc.trust < SOCIAL_CONFIG.invitation.trust ||
        state.social.unlocked[template.id]) continue;
    state.social.unlocked[template.id] = true;
    if (template.opportunity === 'tutor') {
      state.flags.tutorApproved = true;
      log(`${template.name}이 과외 담당자에게 소개해 주었다. 면담이 연결되어 과외를 선택할 수 있다.`);
    } else if (template.opportunity === 'club') {
      state.flags.clubNews = true;
      log(`${template.name}이 동아리 프로젝트에 초대했다. 주요 행동으로 프로젝트에 합류할 수 있다.`);
    } else {
      state.flags.labNews = true;
      log(`${template.name}이 연구실 모집에 추천했다. 주요 행동으로 후속 연구에 참여할 수 있다.`);
    }
  }
  const peer = state.social.npcs.peer;
  if (state.semester >= 5 && peer && peer.trust >= 30 && state.social.unlocked.helpedPeer && !state.social.unlocked.competitionTeam) {
    state.social.unlocked.competitionTeam = true;
    log(`${semesterName(state.social.unlocked.helpedPeer)}에 도움을 받은 박서우가 국제 대회 팀원이 되겠다고 제안했다. 참여하면 준비를 도와줄 예정이다.`);
  }
}
function socialActionResearch(action) {
  const key = `action:${state.semester}:${currentTerm().actions.length}`;
  if (state.social.actionsApplied.includes(key)) return 0;
  state.social.actionsApplied.push(key);
  const strained = state.character.abilities.stress >= SOCIAL_CONFIG.strainAt && (action.research || action.id === 'study');
  if (strained) state.social.strainTerms[state.semester] = true;
  applyAbilities(SOCIAL_CONFIG.actions[action.id] || { stress: 5 });
  for (const npc of NPCS.filter(template => template.likes.includes(action.id) && (template.availableSemester || 1) <= state.semester)) {
    changeRelationship(npc.id, SOCIAL_CONFIG.activityReaction.intimacy, SOCIAL_CONFIG.activityReaction.trust, `${action.title}에서 책임 있게 활동한 모습을 보았다.`);
  }
  if (state.character.abilities.stress >= SOCIAL_CONFIG.burnoutAt) changeRelationship('peer', 0, -2, '과로 때문에 대화가 짧아졌지만 다시 조율할 여지가 있다.');
  checkSocialOpportunities();
  return strained ? (action.research || 0) * .5 : (action.research || 0);
}
function prepareSocialTerm() {
  if (!state.life.admissionYear) return;
  initializeNPCs();
  checkSocialOpportunities();
  if (state.social.termEvents[state.semester]) return;
  const romance = state.social.romance;
  if (romance && currentExchangePlan()) { state.social.termEvents[state.semester] = { conflict: false, distance: true }; return; }
  if (romance) {
    const draw = Math.random();
    const conflict = draw < SOCIAL_CONFIG.conflictProbability;
    state.social.termEvents[state.semester] = { draw, conflict };
    if (conflict) state.social.pendingEvent = { kind: 'conflict', npc: romance.npc, semester: state.semester };
  } else state.social.termEvents[state.semester] = { conflict: false };
}
function interruptForSocialEvent() {
  if (state.character.abilities.stress >= SOCIAL_CONFIG.burnoutAt && !state.social.burnoutAcknowledged[state.semester]) {
    state.social.burnoutAcknowledged[state.semester] = true;
    state.phase = 'wellbeing'; return true;
  }
  if (state.social.pendingEvent) {
    state.social.eventReturnPhase = 'afterAction';
    state.phase = 'relationshipEvent'; return true;
  }
  return false;
}
function romanceRecord(text) {
  state.social.romanceHistory.push({ year: state.life.year, text });
  log(text);
}
function endRomance(reason) {
  const romance = state.social.romance;
  if (!romance) return;
  state.social.npcs[romance.npc].romanceStage = 'separated';
  changeRelationship(romance.npc, -5, 0, reason);
  romanceRecord(`${npcTemplate(romance.npc).name}과 관계를 정리했다. ${reason} 진로 선택은 계속할 수 있다.`);
  state.social.romance = null;
  applyAbilities({ happiness: -5, stress: 3 });
}
function openLongDistance(program) {
  if (!state.social.romance || program.country === '대한민국') return;
  state.social.pendingEvent = { kind: 'distance', npc: state.social.romance.npc, country: program.country, context: program.context || '진학' };
  state.social.eventReturnPhase = state.phase;
  state.phase = 'relationshipEvent';
}
function finishSocialEvent() {
  const returnPhase = state.social.eventReturnPhase;
  state.social.pendingEvent = null;
  if (returnPhase === 'afterAction') afterAction();
  else state.phase = returnPhase;
}
function renderRelationships() {
  const scene = setScene('캠퍼스 인간관계', '곁에 있는 사람들',
    '대화·관심 표현·고백·데이트는 학기당 교류 1회이며 주요 행동을 쓰지 않습니다. 과제 돕기는 별도로 주요 행동 1회를 씁니다. 연애는 선택 콘텐츠입니다.');
  const used = Boolean(state.social.interactionUsed[state.semester]);
  for (const template of NPCS.filter(npc => (npc.availableSemester || 1) <= state.semester)) {
    const npc = state.social.npcs[template.id];
    const card = element('div', undefined, 'opportunity');
    card.append(element('h3', `${template.name} · ${template.type}`));
    card.append(element('p', `${template.type} · ${relationshipLabel(npc)} · ${template.goal}`));
    const detail = element('details'); detail.append(element('summary', '성격·관계 상세'));
    list(detail, [template.personality, `목표: ${template.goal} · 관심: ${template.interest}`,
      `친밀도 ${npc.intimacy} · 신뢰 ${npc.trust}`]);
    if (template.romance) detail.append(element('p', `연락 선호: ${template.contact} · 장거리 생각: ${template.distance}`));
    card.append(detail);
    const choices = choiceContainer(card);
    addButton(choices, `${withPerson(template.name)} 대화`, used ? '이번 학기 교류 시간을 사용했습니다.' : '함께 진로와 일상을 나눕니다 · 학기당 교류 1회',
      choose('relationships', () => {
        if (state.social.interactionUsed[state.semester]) return;
        state.social.interactionUsed[state.semester] = true;
        changeRelationship(template.id, SOCIAL_CONFIG.talk.intimacy, SOCIAL_CONFIG.talk.trust, '진로와 일상에 대해 차분히 대화했다.');
        applyAbilities({ stress: SOCIAL_CONFIG.talk.stress, happiness: SOCIAL_CONFIG.talk.happiness });
        log(`${withPerson(template.name)} 이야기를 나눴다. 서로의 목표를 알게 되었다.`);
        checkSocialOpportunities();
      }), used);
    if (template.id === 'peer') addButton(choices, '박서우의 과제 돕기', '주요 행동 1회 · 체력 -12 · 친밀도 +10, 신뢰 +15 · 이후 협업의 계기',
      choose('relationships', () => {
        if (state.social.unlocked.helpedPeer || currentTerm().actions.length >= 3 || state.energy < SOCIAL_CONFIG.help.energy * -1) return;
        applyEffects({ energy: SOCIAL_CONFIG.help.energy });
        currentTerm().actions.push('peerHelp'); experience('peerHelp');
        changeRelationship('peer', SOCIAL_CONFIG.help.intimacy, SOCIAL_CONFIG.help.trust, '막혔던 팀 과제를 함께 풀어 주었다.');
        state.social.unlocked.helpedPeer = state.semester;
        log('박서우의 과제를 도왔다. 이 경험은 이후 팀 대회에서도 기억될 수 있다.');
        checkSocialOpportunities(); afterAction();
      }), state.social.unlocked.helpedPeer || currentTerm().actions.length >= 3 || state.energy < -SOCIAL_CONFIG.help.energy);
    if (template.romance && !state.social.romance) {
      if (npc.intimacy >= SOCIAL_CONFIG.flirtAt && npc.romanceStage !== 'flirting') {
        addButton(choices, `${template.name}을 조금 더 알아가기`, '교류 1회 · 서로 관심을 표현하는 단계 · 친밀도 +5',
          choose('relationships', () => {
            if (state.social.interactionUsed[state.semester]) return;
            state.social.interactionUsed[state.semester] = true; npc.romanceStage = 'flirting';
            changeRelationship(template.id, 5, 3, '친구보다 조금 더 알아가고 싶다는 마음을 전했다.');
            romanceRecord(`${template.name}과 서로를 조금 더 알아가기로 했다.`);
          }), used);
      }
      if (npc.romanceStage === 'flirting' && npc.intimacy >= SOCIAL_CONFIG.confessAt && npc.trust >= SOCIAL_CONFIG.confessTrust) {
        addButton(choices, `${template.name}에게 고백`, `교류 1회 · 서로의 의사를 확인합니다. 거절되어도 친구 관계와 진로는 이어집니다.`,
          choose('relationships', () => {
            if (state.social.interactionUsed[state.semester] || npc.lastConfession?.semester === state.semester) return;
            state.social.interactionUsed[state.semester] = true;
            const draw = Math.random(); const accepted = draw < SOCIAL_CONFIG.confessionProbability;
            npc.lastConfession = { semester: state.semester, draw, accepted };
            if (accepted) {
              npc.romanceStage = 'dating';
              state.social.romance = { npc: template.id, sinceYear: state.life.year, longDistance: false };
              applyAbilities({ happiness: 10, stress: -5 });
              romanceRecord(`${template.name}과 서로의 마음을 확인하고 연애를 시작했다.`);
            } else {
              applyAbilities({ happiness: -3 });
              romanceRecord(`${template.name}이 고백을 정중히 거절했다. 상대의 뜻을 존중하고 친구로 지내기로 했다.`);
            }
          }), used);
      }
    }
    if (state.social.romance?.npc === template.id) {
      card.append(element('p', `${state.social.romance.longDistance ? '장거리 연애' : '연애 중'} · ${state.social.romance.sinceYear}년부터`));
      addButton(choices, `${template.name}과 데이트`, `교류 1회 · ${-SOCIAL_CONFIG.date.money}만원 · 행복도 +10, 스트레스 -10`,
        choose('relationships', () => {
          if (state.social.interactionUsed[state.semester] || state.money < -SOCIAL_CONFIG.date.money) return;
          state.social.interactionUsed[state.semester] = true; applyEffects({ money: SOCIAL_CONFIG.date.money });
          changeRelationship(template.id, SOCIAL_CONFIG.date.intimacy, SOCIAL_CONFIG.date.trust, '바쁜 일정 사이에 함께 시간을 보냈다.');
          applyAbilities({ happiness: SOCIAL_CONFIG.date.happiness, stress: SOCIAL_CONFIG.date.stress });
          romanceRecord(`${template.name}과 데이트하며 일정과 다음 계획을 나눴다.`);
        }), used || state.money < -SOCIAL_CONFIG.date.money);
      addButton(choices, '관계에 대해 솔직히 이야기하기', '관계 유지 또는 이별을 직접 선택합니다. 주요 행동 소모 없음.',
        choose('relationships', () => {
          if (state.social.discussionUsed[state.semester]) return;
          state.social.discussionUsed[state.semester] = true;
          state.social.pendingEvent ||= { kind: 'discussion', npc: template.id };
          state.social.eventReturnPhase = 'relationships'; state.phase = 'relationshipEvent';
        }), Boolean(state.social.discussionUsed[state.semester]));
    }
    const history = element('details');
    history.append(element('summary', '함께한 기록'));
    list(history, npc.history.map(record => `${record.year}년 ${semesterName(record.semester)}: ${record.text}`));
    card.append(history); scene.append(card);
  }
  addButton(choiceContainer(scene), '학기로 돌아가기', '남은 주요 행동을 이어갑니다.', choose('relationships', () => { state.phase = 'semester'; }), false, true);
}
function renderRelationshipEvent() {
  const event = state.social.pendingEvent;
  const template = npcTemplate(event.npc);
  const distance = event.kind === 'distance';
  const scene = setScene(distance ? '해외 진학과 관계' : '관계를 돌아보는 시간',
    distance ? `${event.country} ${event.context || '진학'}, 멀어지는 거리` : `${template.name}과 일정이 어긋났다`,
    distance ? `${template.name}: “${template.distance}.” ${event.context || '진학'}은 유지하며 두 사람의 관계를 선택합니다.` :
      '시험과 발표, 함께 보내려던 시간이 겹쳤다. 갈등이 곧 관계의 끝을 뜻하지는 않는다. 이야기를 나눌 수 있다.');
  const choices = choiceContainer(scene);
  const scheduledTrust = distance && template.distancePreference === 'frequent' ? 6 : 10;
  addButton(choices, distance ? '장거리 연락과 만남 계획 세우기' : '서로의 일정과 연락 방식을 조율한다', `행동·비용 소모 없음 · 신뢰 +${scheduledTrust} · 스트레스 -10`,
    choose('relationshipEvent', () => {
      changeRelationship(template.id, 5, scheduledTrust, distance ? '각자의 진로를 존중하며 정기적인 장거리 만남 계획을 세웠다.' : '바쁜 시기를 미리 알리고 함께 시간을 조율했다.');
      if (distance && state.social.romance) {
        state.social.romance.longDistance = true;
        state.social.romance.contactPlan = 'scheduled';
      }
      applyAbilities({ stress: -10, happiness: 5 });
      romanceRecord(distance ? `${template.name}과 장거리 연애를 시작했다. ${event.country} 진학을 서로 응원했다.` : `${template.name}과 갈등을 대화로 풀었다.`);
      finishSocialEvent();
    }));
  if (distance) addButton(choices, '짧고 자주 연락하며 장거리 시도', `행동·비용 소모 없음 · 연락 선호에 따라 신뢰 +${template.distancePreference === 'frequent' ? 10 : 6}`,
    choose('relationshipEvent', () => {
      changeRelationship(template.id, 5, template.distancePreference === 'frequent' ? 10 : 6, '짧게 자주 연락하며 서로의 일상을 나누기로 했다.');
      state.social.romance.longDistance = true;
      state.social.romance.contactPlan = 'frequent';
      applyAbilities({ stress: -10, happiness: 5 });
      romanceRecord(`${template.name}과 자주 연락하는 장거리 연애를 선택했다. 서로의 진학을 응원했다.`);
      finishSocialEvent();
    }));
  addButton(choices, '서로의 선택을 존중하며 이별한다', '진학·학업·취업은 계속 진행됩니다.', choose('relationshipEvent', () => {
    endRomance('서로의 시간과 진로를 존중하기로 했다.'); finishSocialEvent();
  }));
}
function renderWellbeing() {
  const scene = setScene('회복할 기회 · 주요 행동 소모 없음', '잠깐 멈춰도 괜찮다',
    '스트레스가 높아 학습 효율이 떨어지고 있다. 성적이나 관계가 자동으로 무너지지는 않는다. 지금 회복하고 다음 선택을 조절할 수 있다.');
  const choices = choiceContainer(scene);
  addButton(choices, '상담과 충분한 수면으로 회복', '체력 +25 · 스트레스 -35 · 행복도 +8 · 학기당 한 번의 회복 안내',
    choose('wellbeing', () => {
      applyEffects({ energy: 25 }); applyAbilities({ stress: -35, happiness: 8 });
      log('상담과 수면으로 컨디션을 회복했다. 남은 행동은 다시 선택할 수 있다.'); afterAction();
    }));
  addButton(choices, '일정을 줄이고 짧게 숨 고르기', '스트레스 -15 · 이후 휴식 행동으로 더 회복할 수 있습니다.',
    choose('wellbeing', () => { applyAbilities({ stress: -15 }); log('일정을 줄이고 잠깐 멈췄다.'); afterAction(); }));
}
function renderSocialSidebar() {
  const admitted = state.life.admissionYear !== null;
  $('relationships-menu').hidden = !admitted;
  $('relationships-records').replaceChildren();
  if (!admitted) return;
  list($('relationships-records'), NPCS.filter(template => state.social.npcs[template.id] && (template.availableSemester || 1) <= state.semester)
    .map(template => `${template.name} (${template.type}) · ${relationshipLabel(state.social.npcs[template.id])}`));
  $('relationships-records').append(element('p', state.social.romance ?
    `${npcTemplate(state.social.romance.npc).name}과 ${state.social.romance.longDistance ? '장거리 연애 중' : '연애 중'}` : '현재 연애하지 않음 · 진로 선택에 필수 조건이 아닙니다.'));
  list($('relationships-records'), state.social.romanceHistory.map(record => `${record.year}년: ${record.text}`));
}
