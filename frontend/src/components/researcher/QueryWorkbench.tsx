import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, FileText, Layers, Lightbulb, Loader2 } from 'lucide-react';
import { useChat, type ChatMessage } from '../../hooks/useChat';

const RESEARCH_PROMPTS = [
  { label: '🌊 Ocean State', query: 'What are the current ocean conditions near Ratnagiri?' },
  { label: '🐟 PFZ Analysis', query: 'Where is the nearest PFZ from Ratnagiri and what is the SST gradient?' },
  { label: '⚠️ Hazard Survey', query: 'List all active hazard advisories for the Konkan coast today.' },
  { label: '🧭 Route Safety', query: 'Compare the safety of direct vs coastal routes from Ratnagiri to the nearest PFZ.' },
  { label: '📊 Multi-source', query: 'Cross-reference INCOIS wave forecast with IMD coastal bulletin for Ratnagiri.' },
  { label: '🔬 Data Quality', query: 'What is the data freshness and confidence level for current marine observations?' },
];

export default function QueryWorkbench() {
  const chat = useChat();
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat.messages]);

  function handleSend() {
    const text = inputValue.trim();
    if (!text || chat.isLoading) return;
    setInputValue('');
    chat.send(text);
  }

  function handlePrompt(query: string) {
    setInputValue('');
    chat.send(query);
  }

  return (
    <div className="researcher-query-workbench">
      {/* Message Area */}
      <div className="researcher-messages-area">
        {chat.messages.length === 0 ? (
          <div className="researcher-welcome">
            <Bot size={32} className="researcher-welcome-icon" />
            <h3>Research Query Workbench</h3>
            <p>Ask exploratory questions about marine conditions, data sources, and decision reasoning. Full evidence and trace data are shown inline.</p>
            <div className="researcher-prompt-grid">
              {RESEARCH_PROMPTS.map(p => (
                <button
                  key={p.label}
                  className="researcher-prompt-chip"
                  onClick={() => handlePrompt(p.query)}
                >
                  <span className="researcher-prompt-emoji">{p.label.slice(0, 2)}</span>
                  <span>{p.label.slice(2).trim()}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="researcher-message-list">
            {chat.messages.map((msg: ChatMessage) => (
              <div key={msg.id} className={`researcher-message ${msg.role}`}>
                <div className="researcher-message-avatar">
                  {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                </div>
                <div className="researcher-message-content">
                  <div className="researcher-message-text">{msg.content}</div>

                  {msg.isLoading && (
                    <div className="researcher-message-loading">
                      <Loader2 size={14} className="researcher-spinner" />
                      <span>Reasoning…</span>
                    </div>
                  )}

                  {/* Inline Recommendation */}
                  {msg.response?.recommendation && (
                    <div className={`researcher-inline-rec status-${msg.response.recommendation.status.toLowerCase().replace('_', '-')}`}>
                      <div className="researcher-rec-header">
                        <span className={`researcher-status-badge ${msg.response.recommendation.status === 'GO' ? 'go' : msg.response.recommendation.status === 'NO_GO' ? 'no-go' : msg.response.recommendation.status === 'CAUTION' ? 'caution' : 'unknown'}`}>
                          {msg.response.recommendation.status.replace('_', ' ')}
                        </span>
                        <span className="researcher-confidence-badge">
                          Confidence: {msg.response.confidence?.level ?? '—'}
                        </span>
                      </div>
                      {msg.response.recommendation.decisive_factors.length > 0 && (
                        <ul className="researcher-factors-list">
                          {msg.response.recommendation.decisive_factors.map((f, i) => (
                            <li key={i}>{f}</li>
                          ))}
                        </ul>
                      )}
                      <div className="researcher-rec-next">
                        <strong>Next Action:</strong> {msg.response.recommendation.next_action}
                      </div>
                    </div>
                  )}

                  {/* Inline Evidence */}
                  {msg.response?.evidence && msg.response.evidence.length > 0 && (
                    <details className="researcher-inline-evidence">
                      <summary>
                        <FileText size={12} />
                        Evidence ({msg.response.evidence.length} items)
                      </summary>
                      <div className="researcher-evidence-table-wrap">
                        <table className="researcher-table researcher-table-compact">
                          <thead>
                            <tr>
                              <th>Source</th>
                              <th>Metric</th>
                              <th>Value</th>
                              <th>Unit</th>
                              <th>Quality</th>
                            </tr>
                          </thead>
                          <tbody>
                            {msg.response.evidence.map((ev, i) => (
                              <tr key={i}>
                                <td>{ev.source_name}</td>
                                <td>{ev.metric_name ?? '—'}</td>
                                <td className="researcher-cell-mono">{typeof ev.metric_value === 'object' ? JSON.stringify(ev.metric_value) : String(ev.metric_value ?? '—')}</td>
                                <td>{ev.metric_unit ?? '—'}</td>
                                <td>
                                  {ev.quality_flags?.map((f: string) => (
                                    <span key={f} className="researcher-quality-flag">{f}</span>
                                  ))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  )}

                  {/* Inline Trace */}
                  {msg.response?.trace && msg.response.trace.length > 0 && (
                    <details className="researcher-inline-trace">
                      <summary>
                        <Layers size={12} />
                        Agent Trace ({msg.response.trace.length} steps)
                      </summary>
                      <div className="researcher-trace-timeline">
                        {msg.response.trace.map((t, i) => (
                          <div key={i} className={`researcher-trace-step status-${t.status}`}>
                            <span className="researcher-trace-num">{t.step}</span>
                            <span className="researcher-trace-node">{t.node}</span>
                            <span className="researcher-trace-action">{t.action}</span>
                            <span className={`researcher-trace-status ${t.status}`}>{t.status}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}

                  {/* Suggested Follow-ups */}
                  {msg.response?.suggested_followups && msg.response.suggested_followups.length > 0 && (
                    <div className="researcher-followups">
                      <Lightbulb size={12} />
                      {msg.response.suggested_followups.map((f, i) => (
                        <button key={i} className="researcher-followup-chip" onClick={() => handlePrompt(f)}>{f}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Bar */}
      <div className="researcher-input-bar">
        <input
          type="text"
          className="researcher-input"
          placeholder="Ask a research question about marine data, safety thresholds, or decision reasoning…"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          disabled={chat.isLoading}
        />
        <button
          className="researcher-send-btn"
          onClick={handleSend}
          disabled={!inputValue.trim() || chat.isLoading}
          aria-label="Send query"
        >
          {chat.isLoading ? <Loader2 size={16} className="researcher-spinner" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}
