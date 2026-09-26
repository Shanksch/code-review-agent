"""
Tree builder service — transforms flat File rows into a nested tree JSON structure.

Directories are sorted before files, and alphabetically within each level.
"""

from pathlib import PurePosixPath
from app.models import FileModel


def build_tree(files: list[FileModel]) -> list[dict]:
    """
    Convert flat file rows into a nested tree structure.

    Each node has:
        - name: str
        - type: "file" | "directory"
        - path: str (full relative path, files only)
        - id: str (file UUID, files only)
        - language: str (files only)
        - severity: str | None (highest severity from latest review, populated later)
        - children: list[dict] (directories only)
    """
    root: dict[str, dict] = {}

    for file in files:
        parts = PurePosixPath(file.path).parts
        current = root

        for i, part in enumerate(parts):
            if part not in current:
                if i == len(parts) - 1:
                    # Leaf node (file)
                    # Compute highest severity for this file from its issues
                    file_severity = None
                    if hasattr(file, "issues") and file.issues:
                        rank = {"critical": 4, "high": 3, "medium": 2, "low": 1}
                        file_severity = max((i.severity for i in file.issues if i.severity), key=lambda s: rank.get(s, 0), default=None)
                        # We use .value if it's an enum, otherwise just string
                        if hasattr(file_severity, "value"):
                            file_severity = file_severity.value

                    current[part] = {
                        "_type": "file",
                        "_id": str(file.id),
                        "_path": file.path,
                        "_language": file.language,
                        "_size": file.size_bytes,
                        "_severity": file_severity,
                    }
                else:
                    # Directory node
                    current[part] = {"_type": "directory", "_children": {}}

            if i < len(parts) - 1:
                node = current[part]
                if "_children" not in node:
                    node["_children"] = {}
                current = node["_children"]

    def to_tree(tree: dict) -> list[dict]:
        nodes = []
        for name, data in tree.items():
            if data.get("_type") == "file":
                nodes.append({
                    "name": name,
                    "type": "file",
                    "id": data["_id"],
                    "path": data["_path"],
                    "language": data["_language"],
                    "size": data["_size"],
                    "severity": data["_severity"],
                })
            else:
                children = to_tree(data.get("_children", {}))
                # Compute directory severity as highest of children
                child_severities = [
                    c.get("severity") for c in children if c.get("severity")
                ]
                dir_severity = None
                if child_severities:
                    rank = {"critical": 4, "high": 3, "medium": 2, "low": 1}
                    dir_severity = max(child_severities, key=lambda s: rank.get(s, 0))

                nodes.append({
                    "name": name,
                    "type": "directory",
                    "severity": dir_severity,
                    "children": children,
                })

        # Sort: directories first, then files, alphabetical within each
        nodes.sort(key=lambda n: (0 if n["type"] == "directory" else 1, n["name"].lower()))
        return nodes

    return to_tree(root)
