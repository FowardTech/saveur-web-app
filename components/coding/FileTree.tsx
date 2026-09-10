"use client";

import { useTranslation } from "react-i18next";
import { EvaIcon } from "@/components/icons/EvaIcon";
import type { TreeNode } from "@/lib/codingProjectsTree";

interface FileTreeProps {
  tree: TreeNode[];
  activePath: string | null;
  dirtyPaths: Set<string>;
  expanded: Set<string>;
  onToggleExpand: (path: string) => void;
  onOpenFile: (path: string) => void;
  onNewFile: (basePath?: string) => void;
  onNewFolder: (basePath?: string) => void;
  onRename: (node: TreeNode) => void;
  onDelete: (node: TreeNode) => void;
}

/** Client-side file/folder tree for the project editor — new file/folder,
 * rename, delete all mutate local React state only (see the editor page's
 * own note: the backend is a full-tree-replace API, so nothing here talks
 * to the server until the user hits Save). */
export function FileTree({ tree, activePath, dirtyPaths, expanded, onToggleExpand, onOpenFile, onNewFile, onNewFolder, onRename, onDelete }: FileTreeProps) {
  const { t } = useTranslation();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-1 border-b border-border px-2 py-2">
        <span className="px-1 text-xs font-semibold uppercase tracking-wide text-hint">{t("web:practice.codingProjects.files", { defaultValue: "Files" })}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onNewFile()}
            title={t("web:practice.codingProjects.newFile", { defaultValue: "New file" })}
            className="inline-flex h-6 w-6 items-center justify-center rounded text-hint hover:bg-surface-3 hover:text-primary"
          >
            <EvaIcon name="file-add-outline" size={14} />
          </button>
          <button
            type="button"
            onClick={() => onNewFolder()}
            title={t("web:practice.codingProjects.newFolder", { defaultValue: "New folder" })}
            className="inline-flex h-6 w-6 items-center justify-center rounded text-hint hover:bg-surface-3 hover:text-primary"
          >
            <EvaIcon name="folder-add-outline" size={14} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {tree.length === 0 ? (
          <p className="px-3 py-4 text-xs text-hint">{t("web:practice.codingProjects.noFiles", { defaultValue: "No files yet — create one above." })}</p>
        ) : (
          tree.map((node) => (
            <TreeRow
              key={node.path}
              node={node}
              depth={0}
              activePath={activePath}
              dirtyPaths={dirtyPaths}
              expanded={expanded}
              onToggleExpand={onToggleExpand}
              onOpenFile={onOpenFile}
              onNewFile={onNewFile}
              onNewFolder={onNewFolder}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}

function TreeRow({
  node,
  depth,
  activePath,
  dirtyPaths,
  expanded,
  onToggleExpand,
  onOpenFile,
  onNewFile,
  onNewFolder,
  onRename,
  onDelete,
}: {
  node: TreeNode;
  depth: number;
  activePath: string | null;
  dirtyPaths: Set<string>;
  expanded: Set<string>;
  onToggleExpand: (path: string) => void;
  onOpenFile: (path: string) => void;
  onNewFile: (basePath?: string) => void;
  onNewFolder: (basePath?: string) => void;
  onRename: (node: TreeNode) => void;
  onDelete: (node: TreeNode) => void;
}) {
  const isFolder = node.type === "folder";
  const isOpen = isFolder && expanded.has(node.path);
  const isActive = !isFolder && activePath === node.path;
  const isDirty = !isFolder && dirtyPaths.has(node.path);

  return (
    <div>
      <div
        className={`group flex items-center gap-1 rounded px-1.5 py-1 text-sm hover:bg-surface-3 ${isActive ? "bg-surface-3 font-medium text-primary" : "text-primary/90"}`}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        <button
          type="button"
          onClick={() => (isFolder ? onToggleExpand(node.path) : onOpenFile(node.path))}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          {isFolder ? (
            <EvaIcon name={isOpen ? "chevron-down-outline" : "chevron-right-outline"} size={12} className="shrink-0 text-hint" />
          ) : (
            <span className="w-3 shrink-0" />
          )}
          <EvaIcon name={isFolder ? "folder-outline" : "file-text-outline"} size={14} className="shrink-0 text-hint" />
          <span className="truncate">{node.name}</span>
          {isDirty && <span className="ml-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />}
        </button>
        <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
          {isFolder && (
            <>
              <button type="button" onClick={() => onNewFile(node.path)} title="New file" className="inline-flex h-5 w-5 items-center justify-center rounded text-hint hover:bg-surface-4">
                <EvaIcon name="file-add-outline" size={12} />
              </button>
              <button type="button" onClick={() => onNewFolder(node.path)} title="New folder" className="inline-flex h-5 w-5 items-center justify-center rounded text-hint hover:bg-surface-4">
                <EvaIcon name="folder-add-outline" size={12} />
              </button>
            </>
          )}
          <button type="button" onClick={() => onRename(node)} title="Rename" className="inline-flex h-5 w-5 items-center justify-center rounded text-hint hover:bg-surface-4">
            <EvaIcon name="edit-2-outline" size={12} />
          </button>
          <button type="button" onClick={() => onDelete(node)} title="Delete" className="inline-flex h-5 w-5 items-center justify-center rounded text-hint hover:text-danger hover:bg-surface-4">
            <EvaIcon name="trash-2-outline" size={12} />
          </button>
        </div>
      </div>
      {isFolder && isOpen && node.children && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <TreeRow
              key={child.path}
              node={child}
              depth={depth + 1}
              activePath={activePath}
              dirtyPaths={dirtyPaths}
              expanded={expanded}
              onToggleExpand={onToggleExpand}
              onOpenFile={onOpenFile}
              onNewFile={onNewFile}
              onNewFolder={onNewFolder}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
