"use client";

import { useRef, useEffect, useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Bot, ShieldAlert, Wrench, Info } from "lucide-react";

interface CodeViewerProps {
  content: string;
  language?: string;
  highlightLines?: number[];
  severity?: string;
  activeIssueId?: string;
  onAskAI?: (prompt: string, selectedCode: string) => void;
}

export default function CodeViewer({ content, language, highlightLines = [], severity = "low", activeIssueId, onAskAI }: CodeViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectionRect, setSelectionRect] = useState<{ top: number; left: number } | null>(null);
  const [selectedText, setSelectedText] = useState("");

  useEffect(() => {
    const handleSelection = () => {
      const selection = window.getSelection();
      if (selection && selection.toString().trim() && selection.rangeCount > 0) {
        const text = selection.toString();
        
        // Ensure the selection is within our container
        let node = selection.anchorNode;
        let isInside = false;
        while (node && node !== document.body) {
          if (node === containerRef.current) {
            isInside = true;
            break;
          }
          node = node.parentNode;
        }
        
        if (isInside) {
          setSelectedText(text);
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          setSelectionRect({ top: rect.top - 40, left: rect.left + rect.width / 2 });
          return;
        }
      }
      
      // If we clicked outside or cleared selection
      setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || !sel.toString().trim()) {
          setSelectionRect(null);
          setSelectedText("");
        }
      }, 50);
    };

    document.addEventListener("mouseup", handleSelection);
    return () => document.removeEventListener("mouseup", handleSelection);
  }, []);

  // Auto-scroll to the first highlighted line when the active issue changes
  useEffect(() => {
    if (highlightLines.length > 0 && containerRef.current) {
      const firstLine = Math.min(...highlightLines);
      // Rough estimate of scroll position
      const scrollPosition = (firstLine - 5) * 20; 
      containerRef.current.scrollTo({ top: scrollPosition > 0 ? scrollPosition : 0, behavior: "smooth" });
    }
  }, [activeIssueId]);

  const getSeverityColor = (sev: string) => {
    switch (sev) {
      case "critical": return "rgba(239, 68, 68, 0.2)";
      case "high": return "rgba(249, 115, 22, 0.2)";
      case "medium": return "rgba(234, 179, 8, 0.2)";
      case "low": return "rgba(59, 130, 246, 0.2)";
      default: return "rgba(255, 255, 255, 0.1)";
    }
  };

  const severityBorder = (sev: string) => {
    switch (sev) {
      case "critical": return "border-red-500";
      case "high": return "border-orange-500";
      case "medium": return "border-yellow-500";
      case "low": return "border-blue-500";
      default: return "border-white/20";
    }
  };

  const customStyle = {
    margin: 0,
    background: "transparent",
    fontSize: "13px",
    lineHeight: "20px",
  };

  return (
    <div ref={containerRef} className="h-full overflow-auto bg-[#0d1117] relative">
      <SyntaxHighlighter
        language={language || "typescript"}
        style={vscDarkPlus}
        customStyle={customStyle}
        showLineNumbers={true}
        wrapLines={true}
        lineProps={(lineNumber: number) => {
          const isHighlighted = highlightLines.includes(lineNumber);
          if (isHighlighted) {
            return {
              style: {
                display: "block",
                backgroundColor: getSeverityColor(severity),
              },
              className: `border-l-4 ${severityBorder(severity)}`,
            };
          }
          return {
            style: { display: "block" },
            className: "border-l-4 border-transparent hover:bg-white/5",
          };
        }}
      >
        {content}
      </SyntaxHighlighter>
      
      {selectionRect && selectedText && onAskAI && (
        <div 
          className="fixed z-50 flex items-center bg-zinc-800 border border-white/10 shadow-xl rounded-lg overflow-hidden transform -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2 duration-200"
          style={{ top: selectionRect.top, left: selectionRect.left }}
        >
          <button 
            onClick={() => onAskAI("Explain this code", selectedText)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/5 transition-colors border-r border-white/5"
          >
            <Info className="w-3.5 h-3.5" /> Explain
          </button>
          <button 
            onClick={() => onAskAI("Fix this code", selectedText)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors border-r border-white/5"
          >
            <Wrench className="w-3.5 h-3.5" /> Fix
          </button>
          <button 
            onClick={() => onAskAI("What is the security impact of this code?", selectedText)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors border-r border-white/5"
          >
            <ShieldAlert className="w-3.5 h-3.5" /> Security
          </button>
          <button 
            onClick={() => onAskAI("", selectedText)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 transition-colors"
          >
            <Bot className="w-3.5 h-3.5" /> Ask AI
          </button>
        </div>
      )}
    </div>
  );
}
