// 실제 제도 출처와 게임용 확률/급여/진도는 MILITARY_RULES.md에 구분합니다.
const MILITARY_CONFIG = {
  defer: { undergraduate: 24, masters: 26, longMasters: 27, phd: 28 },
  assessmentAge: 19, callupAge: 20, researchFinishAge: 35, quarter: 3,
  gradeWeights: [.10, .25, .35, .17, .04, .03, .06],
  service: {
    army: { title: '육군', months: 18, income: 120, learning: .8, stress: 8 },
    social: { title: '사회복무요원', months: 21, income: 100, learning: 1, stress: 5 },
    research: { title: '전문연구요원', months: 36, income: 180, learning: 1.1, stress: 7 },
  },
  researchMinimum: 6, selectionProbability: .7, hireProbability: .75, phdCourseworkSemesters: 4,
  phdDegreeMonths: 24, phdGraceMonths: 36, phdFieldMonths: 12,
};
const RESEARCH_INSTITUTIONS = [
  { id: 'narae', title: '나래정밀 기업부설연구소', field: '기술·데이터·환경 연구', designated: true, university: false },
  { id: 'saebit', title: '새빛융합 지정연구기관', field: '생명·공학 연구', designated: true, university: false },
  { id: 'hanul-grad', title: '한울대학교 지정 자연계대학원', field: '자연계 박사 연구', designated: true, university: true },
];
const MILITARY_ACTIVITIES = [
  { id: 'study', title: '전공 공부', growth: 'study' },
  { id: 'language', title: '외국어 공부', growth: 'language' },
  { id: 'certificate', title: '자격증 준비', growth: 'study' },
  { id: 'exam', title: '자격시험 응시', growth: 'study' },
  { id: 'exercise', title: '복무 중 운동', growth: 'rest' },
  { id: 'reading', title: '독서', growth: 'study' },
  { id: 'saving', title: '저축', growth: 'rest' },
  { id: 'rest', title: '복무 중 휴식', growth: 'rest' },
  { id: 'project', title: '복무 연구 프로젝트', growth: 'research', research: 2 },
  { id: 'data', title: '실험 및 데이터 분석', growth: 'research', research: 2 },
  { id: 'paper', title: '복무 논문 작성', growth: 'research', research: 1 },
  { id: 'conference', title: '복무 학회 발표', growth: 'presentation', research: 1 },
  { id: 'collaboration', title: '복무 공동 연구', growth: 'research', research: 2 },
  { id: 'technology', title: '기술 개발', growth: 'club', research: 1 },
  { id: 'defense', title: '복무 중 학위 디펜스', growth: 'presentation', research: 0 },
];
