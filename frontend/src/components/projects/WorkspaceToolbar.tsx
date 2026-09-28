import React, { useState } from "react";
import { Settings, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

interface WorkspaceToolbarProps {
  projectId: string;
  projectName: string;
  hasRunningReview: boolean;
  reviewLoading: boolean;
  treeDataLength: number;
  onProjectNameUpdate: (newName: string) => void;
  onOpenSettings: () => void;
  onRunReview: () => void;
}

export default function WorkspaceToolbar({
  projectId,
  projectName,
  hasRunningReview,
  reviewLoading,
  treeDataLength,
  onProjectNameUpdate,
  onOpenSettings,
  onRunReview
}: WorkspaceToolbarProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");

  return (
    <div className="h-14 border-b border-white/5 bg-zinc-900/50 flex items-center px-4 justify-between shrink-0">
      <div className="flex items-center gap-3 text-sm">
        <span className="text-zinc-400">Workspace /</span>
        {isEditingName ? (
          <input
            type="text"
            className="bg-zinc-900 border border-sky-500 rounded px-2 py-0.5 text-zinc-100 font-medium focus:outline-none min-w-[150px]"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            autoFocus
            onBlur={async () => {
              setIsEditingName(false);
              const newName = editedName.trim();
              if (newName && newName !== projectName) {
                // Optimistically update the UI instantly
                onProjectNameUpdate(newName);
                try {
                  await api.patch(`/projects/${projectId}`, { name: newName });
                } catch (err) {
                  console.error("Failed to rename project", err);
                  onProjectNameUpdate(projectName); // revert
                }
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setEditedName(projectName || "");
                setIsEditingName(false);
              }
            }}
          />
        ) : (
          <span
            className="font-medium text-zinc-100 cursor-text hover:text-sky-400 transition-colors rounded px-1 -ml-1 border border-transparent hover:border-white/10"
            onDoubleClick={() => {
              setEditedName(projectName || "");
              setIsEditingName(true);
            }}
            title="Double click to rename"
          >
            {projectName}
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <button
          onClick={onOpenSettings}
          className="btn-secondary py-1.5 text-sm flex items-center gap-2 mr-2"
        >
          <Settings className="w-4 h-4" />
          Settings
        </button>
        {hasRunningReview && (
          <div className="flex items-center gap-2 px-3 py-1.5 mr-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 text-sm font-medium">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Reviewing...</span>
          </div>
        )}
        <button
          onClick={onRunReview}
          disabled={reviewLoading || treeDataLength === 0}
          className="btn-primary py-1.5 text-sm flex items-center gap-2"
        >
          {reviewLoading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Starting...</>
          ) : (
            "Run Review"
          )}
        </button>
      </div>
    </div>
  );
}
