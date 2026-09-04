import React from 'react';

/**
 * SAMUDRA Main Shell Scaffolding
 *
 * Owned by Dev 1 (Frontend & Geospatial UX Lead).
 * Ready for implementation of ChatBar, MapView (MapLibre), RecommendationBanner,
 * EvidenceDrawer, and AgentTraceView components.
 */
export default function App() {
  return (
    <div style={{ display: 'flex', height: '100vh', flexDirection: 'column', backgroundColor: '#0b1329', color: '#e2e8f0' }}>
      {/* Top Header */}
      <header style={{ padding: '16px 24px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#38bdf8' }}>
            SAMUDRA <span style={{ fontSize: '13px', fontWeight: 400, color: '#94a3b8' }}>| SIH 2026 PS 26176 (ISRO)</span>
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
            Smart Autonomous Marine Understanding, Decision & Risk Assistant
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '12px', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#cbd5e1' }}>
            Mode: HYBRID (Auto-Fallback)
          </span>
          <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '12px', backgroundColor: '#064e3b', color: '#6ee7b7' }}>
            Scaffold Ready
          </span>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main style={{ flex: 1, display: 'grid', gridTemplateColumns: '420px 1fr', overflow: 'hidden' }}>
        {/* Left Panel: Conversational Interface & Risk Gate Stub */}
        <section style={{ borderRight: '1px solid #1e293b', display: 'flex', flexDirection: 'column', padding: '20px', overflowY: 'auto' }}>
          <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: '#1e293b', marginBottom: '16px', borderLeft: '4px solid #38bdf8' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: '14px', color: '#f8fafc' }}>Frontend Foundation Ready</h3>
            <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', lineHeight: 1.5 }}>
              TypeScript contracts configured in <code>src/types/contracts.ts</code>.
              Ready for Dev 1 to wire the Chat Bar, Evidence Drawer, and Trace Timeline.
            </p>
          </div>

          <div style={{ marginTop: 'auto' }}>
            <h4 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '8px' }}>
              Planned MVP Journeys
            </h4>
            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#cbd5e1', lineHeight: 1.8 }}>
              <li>Nearest Potential Fishing Zone (PFZ)</li>
              <li>GO / NO-GO Safety Decision Gate</li>
              <li>Hazard & Boundary Geofence Intersections</li>
              <li>Safer Alternative Route Comparison</li>
            </ul>
          </div>
        </section>

        {/* Right Panel: MapLibre Geospatial Viewport Stub */}
        <section style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#020617' }}>
          <div style={{ textAlign: 'center', maxWidth: '460px', padding: '24px' }}>
            <div style={{ fontSize: '42px', marginBottom: '12px' }}>🗺️</div>
            <h3 style={{ margin: '0 0 8px', fontSize: '16px', color: '#f1f5f9' }}>MapLibre GL JS Canvas</h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.6 }}>
              Vector map canvas will render here for PFZ front lines, IMD cyclone sectors,
              geofences, and evaluated vessel routes.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
