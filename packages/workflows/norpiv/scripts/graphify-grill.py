"""Emit bounded structural Graphify evidence from a disposable archive."""
import json
import sys
from contextlib import redirect_stdout
from pathlib import Path

EDGE_LIMIT = 100


def normalize_edge(edge):
    return {
        "confidence": edge.get("confidence", "EXTRACTED"),
        "source": edge.get("source", edge.get("from", "")),
        "target": edge.get("target", edge.get("to", "")),
        "type": edge.get("type", edge.get("relation", "")),
    }


def render_evidence(graph, limit=EDGE_LIMIT):
    edges = graph.get("edges", [])[:limit]
    return {
        "edges": [normalize_edge(edge) for edge in edges],
        "truncated": len(graph.get("edges", [])) > len(edges),
    }


def main(root_arg):
    root = Path(root_arg)
    out = root / "graphify-out"
    from graphify.extract import collect_files, extract

    with redirect_stdout(sys.stderr):
        graph = extract(collect_files(root), cache_root=out, root=root, parallel=False)
    print(json.dumps(render_evidence(graph)))


if __name__ == "__main__":
    try:
        main(sys.argv[1])
    except Exception as error:
        print(f"Graphify extraction failed: {error}", file=sys.stderr)
        raise
