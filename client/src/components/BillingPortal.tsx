import React, { useState } from 'react';
import { useAuthStore, WorkspaceItem } from '../store/authStore';
import { api } from '../lib/api';
import { CreditCard, Lock, ArrowRight, CheckCircle, Sparkles } from 'lucide-react';

export function BillingPortal() {
  const { currentRole, currentWorkspace, setCurrentWorkspace, workspaces, setWorkspaces } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Both Owner and Admin can manage billing / upgrade workspace tiers
  const canPurchase = currentRole === 'owner' || currentRole === 'admin';

  const handleUpgradePlan = async (targetPlan: 'free' | 'pro') => {
    if (!currentWorkspace) return;
    setLoading(true);
    setSuccessMsg('');
    try {
      await api.post(`/api/billing/upgrade?workspaceId=${currentWorkspace.id}`, {
        plan: targetPlan,
      });

      const updatedWs: WorkspaceItem = { ...currentWorkspace, plan: targetPlan };
      setCurrentWorkspace(updatedWs);

      const updatedList = workspaces.map((w) => (w.id === currentWorkspace.id ? updatedWs : w));
      setWorkspaces(updatedList);

      setSuccessMsg(`Workspace successfully upgraded to ${targetPlan.toUpperCase()} Plan!`);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Upgrade failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Subscription & Payment Plans</h1>
        <p className="text-sm text-slate-400 mt-1">
          Select or upgrade your team subscription tier for <strong className="text-white">{currentWorkspace?.name}</strong>.
        </p>
      </div>

      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs p-3.5 rounded-xl flex items-center gap-2">
          <CheckCircle size={16} /> {successMsg}
        </div>
      )}

      {/* Pricing Tier Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Free / Starter Plan */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Free Starter</span>
              {currentWorkspace?.plan === 'free' && (
                <span className="bg-slate-800 text-slate-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-slate-700">
                  Current Plan
                </span>
              )}
            </div>
            <div className="text-3xl font-extrabold text-white">
              $0 <span className="text-xs font-normal text-slate-400">/ forever</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Standard collaboration tools for small developer teams and open-source projects.
            </p>
            <div className="space-y-2 text-xs text-slate-300 pt-2 border-t border-slate-800">
              <div className="flex items-center gap-2">
                <CheckCircle size={13} className="text-slate-500" /> Up to 3 Kanban Boards
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle size={13} className="text-slate-500" /> 10,000 Daily AI Tokens
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle size={13} className="text-slate-500" /> Standard Team Chat & Socket.io
              </div>
            </div>
          </div>
        </div>

        {/* Pro Workspace Tier */}
        <div className="bg-gradient-to-b from-indigo-950/40 to-slate-900 border-2 border-indigo-500/50 rounded-2xl p-6 flex flex-col justify-between space-y-6 shadow-2xl relative overflow-hidden">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <Sparkles size={16} className="text-indigo-400" />
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Pro SaaS Tier</span>
              </div>
              {currentWorkspace?.plan === 'pro' && (
                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                  Active Subscription
                </span>
              )}
            </div>
            <div className="text-3xl font-extrabold text-white">
              $29 <span className="text-xs font-normal text-slate-400">/ month</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Full AI Knowledge Base with pgvector cosine similarity search, unlimited Kanban boards, and SSLCommerz billing.
            </p>
            <div className="space-y-2 text-xs text-slate-300 pt-2 border-t border-slate-800/80">
              <div className="flex items-center gap-2">
                <CheckCircle size={13} className="text-emerald-400" /> Unlimited Real-time Kanban Boards & Lists
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle size={13} className="text-emerald-400" /> 500,000 Daily AI Tokens (OmniRoute `auto`)
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle size={13} className="text-emerald-400" /> Full pgvector RAG semantic document search
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle size={13} className="text-emerald-400" /> Priority Support & SSLCommerz Integration
              </div>
            </div>
          </div>

          <div>
            {canPurchase ? (
              <button
                onClick={() => handleUpgradePlan('pro')}
                disabled={loading || currentWorkspace?.plan === 'pro'}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold py-2.5 rounded-xl shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-2"
              >
                {loading ? 'Processing Upgrade...' : currentWorkspace?.plan === 'pro' ? 'Current Active Tier' : 'Upgrade to Pro Tier'}
                {currentWorkspace?.plan !== 'pro' && <ArrowRight size={14} />}
              </button>
            ) : (
              <div className="text-center p-2 rounded-lg bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
                <Lock size={12} className="text-amber-400" /> Admin or Owner permission required to purchase
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
