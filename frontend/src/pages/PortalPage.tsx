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
import type { SupportedLanguage } from '../i18n/translations';

interface PortalPageProps {
  onSelectRole: (role: 'fisher' | 'authority') => void;
  language?: SupportedLanguage;
}

export default function PortalPage({ onSelectRole }: PortalPageProps) {
  return (
    <main className="portal-page" role="main" aria-label="SAMUDRA Portal Role Selection">
      <div className="portal-container">
        {/* Hero Section */}
        <section className="portal-hero">
          <div className="portal-badge">
            <Anchor size={14} className="portal-badge-icon" />
            <span>ISRO & INCOIS Marine Intelligence Platform</span>
          </div>
          <h1 className="portal-title">Select Your Operational Mission Portal</h1>
          <p className="portal-description">
            SAMUDRA orchestrates India&apos;s oceanographic, meteorological, and regulatory data into deterministic voyage
            advisories, risk evaluations, and maritime surveillance.
          </p>
        </section>

        {/* Portal Selection Cards Grid */}
        <section className="portal-grid" aria-label="Available Operational Portals">
          {/* Card 1: Fisher / Skipper Console */}
          <article className="portal-card fisher-portal-card">
            <div className="portal-card-header">
              <div className="portal-icon-wrapper fisher-icon">
                <Fish size={28} />
              </div>
              <div>
                <span className="portal-card-eyebrow">Artisanal Fishers & Vessel Skippers</span>
                <h2>Fisher Console</h2>
              </div>
            </div>

            <p className="portal-card-summary">
              Purpose-built for coastal fishermen and vessel operators preparing to depart harbor. Answers operational voyage
              questions with rigid safety thresholds and vernacular voice support.
            </p>

            <ul className="portal-features-list">
              <li>
                <CheckCircle2 size={15} className="feature-check" />
                <span><strong>Departure Safety Status:</strong> Instant GO / CAUTION / NO-GO verdicts.</span>
              </li>
              <li>
                <MapPinned size={15} className="feature-check" />
                <span><strong>Potential Fishing Zones (PFZ):</strong> Distance, bearing, SST, and chlorophyll gradients.</span>
              </li>
              <li>
                <SlidersHorizontal size={15} className="feature-check" />
                <span><strong>Mission Twin What-If:</strong> Test departure delay windows (+2h, +4h) and craft types.</span>
              </li>
              <li>
                <Mic size={15} className="feature-check" />
                <span><strong>Voice Calls with VAD:</strong> Bidirectional audio assistance in Hindi, Marathi, and English.</span>
              </li>
              <li>
                <ShipWheel size={15} className="feature-check" />
                <span><strong>Corridor Optimization:</strong> Compare Safest vs. Direct vs. Balanced route options.</span>
              </li>
            </ul>

            <button
              type="button"
              className="portal-cta-btn fisher-cta"
              onClick={() => onSelectRole('fisher')}
            >
              <span>Enter Fisher Console</span>
              <ArrowRight size={16} />
            </button>
          </article>

          {/* Card 2: Authority Command Deck */}
          <article className="portal-card authority-portal-card">
            <div className="portal-card-header">
              <div className="portal-icon-wrapper authority-icon">
                <Building2 size={28} />
              </div>
              <div>
                <span className="portal-card-eyebrow">Port Officials & Maritime Authorities</span>
                <h2>Authority Command Deck</h2>
              </div>
            </div>

            <p className="portal-card-summary">
              Dedicated command interface for Port Authorities, Fisheries Departments, and Coastal Disaster Management teams
              auditing fleet compliance and active hazard sectors.
            </p>

            <ul className="portal-features-list">
              <li>
                <RadioTower size={15} className="feature-check" />
                <span><strong>Coastal Sector Surveillance:</strong> Monitor Ratnagiri, Malvan, Goa, and Mumbai waters.</span>
              </li>
              <li>
                <ShieldAlert size={15} className="feature-check" />
                <span><strong>Live Hazard Polygons:</strong> Track IMD squall warnings, MPAs, and naval firing areas.</span>
              </li>
              <li>
                <FileCheck2 size={15} className="feature-check" />
                <span><strong>Evidence & Provenance Audit:</strong> Direct in-page inspection of official INCOIS/IMD feeds.</span>
              </li>
              <li>
                <Activity size={15} className="feature-check" />
                <span><strong>Autonomous Reasoning Trail:</strong> Full LangGraph agent execution trace logs.</span>
              </li>
              <li>
                <Compass size={15} className="feature-check" />
                <span><strong>Surveillance Query Terminal:</strong> Run regional simulations and query decision records.</span>
              </li>
            </ul>

            <button
              type="button"
              className="portal-cta-btn authority-cta"
              onClick={() => onSelectRole('authority')}
            >
              <span>Enter Authority Deck</span>
              <ArrowRight size={16} />
            </button>
          </article>
        </section>

        {/* Footer info badge */}
        <footer className="portal-footer">
          <p>
            Deterministic Marine Decision Engine · Complying with Official Government Feeds (INCOIS OSF, PFZ, SVAS, IMD Marine)
          </p>
        </footer>
      </div>
    </main>
  );
}
