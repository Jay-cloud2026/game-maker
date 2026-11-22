// 통합 3단계: 가상 대학원. 선발 규칙과 확률은 이 파일에서 조정합니다.
const GRAD_ADMISSIONS = {
  ruleset: 2, scale: 12, documentFloor: .03, documentCeiling: .92,
  finalFloor: .02, finalCeiling: .84,
};
PROGRAMS.push(
  { id: 'kr-tech-ms', degree: 'masters', country: '대한민국', school: '푸른샘과학대학교', title: '지능시스템 석사',
    lab: '신뢰인공지능 연구실', topic: '검증 가능한 인공지능', tuition: 95, stipend: 100, moving: 20,
    assistant: 'RA 연구 기여 심사 / TA 전공 면담', weights: { gpa: .30, research: .30, recommendation: .15, language: .10, interview: .15 }, threshold: 72 },
  { id: 'kr-applied-ms', degree: 'masters', country: '대한민국', school: '온새미융합대학교', title: '산업응용 석사',
    lab: '현장문제해결 연구실', topic: '산업 데이터와 환경 센서', tuition: 65, stipend: 50, moving: 10,
    assistant: 'RA 프로젝트 매칭 / TA 기초 수업 지원', weights: { gpa: .30, research: .20, recommendation: .15, language: .05, interview: .30 }, threshold: 55 },
  { id: 'de-ms', degree: 'masters', country: '독일', school: '엘름슈타트 공과대학교', title: '개방형공학 석사',
    lab: '재현공학 연구실', topic: '개방형 실험과 데이터 분석', tuition: 20, stipend: 65, moving: 85,
    assistant: 'RA 연구계획 검토 / TA 언어 면담', weights: { gpa: .35, research: .25, recommendation: .10, language: .15, interview: .15 }, threshold: 65 },
  { id: 'jp-ms', degree: 'masters', country: '일본', school: '하루노미래대학교', title: '생명정보 석사',
    lab: '협력생명정보 연구실', topic: '생명정보 모델과 협업 실험', tuition: 75, stipend: 60, moving: 45,
    assistant: 'RA 실험 배치 / TA 수업 적응 확인', weights: { gpa: .30, research: .25, recommendation: .15, language: .10, interview: .20 }, threshold: 61 },
  { id: 'kr-phd', degree: 'phd', country: '대한민국', school: '한울대학교', title: '융합생명 박사',
    lab: '시스템생명 연구실', topic: '세포 반응의 인과적 모델', tuition: 40, stipend: 140, moving: 15,
    assistant: 'RA 연구계획 심사 / TA 강의 보조', weights: { gpa: .10, research: .40, recommendation: .20, language: .05, interview: .25 }, threshold: 67 },
  { id: 'kr-tech-phd', degree: 'phd', country: '대한민국', school: '푸른샘과학대학교', title: '지능시스템 박사',
    lab: '신뢰인공지능 연구실', topic: '지능 모델의 안정성과 검증', tuition: 30, stipend: 165, moving: 20,
    assistant: 'RA 독립 연구 평가 / TA 교육 시연', weights: { gpa: .10, research: .45, recommendation: .20, language: .10, interview: .15 }, threshold: 78 },
  { id: 'kr-applied-phd', degree: 'phd', country: '대한민국', school: '온새미융합대학교', title: '산업응용 박사',
    lab: '현장문제해결 연구실', topic: '현장 데이터와 기술 검증', tuition: 40, stipend: 125, moving: 10,
    assistant: 'RA 산학 과제 심사 / TA 실습 지도', weights: { gpa: .10, research: .35, recommendation: .20, language: .05, interview: .30 }, threshold: 62 },
  { id: 'jp-phd', degree: 'phd', country: '일본', school: '하루노미래대학교', title: '생명정보 박사',
    lab: '협력생명정보 연구실', topic: '다기관 공동 생명정보 연구', tuition: 45, stipend: 135, moving: 45,
    assistant: 'RA 지도교수 연구계획 심사 / TA 언어 면담', weights: { gpa: .10, research: .40, recommendation: .20, language: .10, interview: .20 }, threshold: 69 }
);
const GRAD_PROGRAM_POLICIES = {
  'kr-ms': { difficulty: 60, gpa: 2.4, recommendedGpa: 3.4, research: 2, recommendations: 1, language: 0, mentor: '서다인 교수 · 기록과 재현성 중심', living: 45 },
  'kr-tech-ms': { difficulty: 72, gpa: 3.1, recommendedGpa: 3.9, research: 4, recommendations: 2, language: 35, mentor: '오지완 교수 · 독립적 탐구와 엄격한 검증', living: 50 },
  'kr-applied-ms': { difficulty: 55, gpa: 2.0, recommendedGpa: 3.0, research: 1, recommendations: 0, language: 0, mentor: '유다솔 교수 · 산업 협력 멘토형', living: 40 },
  'us-ms': { difficulty: 71, gpa: 2.8, recommendedGpa: 3.7, research: 3, recommendations: 1, language: 40, mentor: '에린 한 교수 · 발표와 국제 협업 중심', living: 100 },
  'de-ms': { difficulty: 65, gpa: 2.7, recommendedGpa: 3.5, research: 2, recommendations: 1, language: 40, mentor: '레온 바움 교수 · 자율·재현성 중심', living: 65 },
  'jp-ms': { difficulty: 61, gpa: 2.5, recommendedGpa: 3.4, research: 2, recommendations: 1, language: 35, mentor: '미나토 아오이 교수 · 공동 실험과 피드백', living: 60 },
  'kr-phd': { difficulty: 67, gpa: 2.8, recommendedGpa: 3.6, research: 6, recommendations: 2, language: 25, mentor: '서다인 교수 · 장기 연구 지도', living: 45 },
  'kr-tech-phd': { difficulty: 78, gpa: 3.2, recommendedGpa: 4.0, research: 10, recommendations: 3, language: 45, mentor: '오지완 교수 · 독립 논문과 검증', living: 50 },
  'kr-applied-phd': { difficulty: 62, gpa: 2.5, recommendedGpa: 3.3, research: 5, recommendations: 1, language: 20, mentor: '유다솔 교수 · 산학 연구와 기술 이전', living: 40 },
  'us-phd': { difficulty: 77, gpa: 2.8, recommendedGpa: 3.8, research: 6, recommendations: 2, language: 40, mentor: '알렉스 리 교수 · 국제 공동연구와 독립성', living: 100 },
  'de-phd': { difficulty: 69, gpa: 2.7, recommendedGpa: 3.6, research: 5, recommendations: 2, language: 35, mentor: '노아 린트 교수 · 오픈사이언스와 재현성', living: 65 },
  'jp-phd': { difficulty: 69, gpa: 2.8, recommendedGpa: 3.6, research: 6, recommendations: 2, language: 35, mentor: '미나토 아오이 교수 · 다기관 협력 지도', living: 60 },
};
// 기존 프로그램 ID·비용·기존 가중치는 유지합니다. 새 원서만 새 정책을 캡처합니다.
for (const program of PROGRAMS) program.admissions = GRAD_PROGRAM_POLICIES[program.id];
