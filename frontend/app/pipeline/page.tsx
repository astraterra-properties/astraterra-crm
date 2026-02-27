'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { KanbanSquare, Phone, DollarSign, ChevronLeft, ChevronRight } from 'lucide-react';

interface Lead {
  id: number;
  name?: string;
  contact_name?: string;
  phone?: string;
  contact_phone?: string;
  budget?: number;
  budget_min?: number;
  property_type?: string;
  source?: string;
  source_channel?: string;
  lead_type?: string;
  pipeline_stage?: string;
  priority?: string;
}

const STAGES = [
  { key: 'new_lead', label: 'New Lead', color: '#3B82F6' },
  { key: 'contacted', label: 'Contacted', color: '#F59E0B' },
  { key: 'qualified', label: 'Qualified', color: '#10B981' },
  { key: 'site_visit', label: 'Site Visit', color: '#8B5CF6' },
  { key: 'offer_made', label: 'Offer Made', color: '#F97316' },
  { key: 'negotiation', label: 'Negotiation', color: '#EF4444' },
  { key: 'deal_closed', label: 'Deal Closed', color: '#065F46' },
  { key: 'lost', label: 'Lost', color: '#6B7280' },
];

const LEAD_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  buyer: { bg: '#EFF6FF', text: '#1D4ED8' },
  seller: { bg: '#ECFDF5', text: '#065F46' },
  tenant: { bg: '#F5F3FF', text: '#5B21B6' },
  landlord: { bg: '#FFF7ED', text: '#C2410C' },
  investor: { bg: '#FEFCE8', text: '#854D0E' },
  agent: { bg: '#F9FAFB', text: '#374151' },
};

export default function PipelinePage() {
  const router = useRouter();
  const [kanban, setKanban] = useState<Record<string, Lead[]>>({});
  const [loading, setLoading] = useState(true);
  const [movingLead, setMovingLead] = useState<number | null>(null);

  const fetchKanban = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    try {
      const res = await fetch('/api/leads?view=kanban', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setKanban(data.kanban || {});
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { fetchKanban(); }, [fetchKanban]);

  const moveToStage = async (leadId: number, newStage: string) => {
    setMovingLead(leadId);
    const token = localStorage.getItem('token');
    try {
      await fetch(`/api/leads/${leadId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipeline_stage: newStage }),
      });
      await fetchKanban();
    } catch (e) { console.error(e); }
    finally { setMovingLead(null); }
  };

  const getLeadName = (lead: Lead) => lead.name || lead.contact_name || 'Unknown';
  const getLeadPhone = (lead: Lead) => lead.phone || lead.contact_phone || '';
  const getBudget = (lead: Lead) => lead.budget || lead.budget_min;

  const getTotalBudget = (leads: Lead[]) => {
    const total = leads.reduce((sum, l) => sum + (getBudget(l) || 0), 0);
    return total > 0 ? `AED ${(total / 1000000).toFixed(1)}M` : '';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F4F6F9' }}>
        <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#C9A96E', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#F4F6F9' }}>
      {/* Header */}
      <div className="bg-white border-b px-6 py-4" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #131B2B, #1e2a3d)' }}>
            <KanbanSquare className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ color: '#131B2B' }}>Pipeline Kanban</h1>
            <p className="text-xs" style={{ color: '#9CA3AF' }}>
              {Object.values(kanban).reduce((sum, leads) => sum + leads.length, 0)} total leads
            </p>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            {Object.entries(LEAD_TYPE_COLORS).map(([type, colors]) => (
              <span key={type} className="px-2.5 py-1 text-xs font-medium rounded-full capitalize"
                style={{ background: colors.bg, color: colors.text }}>
                {type}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="p-4 overflow-x-auto">
        <div className="flex gap-3 min-w-max">
          {STAGES.map((stage, stageIndex) => {
            const leads = kanban[stage.key] || [];
            const totalBudget = getTotalBudget(leads);

            return (
              <div key={stage.key} className="w-72 flex-shrink-0">
                {/* Column Header */}
                <div className="rounded-xl p-3 mb-3" style={{ background: 'white', border: `2px solid ${stage.color}20`, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: stage.color }} />
                      <span className="text-sm font-bold" style={{ color: '#131B2B' }}>{stage.label}</span>
                    </div>
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: stage.color }}>
                      {leads.length}
                    </span>
                  </div>
                  {totalBudget && (
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3" style={{ color: '#C9A96E' }} />
                      <span className="text-xs font-medium" style={{ color: '#C9A96E' }}>{totalBudget}</span>
                    </div>
                  )}
                </div>

                {/* Cards */}
                <div className="space-y-2">
                  {leads.map(lead => {
                    const typeColors = LEAD_TYPE_COLORS[lead.lead_type || 'buyer'] || LEAD_TYPE_COLORS.buyer;
                    const name = getLeadName(lead);
                    const phone = getLeadPhone(lead);
                    const budget = getBudget(lead);
                    const isMoving = movingLead === lead.id;

                    return (
                      <div key={lead.id}
                        className="bg-white rounded-xl p-4 border"
                        style={{
                          borderColor: '#E5E7EB',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                          opacity: isMoving ? 0.5 : 1,
                        }}
                      >
                        {/* Lead type badge */}
                        <div className="flex items-center justify-between mb-2">
                          <span className="px-2 py-0.5 text-xs font-semibold rounded-full capitalize"
                            style={{ background: typeColors.bg, color: typeColors.text }}>
                            {lead.lead_type || 'buyer'}
                          </span>
                          {lead.priority === 'high' && (
                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#FEF2F2', color: '#DC2626' }}>🔥 Hot</span>
                          )}
                        </div>

                        {/* Name */}
                        <p className="text-sm font-semibold mb-1" style={{ color: '#131B2B' }}>{name}</p>

                        {/* Phone */}
                        {phone && (
                          <div className="flex items-center gap-1 mb-2">
                            <Phone className="w-3 h-3" style={{ color: '#9CA3AF' }} />
                            <a href={`https://wa.me/${phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer"
                              className="text-xs" style={{ color: '#25D366' }}>{phone}</a>
                          </div>
                        )}

                        {/* Property type */}
                        {lead.property_type && (
                          <p className="text-xs mb-1 capitalize" style={{ color: '#6B7280' }}>{lead.property_type}</p>
                        )}

                        {/* Budget */}
                        {budget && (
                          <p className="text-xs font-medium" style={{ color: '#C9A96E' }}>
                            AED {budget.toLocaleString()}
                          </p>
                        )}

                        {/* Source */}
                        {(lead.source || lead.source_channel) && (
                          <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>
                            via {lead.source_channel || lead.source}
                          </p>
                        )}

                        {/* Move buttons */}
                        <div className="flex gap-1 mt-3 pt-2 border-t" style={{ borderColor: '#F3F4F6' }}>
                          {stageIndex > 0 && (
                            <button
                              onClick={() => moveToStage(lead.id, STAGES[stageIndex - 1].key)}
                              disabled={isMoving}
                              className="flex-1 flex items-center justify-center gap-1 py-1 text-xs rounded-lg"
                              style={{ background: '#F3F4F6', color: '#374151' }}
                            >
                              <ChevronLeft className="w-3 h-3" />
                              Back
                            </button>
                          )}
                          {stageIndex < STAGES.length - 1 && (
                            <button
                              onClick={() => moveToStage(lead.id, STAGES[stageIndex + 1].key)}
                              disabled={isMoving}
                              className="flex-1 flex items-center justify-center gap-1 py-1 text-xs rounded-lg font-medium"
                              style={{ background: stage.color + '15', color: stage.color }}
                            >
                              Advance
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {leads.length === 0 && (
                    <div className="rounded-xl border-2 border-dashed p-6 text-center"
                      style={{ borderColor: stage.color + '30', color: '#9CA3AF' }}>
                      <p className="text-xs">No leads</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
