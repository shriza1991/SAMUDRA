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
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

interface FleetTrackingDeckProps {
  onReplayUpdate?: (layer: MapLayer | null) => void;
  language?: SupportedLanguage;
  className?: string;
}

export default function FleetTrackingDeck({ onReplayUpdate, language = 'en', className }: FleetTrackingDeckProps) {
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
    <div className={cn('fleet-tracking-deck space-y-4', className)} aria-label="Fleet Surveillance & Vessel Replay Deck">
      <div className="fleet-deck-header">
        <h3 className="text-base font-bold text-foreground">
          {translateText('Maritime Fleet Surveillance & Trajectory Replay', language)}
        </h3>
        <p className="fleet-deck-subtitle text-xs text-muted-foreground mt-0.5">
          {translateText('Auditing active coastal vessel positions, time-series GPS replay logs, and multi-agency broadcast alerts.', language)}
        </p>
      </div>

      <div className="fleet-workspace-grid grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Left Column: Vessel Selection & Telemetry Scrubber */}
        <section className="fleet-vessel-pane space-y-3">
          <div className="fleet-section-title flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Ship size={15} className="text-primary" />
            <span>{translateText('Monitored Coastal Fleet', language)} ({vessels.length})</span>
          </div>

          <div className="fleet-vessel-list grid grid-cols-1 gap-2 sm:grid-cols-2">
            {vessels.map((v) => {
              const isSelected = v.public_id === selectedVesselId;
              return (
                <Card
                  key={v.public_id}
                  className={cn(
                    'fleet-vessel-card cursor-pointer border p-3 transition-all hover:bg-card hover:shadow-xs',
                    isSelected ? 'border-primary bg-primary/5 active' : 'border-border/80 bg-card/60'
                  )}
                  onClick={() => setSelectedVesselId(v.public_id)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="vessel-card-top flex items-center justify-between gap-1">
                    <strong className="vessel-name text-xs font-bold text-foreground">{v.name}</strong>
                    <Badge variant={isSelected ? 'default' : 'secondary'} className="vessel-type-badge text-[10px] h-4 px-1.5">
                      {v.vessel_type.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="vessel-specs mt-2 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11px] text-muted-foreground">
                    <span>{translateText('Length:', language)} {v.length_m}m</span>
                    <span>{translateText('Home:', language)} {v.home_harbor_id}</span>
                    {v.metadata_json?.engine_hp && <span>{translateText('Engine:', language)} {v.metadata_json.engine_hp} HP</span>}
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Time-series GPS Scrubber */}
          {selectedVessel && currentPos && (
            <Card className="fleet-scrubber-card border-border/80 bg-card/70 p-3.5 shadow-xs">
              <CardContent className="p-0 space-y-3">
                <div className="scrubber-header flex items-center justify-between">
                  <div>
                    <span className="scrubber-eyebrow text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {translateText('GPS Trajectory Replay', language)}
                    </span>
                    <h4 className="text-sm font-bold text-foreground">{selectedVessel.name}</h4>
                  </div>
                  <div className="scrubber-controls flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      className="scrubber-btn h-7 gap-1 px-2.5 text-xs font-semibold"
                      onClick={() => setIsPlaying(!isPlaying)}
                      title={isPlaying ? translateText('Pause', language) : translateText('Play', language)}
                    >
                      {isPlaying ? <Pause size={13} /> : <Play size={13} />}
                      <span>{isPlaying ? translateText('Pause', language) : translateText('Play', language)}</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="scrubber-btn reset size-7 p-0"
                      onClick={() => {
                        setCurrentIndex(0);
                        setIsPlaying(false);
                      }}
                      title={translateText('Reset to departure', language)}
                    >
                      <RotateCcw size={13} />
                    </Button>
                  </div>
                </div>

                {/* Slider timeline */}
                <div className="scrubber-slider-row space-y-2">
                  <Slider
                    min={0}
                    max={Math.max(positions.length - 1, 0)}
                    step={1}
                    value={[currentIndex]}
                    onValueChange={([val]) => {
                      setCurrentIndex(val);
                      setIsPlaying(false);
                    }}
                    className="scrubber-slider my-2"
                  />
                  <div className="scrubber-time-labels flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{translateText('Start', language)} ({positions[0]?.timestamp || '00:00'})</span>
                    <Badge variant="outline" className="current-time-pill text-[10px] font-mono">
                      T = {currentPos.timestamp}
                    </Badge>
                    <span>{translateText('End', language)} ({positions[positions.length - 1]?.timestamp || '03:30'})</span>
                  </div>
                </div>

                {/* Real-time Telemetry Cards */}
                <div className="scrubber-telemetry-grid grid grid-cols-3 gap-2 pt-1 border-t border-border/50">
                  <div className="telemetry-pill flex items-center gap-1.5 rounded-md bg-background/60 p-2 text-xs">
                    <Gauge size={13} className="text-primary shrink-0" />
                    <span className="truncate">{translateText('Speed:', language)} <strong>{currentPos.speed_knots} kts</strong></span>
                  </div>
                  <div className="telemetry-pill flex items-center gap-1.5 rounded-md bg-background/60 p-2 text-xs">
                    <Compass size={13} className="text-primary shrink-0" />
                    <span className="truncate">{translateText('Heading:', language)} <strong>{currentPos.heading_deg}°</strong></span>
                  </div>
                  <div className="telemetry-pill flex items-center gap-1.5 rounded-md bg-background/60 p-2 text-xs">
                    <MapPin size={13} className="text-primary shrink-0" />
                    <span className="truncate">{translateText('Pos:', language)} <strong>{currentPos.latitude.toFixed(2)}°N</strong></span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Right Column: Fleet Broadcast Alert Feed */}
        <section className="fleet-alerts-pane space-y-3">
          <div className="fleet-section-title flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Radio size={15} className="text-primary" />
            <span>{translateText('Maritime Broadcast Alerts', language)} ({notifications.length})</span>
          </div>

          <div className="fleet-alerts-list space-y-2 overflow-y-auto max-h-[460px] pr-1">
            {notifications.map((notif) => {
              const isWarning = notif.severity === 'WARNING';
              const isCritical = notif.severity === 'CRITICAL';

              return (
                <Card
                  key={notif.public_id}
                  className={cn(
                    'fleet-alert-card border p-3 shadow-xs',
                    isCritical
                      ? 'border-destructive/40 bg-destructive/5 critical'
                      : isWarning
                      ? 'border-amber-500/40 bg-amber-500/5 warning'
                      : 'border-border/80 bg-card/60 info'
                  )}
                >
                  <div className="alert-card-top flex items-center justify-between gap-2">
                    <div className="alert-title-group flex items-center gap-1.5 font-semibold text-xs">
                      {isCritical || isWarning ? (
                        <AlertTriangle size={14} className={isCritical ? 'text-destructive' : 'text-amber-500'} />
                      ) : (
                        <Bell size={14} className="text-primary" />
                      )}
                      <strong className="text-foreground">{translateText(notif.title, language)}</strong>
                    </div>
                    <Badge
                      variant={isCritical ? 'destructive' : isWarning ? 'caution' : 'outline'}
                      className="alert-severity-pill text-[10px] h-4 px-1.5 font-bold"
                    >
                      {notif.severity}
                    </Badge>
                  </div>
                  <p className="alert-message mt-1.5 text-xs text-muted-foreground leading-relaxed">
                    {translateText(notif.message, language)}
                  </p>
                  <div className="alert-card-footer mt-2 flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/40 pt-1.5">
                    <span>{translateText('Role:', language)} {notif.recipient_role}</span>
                    <span>{new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
