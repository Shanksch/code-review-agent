import { useState, useRef, useEffect } from "react";
import { Loader2, Send, Bot, User, Code, AlertCircle, ChevronDown } from "lucide-react";
import { api } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
  files_used?: string[];
}

interface AIChatProps {
  projectId: string;
  context: {
    fileId?: string;
    fileName?: string;
    issue?: any;
    lines?: number[];
  };
  hasRunningReview?: boolean;
}

export default function AIChat({ projectId, context, hasRunningReview }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [contextMode, setContextMode] = useState<'issue' | 'file' | 'code' | 'project'>('project');
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [selectedCodeSnippet, setSelectedCodeSnippet] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (context.issue) setContextMode('issue');
    else if (context.lines && context.lines.length > 0) setContextMode('code');
    else if (context.fileName) setContextMode('file');
    else setContextMode('project');
  }, [context.issue, context.fileName, context.lines]);

  useEffect(() => {
    const handlePromptEvent = ((e: CustomEvent) => {
      const { prompt, code } = e.detail;
      if (typeof prompt === 'string') setInput(prompt);
      if (code) {
        setSelectedCodeSnippet(code);
        setContextMode('code');
      }
      // Auto focus the input
      setTimeout(() => {
        const textarea = document.querySelector('textarea');
        if (textarea) textarea.focus();
      }, 50);
    }) as EventListener;
    
    window.addEventListener("ai-chat-prompt", handlePromptEvent);
    return () => window.removeEventListener("ai-chat-prompt", handlePromptEvent);
  }, []);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      // Create a chat session or send a one-off message.
      // We'll use a streaming endpoint if available, but for MVP we can use a standard POST
      const response: any = await api.post(`/projects/${projectId}/chat`, {
        message: userMsg,
        history: messages,
        context: { 
          ...context, 
          activeMode: contextMode,
          selectedCode: selectedCodeSnippet
        }
      });
      
      setMessages(prev => [...prev, { role: "assistant", content: response.reply, files_used: response.files_used }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I encountered an error. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0d1117]">
      {/* Context Indicator */}
      <div className="p-4 border-b border-white/5 bg-zinc-900/30 flex flex-col gap-2 shrink-0 relative z-10">
        <div className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Context</div>
        
        <button 
          onClick={() => setIsContextOpen(!isContextOpen)}
          className="flex items-center justify-between w-full px-3 py-2 bg-zinc-950 border border-white/10 rounded-lg hover:border-white/20 transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-sky-500" />
            <span className="text-xs font-medium text-zinc-300">
              {contextMode === 'issue' ? 'Current issue' :
               contextMode === 'file' ? 'Current file' :
               contextMode === 'code' ? 'Selected code' : 'Entire project'}
            </span>
          </div>
          <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${isContextOpen ? 'rotate-180' : ''}`} />
        </button>

        {isContextOpen && (
          <div className="absolute top-[calc(100%-8px)] left-4 right-4 bg-zinc-950 border border-white/10 rounded-b-lg shadow-xl p-3 space-y-3 z-20">
            {context.issue && (
              <label 
                className="flex items-start gap-3 cursor-pointer group" 
                onClick={() => { setContextMode('issue'); setIsContextOpen(false); }}
              >
                <input type="radio" checked={contextMode === 'issue'} readOnly className="hidden" />
                <div className={`mt-0.5 w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${contextMode === 'issue' ? 'border-sky-500' : 'border-zinc-600 group-hover:border-zinc-400'}`}>
                  {contextMode === 'issue' && <div className="w-2 h-2 rounded-full bg-sky-500" />}
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className={`text-sm ${contextMode === 'issue' ? 'text-zinc-200 font-medium' : 'text-zinc-400'}`}>Current issue</span>
                  <span className="text-xs text-sky-400/80 line-clamp-1 mt-1">{context.issue.title}</span>
                </div>
              </label>
            )}

            {context.fileName && (
              <label 
                className="flex items-start gap-3 cursor-pointer group" 
                onClick={() => { setContextMode('file'); setIsContextOpen(false); }}
              >
                <input type="radio" checked={contextMode === 'file'} readOnly className="hidden" />
                <div className={`mt-0.5 w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${contextMode === 'file' ? 'border-sky-500' : 'border-zinc-600 group-hover:border-zinc-400'}`}>
                  {contextMode === 'file' && <div className="w-2 h-2 rounded-full bg-sky-500" />}
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className={`text-sm ${contextMode === 'file' ? 'text-zinc-200 font-medium' : 'text-zinc-400'}`}>Current file</span>
                  <span className="text-xs text-zinc-500 font-mono truncate mt-1">{context.fileName}</span>
                </div>
              </label>
            )}

            {context.lines && context.lines.length > 0 && (
              <label 
                className="flex items-center gap-3 cursor-pointer group" 
                onClick={() => { setContextMode('code'); setIsContextOpen(false); }}
              >
                <input type="radio" checked={contextMode === 'code'} readOnly className="hidden" />
                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${contextMode === 'code' ? 'border-sky-500' : 'border-zinc-600 group-hover:border-zinc-400'}`}>
                  {contextMode === 'code' && <div className="w-2 h-2 rounded-full bg-sky-500" />}
                </div>
                <span className={`text-sm ${contextMode === 'code' ? 'text-zinc-200 font-medium' : 'text-zinc-400'}`}>Selected code</span>
              </label>
            )}

            <label 
              className="flex items-center gap-3 cursor-pointer group" 
              onClick={() => { setContextMode('project'); setIsContextOpen(false); }}
            >
              <input type="radio" checked={contextMode === 'project'} readOnly className="hidden" />
              <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${contextMode === 'project' ? 'border-sky-500' : 'border-zinc-600 group-hover:border-zinc-400'}`}>
                {contextMode === 'project' && <div className="w-2 h-2 rounded-full bg-sky-500" />}
              </div>
              <span className={`text-sm ${contextMode === 'project' ? 'text-zinc-200 font-medium' : 'text-zinc-400'}`}>Entire project</span>
            </label>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 animate-in fade-in duration-500">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500/20 to-emerald-500/20 border border-white/10 flex items-center justify-center mb-4">
              <Bot className="w-6 h-6 text-sky-400" />
            </div>
            <h3 className="text-zinc-100 font-medium mb-2">{hasRunningReview ? "Review in progress." : "How can I help?"}</h3>
            <p className="text-zinc-500 text-sm max-w-[200px] mb-6">
              {hasRunningReview 
                ? "You can ask questions about the code while the review runs."
                : `Ask questions about the ${context.issue ? 'selected issue' : context.fileName ? 'current file' : 'entire codebase'}.`}
            </p>
            <div className="flex flex-col gap-2 w-full max-w-[240px]">
              <button 
                onClick={() => {
                  setInput(hasRunningReview ? "What is this project architecture?" : context.issue ? "Explain this issue in simpler terms" : "What does this code do?");
                }}
                className="text-xs text-left px-3 py-2 rounded-lg bg-zinc-900/50 border border-white/5 hover:bg-zinc-800 transition-colors text-zinc-300"
              >
                {hasRunningReview ? "What is this project architecture?" : context.issue ? "Explain this issue in simpler terms" : "What does this code do?"}
              </button>
              <button 
                onClick={() => {
                  setInput(hasRunningReview ? "Identify security risks" : context.issue ? "How do I fix this issue?" : "Are there any security vulnerabilities here?");
                }}
                className="text-xs text-left px-3 py-2 rounded-lg bg-zinc-900/50 border border-white/5 hover:bg-zinc-800 transition-colors text-zinc-300"
              >
                {hasRunningReview ? "Identify security risks" : context.issue ? "How do I fix this issue?" : "Are there any security vulnerabilities here?"}
              </button>
            </div>
          </div>
        )}
        
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
              m.role === 'user' ? 'bg-sky-500/20 text-sky-500' : 'bg-emerald-500/20 text-emerald-500'
            }`}>
              {m.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
            </div>
            <div className={`flex flex-col gap-1 w-full ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`text-sm py-2 px-3 rounded-xl max-w-[85%] ${
                m.role === 'user' ? 'bg-sky-500/10 border border-sky-500/20 text-sky-100' : 'bg-zinc-800/50 border border-white/5 text-zinc-200'
              } whitespace-pre-wrap break-words`}>
                {m.content}
              </div>
              {m.files_used && m.files_used.length > 0 && (
                <div className="flex items-center gap-1 mt-1 text-[10px] text-zinc-500 bg-zinc-900/50 border border-white/5 px-2 py-1 rounded">
                  <Code className="w-3 h-3" />
                  <span>Based on: {m.files_used.map(f => f.split('/').pop()).join(', ')}</span>
                  <span className="ml-1 opacity-70">({m.files_used.length} files used)</span>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-emerald-500/20 text-emerald-500">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="text-sm py-2.5 px-4 rounded-xl bg-zinc-800/50 border border-white/5 text-zinc-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
              <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
              <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce"></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/5 bg-zinc-900/30 shrink-0">
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask about this code..."
            className="w-full bg-[#090b0f] border border-white/10 rounded-lg pl-3 pr-10 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-sky-500/50 resize-none"
            rows={1}
            style={{ minHeight: "44px", maxHeight: "120px" }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="absolute right-2 bottom-2 p-1.5 rounded-md text-zinc-400 hover:text-sky-400 hover:bg-sky-500/10 disabled:opacity-50 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
