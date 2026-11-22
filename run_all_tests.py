"""전체 단계별 UI/통합 테스트. 중단되어도 TEST_RESULTS.json에 완료·미완료 목록을 남깁니다."""
import datetime
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
ARTIFACTS = ROOT / ".artifacts"
ARTIFACTS.mkdir(exist_ok=True)
TESTS = ["test_game.py", "test_life.py", "test_campus.py", "test_social.py",
         "test_study.py", "test_career.py", "test_memoir.py", "test_validation.py", "test_development.py", "test_graduate.py",
         "test_employment.py", "test_degree.py", "test_lifestyle.py", "test_military.py", "test_slots.py", "test_integration.py",
         "test_life_assessment.py", "test_deployment.py"]
result = {"started": datetime.datetime.now().isoformat(), "passed": [], "failed": None, "remaining": TESTS.copy()}


def record():
    (ARTIFACTS / "TEST_RESULTS.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")


record()
for name in TESTS:
    print(f"\n실행: {name}", flush=True)
    try:
        process = subprocess.run([sys.executable, str(ROOT / "tests" / name)], cwd=ROOT, timeout=180)
        if process.returncode:
            result["failed"] = name
            record()
            sys.exit(process.returncode)
    except subprocess.TimeoutExpired:
        result["failed"] = name + " (시간 초과)"
        record()
        sys.exit(1)
    result["passed"].append(name)
    result["remaining"].remove(name)
    record()
result["finished"] = datetime.datetime.now().isoformat()
record()
print(f"\n전체 {len(TESTS)}개 테스트 파일 통과. 완료·미완료 기록: .artifacts/TEST_RESULTS.json", flush=True)
