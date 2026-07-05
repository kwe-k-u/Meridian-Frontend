import { useApp } from '../../contexts/AppContext';
import { connectPickList, connectChannelView } from '../../constants/app';

const keyframes = `
@keyframes mfloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}
@keyframes mbar {
  0% { width: 0; }
  50% { width: 65%; }
  100% { width: 100%; }
}
@keyframes mspin {
  to { transform: rotate(360deg); }
}
`;

const s: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed', inset: 0, background: 'rgba(16,18,36,.5)',
    backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)',
    zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  card: {
    width: '100%', maxWidth: 520, background: '#fff', borderRadius: 20,
    boxShadow: '0 8px 40px rgba(0,0,0,.12)', overflow: 'hidden',
  },
  body: { padding: '32px 32px 24px' },
  footer: { padding: '0 32px 32px', display: 'flex', gap: 12, justifyContent: 'flex-end' },
  title: { fontSize: 22, fontWeight: 700, color: '#16143A', margin: 0, marginBottom: 4 },
  sub: { fontSize: 14, color: '#8A90A2', margin: 0, marginBottom: 24 },
  pickItem: {
    display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
    borderRadius: 12, border: '1px solid #ECEDF2', cursor: 'pointer',
    marginBottom: 10,
  },
  pickIcon: {
    width: 40, height: 40, borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 18, flexShrink: 0,
  },
  pickInfo: { flex: 1 },
  pickName: { fontSize: 15, fontWeight: 600, color: '#16143A' },
  pickSub: { fontSize: 13, color: '#8A90A2', marginTop: 2 },
  chevron: { color: '#C4C9D4', fontSize: 18 },
  authHeader: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 },
  authIcon: {
    width: 44, height: 44, borderRadius: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
  },
  authTitle: { fontSize: 18, fontWeight: 700, color: '#16143A', margin: 0 },
  authBody: { fontSize: 14, color: '#5B6172', lineHeight: 1.6, marginBottom: 24 },
  qrWrap: {
    width: 200, height: 200, margin: '0 auto 24px',
    background: '#fff', border: '2px solid #ECEDF2', borderRadius: 16,
    display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  qrPattern: {
    width: 160, height: 160,
    background: `
      linear-gradient(90deg, #16143A 2px, transparent 1%) 0 0 / 20px 20px,
      linear-gradient(0deg, #16143A 2px, transparent 1%) 0 0 / 20px 20px
    `,
    borderRadius: 8,
  },
  qrCenter: {
    position: 'absolute', width: 44, height: 44, borderRadius: 10,
    background: '#E3F7EF', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 22,
  },
  accountList: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 },
  accountItem: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
    borderRadius: 10, border: '1px solid #ECEDF2',
  },
  radio: {
    width: 18, height: 18, borderRadius: '50%', border: '2px solid #C4C9D4',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  radioInner: { width: 10, height: 10, borderRadius: '50%', background: '#2B63F6' },
  acctName: { fontSize: 14, fontWeight: 600, color: '#16143A' },
  acctEmail: { fontSize: 13, color: '#8A90A2' },
  btnSecondary: {
    padding: '10px 20px', borderRadius: 10, border: '1px solid #DDE0E8',
    background: '#fff', color: '#5B6172', fontSize: 14, fontWeight: 600,
    cursor: 'pointer',
  },
  btnPrimary: {
    padding: '10px 20px', borderRadius: 10, border: 'none',
    background: '#2B63F6', color: '#fff', fontSize: 14, fontWeight: 600,
    cursor: 'pointer',
  },
  centered: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 32px' },
  syncIcon: {
    fontSize: 36, marginBottom: 16,
    animation: 'mfloat 2s ease-in-out infinite',
  },
  syncTitle: { fontSize: 18, fontWeight: 700, color: '#16143A', margin: 0, marginBottom: 4 },
  syncSub: { fontSize: 14, color: '#8A90A2', margin: 0, marginBottom: 28 },
  progressWrap: {
    width: '100%', height: 6, background: '#EEF0F4', borderRadius: 3,
    marginBottom: 24, overflow: 'hidden',
  },
  progressBar: {
    height: '100%', background: '#2B63F6', borderRadius: 3,
    animation: 'mbar 2.4s ease-in-out forwards',
  },
  checklist: { display: 'flex', flexDirection: 'column', gap: 12, width: '100%' },
  checkItem: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#5B6172' },
  checkIcon: { color: '#0E9F6E', fontSize: 16, fontWeight: 700 },
  spinner: {
    width: 16, height: 16, border: '2px solid #DDE0E8', borderTopColor: '#2B63F6',
    borderRadius: '50%', animation: 'mspin .6s linear infinite', flexShrink: 0,
  },
  successIcon: {
    width: 56, height: 56, borderRadius: '50%', background: '#E3F7EF',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 28, color: '#0E9F6E', marginBottom: 16,
  },
  successTitle: { fontSize: 20, fontWeight: 700, color: '#16143A', margin: 0, marginBottom: 8 },
  doneStats: { fontSize: 14, color: '#8A90A2', margin: 0, marginBottom: 20, textAlign: 'center' as const },
  contactList: { display: 'flex', flexDirection: 'column', gap: 8, width: '100%', marginBottom: 12 },
  contactItem: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
    borderRadius: 10, border: '1px solid #ECEDF2',
  },
  avatar: {
    width: 36, height: 36, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0,
  },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 14, fontWeight: 600, color: '#16143A' },
  contactSource: { fontSize: 12, color: '#8A90A2', marginTop: 1 },
  tag: {
    fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
    flexShrink: 0,
  },
  moreText: { fontSize: 13, color: '#8A90A2', marginBottom: 24 },
};

const acctOptions = [
  { name: 'Oasis Travel', email: 'bookings@oasistravel.com' },
  { name: 'Personal', email: 'kweku.ansah@gmail.com' },
];

// ── ConnectChannelModal ──────────────────────────────────────
// Purpose: Multi-step modal to connect an external messaging channel (WhatsApp/Gmail/Instagram).
// Props: none (reads/writes all step state from AppContext)
// This entire flow is a UI simulation — pick/auth/sync/done are just local state transitions
// timed with setTimeout in AppContext (connectGo() etc.), with hardcoded fake "142 chats
// synced" style copy from connectChannelView() in constants/app.ts. There's no real
// WhatsApp/Gmail/Instagram OAuth or API integration behind any of it yet.
export default function ConnectChannelModal() {
  const {
    connectOpen, connectChannel, ccPickList, ccAuth, ccSync, ccDone,
    closeConnect, pickChannel, connectGo, finishConnect,
  } = useApp();

  if (!connectOpen) return null;

  const list = connectPickList(pickChannel);
  const view = connectChannelView(connectChannel);

  return (
    <>
      <style>{keyframes}</style>
      <div style={s.backdrop} onClick={closeConnect}>
        <div style={s.card} onClick={e => e.stopPropagation()}>
          {ccPickList && (
            <div style={s.body}>
              <h2 style={s.title}>Connect a channel</h2>
              <p style={s.sub}>Bring your client conversations...</p>
              {list.map(item => (
                <div key={item.name} style={s.pickItem} onClick={item.pick}>
                  <div style={{ ...s.pickIcon, background: item.iconBg }}>{item.icon}</div>
                  <div style={s.pickInfo}>
                    <div style={s.pickName}>{item.name}</div>
                    <div style={s.pickSub}>{item.sub}</div>
                  </div>
                  <span style={s.chevron}>›</span>
                </div>
              ))}
            </div>
          )}
          {ccAuth && view && (
            <>
              <div style={s.body}>
                <div style={s.authHeader}>
                  <div style={{ ...s.authIcon, background: view.iconBg }}>{view.icon}</div>
                  <h2 style={s.authTitle}>{view.authTitle}</h2>
                </div>
                <p style={s.authBody}>{view.authBody}</p>
                {view.isQr && (
                  <div style={s.qrWrap}>
                    <div style={s.qrPattern} />
                    <div style={s.qrCenter}>{view.icon}</div>
                  </div>
                )}
                {view.isAccount && (
                  <div style={s.accountList}>
                    {acctOptions.map(a => (
                      <div key={a.email} style={s.accountItem}>
                        <div style={s.radio}>
                          <div style={s.radioInner} />
                        </div>
                        <div>
                          <div style={s.acctName}>{a.name}</div>
                          <div style={s.acctEmail}>{a.email}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={s.footer}>
                <button style={s.btnSecondary} onClick={closeConnect}>Cancel</button>
                <button style={s.btnPrimary} onClick={connectGo}>{view.cta}</button>
              </div>
            </>
          )}
          {ccSync && view && (
            <div style={s.centered}>
              <div style={s.syncIcon}>{view.icon}</div>
              <h2 style={s.syncTitle}>Syncing {view.short}…</h2>
              <p style={s.syncSub}>We're pulling your conversations and contacts.</p>
              <div style={s.progressWrap}>
                <div style={s.progressBar} />
              </div>
              <div style={s.checklist}>
                <div style={s.checkItem}>
                  <span style={s.checkIcon}>✓</span>
                  <span>Linked your account</span>
                </div>
                <div style={s.checkItem}>
                  <span style={s.checkIcon}>✓</span>
                  <span>Pulled {view.synced} into your inbox</span>
                </div>
                <div style={s.checkItem}>
                  <div style={s.spinner} />
                  <span>Matching contacts to travelers…</span>
                </div>
              </div>
            </div>
          )}
          {ccDone && view && (
            <div style={s.centered}>
              <div style={s.successIcon}>✓</div>
              <h2 style={s.successTitle}>{view.short} connected</h2>
              <p style={s.doneStats}>
                {view.synced} · {view.createdLabel} · {view.reviewLabel}
              </p>
              <div style={s.contactList}>
                {view.contacts.slice(0, 4).map(c => (
                  <div key={c.name} style={s.contactItem}>
                    <div style={{ ...s.avatar, background: c.avatarBg }}>{c.initials}</div>
                    <div style={s.contactInfo}>
                      <div style={s.contactName}>{c.name}</div>
                      <div style={s.contactSource}>{c.source}</div>
                    </div>
                    <div style={{ ...s.tag, background: c.tagBg, color: c.tagFg }}>{c.tag}</div>
                  </div>
                ))}
              </div>
              <div style={s.moreText}>{view.moreLabel}</div>
              <button style={s.btnPrimary} onClick={finishConnect}>Done</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
