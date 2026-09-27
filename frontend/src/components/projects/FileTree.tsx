"use client";

import { useState, useEffect } from "react";
import { ChevronRight, ChevronDown, Folder, FileCode2, FileText, File, AlertCircle } from "lucide-react";

export interface TreeNode {
  name: string;
  type: "file" | "directory";
  id?: string;
  path?: string;
  language?: string;
  size?: number;
  severity?: "critical" | "high" | "medium" | "low" | null;
  issueCount?: number;
  children?: TreeNode[];
}

interface FileTreeProps {
  data: TreeNode[];
  onFileSelect: (node: TreeNode) => void;
  selectedFileId?: string | null;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectChange?: (id: string, selected: boolean) => void;
}

const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (['ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'java', 'cpp', 'c', 'h'].includes(ext || '')) {
    return <FileCode2 className="w-4 h-4 text-sky-400" />;
  }
  if (['md', 'txt', 'json', 'yaml', 'yml'].includes(ext || '')) {
    return <FileText className="w-4 h-4 text-zinc-400" />;
  }
  return <File className="w-4 h-4 text-zinc-500" />;
};

const getSeverityColor = (severity?: string | null) => {
  switch (severity) {
    case "critical": return "text-red-500";
    case "high": return "text-orange-500";
    case "medium": return "text-yellow-500";
    case "low": return "text-blue-500";
    default: return "";
  }
};

const TreeNodeItem = ({ 
  node, 
  level, 
  onFileSelect, 
  selectedFileId,
  selectable,
  selectedIds = [],
  onSelectChange
}: { 
  node: TreeNode; 
  level: number; 
  onFileSelect: (node: TreeNode) => void;
  selectedFileId?: string | null;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectChange?: (id: string, selected: boolean) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (node.type === "directory" && selectedFileId) {
      const hasSelectedChild = (n: TreeNode): boolean => {
        if (n.id === selectedFileId) return true;
        if (n.children) {
          return n.children.some(hasSelectedChild);
        }
        return false;
      };
      if (hasSelectedChild(node)) {
        setIsOpen(true);
      }
    }
  }, [node, selectedFileId]);
  const isSelected = node.type === "file" && node.id === selectedFileId;
  const severityClass = getSeverityColor(node.severity);

  const isChecked = node.id ? selectedIds.includes(node.id) : false;

  const handleClick = (e: React.MouseEvent) => {
    // Prevent interfering with checkbox clicks if we add one, but we wrap it anyway
    if (node.type === "directory") {
      setIsOpen(!isOpen);
    }
    onFileSelect(node);
  };

  const handleCheck = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (node.id && onSelectChange) {
      onSelectChange(node.id, e.target.checked);
    }
  };

  return (
    <div>
      <div 
        onClick={handleClick}
        className={`flex items-center py-1.5 px-2 cursor-pointer select-none transition-all duration-200 group text-sm relative border-l-2
          ${isSelected ? 'bg-sky-500/10 text-sky-300 border-sky-500' : 'border-transparent text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}
        `}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
      >
        <span className="w-4 h-4 mr-1 flex items-center justify-center shrink-0">
          {node.type === "directory" ? (
            <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
          ) : null}
        </span>
        
        {selectable && node.type === "file" && (
          <div className="mr-2 flex items-center" onClick={(e) => e.stopPropagation()}>
            <input 
              type="checkbox" 
              checked={isChecked}
              onChange={handleCheck}
              className="w-3.5 h-3.5 rounded border-zinc-600 bg-zinc-900 text-sky-500 focus:ring-sky-500/20"
            />
          </div>
        )}
        
        <span className="w-5 h-5 mr-1.5 flex items-center justify-center shrink-0">
          {node.type === "directory" ? (
            <Folder className={`w-4 h-4 ${isOpen ? 'text-sky-400' : 'text-zinc-500 group-hover:text-zinc-400'}`} />
          ) : (
            getFileIcon(node.name)
          )}
        </span>
        
        <span className="truncate">{node.name}</span>
        
        {(node.severity || (node.type === "directory" && node.issueCount)) ? (
          <span className="ml-auto pl-2 shrink-0 flex items-center gap-1.5">
            {node.type === "directory" && node.issueCount ? (
              <span className="text-[10px] font-bold bg-zinc-800/80 text-zinc-400 px-1.5 py-0.5 rounded leading-none">
                {node.issueCount}
              </span>
            ) : null}
            {node.severity && <AlertCircle className={`w-3.5 h-3.5 ${severityClass}`} />}
          </span>
        ) : null}
      </div>
      
      {node.type === "directory" && isOpen && node.children && (
        <div>
          {node.children.map((child, i) => (
            <TreeNodeItem 
              key={`${child.name}-${i}`} 
              node={child} 
              level={level + 1} 
              onFileSelect={onFileSelect}
              selectedFileId={selectedFileId}
              selectable={selectable}
              selectedIds={selectedIds}
              onSelectChange={onSelectChange}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function FileTree({ data, onFileSelect, selectedFileId, selectable, selectedIds, onSelectChange }: FileTreeProps) {
  if (!data || data.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-zinc-500">
        No files found.
      </div>
    );
  }

  return (
    <div className="py-2">
      {data.map((node, i) => (
        <TreeNodeItem 
          key={`${node.name}-${i}`} 
          node={node} 
          level={0} 
          onFileSelect={onFileSelect}
          selectedFileId={selectedFileId}
          selectable={selectable}
          selectedIds={selectedIds}
          onSelectChange={onSelectChange}
        />
      ))}
    </div>
  );
}
