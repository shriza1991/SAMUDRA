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

interface FleetTrackingDeckProps {
  onReplayUpdate?: (layer: MapLayer | null) => void;
}

export default function FleetTrackingDeck({ onReplayUpdate }: FleetTrackingDeckProps) {
  const [vessels, setVessels] = useState<DemoVessel[]>([]);
  const [selectedVesselId, setSelectedVesselId] = useState<string>('vessel-01');
  const [positions, setPositions] = useState<VesselPosition[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<DemoNotification[]>([]);

  useEffect(() => {
    getDemoVessels().then((data) => {
      setVessels(data);
      if (data.length > 0 && !selectedVesselId) {
        setSelectedVesselId(data[0].public_id);
      }
    });

    getDemoNotifications().then((notifs) => {
      setNotifications(notifs);
    });
  }, []);

  useEffect(() => {
    if (!selectedVesselId) return;
    getDemoVesselReplay(selectedVesselId).then((pos) => {
      setPositions(pos);
      setCurrentIndex(0);
      setIsPlaying(false);
    });
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
  const selectedVessel = vessels.find((v) => v.public_id === selectedVesselId) || vessels[0];

  return (
    <div className="fleet-tracking-deck" aria-label="Fleet Surveillance & Vessel Replay Deck">
      <div className="fleet-deck-header">
        <div>
          <h3>Maritime Fleet Surveillance & Trajectory Replay</h3>
          <p className="fleet-deck-subtitle">
            Auditing active coastal vessel positions, time-series GPS replay logs, and multi-agency broadcast alerts.
          </p>
        </div>
      </div>

      <div className="fleet-workspace-grid">
        {/* Left Column: Vessel Selection & Telemetry Scrubber */}
        <section className="fleet-vessel-pane">
          <div className="fleet-section-title">
            <Ship size={16} />
            <span>Monitored Coastal Fleet ({vessels.length})</span>
          </div>

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
                    <span>Length: {v.length_m}m</span>
                    <span>Home: {v.home_harbor_id}</span>
                    {v.metadata_json?.engine_hp && <span>Engine: {v.metadata_json.engine_hp} HP</span>}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Time-series GPS Scrubber */}
          {selectedVessel && currentPos && (
            <div className="fleet-scrubber-card">
              <div className="scrubber-header">
                <div>
                  <span className="scrubber-eyebrow">GPS Trajectory Replay</span>
                  <h4>{selectedVessel.name}</h4>
                </div>
                <div className="scrubber-controls">
                  <button
                    type="button"
                    className="scrubber-btn"
                    onClick={() => setIsPlaying(!isPlaying)}
                    title={isPlaying ? 'Pause replay' : 'Play trajectory'}
                  >
                    {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                    <span>{isPlaying ? 'Pause' : 'Play'}</span>
                  </button>
                  <button
                    type="button"
                    className="scrubber-btn reset"
                    onClick={() => {
                      setCurrentIndex(0);
                      setIsPlaying(false);
                    }}
                    title="Reset to departure"
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
                  <span>Start ({positions[0]?.timestamp || '00:00'})</span>
                  <span className="current-time-pill">T = {currentPos.timestamp}</span>
                  <span>End ({positions[positions.length - 1]?.timestamp || '03:30'})</span>
                </div>
              </div>

              {/* Real-time Telemetry Cards */}
              <div className="scrubber-telemetry-grid">
                <div className="telemetry-pill">
                  <Gauge size={14} />
                  <span>Speed: <strong>{currentPos.speed_knots} kts</strong></span>
                </div>
                <div className="telemetry-pill">
                  <Compass size={14} />
                  <span>Heading: <strong>{currentPos.heading_deg}°</strong></span>
                </div>
                <div className="telemetry-pill">
                  <MapPin size={14} />
                  <span>Pos: <strong>{currentPos.latitude.toFixed(3)}°N, {currentPos.longitude.toFixed(3)}°E</strong></span>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Right Column: Fleet Broadcast Alert Feed */}
        <section className="fleet-alerts-pane">
          <div className="fleet-section-title">
            <Radio size={16} />
            <span>Maritime Broadcast Alerts ({notifications.length})</span>
          </div>

          <div className="fleet-alerts-list">
            {notifications.map((notif) => {
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
                      <strong>{notif.title}</strong>
                    </div>
                    <span className="alert-severity-pill">{notif.severity}</span>
                  </div>
                  <p className="alert-message">{notif.message}</p>
                  <div className="alert-card-footer">
                    <span>Role: {notif.recipient_role}</span>
                    <span>{new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
