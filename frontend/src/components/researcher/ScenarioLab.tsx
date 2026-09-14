import { useState, useEffect } from 'react';
import {
  FlaskConical, Play, CheckCircle2, AlertTriangle,
  Loader2, ChevronRight, BarChart3,
} from 'lucide-react';
import { fetchScenarios, runScenario, type ScenarioMeta, type ScenarioRunResult } from '../../api/researcher-client';

function StatusBadge({ status }: { status?: string }) {
  const safeStatus = status || 'UNKNOWN';
  const cls = safeStatus === 'GO' ? 'go' : safeStatus === 'NO_GO' ? 'no-go' : safeStatus === 'CAUTION' ? 'caution' : 'unknown';
  return <span className={`researcher-status-badge ${cls}`}>{safeStatus.replace('_', ' ')}</span>;
}

export default function ScenarioLab() {
  const [scenarios, setScenarios] = useState<ScenarioMeta[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, ScenarioRunResult>>({});
  const [runningId, setRunningId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadScenarios();
  }, []);

  async function loadScenarios() {
    setLoading(true);
    try {
      const s = await fetchScenarios();
      setScenarios(s);
      if (s.length > 0 && !selectedId) setSelectedId(s[0].id);
    } finally {
      setLoading(false);
    }
  }

  async function handleRun(scenarioId: string) {
    setRunningId(scenarioId);
    try {
      const result = await runScenario(scenarioId);
      setResults(prev => ({ ...prev, [scenarioId]: result }));
    } finally {
      setRunningId(null);
    }
  }

  async function handleRunAll() {
    for (const s of scenarios) {
      setRunningId(s.id);
      setSelectedId(s.id);
      try {
        const result = await runScenario(s.id);
        setResults(prev => ({ ...prev, [s.id]: result }));
      } catch { /* continue */ }
    }
    setRunningId(null);
  }

  const selected = scenarios.find(s => s.id === selectedId);
  const selectedResult = selectedId ? results[selectedId] : undefined;

  if (loading) {
    return (
      <div className="researcher-loading">
        <Loader2 size={20} className="researcher-spinner" />
        <span>Loading scenarios…</span>
      </div>
    );
  }

  return (
    <div className="researcher-scenario-lab">
      {/* Scenario List Panel */}
      <div className="researcher-scenario-list-panel">
        <div className="researcher-scenario-list-header">
          <h3><FlaskConical size={14} /> Evaluation Suite (S1–S8)</h3>
          <button
            className="researcher-run-all-btn"
            onClick={handleRunAll}
            disabled={runningId !== null}
          >
            <Play size={12} />
            Run All
          </button>
        </div>
        <div className="researcher-scenario-cards">
          {scenarios.map(s => (
            <button
              key={s.id}
              className={`researcher-scenario-card ${selectedId === s.id ? 'active' : ''} ${results[s.id] ? 'has-result' : ''}`}
              onClick={() => setSelectedId(s.id)}
            >
              <div className="researcher-scenario-card-top">
                <span className="researcher-scenario-id">{s.id}</span>
                <span className="researcher-scenario-name">{s.name}</span>
                {results[s.id] && <StatusBadge status={results[s.id]?.recommendation_status} />}
                {runningId === s.id && <Loader2 size={12} className="researcher-spinner" />}
              </div>
              <ChevronRight size={14} className="researcher-scenario-chevron" />
            </button>
          ))}
        </div>
      </div>

      {/* Detail & Results Panel */}
      <div className="researcher-scenario-detail-panel">
        {selected ? (
          <>
            <div className="researcher-scenario-detail-header">
              <div>
                <h3>{selected.id}: {selected.name}</h3>
                <p className="researcher-scenario-desc">{selected.description}</p>
              </div>
              <button
                className="researcher-run-btn"
                onClick={() => handleRun(selected.id)}
                disabled={runningId !== null}
              >
                {runningId === selected.id ? (
                  <><Loader2 size={14} className="researcher-spinner" /> Executing…</>
                ) : (
                  <><Play size={14} /> Run Scenario</>
                )}
              </button>
            </div>

            {/* Scenario Input */}
            <div className="researcher-scenario-input">
              <span className="researcher-input-label">Query Input</span>
              <div className="researcher-scenario-query">{selected.query}</div>
              <div className="researcher-scenario-meta-row">
                <span>Intent: <strong>{selected.intent}</strong></span>
                <span>Expected: <StatusBadge status={selected.expected_status} /></span>
                {selected.harbor && <span>Harbor: <strong>{selected.harbor}</strong></span>}
              </div>
            </div>

            {/* Results */}
            {selectedResult && (
              <div className="researcher-scenario-results">
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <h4 className="researcher-results-title">
                    <BarChart3 size={14} />
                    Execution Results
                  </h4>
                  {selectedResult.passed !== undefined && (
                    <span className={`researcher-verdict-badge ${selectedResult.passed ? 'pass' : 'fail'}`}>
                      {selectedResult.passed ? 'PASS' : 'FAIL'}
                    </span>
                  )}
                </div>

                {selectedResult.is_error ? (
                  <div className="researcher-scenario-error-card">
                    <div className="researcher-scenario-error-header">
                      <AlertTriangle size={18} />
                      <div>
                        <strong>Scenario Execution Unavailable</strong>
                        <p>{selectedResult.answer}</p>
                      </div>
                    </div>
                    {selectedResult.warnings.length > 0 && (
                      <div className="researcher-result-warnings">
                        <span className="researcher-input-label">Error Details</span>
                        {selectedResult.warnings.map((w, i) => (
                          <div key={i} className="researcher-warning-item">
                            <AlertTriangle size={12} /> {w}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {/* KPI Row */}
                    <div className="researcher-result-kpis">
                      <div className="researcher-result-kpi">
                        <span className="researcher-kpi-label">Status</span>
                        <StatusBadge status={selectedResult?.recommendation_status} />
                      </div>
                      <div className="researcher-result-kpi">
                        <span className="researcher-kpi-label">Confidence</span>
                        <span className="researcher-kpi-value">{selectedResult?.confidence_level || 'UNKNOWN'}</span>
                      </div>
                      <div className="researcher-result-kpi">
                        <span className="researcher-kpi-label">Evidence</span>
                        <span className="researcher-kpi-value">{selectedResult?.evidence_count ?? 0} items</span>
                      </div>
                      <div className="researcher-result-kpi">
                        <span className="researcher-kpi-label">Trace</span>
                        <span className="researcher-kpi-value">{selectedResult?.trace_steps ?? 0} steps</span>
                      </div>
                      <div className="researcher-result-kpi">
                        <span className="researcher-kpi-label">Latency</span>
                        <span className="researcher-kpi-value">{selectedResult?.execution_time_ms ?? 0}ms</span>
                      </div>
                    </div>

                    {/* Answer */}
                    <div className="researcher-result-answer">
                      <span className="researcher-input-label">Response</span>
                      <p>{selectedResult?.answer || 'Evaluation completed successfully.'}</p>
                    </div>

                    {/* Executed Tools */}
                    {selectedResult.executed_tools && selectedResult.executed_tools.length > 0 && (
                      <div className="researcher-result-tools">
                        <span className="researcher-input-label">Executed Tools ({selectedResult.executed_tools.length})</span>
                        <div className="researcher-tools-list">
                          {selectedResult.executed_tools.map((tool, i) => (
                            <span key={i} className="researcher-tool-tag">{tool}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Decisive Factors */}
                    {selectedResult.decisive_factors && selectedResult.decisive_factors.length > 0 && (
                      <div className="researcher-result-factors">
                        <span className="researcher-input-label">Decisive Factors / Validation</span>
                        <ul>
                          {selectedResult.decisive_factors.map((f, i) => (
                            <li key={i}><CheckCircle2 size={12} /> {f}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Warnings */}
                    {(selectedResult?.warnings || []).length > 0 && (
                      <div className="researcher-result-warnings">
                        <span className="researcher-input-label">Warnings</span>
                        {(selectedResult?.warnings || []).map((w, i) => (
                          <div key={i} className="researcher-warning-item">
                            <AlertTriangle size={12} /> {w}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {!selectedResult && !runningId && (
              <div className="researcher-empty-results">
                <FlaskConical size={24} />
                <p>Click <strong>Run Scenario</strong> to execute this evaluation through the SAMUDRA pipeline.</p>
              </div>
            )}
          </>
        ) : (
          <div className="researcher-empty-results">
            <FlaskConical size={24} />
            <p>Select a scenario to view details and run evaluations.</p>
          </div>
        )}
      </div>
    </div>
  );
}
