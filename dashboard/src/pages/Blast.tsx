import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Megaphone,
  Upload,
  Keyboard,
  Trash2,
  Users,
  XCircle,
  CheckCircle,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { blastApi, type BulkMessageItem, type BatchStatus as BatchStatusType } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useRole } from '../hooks/useRole';
import { useSessionsQuery } from '../hooks/queries';
import { PageHeader } from '../components/PageHeader';
import './Blast.css';

interface Contact {
  phone: string;
  name?: string;
  selected: boolean;
}

type ImportTab = 'file' | 'manual';
type MessageType = 'text' | 'image' | 'video' | 'audio' | 'document';

// ── Helpers ─────────────────────────────────────────────────────────────

/** Normalise a phone string: strip non-digit (except leading +) */
function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  // Keep leading +, strip everything else except digits
  const plus = trimmed.startsWith('+') ? '+' : '';
  return plus + trimmed.replace(/[^\d]/g, '');
}

/** Parse CSV content into contacts. Auto-detects header row. */
function parseCsv(text: string): Contact[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return [];

  // Detect delimiter
  const delim = lines[0].includes(';') ? ';' : ',';
  const rows = lines.map(l =>
    l.split(delim).map(c => c.trim().replace(/^["']|["']$/g, '')),
  );

  // Try to detect header
  const first = rows[0];
  const phoneIdx = first.findIndex(h => /^(phone|number|hp|nomor|telepon|tel|mobile|cell|wa)$/i.test(h));
  const nameIdx = first.findIndex(h => /^(name|nama|contact|kontak)$/i.test(h));
  const hasHeader = phoneIdx >= 0;

  const dataRows = hasHeader ? rows.slice(1) : rows;
  const pIdx = hasHeader ? phoneIdx : 0;
  const nIdx = hasHeader ? nameIdx : -1;

  const seen = new Set<string>();
  const contacts: Contact[] = [];

  for (const row of dataRows) {
    const raw = row[pIdx];
    if (!raw) continue;
    const phone = normalizePhone(raw);
    if (!phone || phone.length < 7 || seen.has(phone)) continue;
    seen.add(phone);
    contacts.push({
      phone,
      name: nIdx >= 0 ? row[nIdx] || undefined : undefined,
      selected: true,
    });
  }

  return contacts;
}

/** Parse a plain text block (one number per line, or comma/space separated) */
function parseManualInput(text: string): Contact[] {
  // Split by newlines, commas, semicolons, or whitespace
  const tokens = text.split(/[\r\n,;]+/).flatMap(t => t.trim().split(/\s+/));
  const seen = new Set<string>();
  const contacts: Contact[] = [];

  for (const raw of tokens) {
    const phone = normalizePhone(raw);
    if (!phone || phone.length < 7 || seen.has(phone)) continue;
    seen.add(phone);
    contacts.push({ phone, selected: true });
  }

  return contacts;
}

// ── Component ───────────────────────────────────────────────────────────

export function Blast() {
  const { t } = useTranslation();
  useDocumentTitle(t('blast.title'));
  const { canWrite } = useRole();
  const { data: allSessions = [], isLoading: loadingSessions } = useSessionsQuery();
  const sessions = allSessions.filter(s => s.status === 'ready');

  // ── State ───────────────────────────────────────────────────────────
  const [importTab, setImportTab] = useState<ImportTab>('file');
  const [dragging, setDragging] = useState(false);
  const [manualText, setManualText] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);

  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [msgType, setMsgType] = useState<MessageType>('text');
  const [messageText, setMessageText] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [delay, setDelay] = useState(3);
  const [randomize, setRandomize] = useState(true);

  const [sending, setSending] = useState(false);
  const [activeBatches, setActiveBatches] = useState<Array<{ sessionId: string; batchId: string }>>([]);
  const [batchStatus, setBatchStatus] = useState<BatchStatusType | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // auto-select first ready session
  useEffect(() => {
    if (sessions.length > 0 && selectedSessions.length === 0) {
      setSelectedSessions([sessions[0].id]);
    }
  }, [sessions, selectedSessions]);

  // cleanup polling on unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // ── Import handlers ─────────────────────────────────────────────────

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const ext = file.name.split('.').pop()?.toLowerCase();
      const parsed = ext === 'csv' ? parseCsv(text) : parseManualInput(text);
      setContacts(prev => {
        const existing = new Set(prev.map(c => c.phone));
        return [...prev, ...parsed.filter(c => !existing.has(c.phone))];
      });
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleAddManual = useCallback(() => {
    const parsed = parseManualInput(manualText);
    setContacts(prev => {
      const existing = new Set(prev.map(c => c.phone));
      return [...prev, ...parsed.filter(c => !existing.has(c.phone))];
    });
    setManualText('');
  }, [manualText]);

  const toggleContact = (phone: string) => {
    setContacts(prev => prev.map(c => c.phone === phone ? { ...c, selected: !c.selected } : c));
  };

  const toggleAll = () => {
    const allSelected = contacts.every(c => c.selected);
    setContacts(prev => prev.map(c => ({ ...c, selected: !allSelected })));
  };

  const removeContact = (phone: string) => {
    setContacts(prev => prev.filter(c => c.phone !== phone));
  };

  const clearContacts = () => setContacts([]);

  const toggleSession = (id: string) => {
    setSelectedSessions(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // ── Send Blast ──────────────────────────────────────────────────────

  const selectedContacts = contacts.filter(c => c.selected);

  const handleSend = async () => {
    if (selectedSessions.length === 0 || selectedContacts.length === 0) return;
    setSending(true);
    setBatchStatus(null);

    try {
      // 1. Build messages payload
      const messages: BulkMessageItem[] = [];
      for (const contact of selectedContacts) {
        const digits = contact.phone.replace(/[^0-9]/g, '');
        const chatId = `${digits}@c.us`;

        const item: BulkMessageItem = {
          chatId,
          type: msgType,
          content: {},
        };

        if (msgType === 'text') {
          item.content.text = messageText;
        } else {
          item.content[msgType] = { url: mediaUrl };
          if (messageText) item.content.caption = messageText;
        }

        if (contact.name) {
          item.variables = { name: contact.name, phone: contact.phone };
        }

        messages.push(item);
      }

      // 2. Distribute messages across selected sessions (Round-Robin / Even Split)
      const numSessions = selectedSessions.length;
      const sessionQueues: Record<string, BulkMessageItem[]> = {};
      selectedSessions.forEach(id => { sessionQueues[id] = []; });

      messages.forEach((msg, idx) => {
        const assignedSessionId = selectedSessions[idx % numSessions];
        sessionQueues[assignedSessionId].push(msg);
      });

      // 3. Trigger bulk-send on backend for each session in parallel
      const activeList: Array<{ sessionId: string; batchId: string }> = [];
      const batchPromises = Object.entries(sessionQueues).map(async ([sessId, sessMsgs]) => {
        if (sessMsgs.length === 0) return;
        const batch = await blastApi.sendBulk(sessId, sessMsgs, {
          delayBetweenMessages: delay * 1000,
          randomizeDelay: randomize,
        });
        activeList.push({ sessionId: sessId, batchId: batch.batchId });
      });

      await Promise.all(batchPromises);
      setActiveBatches(activeList);

      // Initialize combined status
      const initialProgress = { total: messages.length, sent: 0, failed: 0, pending: messages.length };
      setBatchStatus({
        batchId: 'combined-multisession',
        status: 'processing',
        progress: initialProgress,
        results: [],
      });

      // 4. Start combined status polling
      pollRef.current = setInterval(async () => {
        try {
          const pollPromises = activeList.map(async (item) => {
            try {
              return await blastApi.getBatchStatus(item.sessionId, item.batchId);
            } catch {
              return null;
            }
          });

          const statuses = (await Promise.all(pollPromises)).filter((s): s is NonNullable<typeof s> => s !== null);

          if (statuses.length > 0) {
            const combinedResults: Exclude<BatchStatusType['results'], undefined> = [];
            let totalSent = 0;
            let totalFailed = 0;
            let totalPending = 0;
            let allCompleted = true;
            let hasCancelled = false;
            let hasFailed = false;

            statuses.forEach(s => {
              totalSent += s.progress.sent;
              totalFailed += s.progress.failed;
              totalPending += s.progress.pending;

              if (s.results) {
                combinedResults.push(...s.results);
              }

              if (s.status === 'processing' || s.status === 'pending') {
                allCompleted = false;
              }
              if (s.status === 'cancelled') {
                hasCancelled = true;
              }
              if (s.status === 'failed') {
                hasFailed = true;
              }
            });

            const overallStatus = allCompleted
              ? (hasCancelled ? 'cancelled' : (hasFailed && totalSent === 0 ? 'failed' : 'completed'))
              : 'processing';

            setBatchStatus({
              batchId: 'combined-multisession',
              status: overallStatus as any,
              progress: {
                total: messages.length,
                sent: totalSent,
                failed: totalFailed,
                pending: totalPending,
              },
              results: combinedResults,
            });

            if (allCompleted) {
              clearInterval(pollRef.current);
              setSending(false);
            }
          }
        } catch {
          // keep polling
        }
      }, 2000);

    } catch (err) {
      setSending(false);
      setBatchStatus({
        batchId: '',
        status: 'failed',
        progress: { total: 0, sent: 0, failed: 0, pending: 0 },
      });
    }
  };

  const handleCancel = async () => {
    if (activeBatches.length === 0) return;
    try {
      const cancelPromises = activeBatches.map(item =>
        blastApi.cancelBatch(item.sessionId, item.batchId).catch(() => null)
      );
      await Promise.all(cancelPromises);
    } catch { /* ignore */ }
  };

  // ── Progress helpers ────────────────────────────────────────────────

  const progress = batchStatus?.progress;
  const progressPct = progress ? Math.round(((progress.sent + progress.failed) / Math.max(progress.total, 1)) * 100) : 0;
  const successPct = progress ? Math.round((progress.sent / Math.max(progress.sent + progress.failed, 1)) * 100) : 100;

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="blast-page">
      <PageHeader
        title={t('blast.title')}
        subtitle={t('blast.subtitle')}
      />

      <div className="blast-panels">
        {/* ── Left: Import Contacts ─────────────────────────────────── */}
        <div className="blast-panel">
          <h2>{t('blast.importContacts')}</h2>

          <div className="import-tabs">
            <button
              className={importTab === 'file' ? 'active' : ''}
              onClick={() => setImportTab('file')}
            >
              <Upload size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
              {t('blast.fileImport')}
            </button>
            <button
              className={importTab === 'manual' ? 'active' : ''}
              onClick={() => setImportTab('manual')}
            >
              <Keyboard size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
              {t('blast.manualInput')}
            </button>
          </div>

          {importTab === 'file' ? (
            <>
              <div
                className={`drop-zone ${dragging ? 'dragging' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="drop-zone-icon"><Upload size={32} /></div>
                <p>{t('blast.dropZone')}</p>
                <p className="hint">{t('blast.dropZoneHint')}</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt,.text"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                    e.target.value = '';
                  }}
                />
              </div>
            </>
          ) : (
            <div className="manual-input">
              <textarea
                value={manualText}
                onChange={e => setManualText(e.target.value)}
                placeholder={t('blast.manualPlaceholder')}
              />
              <span className="hint">{t('blast.manualHint')}</span>
              <div className="import-actions">
                <button
                  className="import-btn primary"
                  onClick={handleAddManual}
                  disabled={!manualText.trim()}
                >
                  {t('blast.addContacts')}
                </button>
              </div>
            </div>
          )}

          {/* Contact List */}
          {contacts.length > 0 ? (
            <>
              <div className="contact-summary">
                <span>
                  <span className="count">{selectedContacts.length}</span> / {contacts.length} {t('blast.selected')}
                </span>
                <button onClick={clearContacts}>
                  <Trash2 size={12} style={{ marginRight: 4, verticalAlign: -2 }} />
                  {t('blast.clearAll')}
                </button>
              </div>
              <div className="contact-table-wrap">
                <table className="contact-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>
                        <input
                          type="checkbox"
                          checked={contacts.every(c => c.selected)}
                          onChange={toggleAll}
                        />
                      </th>
                      <th>{t('blast.phone')}</th>
                      <th>{t('blast.name')}</th>
                      <th style={{ width: 40 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map(c => (
                      <tr key={c.phone}>
                        <td>
                          <input
                            type="checkbox"
                            checked={c.selected}
                            onChange={() => toggleContact(c.phone)}
                          />
                        </td>
                        <td className="phone-cell">{c.phone}</td>
                        <td>{c.name || '—'}</td>
                        <td>
                          <button className="remove-btn" onClick={() => removeContact(c.phone)}>
                            <XCircle size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="empty-contacts">
              <Users size={40} />
              <p>{t('blast.noContacts')}</p>
            </div>
          )}
        </div>

        {/* ── Right: Compose & Send ─────────────────────────────────── */}
        <div className="blast-panel">
          <h2>{t('blast.composeMessage')}</h2>

          <div className="blast-form-group">
            <label>{t('blast.session')} (Multi-select)</label>
            {loadingSessions ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                <Loader2 size={14} className="animate-spin" style={{ marginRight: 6 }} />
                {t('blast.loadingSessions')}
              </div>
            ) : sessions.length === 0 ? (
              <div style={{ color: '#D97706', fontSize: '0.875rem' }}>
                <AlertTriangle size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                {t('blast.noReadySessions')}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '150px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0.75rem' }}>
                {sessions.map(s => (
                  <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 'normal', textTransform: 'none' }}>
                    <input
                      type="checkbox"
                      checked={selectedSessions.includes(s.id)}
                      onChange={() => toggleSession(s.id)}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                    />
                    <span>{s.name || s.id} {s.phone ? `(${s.phone})` : ''}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="blast-form-group">
            <label>{t('blast.messageType')}</label>
            <select value={msgType} onChange={e => setMsgType(e.target.value as MessageType)}>
              <option value="text">{t('blast.typeText')}</option>
              <option value="image">{t('blast.typeImage')}</option>
              <option value="video">{t('blast.typeVideo')}</option>
              <option value="audio">{t('blast.typeAudio')}</option>
              <option value="document">{t('blast.typeDocument')}</option>
            </select>
          </div>

          {msgType !== 'text' && (
            <div className="blast-form-group">
              <label>{t('blast.mediaUrl')}</label>
              <input
                type="url"
                value={mediaUrl}
                onChange={e => setMediaUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
              />
            </div>
          )}

          <div className="blast-form-group">
            <label>{msgType === 'text' ? t('blast.messageContent') : t('blast.caption')}</label>
            <textarea
              value={messageText}
              onChange={e => setMessageText(e.target.value)}
              placeholder={t('blast.messagePlaceholder')}
            />
            <span className="hint">{t('blast.variableHint')}</span>
          </div>

          <div className="blast-form-group">
            <label>{t('blast.delay')}</label>
            <div className="delay-row">
              <input
                type="number"
                min={1}
                max={60}
                value={delay}
                onChange={e => setDelay(Math.max(1, Math.min(60, Number(e.target.value))))}
              />
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={randomize}
                  onChange={e => setRandomize(e.target.checked)}
                />
                {t('blast.randomize')}
              </label>
            </div>
            <span className="hint">{t('blast.delayHint')}</span>
          </div>

          {sending && activeBatches.length > 0 ? (
            <button className="blast-send-btn cancel" onClick={handleCancel}>
              <XCircle size={18} />
              {t('blast.cancelBlast')}
            </button>
          ) : (
            <button
              className="blast-send-btn"
              disabled={!canWrite || selectedSessions.length === 0 || selectedContacts.length === 0 || !messageText.trim() || sending}
              onClick={handleSend}
            >
              {sending ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Megaphone size={18} />
              )}
              {sending ? t('blast.sending') : t('blast.sendBlast', { count: selectedContacts.length })}
            </button>
          )}

          {/* ── Progress ──────────────────────────────────────────── */}
          {batchStatus && (
            <div className="blast-progress">
              <div className="progress-header">
                <h3>
                  {batchStatus.status === 'completed' && <CheckCircle size={16} color="var(--primary)" />}
                  {batchStatus.status === 'failed' && <XCircle size={16} color="#DC2626" />}
                  {batchStatus.status === 'cancelled' && <AlertTriangle size={16} color="#D97706" />}
                  {batchStatus.status === 'processing' && <Loader2 size={16} className="animate-spin" />}
                  {t('blast.batchProgress')}
                </h3>
                <span className={`progress-status ${batchStatus.status}`}>
                  {batchStatus.status}
                </span>
              </div>

              <div className="progress-bar-track">
                <div
                  className={`progress-bar-fill ${progress && progress.failed > 0 ? 'has-failures' : ''}`}
                  style={{
                    width: `${progressPct}%`,
                    '--success-pct': `${successPct}%`,
                  } as React.CSSProperties}
                />
              </div>

              <div className="progress-stats">
                <div className="progress-stat">
                  <span className="dot sent" />
                  <span>{t('blast.sent')}</span>
                  <strong>{progress?.sent ?? 0}</strong>
                </div>
                <div className="progress-stat">
                  <span className="dot failed" />
                  <span>{t('blast.failed')}</span>
                  <strong>{progress?.failed ?? 0}</strong>
                </div>
                <div className="progress-stat">
                  <span className="dot pending" />
                  <span>{t('blast.pending')}</span>
                  <strong>{progress?.pending ?? 0}</strong>
                </div>
              </div>

              {/* Results */}
              {batchStatus.results && batchStatus.results.length > 0 && (
                <div className="results-section">
                  <h3>{t('blast.results')}</h3>
                  <div className="results-table-wrap">
                    <table className="results-table">
                      <thead>
                        <tr>
                          <th>{t('blast.recipient')}</th>
                          <th>{t('blast.status')}</th>
                          <th>{t('blast.detail')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {batchStatus.results.map((r, i) => (
                          <tr key={i}>
                            <td className="phone-cell">{r.chatId.replace('@c.us', '')}</td>
                            <td>
                              <span className={`status-badge ${r.status === 'sent' ? 'sent' : 'failed'}`}>
                                {r.status === 'sent' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                                {r.status}
                              </span>
                            </td>
                            <td>{r.error?.message || r.messageId || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Blast;
