"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, Folder, FileCode2, FileText, File, AlertCircle } from "lucide-react";

export interface TreeNode {
  name: string;
  type: "file" | "directory";
  id?: string;
  path?: string;
  language?: string;
  size?: number;
  severity?: "critical" | "high" | "medium" | "low" | null;
  children?: TreeNode[];
}

interface FileTreeProps {
  data: TreeNode[];
  onFileSelect: (node: TreeNode) => void;
  selectedFileId?: string | null;
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
  selectedFileId 
}: { 
  node: TreeNode; 
  level: number; 
  onFileSelect: (node: TreeNode) => void;
  selectedFileId?: string | null;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const isSelected = node.type === "file" && node.id === selectedFileId;
  const severityClass = getSeverityColor(node.severity);

  const handleClick = () => {
    if (node.type === "directory") {
      setIsOpen(!isOpen);
    } else {
      onFileSelect(node);
    }
  };

  return (
    <div>
      <div 
        onClick={handleClick}
        className={`flex items-center py-1.5 px-2 cursor-pointer select-none transition-colors group text-sm
          ${isSelected ? 'bg-sky-500/10 text-sky-300' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}
        `}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
      >
        <span className="w-4 h-4 mr-1 flex items-center justify-center shrink-0">
          {node.type === "directory" ? (
            isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />
          ) : null}
        </span>
        
        <span className="w-5 h-5 mr-1.5 flex items-center justify-center shrink-0">
          {node.type === "directory" ? (
            <Folder className={`w-4 h-4 ${isOpen ? 'text-sky-400' : 'text-zinc-500 group-hover:text-zinc-400'}`} />
          ) : (
            getFileIcon(node.name)
          )}
        </span>
        
        <span className="truncate">{node.name}</span>
        
        {node.severity && (
          <span className="ml-auto pl-2 shrink-0">
            <AlertCircle className={`w-3.5 h-3.5 ${severityClass}`} />
          </span>
        )}
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
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function FileTree({ data, onFileSelect, selectedFileId }: FileTreeProps) {
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
        />
      ))}
    </div>
  );
}
