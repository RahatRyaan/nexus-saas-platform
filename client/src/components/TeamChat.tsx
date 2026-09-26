import React, { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useAuthStore } from '../store/authStore';
import { Send, User as UserIcon, MessageSquare, Hash } from 'lucide-react';

export function TeamChat() {
  const { currentWorkspace, user } = useAuthStore();
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    async function loadConversations() {
      if (!currentWorkspace) return;
      try {
        const res = await api.get(`/api/chat/conversations?workspaceId=${currentWorkspace.id}`);
        const convs = res.data.conversations || [];
        setConversations(convs);
        if (convs.length > 0 && !activeConvId) {
          setActiveConvId(convs[0]._id);
        }
      } catch (err) {
        console.error('Failed to load conversations', err);
      } finally {
        setLoading(false);
      }
    }
    loadConversations();
  }, [currentWorkspace]);

  useEffect(() => {
    if (!activeConvId || !currentWorkspace) return;

    async function loadMessages() {
      try {
        const res = await api.get(`/api/chat/conversations/${activeConvId}/messages?workspaceId=${currentWorkspace?.id}`);
        const messageList = res.data.data || [];
        setMessages(messageList.reverse());
        setTimeout(scrollToBottom, 50);
      } catch (err) {
        console.error('Failed to fetch messages', err);
      }
    }
    loadMessages();

    const socket = getSocket();
    socket.emit('join:chat', activeConvId);

    const handleNewMessage = (data: { message: any; conversationId: string }) => {
      if (data.conversationId === activeConvId) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === data.message._id)) return prev;
          return [...prev, data.message];
        });
        setTimeout(scrollToBottom, 50);
      }
    };

    socket.on('sendMessage', handleNewMessage);

    return () => {
      socket.emit('leave:chat', activeConvId);
      socket.off('sendMessage', handleNewMessage);
    };
  }, [activeConvId, currentWorkspace]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeConvId || !currentWorkspace) return;

    const content = input;
    setInput('');

    try {
      const res = await api.post(`/api/chat/conversations/${activeConvId}/messages?workspaceId=${currentWorkspace.id}`, { content });
      if (res.data.message) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === res.data.message._id)) return prev;
          return [...prev, res.data.message];
        });
        setTimeout(scrollToBottom, 50);
      }
    } catch (err) {
      console.error('Failed to send message', err);
    }
  };

  if (!currentWorkspace) {
    return <div className="text-slate-400 text-sm">Please select a workspace from the sidebar.</div>;
  }

  if (loading) {
    return <div className="text-slate-400 text-xs p-8">Loading shared team conversations...</div>;
  }

  const activeConv = conversations.find((c) => c._id === activeConvId);

  return (
    <div className="max-w-6xl h-[720px] bg-slate-900 border border-slate-800 rounded-2xl flex overflow-hidden shadow-2xl">
      {/* Channels / Conversations Sidebar */}
      <div className="w-64 border-r border-slate-800 bg-slate-950/60 p-4 flex flex-col justify-between shrink-0">
        <div className="space-y-4">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <MessageSquare size={14} /> Team Channels
          </div>
          <div className="space-y-1">
            {conversations.map((conv) => (
              <button
                key={conv._id}
                onClick={() => setActiveConvId(conv._id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition text-left ${
                  activeConvId === conv._id
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Hash size={14} className="shrink-0 opacity-70" />
                <span className="truncate">{conv.name || 'General Channel'}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="text-[11px] text-emerald-400 flex items-center gap-1.5 pt-3 border-t border-slate-800">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
          Live Socket.io Connected
        </div>
      </div>

      {/* Main Chat Conversation Thread */}
      <div className="flex-1 flex flex-col bg-slate-900">
        {/* Chat Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/30 flex justify-between items-center">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Hash size={16} className="text-indigo-400" /> {activeConv?.name || 'General Product Discussion'}
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Workspace discussion thread with real-time syncing and persistence.
            </p>
          </div>
        </div>

        {/* Message Bubble Thread */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4">
          {messages.length === 0 ? (
            <div className="text-slate-500 text-xs text-center py-20">No messages in this conversation thread. Start chatting!</div>
          ) : (
            messages.map((m: any, i: number) => {
              const isMe = m.senderId?._id === user?.id || m.senderId === user?.id;
              const senderName = m.senderId?.name || (isMe ? 'You' : 'Team Member');
              const avatar = m.senderId?.avatar;
              const timeStr = m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now';

              return (
                <div key={m._id || i} className={`flex gap-3 items-start ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Sender Avatar */}
                  <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center font-bold text-xs text-white shrink-0 mt-0.5 shadow">
                    {avatar ? (
                      <img src={avatar} alt={senderName} className="h-full w-full object-cover" />
                    ) : (
                      senderName.charAt(0).toUpperCase()
                    )}
                  </div>

                  {/* Message Bubble */}
                  <div className={`flex flex-col gap-1 max-w-lg ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-2 px-1">
                      <span className={`text-[11px] font-bold ${isMe ? 'text-indigo-400' : 'text-slate-300'}`}>{senderName}</span>
                      <span className="text-[10px] text-slate-500">{timeStr}</span>
                    </div>
                    <div
                      className={`p-3.5 rounded-2xl text-xs leading-relaxed border shadow-md ${
                        isMe
                          ? 'bg-indigo-600 text-white border-indigo-500 rounded-tr-none'
                          : 'bg-slate-950 border-slate-800 text-slate-200 rounded-tl-none'
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input Form */}
        <form onSubmit={handleSend} className="p-4 border-t border-slate-800 bg-slate-950/80 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Reply in #${activeConv?.name || 'general'} as ${user?.name}...`}
            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 placeholder:text-slate-500"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 transition"
          >
            <Send size={14} /> Send
          </button>
        </form>
      </div>
    </div>
  );
}
