"""Emit bounded structural Graphify evidence from a disposable archive."""
import json
import sys
from contextlib import redirect_stdout
from pathlib import Path

root = Path(sys.argv[1])
out = root / "graphify-out"

try:
    from graphify.extract import collect_files, extract

    with redirect_stdout(sys.stderr):
        graph = extract(collect_files(root), cache_root=out, root=root, parallel=False)
    edges = graph.get("edges", [])[:100]
    evidence = [
        {
            "confidence": edge.get("confidence", "EXTRACTED"),
            "source": edge.get("source", edge.get("from", "")),
            "target": edge.get("target", edge.get("to", "")),
            "type": edge.get("type", edge.get("relation", "")),
        }
        for edge in edges
    ]
    print(json.dumps({"edges": evidence, "truncated": len(graph.get("edges", [])) > len(edges)}))
except Exception as error:
    print(f"Graphify extraction failed: {error}", file=sys.stderr)
    raise
