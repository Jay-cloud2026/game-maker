// Presentation helpers never draw outcomes or mutate a save during rendering.
function foldDetails(parent, title, nodes) {
  const details = element('details');
  details.append(element('summary', title));
  nodes.forEach(node => details.append(node));
  parent.append(details);
  return details;
}
function compactSemester(scene, firstDetail) {
  const nodes = Array.from(scene.children).slice(firstDetail);
  const core = choiceContainer(scene); core.classList.add('core-actions');
  const work = state.flags.tutorApproved ? 'tutor' : 'cafe';
  const research = state.flags.labNews ? 'newsLab' : 'lab';
  const social = state.flags.clubNews ? 'newsClub' : 'club';
  for (const [id, title, text] of [
    ['study', '공부', '성적과 학업 역량을 준비합니다.'],
    [research, '연구·프로젝트', '연구 경험을 쌓고 교수와의 기회를 만듭니다.'],
    [social, '사람 만나기', '함께 활동하며 관계와 협업 경험을 쌓습니다.'],
    [work, '아르바이트', '현재 가능한 일로 생활비를 법니다.'],
    ['rest', '쉬어 가기', '체력과 마음을 회복합니다.'],
  ]) {
    const original = ACTIONS.find(a => a.id === id);
    const action = labActionEffects(universityAction(original));
    const reason = unavailable(action.effects) || (action.requires && !state.flags[action.requires] ? '아직 열리지 않은 기회' : '');
    addButton(core, title, `${text} ${effectsText(action.effects)}`,
      choose('semester', () => {
        currentTerm().quickProgress = true;
        performAction(action);
      }), reason);
  }
  const opportunities = [];
  if (state.semester >= 3 && state.semester <= 6) opportunities.push('교환학생');
  if (state.semester === 5 && !state.competition) opportunities.push('국제 대회 모집');
  if (state.flags.industryInvite) opportunities.push('선배의 산학 협업');
  if (state.semester >= 5 && !state.academic.project) opportunities.push('졸업 프로젝트');
  if (opportunities.length) scene.append(element('p', `지금의 기회: ${opportunities.join(' · ')} → 아래 세부 활동에서 선택`, 'opportunity-hint'));
  foldDetails(scene, '세부 활동·운동·식사·학기 관리', nodes);
}
function renderCompactChrome() {
  const character = Boolean(state.character);
  document.body.classList.toggle('creating', !character);
  $('stage').textContent = character ? `${characterAge()}세 · ${$('stage').textContent}` : '새 이야기';
  $('gpa').textContent = state.postgraduate.active && !state.postgraduate.active.completed ?
    `연구 ${round(state.postgraduate.active.research)}` : state.career.employer ?
      `경력 ${state.career.years}년` : cumulativeGpa() ? `${cumulativeGpa().toFixed(2)} / 4.50` : '아직 미공개';
  $('military-button').hidden = !character || !state.military.subject || state.character.gender === '여성' ||
    Boolean(state.military.service?.completed) || MILITARY_PHASES.includes(state.phase);
  $('nav-character').hidden = !character;
  $('nav-records').hidden = !character;
  $('nav-relationships').hidden = !Object.keys(state.social.npcs).length;
  $('relationships-open').hidden = state.phase !== 'semester';
  const developer = new URLSearchParams(location.search).get('dev') === '1';
  for (const id of ['slots-export', 'save-export', 'save-import']) $(id).hidden = !developer;
  // Keep detail-only numbers available inside the character drawer.
  const heading = $('scene').querySelector('h2');
  const important = ['collegeMail','collegeEnrollment','militaryComplete','competitionResult','employmentDecision','graduateDone','ending'];
  if (heading && important.includes(state.phase) &&
      (state.phase !== 'collegeMail' || entranceAttempt().applications.some(a => a.accepted))) heading.classList.add('achievement');
  $('notice').classList.toggle('achievement',
    /선발,|장학금.*만원.*감면|승진.*수락|학위.*취득|연애를 시작|추천서를 써/.test(state.notice) && !/불합격|미선발/.test(state.notice));
  const report = currentTerm().report;
  if (state.phase === 'report' && report) {
    const previous = state.terms[state.semester - 2]?.report;
    const text = previous && report.gpa > previous.gpa ?
      `GPA ${report.gpa.toFixed(2)}! 지난 학기보다 ${round(report.gpa - previous.gpa).toFixed(2)} 올랐습니다. 다음 학기 장학금 기회가 가까워졌습니다.` :
      `이번 학기 GPA ${report.gpa.toFixed(2)} · 공부와 경험이 성적표에 남았습니다.`;
    const card = element('p', text, 'result-card'); if (previous && report.gpa > previous.gpa) card.classList.add('achievement');
    $('scene').insertBefore(card, $('scene').children[3] || null);
  }
  const quote = state.campus.ledgers[state.semester]?.quote;
  if (state.phase === 'semester' && !currentTerm().actions.length && quote?.awarded > 0) {
    const card = element('p', `장학금 ${quote.awarded}만원 획득! 이번 학기 지출 부담이 줄었습니다.`, 'result-card achievement');
    $('scene').insertBefore(card, $('scene').children[3] || null);
  }
  if (state.phase === 'vacationResult' && currentTerm().vacationResult?.startsWith('선발')) {
    heading?.classList.add('achievement');
  }
}
function compactDegree(scene, firstDetail, d, t) {
  const nodes = Array.from(scene.children).slice(firstDetail);
  if (!t.paid) {
    // Registration is a real financial decision; retain its amount and loan disclosure.
    const cost = Math.round((programById(d.program).tuition + programById(d.program).admissions.living) * difficultyConfig().living) - programById(d.program).stipend;
    addButton(scene, '등록하고 연구 시작', `${cost}만원 · 부족액은 무이자 학자금 대출에 포함됩니다.`,
      choose('graduateTerm', () => {
        if (t.paid) return;
        const amount = Math.max(0, cost - state.money);
        if (state.campus.debt + amount > CAMPUS_CONFIG.loan.limit) { log('대출 한도에 도달했습니다. 생활비 상담이나 조교 활동을 위한 재정을 먼저 확인하세요.'); return; }
        if (amount) { state.money += amount; state.campus.debt += amount; state.campus.borrowed += amount; }
        const p = programById(d.program);
        t.settlement = { tuition: p.tuition, living: p.admissions.living, stipend: p.stipend, net: cost, year: state.life.year };
        applyEffects({ money: -cost }); t.paid = true;
        log(`대학원 등록 완료. 정산 ${cost}만원${amount ? `, 대출 ${amount}만원` : ''}.`);
      }), false, true);
  } else {
    const priority = !d.topic ? 'topic' : d.data < d.policy.data ? 'experiment' :
      d.thesis < d.policy.thesis ? 'thesis' : d.degree === 'phd' && d.paper < d.policy.papers ? 'paper' : 'project';
    const mentoring = d.feedback < d.policy.feedback ? 'meeting' : d.conference < d.policy.conference ? 'conference' : 'mentoring';
    const study = d.knowledge < d.policy.knowledge ? 'advanced' : d.degree === 'phd' && !d.qualify ? 'qualify' :
      d.degree === 'phd' && !d.defense && d.thesis >= d.policy.thesis ? 'defense' : 'advanced';
    for (const [id, title] of [[priority,'연구·논문'], [study,'공부·심사 준비'], [mentoring,'발표·교수와 협업'], ['RA','조교 활동'], ['rest','회복하기']]) {
      const action = DEGREE_ACTIONS.find(a => a.id === id), reason = degreeActionReason(action);
      addButton(scene, title, `${action.title} · 체력 ${action.energy}`, choose('graduateTerm', () => completeDegreeAction(action)), reason);
    }
  }
  const details = foldDetails(scene, '세부 연구·등록·생활비 관리', nodes);
  details.insertBefore(element('p', `자료 ${d.data} · 지식 ${d.knowledge} · 논문 작성 ${d.thesis} · 논문 ${d.paper} · 학회 ${d.conference} · 피드백 ${d.feedback}`), details.children[1] || null);
}
