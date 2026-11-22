// 5단계 이후 설정. 모든 학교·연구실·기업은 가상이며 금액은 만원입니다.
const STUDY_CONFIG = {
  languageStudy: { money: -5, energy: -12, gain: 12 },
  project: { money: -5, energy: -16, budget: 15, researchSuccess: 3, researchFailure: 1, probability: .7 },
  conference: { money: -15, energy: -14, research: 2, minimumContribution: 1 },
  paper: { money: 0, energy: -20, budget: 20, minimumContribution: 3, probability: .75 },
  recommendation: { minimumContribution: 3, minimumTrust: 35 },
  exchange: { applicationFee: 4, minimumGpa: 2.5, probability: .85,
    scholarshipProbability: .8, scholarshipGpa: 3.0, scholarshipLanguage: 60 },
  leaveActions: 3,
};
const LABS = [
  { id: 'results', name: '정량시스템 연구실', professor: '송재현 교수', style: '성과 중심형', topic: '세포 데이터의 예측 모델', budget: 200, atmosphere: '목표가 분명하고 일정이 촘촘함', hours: 25, bonus: 1, energyExtra: 5, stress: 5, trustGain: 5 },
  { id: 'free', name: '열린탐구 연구실', professor: '문서진 교수', style: '자유로운 연구형', topic: '새로운 생명 현상의 탐색', budget: 150, atmosphere: '자율성과 자기 관리 중시', hours: 18, bonus: .5, energyExtra: 0, stress: 0, trustGain: 4 },
  { id: 'mentor', name: '재현과학 연구실', professor: '김은솔 교수', style: '멘토형', topic: '재현 가능한 실험 설계', budget: 180, atmosphere: '기록을 함께 검토하고 실패를 공유함', hours: 20, bonus: .5, energyExtra: 2, stress: -3, trustGain: 8 },
  { id: 'industry', name: '현장혁신 연구실', professor: '장유정 교수', style: '산업 협력형', topic: '환경 센서의 현장 적용', budget: 230, atmosphere: '기업과 협업하며 실용성을 검토함', hours: 22, bonus: .5, energyExtra: 3, stress: 2, trustGain: 6 },
  { id: 'education', name: '학습설계 연구실', professor: '배준호 교수', style: '교육 중심형', topic: '과학 교육과 학습 도구', budget: 160, atmosphere: '설명과 토론, 동료 교육을 중시함', hours: 16, bonus: .25, energyExtra: 0, stress: -2, trustGain: 6 },
];
const LANGUAGE_TESTS = [
  { id: 'TOEIC', fee: 6, max: 990, step: 5 },
  { id: 'TOEFL', fee: 18, max: 120, step: 1 },
  { id: 'IELTS', fee: 20, max: 9, step: .5 },
];
const EXCHANGES = [
  { id: 'us', country: '미국', school: '브룩필드 교류대학', minimumLanguage: 60, housing: 65, travel: 45, grant: 90, contact: '현지 동료 에밀리' },
  { id: 'jp', country: '일본', school: '아오모리 가람대학', minimumLanguage: 50, housing: 40, travel: 20, grant: 60, contact: '현지 동료 아키' },
  { id: 'de', country: '독일', school: '발트호프 교류대학', minimumLanguage: 55, housing: 45, travel: 40, grant: 75, contact: '현지 동료 레아' },
  { id: 'uk', country: '영국', school: '웨스트브룩 교류대학', minimumLanguage: 65, housing: 70, travel: 45, grant: 100, contact: '현지 동료 로빈' },
  { id: 'ca', country: '캐나다', school: '메이플릿지 교류대학', minimumLanguage: 55, housing: 55, travel: 40, grant: 80, contact: '현지 동료 테오' },
];
const LEAVE_ACTIONS = [
  { id: 'work', title: '휴학 중 아르바이트', effects: { money: 100, energy: -18 }, abilities: { stress: 8 }, practice: 1 },
  { id: 'language', title: '휴학 중 어학 공부', effects: { money: -5, energy: -10 }, abilities: { language: 15, stress: 3 } },
  { id: 'intern', title: '휴학 중 인턴', effects: { money: 80, energy: -20 }, abilities: { sociability: 3 }, practice: 2, requiresResearch: 1 },
  { id: 'project', title: '휴학 중 개인 프로젝트', effects: { money: -5, energy: -12 }, abilities: { creativity: 5 }, research: 1, practice: 1 },
  { id: 'rest', title: '휴학 중 휴식', effects: { money: 0, energy: 35 }, abilities: { stress: -25, happiness: 8 } },
  { id: 'return', title: '복학 준비', effects: { money: 0, energy: 20 }, abilities: { motivation: 10, stress: -10 } },
];
const CAREER_CONFIG = {
  maxApplications: 3, hiringHalves: 1, training: { money: 50, practice: 2, halves: 1 },
  promotionRate: .08, promotionPerformance: 30, referralBonus: 8,
  ventureCapital: 100, ventureCost: 20, ventureSuccessRevenue: 100, ventureFailureRevenue: 10,
  eventProbability: .25,
};
const COMPANIES = [
  { id: 'hanbit', name: '한빛테크놀로지', type: '대기업', role: '시스템 엔지니어', salary: 4200, living: 3000, benefits: '교육비·건강 지원', balance: 60, growth: 90, researchUse: 50, threshold: 55, bachelor: true,
    weights: { gpa: .2, practice: .3, research: .15, interview: .35 } },
  { id: 'mirae', name: '미래정밀솔루션', type: '중견기업', role: '제품 개발', salary: 3600, living: 2800, benefits: '주거·직무 교육 지원', balance: 70, growth: 75, researchUse: 55, threshold: 45, bachelor: false,
    weights: { gpa: .1, practice: .4, research: .15, interview: .35 } },
  { id: 'daon', name: '다온웨이브', type: '스타트업', role: '주니어 서비스 개발', salary: 3000, living: 2800, benefits: '유연 근무·프로젝트 선택', balance: 65, growth: 95, researchUse: 35, threshold: 30, bachelor: false,
    weights: { gpa: .05, practice: .35, research: .15, interview: .45 } },
  { id: 'gonggam', name: '공감도시공사', type: '공공기관', role: '공공 데이터 운영', salary: 3500, living: 2700, benefits: '안정적 근무·휴가', balance: 90, growth: 55, researchUse: 35, threshold: 48, bachelor: true,
    weights: { gpa: .3, practice: .2, research: .1, interview: .4 } },
  { id: 'neulbom', name: '늘봄융합연구원', type: '정부출연연구소', role: '연구 개발', salary: 4000, living: 2800, benefits: '학회·연구 교육 지원', balance: 75, growth: 80, researchUse: 95, threshold: 52, bachelor: true,
    weights: { gpa: .15, practice: .15, research: .4, interview: .3 } },
  { id: 'hanul-lab', name: '한울대학교 공동연구센터', type: '대학 연구직', role: '연구 프로젝트 전담', salary: 3200, living: 2600, benefits: '대학원 준비·세미나 참여', balance: 70, growth: 75, researchUse: 100, threshold: 42, bachelor: true,
    weights: { gpa: .1, practice: .1, research: .5, interview: .3 } },
];
// 통합 4단계: 학위 단계 0=제한 없음, 1=학사, 2=석사.
const HIRING_CONFIG = { scale: 12, minProbability: .03, maxProbability: .88 };
const COMPANY_POLICIES = {
  hanbit: { industry: '첨단 시스템', difficulty: 72, degree: 1, gpa: 2.8, practice: 3, research: 0 },
  mirae: { industry: '정밀 제조', difficulty: 58, degree: 0, gpa: 0, practice: 1, research: 0 },
  daon: { industry: '소프트웨어 서비스', difficulty: 47, degree: 0, gpa: 0, practice: 0, research: 0 },
  gonggam: { industry: '공공 데이터', difficulty: 66, degree: 1, gpa: 2.7, practice: 0, research: 0 },
  neulbom: { industry: '융합 연구개발', difficulty: 71, degree: 2, gpa: 2.8, practice: 0, research: 4 },
  'hanul-lab': { industry: '대학 연구개발', difficulty: 59, degree: 1, gpa: 2.4, practice: 0, research: 3 },
};
for (const company of COMPANIES) company.hiring = COMPANY_POLICIES[company.id];
const WORK_ACTIONS = [
  { id: 'project', title: '핵심 프로젝트 완수', performance: 20, practice: 3, stress: 12, happiness: 2, bonus: .02 },
  { id: 'research', title: '업무 연구와 개선', performance: 15, practice: 2, research: 2, stress: 8, happiness: 3, minimumResearch: 2 },
  { id: 'balance', title: '균형 있게 일하기', performance: 10, practice: 3, stress: -15, happiness: 10, energy: 15 },
  { id: 'innovation', title: '새 사업 아이디어 검증', performance: 15, practice: 2, stress: 8, happiness: 5, creativity: 5, venture: true },
];
// 기존 선택형 이벤트 렌더러에서 사용하는 데이터. 모두 하나 이상의 무료 선택을 가집니다.
const RANDOM_CAMPUS_EVENTS = [
  { id: 'laptop', weight: 2, title: '노트북이 멈췄다', text: '발표 자료를 열던 노트북이 고장 났다. 오늘의 해결 방법은?',
    choices: [
      { title: '수리하고 자료를 복구한다', effects: { money: -25, energy: 5 }, story: '노트북을 수리하고 백업의 중요성을 배웠다.' },
      { title: '교내 공용 컴퓨터를 이용한다', effects: { money: 0, energy: 0 }, story: '공용 컴퓨터로 자료를 정리해 과제를 이어갔다.' },
    ] },
  { id: 'seniorProject', weight: 2, needs: 'club', title: '선배가 찾는 협업자', text: '예전 동아리 결과물을 본 선배가 산학 협업을 제안했다.',
    choices: [
      { title: '후속 프로젝트 소식을 받는다', effects: { money: 0, energy: 0 }, flag: 'industryInvite', story: '동아리 결과물 → 선배의 산학 협업 초대. 이후 주요 행동에서 참여할 수 있다.' },
      { title: '지금 활동에 집중한다', effects: { energy: 5 }, story: '새 프로젝트 대신 진행 중인 활동을 마무리했다.' },
    ] },
  { id: 'conferenceNotice', weight: 2, minimumResearch: 3, title: '해외 학회 발표 소식', text: '연구실에 학회 발표 지원금이 배정됐다.',
    choices: [
      { title: '발표 지원금을 신청한다', effects: { money: 0, energy: 0 }, flag: 'conferenceFund', story: '연구 경험 → 학회 지원금. 다음 학회 발표의 참가비를 지원받는다.' },
      { title: '연구 기록을 더 정리한다', effects: { energy: 5 }, story: '학회보다 연구 기록의 완성도를 높이기로 했다.' },
    ] },
  { id: 'familyCost', weight: 2, title: '가족에게 필요한 지출', text: '예상하지 못한 생활 지출에 대해 가족과 이야기했다.',
    choices: [
      { title: '가능한 만큼 함께 부담한다', effects: { money: -20 }, story: '가족과 예상 밖의 비용을 분담했다.' },
      { title: '지금의 형편을 솔직히 설명한다', effects: { money: 0 }, story: '형편을 공유하고 부담할 수 있는 범위를 합의했다.' },
    ] },
  { id: 'festivalInvite', weight: 1, title: '축제의 작은 무대', text: '동아리가 축제의 작은 전시를 함께 준비하자고 한다.',
    choices: [
      { title: '전시를 돕고 사람들을 만난다', effects: { energy: 5 }, flag: 'festivalNetwork', story: '축제 전시에서 새로운 협업자들을 만났다. 이후 채용 소개에도 사용할 수 있는 인맥이 남았다.' },
      { title: '잠깐 들러 응원한다', effects: { energy: 10 }, story: '친구들의 전시를 응원하며 잠깐 쉬었다.' },
    ] },
];
for (const event of RANDOM_CAMPUS_EVENTS) CAMPUS_EVENTS[event.id] = event;
const EPILOGUE_CONFIG = { phdYears: 4, yearlyLiving: 120 };
const PHD_EPILOGUES = [
  { id: 'research', title: '박사 연구를 깊이 이어가기', research: 8, teaching: 0, practice: 2 },
  { id: 'teaching', title: '연구와 후배 교육을 함께하기', research: 6, teaching: 3, practice: 2 },
  { id: 'industry', title: '산업과 연결된 박사 연구', research: 5, teaching: 0, practice: 6 },
];
const ENDINGS = [
  { id: 'enterpriseResearch', title: '대기업 핵심 연구원', profession: '기업 핵심 연구원',
    requirements: { research: 8, careerYears: 3, performance: 40, companyTypes: ['대기업'] },
    years: 2, income: 240, narrative: '연구와 현장 경험을 묶어 팀의 핵심 문제를 해결하는 연구원이 되었다.' },
  { id: 'overseasPhd', title: '해외 박사 연구자', profession: '국제 공동연구 연구자',
    requirements: { phd: true, international: 1, research: 8 },
    years: 1, income: 160, narrative: '학위 뒤에도 서로 다른 나라의 연구자들과 질문을 나누며 국제 공동연구를 이어갔다.' },
  { id: 'professor', title: '대학교수', profession: '대학교수',
    requirements: { phd: true, teaching: 2, research: 12, recommendations: 1, relationshipTrust: 35 },
    years: 2, income: 180, narrative: '박사 이후 연구와 교육 경력을 쌓고 가상 대학의 교원으로 첫 강의를 맡았다.' },
  { id: 'founder', title: '스타트업 창업가', profession: '스타트업 대표',
    requirements: { traction: 2, practice: 3, happiness: 15 },
    years: 1, income: 150, narrative: '여러 번 고객의 반응을 확인한 제품으로 작은 팀을 꾸렸다. 불확실성 속에서도 함께 일할 방식을 찾았다.' },
  { id: 'seniorResearcher', title: '연구소 선임연구원', profession: '선임연구원',
    requirements: { research: 8, careerYears: 2, degree: 2, companyTypes: ['정부출연연구소', '대학 연구직'] },
    years: 2, income: 200, narrative: '연구 기여와 협업 신뢰를 바탕으로 후배와 장기 프로젝트를 이끄는 연구원이 되었다.' },
  { id: 'globalEngineer', title: '국제 기업 엔지니어', profession: '국제 협업 엔지니어',
    requirements: { international: 1, practice: 8, careerYears: 2 },
    years: 1, income: 180, narrative: '해외 경험과 실무를 연결해 다른 언어와 업무 방식 사이를 잇는 엔지니어로 성장했다.' },
  { id: 'balance', title: '워라밸을 중시하는 직장인', profession: '균형을 찾은 직장인',
    requirements: { careerYears: 1, happiness: 55 },
    years: 1, income: 100, narrative: '일의 성장과 개인의 시간을 함께 지켰다. 혼자든 누군가와 함께든 충분히 좋은 일상을 만들었다.' },
  { id: 'transition', title: '새로운 분야에 도전하는 커리어 전환자', profession: '새 분야를 준비하는 실무자',
    requirements: {}, years: 1, income: 60,
    narrative: '한 번의 성적이나 소속으로 삶을 고정하지 않았다. 경험을 다시 엮어 새로운 분야로 다음 걸음을 내디뎠다.' },
];
