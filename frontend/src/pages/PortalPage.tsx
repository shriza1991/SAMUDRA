import {
  Activity,
  Anchor,
  ArrowRight,
  Building2,
  CheckCircle2,
  Compass,
  FileCheck2,
  Fish,
  MapPinned,
  Mic,
  RadioTower,
  ShieldAlert,
  ShipWheel,
  SlidersHorizontal,
} from 'lucide-react';
import { translateText, type SupportedLanguage } from '../i18n/translations';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface PortalPageProps {
  onSelectRole: (role: 'fisher' | 'authority') => void;
  language?: SupportedLanguage;
  className?: string;
}

export default function PortalPage({ onSelectRole, language = 'en', className }: PortalPageProps) {
  const tr = (str: string) => translateText(str, language);

  return (
    <main className={cn('portal-page min-h-[calc(100vh-60px)] flex flex-col justify-center p-4 sm:p-6 lg:p-8', className)} role="main" aria-label={tr('Select Your Operational Mission Portal')}>
      <div className="portal-container max-w-5xl mx-auto w-full space-y-8">
        {/* Hero Section */}
        <section className="portal-hero text-center space-y-3">
          <Badge variant="outline" className="portal-badge gap-1.5 px-3 py-1 text-xs font-semibold">
            <Anchor size={13} className="text-primary" />
            <span>{tr('ISRO & INCOIS Marine Intelligence Platform')}</span>
          </Badge>
          <h1 className="portal-title text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground">
            {tr('Select Your Operational Mission Portal')}
          </h1>
          <p className="portal-description max-w-2xl mx-auto text-sm sm:text-base text-muted-foreground leading-relaxed">
            {tr("SAMUDRA orchestrates India's oceanographic, meteorological, and regulatory data into deterministic voyage advisories, risk evaluations, and maritime surveillance.")}
          </p>
        </section>

        {/* Portal Selection Cards Grid */}
        <section className="portal-grid grid grid-cols-1 md:grid-cols-2 gap-6" aria-label="Available Operational Portals">
          {/* Card 1: Fisher / Skipper Console */}
          <Card className="portal-card fisher-portal-card border-border/80 bg-card/80 flex flex-col justify-between transition-all hover:border-primary/50 hover:shadow-lg">
            <CardHeader className="p-6 pb-4">
              <div className="portal-card-header flex items-start gap-4">
                <div className="portal-icon-wrapper flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-xs">
                  <Fish size={26} />
                </div>
                <div>
                  <span className="portal-card-eyebrow text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {tr('Artisanal Fishers & Vessel Skippers')}
                  </span>
                  <CardTitle className="text-xl font-bold text-foreground mt-0.5">{tr('Fisher Console')}</CardTitle>
                </div>
              </div>
              <CardDescription className="portal-card-summary text-xs text-muted-foreground leading-relaxed mt-3">
                {tr('Purpose-built for coastal fishermen and vessel operators preparing to depart harbor. Answers operational voyage questions with rigid safety thresholds and vernacular voice support.')}
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 pt-0">
              <ul className="portal-features-list space-y-2.5 text-xs">
                <li className="flex items-start gap-2 text-foreground/90">
                  <CheckCircle2 size={15} className="text-emerald-500 mt-0.5 shrink-0" />
                  <span><strong>{tr('Departure Safety Status:')}</strong> {tr('Instant GO / CAUTION / NO-GO verdicts.')}</span>
                </li>
                <li className="flex items-start gap-2 text-foreground/90">
                  <MapPinned size={15} className="text-primary mt-0.5 shrink-0" />
                  <span><strong>{tr('Potential Fishing Zones (PFZ):')}</strong> {tr('Distance, bearing, SST, and chlorophyll gradients.')}</span>
                </li>
                <li className="flex items-start gap-2 text-foreground/90">
                  <SlidersHorizontal size={15} className="text-primary mt-0.5 shrink-0" />
                  <span><strong>{tr('Mission Twin What-If:')}</strong> {tr('Test departure delay windows (+2h, +4h) and craft types.')}</span>
                </li>
                <li className="flex items-start gap-2 text-foreground/90">
                  <Mic size={15} className="text-primary mt-0.5 shrink-0" />
                  <span><strong>{tr('Voice Calls with VAD:')}</strong> {tr('Bidirectional audio assistance in Hindi, Marathi, and English.')}</span>
                </li>
                <li className="flex items-start gap-2 text-foreground/90">
                  <ShipWheel size={15} className="text-primary mt-0.5 shrink-0" />
                  <span><strong>{tr('Corridor Optimization:')}</strong> {tr('Compare Safest vs. Direct vs. Balanced route options.')}</span>
                </li>
              </ul>
            </CardContent>

            <CardFooter className="p-6 pt-0">
              <Button
                type="button"
                variant="default"
                className="portal-cta-btn fisher-cta w-full justify-between h-10 px-4 font-semibold shadow-xs"
                onClick={() => onSelectRole('fisher')}
              >
                <span>{tr('Enter Fisher Console')}</span>
                <ArrowRight size={16} />
              </Button>
            </CardFooter>
          </Card>

          {/* Card 2: Authority Command Deck */}
          <Card className="portal-card authority-portal-card border-border/80 bg-card/80 flex flex-col justify-between transition-all hover:border-primary/50 hover:shadow-lg">
            <CardHeader className="p-6 pb-4">
              <div className="portal-card-header flex items-start gap-4">
                <div className="portal-icon-wrapper flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-xs">
                  <Building2 size={26} />
                </div>
                <div>
                  <span className="portal-card-eyebrow text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {tr('Port Officials & Maritime Authorities')}
                  </span>
                  <CardTitle className="text-xl font-bold text-foreground mt-0.5">{tr('Authority Command Deck')}</CardTitle>
                </div>
              </div>
              <CardDescription className="portal-card-summary text-xs text-muted-foreground leading-relaxed mt-3">
                {tr('Dedicated command interface for Port Authorities, Fisheries Departments, and Coastal Disaster Management teams auditing fleet compliance and active hazard sectors.')}
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 pt-0">
              <ul className="portal-features-list space-y-2.5 text-xs">
                <li className="flex items-start gap-2 text-foreground/90">
                  <RadioTower size={15} className="text-primary mt-0.5 shrink-0" />
                  <span><strong>{tr('Coastal Sector Surveillance:')}</strong> {tr('Monitor Ratnagiri, Malvan, Goa, and Mumbai waters.')}</span>
                </li>
                <li className="flex items-start gap-2 text-foreground/90">
                  <ShieldAlert size={15} className="text-amber-500 mt-0.5 shrink-0" />
                  <span><strong>{tr('Live Hazard Polygons:')}</strong> {tr('Track IMD squall warnings, MPAs, and naval firing areas.')}</span>
                </li>
                <li className="flex items-start gap-2 text-foreground/90">
                  <FileCheck2 size={15} className="text-primary mt-0.5 shrink-0" />
                  <span><strong>{tr('Evidence & Provenance Audit:')}</strong> {tr('Direct in-page inspection of official INCOIS/IMD feeds.')}</span>
                </li>
                <li className="flex items-start gap-2 text-foreground/90">
                  <Activity size={15} className="text-primary mt-0.5 shrink-0" />
                  <span><strong>{tr('Autonomous Reasoning Trail:')}</strong> {tr('Full LangGraph agent execution trace logs.')}</span>
                </li>
                <li className="flex items-start gap-2 text-foreground/90">
                  <Compass size={15} className="text-primary mt-0.5 shrink-0" />
                  <span><strong>{tr('Surveillance Query Terminal:')}</strong> {tr('Run regional simulations and query decision records.')}</span>
                </li>
              </ul>
            </CardContent>

            <CardFooter className="p-6 pt-0">
              <Button
                type="button"
                variant="outline"
                className="portal-cta-btn authority-cta w-full justify-between h-10 px-4 font-semibold border-primary/40 text-primary hover:bg-primary/10 shadow-xs"
                onClick={() => onSelectRole('authority')}
              >
                <span>{tr('Enter Authority Deck')}</span>
                <ArrowRight size={16} />
              </Button>
            </CardFooter>
          </Card>
        </section>

        {/* Footer info badge */}
        <footer className="portal-footer text-center">
          <p className="text-xs text-muted-foreground max-w-xl mx-auto leading-relaxed">
            {tr('Deterministic Marine Decision Engine · Complying with Official Government Feeds (INCOIS OSF, PFZ, SVAS, IMD Marine)')}
          </p>
        </footer>
      </div>
    </main>
  );
}
