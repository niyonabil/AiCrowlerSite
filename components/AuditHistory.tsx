import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { AuditResultCache } from '../types';
import { XIcon } from './icons';

interface AuditHistoryProps {
  propertyId: number;
  currentAuditId?: number;
  onLoadAudit: (audit: AuditResultCache) => void;
  onDeleteAudit: (auditId: number) => void;
}

export const AuditHistory: React.FC<AuditHistoryProps> = ({ propertyId, currentAuditId, onLoadAudit, onDeleteAudit }) => {
  const [history, setHistory] = useState<AuditResultCache[] | undefined>(undefined);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!propertyId) {
        setHistory([]);
        return;
      }
      const { data, error } = await supabase
        .from('audit_results')
        .select('*')
        .eq('property_id', propertyId)
        .order('timestamp', { ascending: false });

      if (error) {
        console.error("Error fetching audit history:", error);
        setHistory([]);
      } else {
        setHistory(data);
      }
    };
    
    fetchHistory();
    
    const channel = supabase.channel(`public:audit_results:property_id=eq.${propertyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_results', filter: `property_id=eq.${propertyId}` }, () => {
          fetchHistory()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel);
    };
  }, [propertyId]);

  if (history === undefined) {
      return (
          <div className="bg-slate-800 rounded-lg p-6 text-center">
              <h3 className="font-semibold text-slate-100">Audit History</h3>
              <p className="text-sm text-slate-400 mt-2">Loading history...</p>
          </div>
      );
  }

  if (!history || history.length === 0) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 text-center">
        <h3 className="font-semibold text-slate-100">Audit History</h3>
        <p className="text-sm text-slate-400 mt-2">No past audits found for this property.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg shadow-lg">
      <header className="p-4 border-b border-slate-700">
        <h3 className="font-semibold text-slate-100">Audit History</h3>
      </header>
      <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
        {history.map(audit => {
          const isActive = audit.id === currentAuditId;
          return (
            <div
              key={audit.id}
              className={`p-3 rounded-md transition-colors group ${isActive ? 'bg-cyan-500/20 border border-cyan-500' : 'bg-slate-700/50 hover:bg-slate-700'}`}
            >
              <div className="flex justify-between items-center">
                <div>
                  {/* FIX: Corrected property access from audit.analysisMode to audit.analysis_mode */}
                  <p className="text-sm font-semibold text-slate-200 capitalize">{audit.analysis_mode} Analysis</p>
                  <p className="text-xs text-slate-400">
                    {new Date(audit.timestamp).toLocaleString(undefined, {
                      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                   <button
                    onClick={() => onLoadAudit(audit)}
                    className="text-xs font-semibold text-cyan-400 hover:underline disabled:text-slate-500 disabled:no-underline"
                    disabled={isActive}
                    aria-label="View this audit"
                  >
                    View
                  </button>
                  <button
                    onClick={() => onDeleteAudit(audit.id!)}
                    className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Delete this audit"
                  >
                    <XIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
