import importlib.util
from pathlib import Path

module_path = Path(__file__).with_name("graphify-grill.py")
spec = importlib.util.spec_from_file_location("graphify_grill", module_path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

edge = module.normalize_edge({"from": "a", "to": "b", "relation": "calls"})
assert edge == {
    "confidence": "EXTRACTED",
    "source": "a",
    "target": "b",
    "type": "calls",
}

rendered = module.render_evidence({"edges": [{"source": str(i)} for i in range(105)]}, limit=100)
assert len(rendered["edges"]) == 100
assert rendered["truncated"] is True

print("graphify-grill.py self-check passed")
