import { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  Play,
  Layers,
  Activity,
  FileCheck2,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';
import {
  getDemoScenarios,
  runScenario,
  type DemoScenario,
  type ScenarioBenchmarkResult,
} from '../../api/client';
import type { SupportedLanguage } from '../../i18n/translations';

interface ScenarioBenchmarkDeckProps {
  language?: SupportedLanguage;
}

export default function ScenarioBenchmarkDeck({ language = 'en' }: ScenarioBenchmarkDeckProps) {
  const [scenarios, setScenarios] = useState<DemoScenario[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('S1');
  const [isRunning, setIsRunning] = useState(false);
  const [benchmarkResult, setBenchmarkResult] = useState<ScenarioBenchmarkResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDemoScenarios()
      .then((data) => {
        setScenarios(data);
        if (data.length > 0 && !selectedScenarioId) {
          setSelectedScenarioId(data[0].id);
        }
      })
      .catch((err) => {
        setError('Failed to load scenarios manifest from backend.');
        console.error(err);
      });
  }, []);

  const selectedScenario = scenarios.find((s) => s.id === selectedScenarioId) || scenarios[0];

  const handleRunBenchmark = async () => {
    if (!selectedScenarioId) return;
    setIsRunning(true);
    setError(null);
    try {
      const res = await runScenario(selectedScenarioId, language);
      setBenchmarkResult(res);
    } catch (err: any) {
      setError(err?.message || 'Scenario execution failed');
      setBenchmarkResult(null);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="scenario-benchmark-deck" aria-label="Canonical Scenario Benchmark Suite">
      <div className="benchmark-header">
        <div>
          <h3>Canonical Evaluation Scenarios (S1–S8 Benchmark Runner)</h3>
          <p className="benchmark-subtitle">
            Execute deterministic evaluation pipelines on the LangGraph agent graph to verify safety decisions,
            evidence grounding, and rule compliance.
          </p>
        </div>
      </div>

      <div className="benchmark-workspace">
        {/* Left: Scenarios Selector List */}
        <aside className="benchmark-scenario-list" aria-label="Scenarios selection">
          <span className="benchmark-list-label">Evaluation Benchmarks ({scenarios.length})</span>
          <div className="benchmark-cards-scroll">
            {scenarios.map((sc) => {
              const isSelected = sc.id === selectedScenarioId;
              const badge = sc.ui_metadata?.badge || sc.expected_status || sc.intent || 'TEST';
              const badgeColor =
                badge.includes('NO_GO') || badge.includes('CONFLICT')
                  ? 'badge-no-go'
                  : badge.includes('CAUTION')
                  ? 'badge-caution'
                  : 'badge-go';

              return (
                <button
                  key={sc.id}
                  type="button"
                  className={`benchmark-scenario-card ${isSelected ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedScenarioId(sc.id);
                    setBenchmarkResult(null);
                    setError(null);
                  }}
                >
                  <div className="scenario-card-top">
                    <strong className="scenario-id-tag">{sc.id}</strong>
                    <span className={`status-pill ${badgeColor}`}>{badge}</span>
                  </div>
                  <div className="scenario-name">{sc.name}</div>
                  <div className="scenario-harbor">Harbor: {sc.harbor || 'Ratnagiri'}</div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Right: Scenario Details & Execution Results */}
        <main className="benchmark-detail-pane">
          {selectedScenario && (
            <div className="scenario-spec-box">
              <div className="scenario-spec-header">
                <div>
                  <span className="scenario-spec-eyebrow">Scenario Specification</span>
                  <h4>{selectedScenario.id}: {selectedScenario.name}</h4>
                </div>
                <button
                  type="button"
                  className="benchmark-run-btn"
                  onClick={handleRunBenchmark}
                  disabled={isRunning}
                >
                  {isRunning ? (
                    <>
                      <RefreshCw size={15} className="spin-icon" />
                      <span>Executing Graph...</span>
                    </>
                  ) : (
                    <>
                      <Play size={15} />
                      <span>Run Benchmark Test</span>
                    </>
                  )}
                </button>
              </div>

              <p className="scenario-spec-desc">{selectedScenario.description}</p>

              <div className="scenario-query-quote">
                <strong>Standard Query:</strong> &ldquo;{selectedScenario.query}&rdquo;
              </div>

              <div className="scenario-meta-grid">
                <div className="scenario-meta-item">
                  <span>Target Intent</span>
                  <strong>{selectedScenario.intent || 'SAFETY'}</strong>
                </div>
                <div className="scenario-meta-item">
                  <span>Expected Status</span>
                  <strong className="status-pill status-go">{selectedScenario.expected_status || 'GO'}</strong>
                </div>
                <div className="scenario-meta-item">
                  <span>Confidence Bar</span>
                  <strong>{selectedScenario.expected_confidence || 'HIGH'}</strong>
                </div>
                <div className="scenario-meta-item">
                  <span>Harbor Sector</span>
                  <strong>{selectedScenario.harbor || 'Ratnagiri'}</strong>
                </div>
              </div>
            </div>
          )}

          {/* Execution Result Area */}
          {error && (
            <div className="benchmark-error-banner" role="alert">
              <XCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {benchmarkResult && (
            <div className="benchmark-result-card" role="region" aria-label="Benchmark Test Outcome">
              <div className="result-header">
                <div className="result-status-title">
                  {benchmarkResult.passed ? (
                    <span className="result-tag pass">
                      <CheckCircle2 size={16} /> TEST SUITE PASSED
                    </span>
                  ) : (
                    <span className="result-tag fail">
                      <XCircle size={16} /> TEST SUITE FAILED
                    </span>
                  )}
                  <h5>Pipeline Verification: {benchmarkResult.scenario_id}</h5>
                </div>
                <span className="result-metric-summary">
                  {benchmarkResult.trace_steps_count} execution steps · {benchmarkResult.evidence_count} evidence records
                </span>
              </div>

              <div className="result-kpis-grid">
                <div className="result-kpi">
                  <span>Status Match</span>
                  <strong>
                    Actual: <span className="status-highlight">{benchmarkResult.actual_status}</span> (Expected: {benchmarkResult.expected_status})
                  </strong>
                </div>
                <div className="result-kpi">
                  <span>Intent Match</span>
                  <strong>
                    {benchmarkResult.actual_intent} (Expected: {benchmarkResult.expected_intent})
                  </strong>
                </div>
                <div className="result-kpi">
                  <span>Evidence Grounding</span>
                  <strong>
                    {benchmarkResult.evidence_grounded ? (
                      <span className="grounded-yes">100% Grounded</span>
                    ) : (
                      <span className="grounded-no">Unverified</span>
                    )}
                  </strong>
                </div>
                <div className="result-kpi">
                  <span>Confidence Level</span>
                  <strong>{benchmarkResult.actual_confidence}</strong>
                </div>
              </div>

              <div className="result-tools-block">
                <span className="block-title"><Layers size={14} /> Executed LangGraph Tools:</span>
                <div className="tools-pills">
                  {benchmarkResult.executed_tools.map((tool, idx) => (
                    <span key={idx} className="tool-pill">
                      <code>{tool}</code>
                    </span>
                  ))}
                </div>
              </div>

              <div className="result-response-block">
                <span className="block-title"><FileCheck2 size={14} /> Composed Advisory Output:</span>
                <div className="result-response-text">
                  {benchmarkResult.response_text}
                </div>
              </div>

              {benchmarkResult.validation_notes.length > 0 && (
                <div className="result-notes-block">
                  <span className="block-title"><Activity size={14} /> Validation Criteria Check:</span>
                  <ul>
                    {benchmarkResult.validation_notes.map((note, idx) => (
                      <li key={idx}>{note}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {!benchmarkResult && !isRunning && (
            <div className="benchmark-placeholder-note">
              <HelpCircle size={28} />
              <p>
                Select an evaluation scenario from the left and click <strong>&ldquo;Run Benchmark Test&rdquo;</strong> to execute
                the backend LangGraph agent pipeline and audit the response in real time.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
