import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { Plus, Trash2, Calendar, Tag, Search, CheckCircle, Clock, ArrowRight, Kanban, Sparkles, Filter } from 'lucide-react';

export function KanbanBoard({ boardId, workspaceId }: { boardId: string; workspaceId: string }) {
  const [boardData, setBoardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [newCardTitle, setNewCardTitle] = useState<{ [listId: string]: string }>({});
  const [newCardPriority, setNewCardPriority] = useState<{ [listId: string]: string }>({});
  const [newListTitle, setNewListTitle] = useState('');
  const [showAddList, setShowAddList] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const { currentRole, cachedBoards, setCachedBoards } = useAuthStore();
  const canModify = currentRole === 'owner' || currentRole === 'admin' || currentRole === 'member';
  const isAdmin = currentRole === 'owner' || currentRole === 'admin';

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
    const priority = newCardPriority[listId] || 'medium';

    try {
      await api.post(`/api/boards/${boardId}/lists/${listId}/cards?workspaceId=${workspaceId}`, {
        title: title.trim(),
        priority,
      });
      setNewCardTitle((prev) => ({ ...prev, [listId]: '' }));
      loadBoard();
    } catch (err) {
      console.error('Failed to add card', err);
    }
  };

  const handleAddList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListTitle.trim()) return;
    try {
      await api.post(`/api/boards/${boardId}/lists?workspaceId=${workspaceId}`, {
        title: newListTitle.trim(),
      });
      setNewListTitle('');
      setShowAddList(false);
      loadBoard();
    } catch (err) {
      console.error('Failed to add list', err);
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

  const handleQuickMoveCard = async (card: any, targetListId: string) => {
    if (card.listId === targetListId) return;
    try {
      await api.post(`/api/boards/${boardId}/cards/${card._id}/move?workspaceId=${workspaceId}`, {
        targetListId,
        version: card.version,
      });
      loadBoard();
    } catch (err) {
      console.error('Failed to move card', err);
    }
  };

  if (loading && !boardData) {
    return <div className="text-slate-400 text-xs p-8">Loading sprint board data...</div>;
  }

  const lists = boardData?.lists || [];

  return (
    <div className="space-y-6 max-w-full">
      {/* Board Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Kanban className="text-indigo-400" size={22} />
              {boardData?.board?.title || 'Sprint Roadmap'}
            </h1>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold uppercase">
              Live Real-Time Sync
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">{boardData?.board?.description || 'Agile Kanban board with optimistic conflict resolution'}</p>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filter tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {isAdmin && (
            <button
              onClick={() => setShowAddList(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 shadow transition"
            >
              <Plus size={14} /> Add List
            </button>
          )}
        </div>
      </div>

      {/* Add Column Modal */}
      {showAddList && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl w-full max-w-sm shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Create Kanban Column</h3>
            <form onSubmit={handleAddList} className="space-y-4">
              <input
                type="text"
                required
                placeholder="Column Title (e.g. Blocked, In Review)"
                value={newListTitle}
                onChange={(e) => setNewListTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddList(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 px-4 py-1.5 text-xs text-white font-bold rounded-xl shadow"
                >
                  Create Column
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Kanban Columns Row */}
      <div className="flex gap-4 overflow-x-auto pb-6 items-start">
        {lists.map((list: any) => {
          const cards = (list.cards || []).filter((c: any) => {
            const matchesSearch = !searchQuery || c.title.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesPriority = priorityFilter === 'all' || c.priority === priorityFilter;
            return matchesSearch && matchesPriority;
          });

          return (
            <div
              key={list._id}
              className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 w-80 shrink-0 flex flex-col max-h-[750px] shadow-xl"
            >
              {/* Column Header */}
              <div className="flex justify-between items-center mb-3 px-1">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-xs text-white uppercase tracking-wider">{list.title}</span>
                  <span className="text-[10px] font-mono font-bold bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700">
                    {cards.length}
                  </span>
                </div>
              </div>

              {/* Card Stack */}
              <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                {cards.length === 0 ? (
                  <div className="border border-dashed border-slate-800/80 rounded-xl p-6 text-center text-slate-500 text-xs">
                    No task cards in this list
                  </div>
                ) : (
                  cards.map((card: any) => (
                    <div
                      key={card._id}
                      className="bg-slate-950 border border-slate-800/90 p-3.5 rounded-xl shadow-md hover:border-indigo-500/50 transition space-y-2 group"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-xs text-slate-200 font-semibold leading-snug">{card.title}</span>
                        {canModify && (
                          <button
                            onClick={() => handleDeleteCard(card._id)}
                            className="text-slate-500 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition rounded"
                            title="Delete Card"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>

                      {card.description && (
                        <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{card.description}</p>
                      )}

                      {/* Card Tags & Priority */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span
                          className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            card.priority === 'urgent'
                              ? 'bg-red-500/15 text-red-300 border border-red-500/30'
                              : card.priority === 'high'
                              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                              : card.priority === 'medium'
                              ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {card.priority}
                        </span>

                        {card.labels?.map((label: string, lIdx: number) => (
                          <span key={lIdx} className="text-[9px] font-bold bg-slate-800/80 text-slate-400 px-2 py-0.5 rounded-md">
                            #{label}
                          </span>
                        ))}
                      </div>

                      {/* Move to another column quick selector */}
                      {canModify && lists.length > 1 && (
                        <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500">
                          <span>Move to:</span>
                          <select
                            value={card.listId}
                            onChange={(e) => handleQuickMoveCard(card, e.target.value)}
                            className="bg-slate-900 border border-slate-800 text-slate-300 text-[10px] rounded-lg px-2 py-0.5 focus:outline-none focus:border-indigo-500 font-medium"
                          >
                            {lists.map((l: any) => (
                              <option key={l._id} value={l._id}>
                                {l.title}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Add Card Form */}
              {canModify && (
                <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-2">
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="+ New task title..."
                      value={newCardTitle[list._id] || ''}
                      onChange={(e) => setNewCardTitle({ ...newCardTitle, [list._id]: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddCard(list._id)}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                    <select
                      value={newCardPriority[list._id] || 'medium'}
                      onChange={(e) => setNewCardPriority({ ...newCardPriority, [list._id]: e.target.value })}
                      className="bg-slate-950 border border-slate-800 text-slate-400 text-[10px] rounded-xl px-1.5"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Med</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                    <button
                      onClick={() => handleAddCard(list._id)}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function KanbanWrapper() {
  const { currentWorkspace } = useAuthStore();
  const [boards, setBoards] = useState<any[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateBoard, setShowCreateBoard] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState('');
  const [newBoardDesc, setNewBoardDesc] = useState('');

  const loadBoards = async () => {
    if (!currentWorkspace) return;
    try {
      const res = await api.get(`/api/boards?workspaceId=${currentWorkspace.id}`);
      const list = res.data.boards || [];
      setBoards(list);
      if (list.length > 0 && !activeBoardId) {
        setActiveBoardId(list[0]._id);
      }
    } catch (err) {
      console.error('Failed to fetch workspace boards', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBoards();
  }, [currentWorkspace]);

  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBoardTitle.trim() || !currentWorkspace) return;
    try {
      const res = await api.post(`/api/boards?workspaceId=${currentWorkspace.id}`, {
        workspaceId: currentWorkspace.id,
        title: newBoardTitle.trim(),
        description: newBoardDesc.trim() || undefined,
      });
      setNewBoardTitle('');
      setNewBoardDesc('');
      setShowCreateBoard(false);
      await loadBoards();
      if (res.data.board) setActiveBoardId(res.data.board._id);
    } catch (err) {
      console.error('Failed to create board', err);
    }
  };

  if (!currentWorkspace) {
    return <div className="text-slate-400 text-sm">Please select a workspace from the sidebar.</div>;
  }

  if (loading && boards.length === 0) {
    return <div className="text-slate-400 text-xs p-8">Loading workspace boards...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Multi-Board Navigation Bar */}
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-2xl">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2">Boards:</span>
          {boards.map((b) => (
            <button
              key={b._id}
              onClick={() => setActiveBoardId(b._id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                activeBoardId === b._id
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {b.title}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowCreateBoard(true)}
          className="bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition shrink-0"
        >
          <Plus size={14} /> New Board
        </button>
      </div>

      {showCreateBoard && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl w-full max-w-sm shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Create New Sprint Board</h3>
            <form onSubmit={handleCreateBoard} className="space-y-3">
              <input
                type="text"
                required
                placeholder="Board Title (e.g. Q4 Releases)"
                value={newBoardTitle}
                onChange={(e) => setNewBoardTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
              <textarea
                rows={2}
                placeholder="Description (optional)"
                value={newBoardDesc}
                onChange={(e) => setNewBoardDesc(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateBoard(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 px-4 py-1.5 text-xs text-white font-bold rounded-xl shadow"
                >
                  Create Board
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {boards.length > 0 ? (
        <KanbanBoard boardId={activeBoardId || boards[0]._id} workspaceId={currentWorkspace.id} />
      ) : (
        <div className="bg-slate-900 border border-slate-800 p-12 rounded-2xl text-center space-y-4">
          <h3 className="text-base font-bold text-white">No sprint boards found in this workspace</h3>
          <p className="text-xs text-slate-400">Click below to initialize your first Kanban board.</p>
          <button
            onClick={() => setShowCreateBoard(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-600/30"
          >
            Create Initial Sprint Board
          </button>
        </div>
      )}
    </div>
  );
}
