import { useState, useEffect, useRef } from 'react';
import { ApiService } from '../../services/api-service';
import type { GmailThreadPreview, ConversationResponse } from '../../types/app';
import '../../styles/AddItemModal.css';

// ── AddGmailThreadModal ──────────────────────────────────────
// Purpose: The "browse your Gmail and pick which threads to track" picker — nothing syncs
// automatically (see GmailThreadController on the backend for why), so this is the only way a
// thread ever starts being tracked. Unlike AssignTravelerModal/LinkTripModal, the list here is
// server-driven (Gmail search, not something to replicate client-side) and a thread stays
// visible with an "✓ Added" state after adding rather than closing the modal — an agent
// typically wants to pick several threads in one pass.
// Props: open, onClose, onAdded(conversation) — called once per successful add.
interface Props {
  open: boolean;
  onClose: () => void;
  onAdded: (conversation: ConversationResponse) => void;
}

export default function AddGmailThreadModal({ open, onClose, onAdded }: Props) {
  const [query, setQuery] = useState('');
  const [threads, setThreads] = useState<GmailThreadPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runBrowse = (q: string) => {
    setLoading(true);
    setError('');
    ApiService.browseGmailThreads(q || undefined)
      .then(r => setThreads(r.threads))
      .catch(err => {
        setThreads([]);
        setError(err?.response?.data?.message || 'Could not load Gmail threads.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setAddedIds(new Set());
    runBrowse('');
  }, [open]);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runBrowse(value), 400);
  };

  if (!open) return null;

  const handleAdd = async (threadId: string) => {
    setAddingId(threadId);
    setError('');
    try {
      const conversation = await ApiService.addGmailThread(threadId);
      setAddedIds(prev => new Set(prev).add(threadId));
      onAdded(conversation);
    } catch {
      setError('Could not add that thread.');
    } finally {
      setAddingId(null);
    }
  };

  const fmtDate = (d: string | null) => {
    if (!d) return '';
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? '' : parsed.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="aim-overlay" onClick={onClose}>
      <div className="aim-modal" onClick={e => e.stopPropagation()}>
        <div className="aim-header">
          <h2 className="aim-title">Add a Gmail thread</h2>
          <button className="aim-close" onClick={onClose}>✕</button>
        </div>

        <div className="aim-body">
          <label className="aim-label">Search your Gmail</label>
          <input
            className="aim-input"
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            placeholder="Search by sender, subject, keyword..."
            autoFocus
          />

          {error && <p className="afm-error">{error}</p>}

          <div className="aim-dest-dropdown" style={{ position: 'static', margin: 0, maxHeight: 320, overflowY: 'auto' }}>
            {loading ? (
              <div className="aim-dest-opt" style={{ cursor: 'default' }}>
                <span className="aim-dest-country">Loading…</span>
              </div>
            ) : threads.length === 0 && !error ? (
              <div className="aim-dest-opt" style={{ cursor: 'default' }}>
                <span className="aim-dest-country">
                  {query ? `No threads match "${query}".` : 'No untracked threads found.'}
                </span>
              </div>
            ) : threads.map(t => {
              const added = addedIds.has(t.thread_id);
              return (
                <div key={t.thread_id} className={'aim-dest-opt' + (added ? ' aim-dest-opt--disabled' : '')} style={{ alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="aim-dest-name">{t.subject || '(no subject)'}</div>
                    <div className="aim-dest-country">
                      {t.from_name || t.from_email || 'Unknown sender'}{t.date ? ` · ${fmtDate(t.date)}` : ''}
                    </div>
                    {t.snippet && (
                      <div style={{ fontSize: 12, color: '#8A90A2', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.snippet}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className={added ? 'aim-dest-create-cancel' : 'aim-dest-create-confirm'}
                    style={{ flexShrink: 0, marginLeft: 12 }}
                    disabled={added || addingId === t.thread_id}
                    onClick={() => handleAdd(t.thread_id)}
                  >
                    {added ? '✓ Added' : addingId === t.thread_id ? 'Adding…' : 'Add'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="aim-footer">
          <button className="aim-cancel" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
