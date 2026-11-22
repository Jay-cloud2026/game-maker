// 인생 평가 v1. 합격/보상과 무관한 결산 규칙이며 모든 기준은 조정 가능합니다.
const LIFE_ASSESSMENT_CONFIG = {
  version: 1, milestoneAge: 40,
  axisLabels: { career: '커리어 성취', economy: '경제적 안정', health: '건강·행복', relationships: '인간관계', growth: '성장·경험' },
  grades: [
    { id: 'SSS', title: '전설적인 인생', minimum: 86, floors: { career: 85, economy: 55, health: 65, relationships: 55, growth: 15 } },
    { id: 'SS', title: '시대를 대표하는 성공', minimum: 78, floors: { career: 75, health: 40, relationships: 30 } },
    { id: 'S', title: '뛰어난 성취', minimum: 70, floors: { career: 60, health: 25, relationships: 20 } },
    { id: 'A', title: '성공적인 인생', minimum: 58, floors: {} },
    { id: 'B', title: '안정적인 인생', minimum: 45, floors: {} },
    { id: 'C', title: '평범하지만 의미 있는 인생', minimum: 30, floors: {} },
    { id: 'D', title: '어려움 속에서 살아온 인생', minimum: 0, floors: {} },
  ],
  economy: { reserveYears: .75, minimumBuffer: 100, incomeMargin: .15, reserveWeight: .8, incomeWeight: .2 },
  health: { energy: .15, fatigue: .2, happiness: .3, stress: .2, habit: .15, habitTarget: 30 },
  relationships: { npcWeight: .8, familyWeight: .2, trustWeight: .6, intimacyWeight: .4 },
  growth: { gainsTarget: 60, gainWeight: .7, breadthWeight: .3, channelMinimum: 2 },
};
// 기존 연구직의 연간 '업무 연구와 개선'에만 연결. 정식 교수 임용/인용지수는 생성하지 않습니다.
const WORK_RESEARCH_REVIEW = { probability: .65, minimumResearchUse: 80 };
const LIFE_PATHS = {
  corporate: {
    title: '대기업 핵심 인재·기술 전문가',
    description: '프로젝트·근속·승진 실적을 평가합니다. 임원 승진 트리는 아직 없습니다.',
    weights: { career: .55, economy: .15, health: .12, relationships: .10, growth: .08 },
    targets: { projects: 10, years: 12, promotions: 1, practice: 45 },
    careerWeights: { projects: .5, years: .25, promotions: .15, practice: .1 },
    sss: { years: 8, projects: 6, performance: 180 },
  },
  researcher: {
    title: '연구자·교수',
    description: '논문·학회·지속 연구·교육 기여를 평가합니다. 학위·교수 후일담만으로 최고 등급이 되지 않습니다.',
    weights: { career: .55, economy: .12, health: .12, relationships: .13, growth: .08 },
    targets: { papers: 6, research: 40, conferences: 4, teaching: 4 },
    careerWeights: { papers: .35, research: .25, conferences: .15, teaching: .15, degree: .10 },
    sss: { papers: 4, research: 30, conferences: 2, researchWork: 4, teaching: 2 },
  },
  founder: {
    title: '창업가',
    description: '현재 구현된 고객 검증·운영 지속·재도전 기록을 평가합니다. 투자 유치·기업가치는 추정하거나 부여하지 않습니다.',
    weights: { career: .55, economy: .15, health: .12, relationships: .10, growth: .08 },
    targets: { traction: 16, turns: 16 },
    careerWeights: { traction: .6, turns: .4 },
    sss: { traction: 12, turns: 16 },
  },
  balanced: {
    title: '균형 잡힌 인생',
    description: '최고 학력·연봉 대신 지속 가능한 직업·건강·행복·관계를 중요하게 평가합니다.',
    weights: { career: .20, economy: .18, health: .27, relationships: .25, growth: .10 },
    targets: { years: 8 },
    careerWeights: { years: .65, satisfaction: .35 },
    sss: { years: 6, health: 80, relationships: 75, habit: 10, happiness: 75, strongTies: 2 },
  },
  specialist: {
    title: '전문 분야의 최고 인재',
    description: '실무·프로젝트·지속적인 숙련을 평가합니다. 석사·박사 학위는 필수 조건이 아닙니다.',
    weights: { career: .50, economy: .15, health: .15, relationships: .12, growth: .08 },
    targets: { practice: 45, projects: 10, years: 12 },
    careerWeights: { practice: .4, projects: .35, years: .25 },
    sss: { years: 8, practice: 30, projects: 6 },
  },
};
