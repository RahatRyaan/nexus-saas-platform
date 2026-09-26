import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { Plus, Trash2 } from 'lucide-react';

export function KanbanBoard({ boardId, workspaceId }: { boardId: string; workspaceId: string }) {
  const [boardData, setBoardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [newCardTitle, setNewCardTitle] = useState<{ [listId: string]: string }>({});
  const { currentRole } = useAuthStore();
  const canModify = currentRole === 'owner' || currentRole === 'admin' || currentRole === 'member';

  const loadBoard = async () => {
    try {
      const res = await api.get(`/api/boards/${boardId}?workspaceId=${workspaceId}`);
      setBoardData(res.data);
    } catch (err) {
      console.error('Failed to load board details', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBoard();
  }, [boardId, workspaceId]);

  const handleAddCard = async (listId: string) => {
    const title = newCardTitle[listId];
    if (!title?.trim()) return;

    try {
      await api.post(`/api/boards/${boardId}/lists/${listId}/cards?workspaceId=${workspaceId}`, {
        title: title.trim(),
        priority: 'medium',
      });
      setNewCardTitle((prev) => ({ ...prev, [listId]: '' }));
      loadBoard();
    } catch (err) {
      console.error('Failed to add card', err);
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    try {
      await api.delete(`/api/boards/${boardId}/cards/${cardId}?workspaceId=${workspaceId}`);
      loadBoard();
    } catch (err) {
      console.error('Failed to delete card', err);
    }
  };

  if (loading || !boardData) {
    return <div className="text-slate-400 text-xs p-8">Loading real-time Kanban board from database...</div>;
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">{boardData.board?.title}</h1>
        <p className="text-xs text-slate-400 mt-1">{boardData.board?.description || 'Real-time fractional position sprint board'}</p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 items-start">
        {boardData.lists?.map((list: any) => (
          <div key={list._id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 w-80 shrink-0 flex flex-col max-h-[700px]">
            <div className="flex justify-between items-center mb-3">
              <span className="font-bold text-xs text-white uppercase tracking-wider">{list.title}</span>
              <span className="text-[10px] font-mono bg-slate-800 text-slate-400 px-2 py-0.5 rounded">
                {list.cards?.length || 0}
              </span>
            </div>

            <div className="space-y-2.5 overflow-y-auto flex-1 pr-1">
              {list.cards?.map((card: any) => (
                <div key={card._id} className="bg-slate-950 border border-slate-800 p-3 rounded-lg shadow-sm hover:border-slate-700 transition">
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-xs text-slate-200 font-medium leading-snug">{card.title}</span>
                    {canModify && (
                      <button
                        onClick={() => handleDeleteCard(card._id)}
                        className="text-slate-500 hover:text-red-400 p-0.5"
                        title="Delete Card"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                  {card.description && (
                    <p className="text-[11px] text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">{card.description}</p>
                  )}
                  <div className="flex justify-between items-center mt-2.5 pt-2 border-t border-slate-800/60">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                      card.priority === 'urgent' ? 'bg-red-500/10 text-red-400' :
                      card.priority === 'high' ? 'bg-amber-500/10 text-amber-400' :
                      'bg-slate-800 text-slate-400'
                    }`}>
                      {card.priority}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">v{card.version}</span>
                  </div>
                </div>
              ))}
            </div>

            {canModify && (
              <div className="mt-3 pt-3 border-t border-slate-800">
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="+ New card title..."
                    value={newCardTitle[list._id] || ''}
                    onChange={(e) => setNewCardTitle({ ...newCardTitle, [list._id]: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCard(list._id)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={() => handleAddCard(list._id)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1 rounded text-xs font-medium"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function KanbanWrapper() {
  const { currentWorkspace } = useAuthStore();
  const [boards, setBoards] = useState<any[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBoards() {
      if (!currentWorkspace) return;
      try {
        const res = await api.get(`/api/boards?workspaceId=${currentWorkspace.id}`);
        const list = res.data.boards || [];
        setBoards(list);
        if (list.length > 0) setActiveBoardId(list[0]._id);
      } catch (err) {
        console.error('Failed to fetch workspace boards', err);
      } finally {
        setLoading(false);
      }
    }
    loadBoards();
  }, [currentWorkspace]);

  if (!currentWorkspace) {
    return <div className="text-slate-400 text-sm">Please select a workspace from the sidebar.</div>;
  }

  if (loading) {
    return <div className="text-slate-400 text-xs p-8">Loading workspace boards...</div>;
  }

  if (boards.length === 0) {
    return <div className="text-slate-400 text-xs p-8">No boards found for this workspace.</div>;
  }

  return <KanbanBoard boardId={activeBoardId || boards[0]._id} workspaceId={currentWorkspace.id} />;
}
