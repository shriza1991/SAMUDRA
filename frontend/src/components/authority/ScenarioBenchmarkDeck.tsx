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
import { translateText, type SupportedLanguage } from '../../i18n/translations';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

interface ScenarioBenchmarkDeckProps {
  language?: SupportedLanguage;
  className?: string;
}

export default function ScenarioBenchmarkDeck({ language = 'en', className }: ScenarioBenchmarkDeckProps) {
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

  const getStatusBadgeVariant = (badgeText: string): 'go' | 'caution' | 'noGo' | 'unknown' | 'secondary' => {
    const b = badgeText.toUpperCase();
    if (b.includes('NO_GO') || b.includes('CONFLICT')) return 'noGo';
    if (b.includes('CAUTION')) return 'caution';
    if (b.includes('GO')) return 'go';
    return 'secondary';
  };

  return (
    <div className={cn('scenario-benchmark-deck space-y-4', className)} aria-label="Canonical Scenario Benchmark Suite">
      <div className="benchmark-header">
        <h3 className="text-base font-bold text-foreground">
          {translateText('Canonical Evaluation Scenarios (S1–S8 Benchmark Runner)', language)}
        </h3>
        <p className="benchmark-subtitle text-xs text-muted-foreground mt-0.5">
          {translateText('Execute deterministic evaluation pipelines on the LangGraph agent graph to verify safety decisions, evidence grounding, and rule compliance.', language)}
        </p>
      </div>

      <div className="benchmark-workspace grid grid-cols-1 gap-4 md:grid-cols-12">
        {/* Left: Scenarios Selector List */}
        <aside className="benchmark-scenario-list md:col-span-4 space-y-2.5" aria-label="Scenarios selection">
          <span className="benchmark-list-label text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {translateText('Evaluation Benchmarks', language)} ({scenarios.length})
          </span>
          <div className="benchmark-cards-scroll space-y-2 overflow-y-auto max-h-[500px] pr-1">
            {scenarios.map((sc) => {
              const isSelected = sc.id === selectedScenarioId;
              const badge = sc.ui_metadata?.badge || sc.expected_status || sc.intent || 'TEST';

              return (
                <Card
                  key={sc.id}
                  className={cn(
                    'benchmark-scenario-card cursor-pointer border p-3 transition-all hover:bg-card hover:shadow-xs',
                    isSelected ? 'border-primary bg-primary/5 active' : 'border-border/80 bg-card/60'
                  )}
                  onClick={() => {
                    setSelectedScenarioId(sc.id);
                    setBenchmarkResult(null);
                    setError(null);
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="scenario-card-top flex items-center justify-between gap-1">
                    <strong className="scenario-id-tag font-mono text-xs font-bold text-primary">{sc.id}</strong>
                    <Badge variant={getStatusBadgeVariant(badge)} className="text-[10px] h-4 px-1.5 font-bold">
                      {badge}
                    </Badge>
                  </div>
                  <div className="scenario-name mt-1 text-xs font-semibold text-foreground leading-snug">{sc.name}</div>
                  <div className="scenario-harbor mt-1 text-[11px] text-muted-foreground">
                    {translateText('Harbor:', language)} {sc.harbor || 'Ratnagiri'}
                  </div>
                </Card>
              );
            })}
          </div>
        </aside>

        {/* Right: Scenario Details & Execution Results */}
        <main className="benchmark-detail-pane md:col-span-8 space-y-3.5">
          {selectedScenario && (
            <Card className="scenario-spec-box border-border/80 bg-card/70 p-4 shadow-xs">
              <CardContent className="p-0 space-y-3">
                <div className="scenario-spec-header flex items-start justify-between gap-3">
                  <div>
                    <span className="scenario-spec-eyebrow text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {translateText('Scenario Specification', language)}
                    </span>
                    <h4 className="text-sm font-bold text-foreground">{selectedScenario.id}: {selectedScenario.name}</h4>
                  </div>
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="benchmark-run-btn gap-1.5 text-xs font-semibold shrink-0 shadow-xs"
                    onClick={handleRunBenchmark}
                    disabled={isRunning}
                  >
                    {isRunning ? (
                      <>
                        <RefreshCw size={14} className="spin-icon animate-spin" />
                        <span>{translateText('Executing Graph...', language)}</span>
                      </>
                    ) : (
                      <>
                        <Play size={14} />
                        <span>{translateText('Run Benchmark Test', language)}</span>
                      </>
                    )}
                  </Button>
                </div>

                <p className="scenario-spec-desc text-xs text-muted-foreground leading-relaxed">{selectedScenario.description}</p>

                <div className="scenario-query-quote rounded-md bg-background/60 p-2.5 text-xs border border-border/50 text-foreground leading-relaxed">
                  <strong className="text-primary">{translateText('Standard Query:', language)}</strong> &ldquo;{selectedScenario.query}&rdquo;
                </div>

                <div className="scenario-meta-grid grid grid-cols-2 gap-2 sm:grid-cols-4 pt-1">
                  <div className="scenario-meta-item rounded-md bg-background/50 p-2 text-center border border-border/40">
                    <span className="block text-[10px] text-muted-foreground font-medium">{translateText('Target Intent', language)}</span>
                    <strong className="text-xs text-foreground">{selectedScenario.intent || 'SAFETY'}</strong>
                  </div>
                  <div className="scenario-meta-item rounded-md bg-background/50 p-2 text-center border border-border/40">
                    <span className="block text-[10px] text-muted-foreground font-medium">{translateText('Expected Status', language)}</span>
                    <Badge variant={getStatusBadgeVariant(selectedScenario.expected_status || 'GO')} className="text-[10px] mt-0.5">
                      {selectedScenario.expected_status || 'GO'}
                    </Badge>
                  </div>
                  <div className="scenario-meta-item rounded-md bg-background/50 p-2 text-center border border-border/40">
                    <span className="block text-[10px] text-muted-foreground font-medium">{translateText('Confidence Bar', language)}</span>
                    <strong className="text-xs text-foreground">{selectedScenario.expected_confidence || 'HIGH'}</strong>
                  </div>
                  <div className="scenario-meta-item rounded-md bg-background/50 p-2 text-center border border-border/40">
                    <span className="block text-[10px] text-muted-foreground font-medium">{translateText('Harbor Sector', language)}</span>
                    <strong className="text-xs text-foreground">{selectedScenario.harbor || 'Ratnagiri'}</strong>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Execution Result Area */}
          {error && (
            <Alert variant="destructive" className="benchmark-error-banner flex items-center gap-2">
              <XCircle className="size-4 shrink-0" />
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}

          {benchmarkResult && (
            <Card className="benchmark-result-card border-border/80 bg-card/70 p-4 shadow-xs" role="region" aria-label="Benchmark Test Outcome">
              <CardContent className="p-0 space-y-3">
                <div className="result-header flex items-center justify-between gap-2 border-b border-border/50 pb-2.5">
                  <div className="result-status-title flex items-center gap-2">
                    {benchmarkResult.passed ? (
                      <Badge variant="go" className="result-tag pass gap-1 text-xs font-bold">
                        <CheckCircle2 size={13} /> {translateText('TEST SUITE PASSED', language)}
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="result-tag fail gap-1 text-xs font-bold">
                        <XCircle size={13} /> {translateText('TEST SUITE FAILED', language)}
                      </Badge>
                    )}
                    <h5 className="text-xs font-bold text-foreground">{translateText('Pipeline Verification:', language)} {benchmarkResult.scenario_id}</h5>
                  </div>
                  <span className="result-metric-summary text-[11px] text-muted-foreground">
                    {benchmarkResult.trace_steps_count} {translateText('steps', language)} · {benchmarkResult.evidence_count} {translateText('evidence', language)}
                  </span>
                </div>

                <div className="result-kpis-grid grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="result-kpi rounded-md bg-background/60 p-2 text-xs border border-border/40 space-y-0.5">
                    <span className="text-[10px] text-muted-foreground font-medium block">{translateText('Status Match', language)}</span>
                    <strong className="text-xs text-foreground">
                      <span className="text-primary font-bold">{benchmarkResult.actual_status}</span>
                    </strong>
                  </div>
                  <div className="result-kpi rounded-md bg-background/60 p-2 text-xs border border-border/40 space-y-0.5">
                    <span className="text-[10px] text-muted-foreground font-medium block">{translateText('Intent Match', language)}</span>
                    <strong className="text-xs text-foreground">{benchmarkResult.actual_intent}</strong>
                  </div>
                  <div className="result-kpi rounded-md bg-background/60 p-2 text-xs border border-border/40 space-y-0.5">
                    <span className="text-[10px] text-muted-foreground font-medium block">{translateText('Evidence Grounding', language)}</span>
                    <strong>
                      {benchmarkResult.evidence_grounded ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">{translateText('100% Grounded', language)}</span>
                      ) : (
                        <span className="text-muted-foreground">{translateText('Unverified', language)}</span>
                      )}
                    </strong>
                  </div>
                  <div className="result-kpi rounded-md bg-background/60 p-2 text-xs border border-border/40 space-y-0.5">
                    <span className="text-[10px] text-muted-foreground font-medium block">{translateText('Confidence Level', language)}</span>
                    <strong className="text-xs text-foreground">{benchmarkResult.actual_confidence}</strong>
                  </div>
                </div>

                <div className="result-tools-block space-y-1.5 pt-1">
                  <span className="block-title flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                    <Layers size={13} className="text-primary" /> {translateText('Executed LangGraph Tools:', language)}
                  </span>
                  <div className="tools-pills flex flex-wrap gap-1">
                    {benchmarkResult.executed_tools.map((tool, idx) => (
                      <Badge key={idx} variant="outline" className="tool-pill text-[10px] font-mono">
                        {tool}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="result-response-block space-y-1.5 pt-1">
                  <span className="block-title flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                    <FileCheck2 size={13} className="text-primary" /> {translateText('Composed Advisory Output:', language)}
                  </span>
                  <div className="result-response-text rounded-md bg-background/60 p-2.5 text-xs text-foreground border border-border/50 leading-relaxed">
                    {benchmarkResult.response_text}
                  </div>
                </div>

                {benchmarkResult.validation_notes.length > 0 && (
                  <div className="result-notes-block space-y-1 pt-1">
                    <span className="block-title flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                      <Activity size={13} className="text-primary" /> {translateText('Validation Criteria Check:', language)}
                    </span>
                    <ul className="text-xs text-muted-foreground space-y-0.5 list-disc pl-4">
                      {benchmarkResult.validation_notes.map((note, idx) => (
                        <li key={idx}>{note}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {!benchmarkResult && !isRunning && (
            <Card className="benchmark-placeholder-note border-dashed bg-card/40 p-8 text-center">
              <CardContent className="p-0 flex flex-col items-center justify-center space-y-2">
                <HelpCircle size={28} className="text-muted-foreground" />
                <p className="max-w-md text-xs text-muted-foreground leading-relaxed">
                  {translateText('Select an evaluation scenario from the left and click "Run Benchmark Test" to execute the backend LangGraph agent pipeline and audit the response in real time.', language)}
                </p>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}
