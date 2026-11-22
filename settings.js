// 모든 금액은 만원, 시간은 주당 시간입니다. 가상 학교·대회이며 실제 입시 기준이 아닙니다.
const CONFIG = {
  saveKey: 'semester-break-career-v1', saveVersion: 13,
  semesters: 8, actionsPerSemester: 3,
  initial: { money: 100, energy: 80 }, maxEnergy: 100,
  vacationRecovery: 35, shortResearch: { money: 35, energy: 25, research: 2 },
  internship: { income: 120, energy: -20, experience: 2, minimumExperience: 2 },
  job: { income: 200, energy: -20, savings: 150, experience: 3 },
  competition: {
    title: '바이오브릿지 국제 팀 챌린지',
    initialBudget: 80, preparationCost: 30, grant: 80, reducedCost: 15,
    awardPreparation: 3,
    roles: {
      data: { title: '데이터 분석', task: '실험 데이터를 정리하고 재현성을 검토한 일' },
      presentation: { title: '발표', task: '서로 다른 전공의 의견을 하나의 발표로 엮은 일' },
      management: { title: '팀 운영', task: '일정과 예산을 조정하고 팀원 이탈 뒤 업무를 재배분한 일' },
    },
  },
};
// 인생 확장 2단계 설정. 수치는 게임용이며 실제 입시·대학 자료가 아닙니다.
const LIFE_CONFIG = {
  startYear: 2026, birthYear: 2008, startAge: 18,
  legacyAdmissionYear: 2027, legacyUniversity: null,
  legacySchoolLabel: '기존 대학 (학교 기록 없음)',
  highSchool: '새봄고등학교',
  abilityRange: [30, 78], strongRange: [82, 95], weakRange: [18, 32],
  personalities: {
    steady: { title: '차근차근 성실형', boosts: { diligence: 12, academic: 5 } },
    curious: { title: '질문 많은 탐구형', boosts: { researchAptitude: 12, creativity: 5 } },
    social: { title: '함께하는 사교형', boosts: { sociability: 12, happiness: 5 } },
    inventive: { title: '새로움을 찾는 창의형', boosts: { creativity: 12, language: 5 } },
  },
  interests: ['생명·화학', '컴퓨터·데이터', '기계·환경', '경영·사회', '인문·국제'],
  abilityLabels: {
    academic: '학업 능력', researchAptitude: '연구 적성', sociability: '사회성',
    creativity: '창의성', diligence: '성실성', stress: '스트레스',
    happiness: '행복도', economy: '경제력', language: '외국어 능력', motivation: '학업 의욕',
  },
  exam: {
    subjects: ['국어', '수학', '영어', '탐구 1', '탐구 2'],
    sharedNoise: [-20, 20], subjectNoise: [-14, 14],
    retryNoise: [-18, 8], retrySubjectNoise: [-7, 7],
    gradeThresholds: [96, 89, 77, 60, 40, 23, 11, 4],
    academicWeight: .55, diligenceWeight: .15, latentWeight: .30,
  },
  admissions: { maxApplications: 4, logisticScale: 8, minProbability: .02, maxProbability: .98 },
  retake: { actions: 4, alternativesAfter: 3, energyRecovery: 20 },
  // 시간은 단계 완료 시에만 진행하며, 반년을 최소 단위로 사용합니다.
  time: { undergraduateTerm: 1, workTurn: 2, masterTurn: 2, shortResearch: 1 },
};
const RETAKE_ACTIONS = [
  { id: 'self', title: '독학 재수', effects: { money: -10, energy: -15 },
    abilities: { academic: 2, diligence: 2, stress: 7, happiness: -2 }, general: 5, selfManaged: true,
    text: '성실성에 따라 학습 효과가 달라집니다.' },
  { id: 'academy', title: '재수 학원 등록', effects: { money: -80, energy: -22 },
    abilities: { academic: 3, stress: 12, happiness: -4 }, general: 8, text: '비용은 높지만 체계적으로 전 과목을 준비합니다.' },
  { id: 'math', title: '수학 집중 공부', effects: { money: -8, energy: -15 },
    abilities: { academic: 2, stress: 6 }, subject: '수학', boost: 11, text: '수학에 집중합니다.' },
  { id: 'english', title: '영어 집중 공부', effects: { money: -8, energy: -14 },
    abilities: { language: 4, stress: 5 }, subject: '영어', boost: 11, text: '영어에 집중하고 외국어 능력도 키웁니다.' },
  { id: 'weak', title: '취약 과목 보완', effects: { money: -12, energy: -15 },
    abilities: { academic: 2, stress: 5 }, weakest: true, boost: 12, text: '직전 수능에서 가장 약했던 과목을 보완합니다.' },
  { id: 'work', title: '아르바이트 병행', effects: { money: 60, energy: -20 },
    abilities: { sociability: 2, stress: 6 }, text: '생활비를 벌지만 공부에 쓸 시간은 줄어듭니다.' },
  { id: 'rest', title: '휴식 및 멘탈 관리', effects: { money: 0, energy: 35 },
    abilities: { stress: -24, happiness: 15, motivation: 8 }, general: 1, text: '체력과 마음을 회복합니다.' },
];
// 대학별 등록금·주거비는 학기 시작 정산에 사용합니다.
const UNIVERSITIES = [
  { id: 'sangrok', name: '상록과학기술원', region: '중부 연구도시', type: '연구 중심 특성화', tier: '최상위권',
    majors: ['생명·화학', '컴퓨터·데이터', '기계·환경'], difficulty: 94,
    weights: { school: .20, exam: .65, activity: .15 }, fee: 6, tuition: 250, housing: 65,
    scholarship: { title: '탐구 인재 장학금', minimum: 94, amount: 200 }, dorm: true,
    opportunities: '연구실 탐구와 국제 연구 동아리', future: '기초 연구·대학원 연구계획 지원' },
  { id: 'eunha', name: '은하종합대학교', region: '수도권', type: '종합 연구', tier: '최상위권',
    majors: ['생명·화학', '컴퓨터·데이터', '경영·사회', '인문·국제'], difficulty: 88,
    weights: { school: .35, exam: .45, activity: .20 }, fee: 6, tuition: 280, housing: 95,
    scholarship: { title: '성적 우수 장학금', minimum: 90, amount: 180 }, dorm: true,
    opportunities: '다양한 연구실과 학제 간 동아리', future: '폭넓은 기업·학계 진로 탐색' },
  { id: 'hanul', name: '한울대학교', region: '충청권', type: '연구·교육 균형', tier: '상위권',
    majors: ['생명·화학', '컴퓨터·데이터', '기계·환경', '경영·사회'], difficulty: 81,
    weights: { school: .30, exam: .50, activity: .20 }, fee: 5, tuition: 180, housing: 50,
    scholarship: { title: '신입생 학업 장학금', minimum: 83, amount: 100 }, dorm: true,
    opportunities: '멘토형 연구실과 데이터 동아리', future: '연구와 실무를 균형 있게 준비' },
  { id: 'haeon', name: '해온공학대학교', region: '동남 산업도시', type: '산학 실무', tier: '상위권',
    majors: ['컴퓨터·데이터', '기계·환경', '생명·화학'], difficulty: 75,
    weights: { school: .20, exam: .55, activity: .25 }, fee: 5, tuition: 210, housing: 55,
    scholarship: { title: '산학 인재 장학금', minimum: 78, amount: 110 }, dorm: true,
    opportunities: '산학 연구실과 제작 프로젝트 동아리', future: '인턴·산업 프로젝트 기회' },
  { id: 'seorim', name: '서림시립대학교', region: '수도권 도심', type: '공공·도시', tier: '중위권',
    majors: ['기계·환경', '경영·사회', '컴퓨터·데이터'], difficulty: 69,
    weights: { school: .45, exam: .40, activity: .15 }, fee: 4, tuition: 100, housing: 100,
    scholarship: { title: '생활 지원 장학금', minimum: 70, amount: 60 }, dorm: false,
    opportunities: '도시 문제 연구실과 지역 협력 동아리', future: '공공기관·도심 아르바이트 접근성' },
  { id: 'gaon', name: '가온국제대학교', region: '서해권', type: '국제 교류', tier: '중위권',
    majors: ['인문·국제', '경영·사회', '컴퓨터·데이터'], difficulty: 63,
    weights: { school: .25, exam: .45, activity: .30 }, fee: 4, tuition: 220, housing: 60,
    scholarship: { title: '국제 인재 장학금', minimum: 70, amount: 120 }, dorm: true,
    opportunities: '국제 공동 세미나와 언어 동아리', future: '교환학생과 국제 진로 탐색' },
  { id: 'noeul', name: '노을산학대학교', region: '중부 산업도시', type: '실무 중심', tier: '중위권',
    majors: ['기계·환경', '컴퓨터·데이터', '경영·사회'], difficulty: 57,
    weights: { school: .40, exam: .35, activity: .25 }, fee: 4, tuition: 170, housing: 45,
    scholarship: { title: '프로젝트 장학금', minimum: 65, amount: 80 }, dorm: true,
    opportunities: '산업 연계 연구실과 제품 개발 동아리', future: '현장 실습과 실무 포트폴리오' },
  { id: 'solbit', name: '솔빛국립대학교', region: '서남권', type: '지역 거점 교육', tier: '중하위권',
    majors: ['생명·화학', '기계·환경', '경영·사회', '인문·국제'], difficulty: 51,
    weights: { school: .40, exam: .45, activity: .15 }, fee: 3, tuition: 90, housing: 35,
    scholarship: { title: '지역 성장 장학금', minimum: 58, amount: 60 }, dorm: true,
    opportunities: '지역 생태 연구실과 주민 협업 동아리', future: '지역 연구·공공 분야 진로' },
  { id: 'daon', name: '다온실무대학교', region: '동해권', type: '산업 실무 교육', tier: '기초 성장권',
    majors: ['컴퓨터·데이터', '기계·환경', '경영·사회'], difficulty: 43,
    weights: { school: .35, exam: .30, activity: .35 }, fee: 3, tuition: 130, housing: 35,
    scholarship: { title: '성장 응원 장학금', minimum: 52, amount: 70 }, dorm: true,
    opportunities: '실습 연구실과 앱 제작 동아리', future: '직무 교육과 지역 기업 연계' },
  { id: 'deulkkot', name: '들꽃미래대학교', region: '내륙 지역', type: '맞춤형 교육', tier: '기초 성장권',
    majors: ['생명·화학', '컴퓨터·데이터', '기계·환경', '경영·사회', '인문·국제'], difficulty: 32,
    weights: { school: .35, exam: .35, activity: .30 }, fee: 3, tuition: 110, housing: 30,
    scholarship: { title: '첫걸음 장학금', minimum: 45, amount: 60 }, dorm: true,
    opportunities: '소규모 지도 연구실과 자율 프로젝트 동아리', future: '기초부터 쌓는 취업·대학원 준비' },
];
// 3단계: 금액은 만원, 통학은 편도 분, 효과는 학기당 한 번입니다.
const CAMPUS_CONFIG = {
  legacySchool: { name: '기존 대학 표준 정책', tuition: 120, housing: 45, dorm: true },
  livingCost: 20, extraTuitionRate: .6,
  loan: { limit: 6000, repaymentRate: .25, manualPayment: 50, activityReserve: 30 },
  preparationWork: { income: 80, halves: 1, energy: 20 },
  graduation: { total: 96, major: 72, general: 24, minimumGpa: 2.0,
    required: ['s1-c0', 's1-c1', 's2-c0', 's2-c1'], project: true },
  retake: { eligibleAtMost: 2.5, maximum: 3.5, improvement: 1, energy: -18, money: -5 },
  warningBelow: 1.75,
  workPenalty: { threshold: 2, perAction: 1.25 },
  project: { money: -10, energy: -18 },
  seminar: { money: -5, energy: -12 },
};
const HOUSING = [
  { id: 'home', title: '부모님 집에서 통학', deposit: 0, rent: 10, commute: 90,
    energy: -12, happiness: -2, privacy: '낮음', refundRate: 1 },
  { id: 'dorm', title: '학교 기숙사', deposit: 15, rentFactor: .8, commute: 10,
    energy: 0, happiness: 3, privacy: '공용 생활', refundRate: 1, requiresDorm: true },
  { id: 'studio', title: '원룸 자취', deposit: 180, rentFactor: 1.5, commute: 20,
    energy: -3, happiness: 6, privacy: '높음', refundRate: 1 },
  { id: 'roommate', title: '룸메이트와 공동 거주', deposit: 60, rentFactor: 1, commute: 25,
    energy: -4, happiness: 4, privacy: '보통', refundRate: 1 },
];
const SCHOLARSHIPS = [
  { id: 'merit', title: '성적 장학금', amount: 65, probability: .85, minimumGpa: 3.3,
    description: '직전 공개 학기 평점 3.3 이상' },
  { id: 'research', title: '연구 장학금', amount: 55, probability: .85, minimumResearch: 2,
    description: '누적 연구 경험 2 이상' },
  { id: 'need', title: '생활비 장학금', amount: 60, probability: .95, maximumMoney: 120, maximumEconomy: 55,
    description: '학기 준비 시 잔액 120만원 이하 또는 경제력 55 이하' },
];
// 학교별 특성은 순위 보정이 아니라 구체적인 활동·졸업 요건에만 반영됩니다.
const UNIVERSITY_POLICIES = {
  default: { retakePolicy: 'highest', researchBonus: 0, cafeBonus: 0,
    requiredResearch: 0, industryProject: false, internationalSeminar: false },
  sangrok: { researchBonus: 1, requiredResearch: 2 },
  eunha: { researchBonus: 1, requiredResearch: 2 },
  hanul: { researchBonus: 1 },
  haeon: { internshipThreshold: 1, industryProject: true },
  seorim: { cafeBonus: 10, retakePolicy: 'latest' },
  gaon: { internationalSeminar: true },
  noeul: { internshipThreshold: 1, industryProject: true },
  solbit: { researchBonus: 1 },
  daon: { cafeBonus: 5, internshipThreshold: 1, industryProject: true },
  deulkkot: { retakePolicy: 'highest' },
};
// 4단계: 친밀도와 신뢰도는 별개입니다. 연애는 진로 선발 점수의 필수 조건이 아닙니다.
const SOCIAL_CONFIG = {
  talk: { intimacy: 12, trust: 6, stress: -6, happiness: 3 },
  activityReaction: { intimacy: 3, trust: 6 },
  help: { intimacy: 10, trust: 15, energy: -12 },
  date: { money: -12, intimacy: 10, trust: 6, happiness: 10, stress: -10 },
  invitation: { intimacy: 40, trust: 30 },
  flirtAt: 40, confessAt: 55, confessTrust: 35, confessionProbability: .85,
  conflictProbability: .3, burnoutAt: 85, strainAt: 80, strainGradePenalty: .5,
  actions: {
    study: { stress: 8, happiness: -1 }, lab: { stress: 10, happiness: -1 },
    newsLab: { stress: 10, happiness: -1 }, club: { stress: 6, happiness: 3 },
    newsClub: { stress: 6, happiness: 3 }, cafe: { stress: 10, happiness: -1 },
    tutor: { stress: 12, happiness: 0 }, rest: { stress: -25, happiness: 8, motivation: 5 },
  },
};
const NPCS = [
  { id: 'peer', name: '박서우', type: '같은 과 동기', personality: '차분하고 약속을 잘 지킨다', goal: '사람들에게 도움이 되는 팀 프로젝트', interest: '데이터와 협업', initialIntimacy: 20, initialTrust: 15, likes: ['club', 'newsClub'], opportunity: 'tutor' },
  { id: 'senior', name: '윤도현', type: '선배', personality: '솔직하고 실행이 빠르다', goal: '후배에게 현장 경험 전달', interest: '산학 프로젝트', initialIntimacy: 15, initialTrust: 20, likes: ['cafe', 'industry'], opportunity: 'club' },
  { id: 'junior', name: '정나래', type: '후배', personality: '호기심이 많고 질문을 즐긴다', goal: '첫 전공 발표 완성', interest: '전공 학습', initialIntimacy: 10, initialTrust: 10, likes: ['study'], availableSemester: 3 },
  { id: 'clubmate', name: '이하람', type: '동아리 친구', personality: '창의적이며 함께하는 시간을 중요하게 여긴다', goal: '자신만의 서비스 만들기', interest: '디자인과 프로젝트', initialIntimacy: 20, initialTrust: 15, likes: ['club', 'newsClub'], opportunity: 'club', romance: true, contact: '자주 짧게 연락하기', distance: '일정을 함께 정하면 장거리도 시도하고 싶다', distancePreference: 'frequent' },
  { id: 'labmate', name: '최지윤', type: '연구실 동료', personality: '독립적이며 솔직한 대화를 좋아한다', goal: '해외 연구실에서 새로운 주제 배우기', interest: '연구와 국제 교류', initialIntimacy: 20, initialTrust: 15, likes: ['lab', 'newsLab'], opportunity: 'lab', romance: true, contact: '바쁜 기간에는 미리 알리기', distance: '각자의 진로를 존중하며 정기적으로 만나기', distancePreference: 'scheduled' },
  { id: 'professor', name: '김은솔 교수', type: '지도교수', personality: '과정과 기록을 중요하게 여긴다', goal: '학생이 스스로 질문하도록 돕기', interest: '연구 재현성과 교육', initialIntimacy: 5, initialTrust: 20, likes: ['lab', 'newsLab', 'study'], opportunity: 'recommendation' },
  { id: 'coworker', name: '한유진', type: '아르바이트 동료', personality: '현실적이고 유쾌하다', goal: '생활비를 모아 새로운 일을 배우기', interest: '고객 응대와 일상', initialIntimacy: 15, initialTrust: 15, likes: ['cafe', 'tutor'], opportunity: 'tutor' },
];
const ACTIONS = [
  { id: 'study', title: '전공 공부', effects: { money: -5, energy: -16 }, feedback: '개념이 서로 연결되기 시작했다. 과제의 논리가 탄탄해졌다.' },
  { id: 'lab', title: '연구실 참여', effects: { money: -8, energy: -20 }, feedback: '실험 노트를 꼼꼼히 정리했다. 선배와 질문을 나눴다.', research: 1 },
  { id: 'club', title: '동아리 프로젝트', effects: { money: -8, energy: -16 }, feedback: '팀플 발표는 순조로웠다. 역할을 나누어 결과물을 완성했다.' },
  { id: 'cafe', title: '카페 알바', effects: { money: 45, energy: -20 }, feedback: '바쁜 주문을 차근차근 처리했다. 생활비에 여유가 생겼다.' },
  { id: 'tutor', title: '과외', effects: { money: 75, energy: -26 }, requires: 'tutorApproved', feedback: '학생 눈높이로 설명하며 전공 기초도 다시 정리했다.' },
  { id: 'rest', title: '휴식', effects: { money: 0, energy: 38 }, feedback: '잠과 산책으로 숨을 돌렸다. 다음 과제를 해낼 힘이 생겼다.' },
  { id: 'newsLab', title: '식사에서 들은 연구실 모집에 참여', effects: { money: 0, energy: -18 }, requires: 'labNews', experience: 'lab', research: 2, feedback: '동기의 소개로 새 연구실에 합류했다. 교수님이 후속 연구를 제안했다.', recommendation: 1 },
  { id: 'newsClub', title: '식사에서 들은 동아리 프로젝트 합류', effects: { money: -5, energy: -15 }, requires: 'clubNews', experience: 'club', feedback: '식사 자리에서 들은 소식이 실제 협업으로 이어졌다.' },
];
const MEALS = [
  { id: 'store', title: '편의점', price: 3, recovery: 8, menu: '삼각김밥과 두유' },
  { id: 'cafeteria', title: '학식', price: 6, recovery: 18, menu: '따뜻한 백반' },
  { id: 'friends', title: '동기와 외식', price: 15, recovery: 25, menu: '함께 먹는 저녁 · 이전 활동에 따른 모집 소식' },
];
const COURSES = [
  { name: '전공 이론', credits: 3, base: 2.5, study: .50, lab: .10, club: 0 },
  { name: '실험과 탐구', credits: 3, base: 2.5, study: .20, lab: .50, club: .10 },
  { name: '팀 프로젝트', credits: 3, base: 2.5, study: .15, lab: .15, club: .50 },
  { name: '교양 세미나', credits: 3, base: 3.0, study: .20, lab: .10, club: .15 },
];
const CAMPUS_EVENTS = {
  recommendation: {
    title: '교수님이 기억한 실험 노트',
    text: '지난 학기 연구실에서 남긴 기록을 교수님이 기억하고 계셨다. 후속 연구를 함께하면 추천서를 써 주겠다고 하신다.',
    choices: [
      { title: '후속 연구를 맡는다', effects: { energy: -8 }, recommendation: 1, research: 1, story: '이전 연구실 참여 → 후속 연구 → 추천서 확보' },
      { title: '이번에는 쉬어 간다', effects: { energy: 12 }, story: '연구 제안을 미루고 컨디션을 회복했다.' },
    ],
  },
  project: {
    title: '과제 발표를 앞두고',
    text: '팀원들이 마지막 점검을 부탁했다. 어떤 방식으로 함께할까?',
    choices: [
      { title: '발표 리허설을 돕는다', effects: { energy: -5 }, presentation: 1, story: '발표 리허설이 순조로웠다. 팀원들과 핵심 메시지를 정리했다.' },
      { title: '서로의 컨디션을 챙긴다', effects: { energy: 10 }, story: '함께 쉬며 남은 과제 일정을 조율했다.' },
    ],
  },
};
const GRAD_ACTIONS = [
  { id: 'research', title: '연구 프로젝트', effects: { money: -10, energy: -18 }, research: 3, recommendation: 1, hours: 25, story: '연구 프로젝트에서 재현 가능한 결과를 얻고 지도교수와 후속 질문을 정리했다.' },
  { id: 'presentation', title: '발표 준비', effects: { money: 0, energy: -12 }, research: 2, recommendation: 1, hours: 18, story: '연구 발표를 준비하며 논리와 한계를 설명했다. 교수님에게 구체적인 피드백을 받았다.' },
  { id: 'RA', title: '연구 조교(RA)', effects: { money: 100, energy: -23 }, research: 2, recommendation: 1, hours: 20, story: 'RA로 연구 데이터를 관리했다. 생활비 지원과 연구 성과를 함께 얻었다.' },
  { id: 'TA', title: '수업 조교(TA)', effects: { money: 80, energy: -16 }, research: 1, recommendation: 1, hours: 12, story: 'TA로 실습과 질의응답을 맡았다. 수업 지원 경험을 추천서에 남겼다.' },
];
// 같은 객체 구조로 국가·프로그램을 추가하면 지원·면접·제안 화면에 자동 반영됩니다.
// weights의 합은 1 권장. 기존 원서는 threshold 규칙, 신규 원서는 graduate-settings.js 확률 규칙.
const PROGRAMS = [
  { id: 'kr-ms', degree: 'masters', country: '대한민국', school: '한울대학교', title: '융합생명 데이터 석사',
    lab: '시스템생명 연구실', topic: '세포 반응 데이터와 재현 가능한 분석',
    weights: { gpa: .35, research: .25, recommendation: .20, interview: .20 }, threshold: 45,
    tuition: 80, stipend: 70, moving: 15, assistant: 'RA 주 20시간 / 100만원 또는 TA 주 12시간 / 80만원 (턴별 선택)' },
  { id: 'us-ms', degree: 'masters', country: '미국', school: '레이크브리지 대학교', title: '바이오엔지니어링 석사',
    lab: '협업설계 연구실', topic: '팀 기반 바이오 시스템 설계',
    weights: { gpa: .15, research: .25, recommendation: .20, interview: .40 }, threshold: 48,
    tuition: 150, stipend: 100, moving: 100, assistant: 'RA 주 20시간 / 100만원 또는 TA 주 12시간 / 80만원 (턴별 선택)' },
  { id: 'us-phd', degree: 'phd', country: '미국', school: '레드우드 공과대학', title: '정량생명 박사',
    lab: '적응시스템 연구실', topic: '세포 시스템의 적응과 예측',
    weights: { research: .45, recommendation: .30, interview: .25 }, threshold: 48,
    tuition: 0, stipend: 180, moving: 120, assistant: 'RA 주 20시간 · 월 지원에 포함 (박사 진학 후 기록으로 마무리)' },
  { id: 'de-phd', degree: 'phd', country: '독일', school: '린덴 연구대학교', title: '계산생물학 박사',
    lab: '오픈사이언스 연구실', topic: '공개 데이터의 검증과 생물학적 모델링',
    weights: { research: .50, recommendation: .25, interview: .25 }, threshold: 46,
    tuition: 0, stipend: 160, moving: 90, assistant: '연구 계약 주 20시간 · 월 지원에 포함 (박사 진학 후 기록으로 마무리)' },
];
