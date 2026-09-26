import React, { useState, useRef, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { Sparkles, Bot, User, Send, Trash2 } from 'lucide-react';

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
      content: 'Hello! I am Nexus AI. You can ask me questions about your workspace architecture, request code breakdowns, or have a continuous conversation. How can I help you today?',
      time: 'Just now',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !currentWorkspace) return;

    const userQuestion = input.trim();
    const newMsg: ChatMessage = {
      role: 'user',
      content: userQuestion,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, newMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.post(`/api/ai/ask?workspaceId=${currentWorkspace.id}`, { question: userQuestion });
      const aiReply = res.data.answer || 'Response generated from knowledge base.';

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: aiReply,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: err.response?.data?.error || 'Unable to reach AI assistant. Please ensure OmniRoute is running.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
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

  if (!currentWorkspace) {
    return <div className="text-slate-400 text-sm">Please select a workspace from the sidebar.</div>;
  }

  return (
    <div className="max-w-4xl h-[720px] bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
      {/* AI Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/20">
            <Sparkles size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              Nexus AI Conversation Assistant
            </h2>
            <p className="text-[11px] text-emerald-400 flex items-center gap-1.5 mt-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              OmniRoute (`auto` model) & pgvector RAG Active
            </p>
          </div>
        </div>

        <button
          onClick={clearChat}
          title="Clear Conversation History"
          className="text-slate-400 hover:text-red-400 p-2 rounded-lg hover:bg-slate-800 transition flex items-center gap-1.5 text-xs"
        >
          <Trash2 size={14} /> Clear History
        </button>
      </div>

      {/* Chat Thread Messages */}
      <div className="flex-1 p-5 overflow-y-auto space-y-4">
        {messages.map((m, i) => {
          const isUser = m.role === 'user';

          return (
            <div key={i} className={`flex gap-3 items-start ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
              <div
                className={`h-8 w-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow ${
                  isUser
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gradient-to-tr from-indigo-900 to-purple-800 text-indigo-200 border border-indigo-500/30'
                }`}
              >
                {isUser ? <User size={15} /> : <Bot size={15} />}
              </div>

              <div className={`flex flex-col gap-1 max-w-2xl ${isUser ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-2 px-1">
                  <span className={`text-[11px] font-bold ${isUser ? 'text-indigo-400' : 'text-purple-300'}`}>
                    {isUser ? user?.name || 'You' : 'Nexus AI'}
                  </span>
                  <span className="text-[10px] text-slate-500">{m.time}</span>
                </div>

                <div
                  className={`p-4 rounded-2xl text-xs leading-relaxed border shadow-md whitespace-pre-wrap ${
                    isUser
                      ? 'bg-indigo-600 text-white border-indigo-500 rounded-tr-none'
                      : 'bg-slate-950 border-slate-800 text-slate-200 rounded-tl-none'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex gap-3 items-start">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-indigo-900 to-purple-800 flex items-center justify-center text-indigo-200 border border-indigo-500/30 shrink-0">
              <Bot size={15} />
            </div>
            <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-2xl rounded-tl-none text-xs text-indigo-400 flex items-center gap-2 animate-pulse">
              <Sparkles size={14} /> Nexus AI is thinking and retrieving context...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <form onSubmit={handleSend} className="p-4 border-t border-slate-800 bg-slate-950/80 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question or continue the conversation..."
          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 placeholder:text-slate-500"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 transition"
        >
          <Send size={14} /> Send
        </button>
      </form>
    </div>
  );
}
