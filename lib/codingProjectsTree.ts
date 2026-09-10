// Pure helpers for the coding-project editor's client-side file tree —
// split out from the page component so the tree-building / path-mutation
// logic (which has no React dependency at all) is easy to reason about and
// unit-test in isolation. See app/practice/coding/projects/[id]/page.tsx for
// the only consumer.

export interface TreeNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: TreeNode[];
}

/** Mirrors Saveur-Backend/app/api/coding.py's `_valid_project_file_path` —
 * no absolute paths, no '.'/'..' segments, no empty segments, max 1024
 * chars. Returns the normalized (forward-slash) path, or null if invalid. */
export function sanitizeProjectPath(raw: string): string | null {
  const p = raw.trim().replace(/\\/g, "/");
  if (!p || p.length > 1024) return null;
  if (p.startsWith("/")) return null;
  const parts = p.split("/");
  if (parts.some((part) => part === "" || part === "." || part === "..")) return null;
  return parts.join("/");
}

/** Builds a nested folder/file tree from a flat list of file paths plus any
 * explicitly-created empty folders (folders with no files in them yet — the
 * backend has no concept of an empty folder, so these only live in client
 * state until a file is added inside one; see the editor page's own note
 * about this on Save). Folders sort before files at each level, both
 * alphabetically. */
export function buildFileTree(filePaths: string[], emptyFolders: string[]): TreeNode[] {
  interface MutableNode {
    name: string;
    path: string;
    type: "file" | "folder";
    children: Map<string, MutableNode>;
  }
  const root: MutableNode = { name: "", path: "", type: "folder", children: new Map() };

  function ensureFolder(parts: string[]): MutableNode {
    let node = root;
    let acc = "";
    for (const part of parts) {
      if (!part) continue;
      acc = acc ? `${acc}/${part}` : part;
      let child = node.children.get(`d:${part}`);
      if (!child) {
        child = { name: part, path: acc, type: "folder", children: new Map() };
        node.children.set(`d:${part}`, child);
      }
      node = child;
    }
    return node;
  }

  for (const folder of emptyFolders) {
    if (!folder) continue;
    ensureFolder(folder.split("/"));
  }
  for (const filePath of filePaths) {
    const parts = filePath.split("/");
    const fileName = parts.pop() as string;
    const parent = ensureFolder(parts);
    parent.children.set(`f:${fileName}`, { name: fileName, path: filePath, type: "file", children: new Map() });
  }

  function toArray(node: MutableNode): TreeNode[] {
    const arr = Array.from(node.children.values());
    arr.sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return arr.map((n) => ({
      name: n.name,
      path: n.path,
      type: n.type,
      children: n.type === "folder" ? toArray(n) : undefined,
    }));
  }

  return toArray(root);
}

/** Renames `oldPath` to `newPath` across a "path -> value" record, treating
 * `oldPath` as a folder prefix too (so renaming a folder carries every file
 * under it along). Used for both the `files` content map and any other
 * path-keyed structure (open tabs, active tab, empty-folder set). */
export function remapPath(path: string, oldPath: string, newPath: string): string {
  if (path === oldPath) return newPath;
  const prefix = `${oldPath}/`;
  if (path.startsWith(prefix)) return newPath + path.slice(oldPath.length);
  return path;
}

export function isUnderOrEqual(path: string, target: string): boolean {
  return path === target || path.startsWith(`${target}/`);
}
