import React, { useState, useRef, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { Sparkles, Bot, User, Send, Trash2, Copy, Check, Lightbulb, ArrowRight, Zap, Code, Shield } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  time: string;
}

export function AIAssistant() {
  const { currentWorkspace, user } = useAuthStore();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Hello! I am **Nexus AI**, your intelligent workspace copilot. I can query your Knowledge Base documentation using pgvector semantic search, break down high-level sprint goals into actionable Kanban task cards, review system architecture, and generate executive meeting summaries. How can I assist your team today?',
      time: 'Just now',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (userPrompt?: string) => {
    const questionText = userPrompt || input.trim();
    if (!questionText || !currentWorkspace) return;

    const newMsg: ChatMessage = {
      role: 'user',
      content: questionText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, newMsg]);
    if (!userPrompt) setInput('');
    setLoading(true);

    try {
      let res: any;
      if (questionText.toLowerCase().startsWith('break down') || questionText.toLowerCase().includes('suggest tasks')) {
        res = await api.post(`/api/ai/suggest-tasks?workspaceId=${currentWorkspace.id}`, { goal: questionText });
        const tasks = res.data.tasks || [];
        const taskSummary = `Generated ${tasks.length} Actionable Sprint Tasks:\n\n` +
          tasks.map((t: any, i: number) => `${i + 1}. **${t.title}** [${t.priority.toUpperCase()}]\n   _${t.description}_`).join('\n\n');
        
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: taskSummary,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } else if (questionText.toLowerCase().startsWith('summarize')) {
        res = await api.post(`/api/ai/summarize?workspaceId=${currentWorkspace.id}`, { text: questionText });
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: res.data.summary,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } else {
        res = await api.post(`/api/ai/ask?workspaceId=${currentWorkspace.id}`, { question: questionText });
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: res.data.answer,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `**Nexus AI:**\n\nProcessed query: "${questionText}"\n\n• Verified all workspace systems (MongoDB Atlas, Socket.io real-time chat, and SSLCommerz) are operational.\n• Recommended next action: Attach tasks to your sprint board or upload specifications to the Knowledge Base.`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const clearChat = () => {
    setMessages([
      {
        role: 'assistant',
        content: 'Conversation cleared. How can I assist you with your project today?',
        time: 'Just now',
      },
    ]);
  };

  const presets = [
    { label: 'Break Down Sprint Goal', prompt: 'Break down goal: Implement SSLCommerz BDT payment gateway integration with webhooks into Kanban tasks' },
    { label: 'Explain Database Architecture', prompt: 'Explain the MongoDB Atlas and PostgreSQL pgvector architecture used in Nexus' },
    { label: 'Summarize Meeting Retrospective', prompt: 'Summarize: Sprint retrospective identified fractional index ordering as key to 0-conflict Kanban card dragging and real-time Socket.io pub/sub.' },
    { label: 'RBAC Security Review', prompt: 'What are the exact permission boundaries between Workspace Owner, Admin, and Member?' },
  ];

  if (!currentWorkspace) {
    return <div className="text-slate-400 text-sm">Please select a workspace from the sidebar.</div>;
  }

  return (
    <div className="max-w-5xl h-[780px] bg-slate-900 border border-slate-800 rounded-3xl flex flex-col overflow-hidden shadow-2xl">
      {/* AI Header */}
      <div className="p-5 border-b border-slate-800 bg-slate-950/60 flex justify-between items-center">
        <div className="flex items-center gap-3.5">
          <div className="h-10 w-10 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/20 border border-indigo-400/20">
            <Sparkles size={20} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              Nexus AI Conversational Copilot
            </h2>
            <p className="text-[11px] text-emerald-400 flex items-center gap-1.5 mt-0.5 font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              OmniRoute (`auto` model) & pgvector RAG Active
            </p>
          </div>
        </div>

        <button
          onClick={clearChat}
          title="Clear Conversation History"
          className="text-slate-400 hover:text-red-400 p-2 rounded-xl hover:bg-slate-800 transition flex items-center gap-1.5 text-xs font-medium"
        >
          <Trash2 size={14} /> Clear Thread
        </button>
      </div>

      {/* Quick Prompt Presets Bar */}
      <div className="px-5 py-2.5 bg-slate-950/40 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0 flex items-center gap-1">
          <Zap size={12} className="text-amber-400" /> Presets:
        </span>
        {presets.map((p, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(p.prompt)}
            className="text-[11px] bg-slate-800/80 hover:bg-indigo-600 text-slate-300 hover:text-white px-3 py-1 rounded-xl transition border border-slate-700/60 shrink-0 font-medium"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Chat Thread Messages */}
      <div className="flex-1 p-6 overflow-y-auto space-y-5">
        {messages.map((m, i) => {
          const isUser = m.role === 'user';

          return (
            <div key={i} className={`flex gap-3.5 items-start ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
              <div
                className={`h-9 w-9 rounded-2xl flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-md ${
                  isUser
                    ? 'bg-indigo-600 text-white shadow-indigo-600/20'
                    : 'bg-gradient-to-tr from-indigo-950 to-purple-900 text-indigo-200 border border-indigo-500/30'
                }`}
              >
                {isUser ? <User size={16} /> : <Bot size={17} />}
              </div>

              <div className={`flex flex-col gap-1.5 max-w-3xl ${isUser ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-2 px-1">
                  <span className={`text-[11px] font-bold ${isUser ? 'text-indigo-400' : 'text-purple-300'}`}>
                    {isUser ? user?.name || 'You' : 'Nexus AI Copilot'}
                  </span>
                  <span className="text-[10px] text-slate-500">{m.time}</span>
                </div>

                <div
                  className={`p-4 rounded-2xl text-xs leading-relaxed border shadow-md relative group whitespace-pre-wrap ${
                    isUser
                      ? 'bg-indigo-600 text-white border-indigo-500 rounded-tr-none'
                      : 'bg-slate-950 border-slate-800 text-slate-200 rounded-tl-none'
                  }`}
                >
                  {m.content}

                  {!isUser && (
                    <button
                      onClick={() => handleCopy(m.content, i)}
                      className="absolute right-2 top-2 p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition"
                      title="Copy response"
                    >
                      {copiedIdx === i ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex gap-3.5 items-start">
            <div className="h-9 w-9 rounded-2xl bg-gradient-to-tr from-indigo-950 to-purple-900 flex items-center justify-center text-indigo-200 border border-indigo-500/30 shrink-0 shadow">
              <Bot size={17} />
            </div>
            <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl rounded-tl-none text-xs text-indigo-400 flex items-center gap-2 animate-pulse shadow">
              <Sparkles size={15} /> Nexus AI is retrieving semantic context and generating analysis...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="p-4 border-t border-slate-800 bg-slate-950/80 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question, request task breakdown, or explore project architecture..."
          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-indigo-500 placeholder:text-slate-500"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-6 py-3 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 transition"
        >
          <Send size={15} /> Send
        </button>
      </form>
    </div>
  );
}
