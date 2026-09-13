import { useState, useEffect } from 'react';
import {
  Ship,
  Play,
  Pause,
  RotateCcw,
  Bell,
  Gauge,
  Compass,
  AlertTriangle,
  Radio,
  MapPin,
} from 'lucide-react';
import {
  getDemoVessels,
  getDemoVesselReplay,
  getDemoNotifications,
  type DemoVessel,
  type VesselPosition,
  type DemoNotification,
} from '../../api/client';
import type { MapLayer } from '../../types/contracts';
import { translateText, type SupportedLanguage } from '../../i18n/translations';

interface FleetTrackingDeckProps {
  selectedSector?: string;
  onReplayUpdate?: (layer: MapLayer | null) => void;
  language?: SupportedLanguage;
}

export default function FleetTrackingDeck({
  selectedSector,
  onReplayUpdate,
  language = 'en',
}: FleetTrackingDeckProps) {
  const [vessels, setVessels] = useState<DemoVessel[]>([]);
  const [selectedVesselId, setSelectedVesselId] = useState<string | null>(null);
  const [positions, setPositions] = useState<VesselPosition[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<DemoNotification[]>([]);
  const [isBackendOffline, setIsBackendOffline] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Sector change effect: reload vessels & alerts, clear previous replay
  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);
    setIsBackendOffline(false);
    setIsPlaying(false);
    setCurrentIndex(0);
    setPositions([]);
    onReplayUpdate?.(null);

    Promise.allSettled([
      getDemoVessels(selectedSector),
      getDemoNotifications(selectedSector),
    ]).then(([vesselsRes, notifsRes]) => {
      if (isCancelled) return;

      if (vesselsRes.status === 'fulfilled') {
        const vesselList = vesselsRes.value;
        setVessels(vesselList);
        if (vesselList.length > 0) {
          setSelectedVesselId(vesselList[0].public_id);
        } else {
          setSelectedVesselId(null);
          setPositions([]);
          onReplayUpdate?.(null);
        }
      } else {
        // Backend offline or error: zero telemetry fabricated
        setIsBackendOffline(true);
        setVessels([]);
        setSelectedVesselId(null);
        setPositions([]);
        onReplayUpdate?.(null);
      }

      if (notifsRes.status === 'fulfilled') {
        setNotifications(notifsRes.value);
      } else {
        setNotifications([]);
      }

      setIsLoading(false);
    });

    return () => {
      isCancelled = true;
    };
  }, [selectedSector]);

  // Selected vessel change effect: fetch canonical replay trajectory
  useEffect(() => {
    let isCancelled = false;
    if (!selectedVesselId) {
      setPositions([]);
      onReplayUpdate?.(null);
      return;
    }

    getDemoVesselReplay(selectedVesselId)
      .then((pos) => {
        if (isCancelled) return;
        if (Array.isArray(pos) && pos.length > 0) {
          setPositions(pos);
          setCurrentIndex(0);
          setIsPlaying(false);
        } else {
          setPositions([]);
          onReplayUpdate?.(null);
        }
      })
      .catch(() => {
        if (isCancelled) return;
        setPositions([]);
        onReplayUpdate?.(null);
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedVesselId]);

  // Autoplay ticker for trajectory scrubber
  useEffect(() => {
    if (!isPlaying || positions.length === 0) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev >= positions.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1200);

    return () => clearInterval(timer);
  }, [isPlaying, positions]);

  // Generate dynamic MapLayer for the vessel trajectory and current position
  useEffect(() => {
    if (!onReplayUpdate) return;
    if (positions.length === 0) {
      onReplayUpdate(null);
      return;
    }

    const currentPos = positions[currentIndex] || positions[0];
    const pastCoordinates = positions.slice(0, currentIndex + 1).map((p) => [p.longitude, p.latitude]);

    const replayLayer: MapLayer = {
      layer_id: 'layer_fleet_vessel_replay',
      name: `Vessel Replay (${currentPos.vessel_id})`,
      layer_type: 'geojson',
      visible: true,
      style: {
        color: '#06b6d4',
        opacity: 0.9,
        line_width: 3,
        circle_radius: 9,
        layer_category: 'fleet_replay',
      },
      geojson: {
        type: 'FeatureCollection',
        features: [
          // Trajectory path
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: pastCoordinates,
            },
            properties: {
              label: 'Historical Trajectory',
              vessel_id: currentPos.vessel_id,
            },
          },
          // Current vessel point
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [currentPos.longitude, currentPos.latitude],
            },
            properties: {
              label: `Vessel Position @ ${currentPos.timestamp}`,
              speed_knots: currentPos.speed_knots,
              heading_deg: currentPos.heading_deg,
              vessel_id: currentPos.vessel_id,
            },
          },
        ],
      },
    };

    onReplayUpdate(replayLayer);
  }, [positions, currentIndex, onReplayUpdate]);

  const currentPos = positions[currentIndex] || positions[0];
  const selectedVessel = vessels.find((v) => v.public_id === selectedVesselId) || null;

  return (
    <div className="fleet-tracking-deck" aria-label="Fleet Surveillance & Vessel Replay Deck">
      <div className="fleet-deck-header">
        <div>
          <h3>{translateText('Maritime Fleet Surveillance & Trajectory Replay', language)}</h3>
          <p className="fleet-deck-subtitle">
            {translateText('Auditing active coastal vessel positions, time-series GPS replay logs, and multi-agency broadcast alerts.', language)}
          </p>
        </div>
      </div>

      {isBackendOffline && (
        <div className="fleet-offline-banner" style={{
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid #ef4444',
          borderRadius: '8px',
          padding: '10px 14px',
          margin: '0 0 14px 0',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          color: '#ef4444',
          fontSize: '13px',
        }}>
          <AlertTriangle size={18} />
          <div>
            <strong>{translateText('BACKEND OFFLINE — SURVEILLANCE DATA UNAVAILABLE', language)}</strong>
            <p style={{ margin: '2px 0 0 0', opacity: 0.85, fontSize: '12px' }}>
              {translateText('Cannot connect to SAMUDRA backend API. Synthetic telemetry, GPS replay tracks, and broadcast alerts are suspended. Offline fallback preserves sector navigation only.', language)}
            </p>
          </div>
        </div>
      )}

      <div className="fleet-workspace-grid">
        {/* Left Column: Vessel Selection & Telemetry Scrubber */}
        <section className="fleet-vessel-pane">
          <div className="fleet-section-title">
            <Ship size={16} />
            <span>{translateText('Monitored Coastal Fleet', language)} ({vessels.length})</span>
          </div>

          {isLoading ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
              {translateText('Loading monitored sector fleet...', language)}
            </div>
          ) : vessels.length === 0 ? (
            <div style={{
              padding: '24px 16px',
              textAlign: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '8px',
              border: '1px dashed rgba(255, 255, 255, 0.1)',
              margin: '8px 0',
            }}>
              <Ship size={28} style={{ margin: '0 auto 8px auto', opacity: 0.4 }} />
              <p style={{ margin: 0, fontWeight: 600, fontSize: '13px' }}>
                {translateText('No Monitored Vessels Seeded in this Sector', language)}
              </p>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
                {translateText('Active canonical surveillance logs are seeded for Ratnagiri Sector (MH-03) and Malvan Marine Zone (MH-04).', language)}
              </p>
            </div>
          ) : (
            <div className="fleet-vessel-list">
              {vessels.map((v) => {
                const isSelected = v.public_id === selectedVesselId;
                return (
                  <button
                    key={v.public_id}
                    type="button"
                    className={`fleet-vessel-card ${isSelected ? 'active' : ''}`}
                    onClick={() => setSelectedVesselId(v.public_id)}
                  >
                    <div className="vessel-card-top">
                      <strong className="vessel-name">{v.name}</strong>
                      <span className="vessel-type-badge">{v.vessel_type.replace('_', ' ')}</span>
                    </div>
                    <div className="vessel-specs">
                      <span>{translateText('Length:', language)} {v.length_m}m</span>
                      <span>{translateText('Home:', language)} {v.home_harbor_id}</span>
                      {v.metadata_json?.engine_hp && <span>{translateText('Engine:', language)} {v.metadata_json.engine_hp} HP</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Time-series GPS Scrubber */}
          {selectedVessel && currentPos && positions.length > 0 && (
            <div className="fleet-scrubber-card">
              <div className="scrubber-header">
                <div>
                  <span className="scrubber-eyebrow">{translateText('GPS Trajectory Replay', language)}</span>
                  <h4>{selectedVessel.name}</h4>
                </div>
                <div className="scrubber-controls">
                  <button
                    type="button"
                    className="scrubber-btn"
                    onClick={() => setIsPlaying(!isPlaying)}
                    title={isPlaying ? translateText('Pause', language) : translateText('Play', language)}
                  >
                    {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                    <span>{isPlaying ? translateText('Pause', language) : translateText('Play', language)}</span>
                  </button>
                  <button
                    type="button"
                    className="scrubber-btn reset"
                    onClick={() => {
                      setCurrentIndex(0);
                      setIsPlaying(false);
                    }}
                    title={translateText('Reset to departure', language)}
                  >
                    <RotateCcw size={14} />
                  </button>
                </div>
              </div>

              {/* Slider timeline */}
              <div className="scrubber-slider-row">
                <input
                  type="range"
                  min="0"
                  max={Math.max(positions.length - 1, 0)}
                  value={currentIndex}
                  onChange={(e) => {
                    setCurrentIndex(Number(e.target.value));
                    setIsPlaying(false);
                  }}
                  className="scrubber-slider"
                />
                <div className="scrubber-time-labels">
                  <span>{translateText('Start', language)} ({positions[0]?.timestamp || '00:00'})</span>
                  <span className="current-time-pill">T = {currentPos.timestamp}</span>
                  <span>{translateText('End', language)} ({positions[positions.length - 1]?.timestamp || '03:30'})</span>
                </div>
              </div>

              {/* Real-time Telemetry Cards */}
              <div className="scrubber-telemetry-grid">
                <div className="telemetry-pill">
                  <Gauge size={14} />
                  <span>{translateText('Speed:', language)} <strong>{currentPos.speed_knots} kts</strong></span>
                </div>
                <div className="telemetry-pill">
                  <Compass size={14} />
                  <span>{translateText('Heading:', language)} <strong>{currentPos.heading_deg}°</strong></span>
                </div>
                <div className="telemetry-pill">
                  <MapPin size={14} />
                  <span>{translateText('Pos:', language)} <strong>{currentPos.latitude.toFixed(3)}°N, {currentPos.longitude.toFixed(3)}°E</strong></span>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Right Column: Fleet Broadcast Alert Feed */}
        <section className="fleet-alerts-pane">
          <div className="fleet-section-title">
            <Radio size={16} />
            <span>{translateText('Maritime Broadcast Alerts', language)} ({notifications.length})</span>
          </div>

          <div className="fleet-alerts-list">
            {notifications.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: '13px', padding: '16px 0', textAlign: 'center' }}>
                {translateText('No active maritime broadcast alerts in this sector.', language)}
              </p>
            ) : (
              notifications.map((notif) => {
                const isWarning = notif.severity === 'WARNING';
                const isCritical = notif.severity === 'CRITICAL';

                return (
                  <article
                    key={notif.public_id}
                    className={`fleet-alert-card ${isCritical ? 'critical' : isWarning ? 'warning' : 'info'}`}
                  >
                    <div className="alert-card-top">
                      <div className="alert-title-group">
                        {isCritical || isWarning ? (
                          <AlertTriangle size={15} className="alert-icon" />
                        ) : (
                          <Bell size={15} className="alert-icon" />
                        )}
                        <strong>{translateText(notif.title, language)}</strong>
                      </div>
                      <span className="alert-severity-pill">{notif.severity}</span>
                    </div>
                    <p className="alert-message">{translateText(notif.message, language)}</p>
                    <div className="alert-card-footer">
                      <span>{translateText('Role:', language)} {notif.recipient_role}</span>
                      <span>{new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
