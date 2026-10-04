"""Check Lab 4 AC/test references and local links without running feature tests."""
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
docs = root / "docs/lab-04"
required = ["specification", "api-spec", "ui-spec", "tests", "reviewer", "ai-use"]
for name in required:
    assert (docs / f"{name}.md").is_file(), f"Missing {name}.md"


def rows(path, pattern):
    result = {}
    for line in path.read_text().splitlines():
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if line.startswith("|") and re.fullmatch(pattern, cells[0]):
            assert cells[0] not in result, f"Duplicate ID {cells[0]} in {path.name}"
            result[cells[0]] = cells
    return result


spec = rows(docs / "specification.md", r"AC-\d{2}")
tests = rows(docs / "tests.md", r"(?:UNIT|API|AUTH|CONC|DB|UI|STYLE|RESP|A11Y|E2E|REG|PERF|DOC|RELEASE)-\d{2}")
assert set(spec) == {f"AC-{i:02}" for i in range(1, 25)}, "Missing/extra AC"
forward = {(ac, test) for ac, row in spec.items() for test in re.findall(r"\b[A-Z0-9]+-\d{2}\b", row[3])}
reverse = {(ac, test) for test, row in tests.items() for ac in re.findall(r"AC-\d{2}", row[2])}
assert forward == reverse, f"Traceability mismatch: {sorted(forward ^ reverse)}"
assert {test for _, test in forward} == set(tests), "Unmapped test"
definitions = set(re.findall(r"^\| ((?:FR|BR)-\d{2}) \|", (docs / "specification.md").read_text(), re.M))
for ac, row in spec.items():
    refs = set(re.findall(r"(?:FR|BR)-\d{2}", row[2]))
    assert refs <= definitions, f"Unknown FR/BR in {ac}: {refs - definitions}"
for test, row in tests.items():
    assert len(row) == 6 and row[-1] in {"Planned", "Passed", "Failed", "Pending"}, f"Invalid test row: {test}"
    assert re.findall(r"AC-\d{2}", row[2]), f"No AC for {test}"
    paths = re.findall(r"`([^`]+)`", row[4])
    assert paths or test == "RELEASE-01", f"No intended path: {test}"
    for path in paths:
        assert not Path(path).is_absolute() and ".." not in Path(path).parts, f"Unsafe path: {path}"
        if row[-1] == "Passed":
            assert (root / path).exists(), f"Passing test path missing: {path}"
for path in docs.glob("*.md"):
    for target in re.findall(r"\[[^\]]*\]\(([^)]+)\)", path.read_text()):
        if "://" not in target and not target.startswith("#"):
            assert (path.parent / target.split("#")[0]).exists(), f"Broken local link in {path.name}: {target}"
print(f"Contract references valid: {len(spec)} ACs, {len(tests)} test IDs, {len(forward)} bidirectional mappings; local links valid.")
print("This check does not execute or certify the planned feature tests.")
