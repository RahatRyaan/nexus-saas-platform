import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';

export function KnowledgeBase() {
  const { currentWorkspace } = useAuthStore();
  const [docs, setDocs] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchDocs = async () => {
    if (!currentWorkspace) return;
    try {
      const res = await api.get(`/api/knowledge?workspaceId=${currentWorkspace.id}`);
      setDocs(res.data.documents || []);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchDocs(); }, [currentWorkspace]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !currentWorkspace) return;
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      await api.post(`/api/knowledge/upload?workspaceId=${currentWorkspace.id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setFile(null);
      fetchDocs();
    } catch (err) { alert('Upload failed'); } 
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Knowledge Base</h2>
      <form onSubmit={handleUpload} className="flex gap-2">
        <input 
            type="file" 
            onChange={(e) => setFile(e.target.files?.[0] || null)} 
            className="text-slate-300 text-sm"
        />
        <button type="submit" disabled={loading} className="bg-indigo-600 px-4 py-2 text-white rounded text-sm">
            {loading ? 'Uploading...' : 'Upload'}
        </button>
      </form>
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        {docs.map((doc: any) => (
            <div key={doc._id} className="p-2 border-b border-slate-800 text-slate-300 text-sm flex justify-between">
                <span>{doc.title}</span>
                <span className="text-slate-500">{doc.embeddingStatus}</span>
            </div>
        ))}
      </div>
    </div>
  );
}
