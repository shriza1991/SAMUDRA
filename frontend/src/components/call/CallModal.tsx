import { useEffect, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  Loader2,
  Anchor,
  Globe,
  RefreshCw,
  X,
  Radio,
  SendHorizontal,
  Sparkles,
} from 'lucide-react';
import type { SupportedLanguage } from '../../i18n/translations';
import { TRANSLATIONS } from '../../i18n/translations';
import { useCallSession } from '../../hooks/useCallSession';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface CallModalProps {
  isOpen: boolean;
  onClose: () => void;
  language?: SupportedLanguage;
  originHarbor?: string;
  craftProfile?: string;
}

function getLanguageLabel(code: string | null): { name: string; flag: string } {
  if (!code) return { name: 'Multi-lingual Auto', flag: '🌐' };
  const lower = code.toLowerCase();
  if (lower.startsWith('mr')) return { name: 'मराठी (Marathi)', flag: '🇮🇳' };
  if (lower.startsWith('hi')) return { name: 'हिन्दी (Hindi)', flag: '🇮🇳' };
  if (lower.startsWith('en')) return { name: 'English', flag: '🌐' };
  if (lower.startsWith('ta')) return { name: 'தமிழ் (Tamil)', flag: '🇮🇳' };
  return { name: code, flag: '🌐' };
}

export default function CallModal({
  isOpen,
  onClose,
  language = 'en',
  originHarbor = 'Ratnagiri',
  craftProfile = 'motorized_boat',
}: CallModalProps) {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const {
    callState,
    formattedDuration,
    detectedLanguage,
    transcriptHistory,
    volumeLevel,
    error,
    isMuted,
    startCall,
    finishSpeakingTurn,
    toggleMute,
    retryTurn,
    endCall,
  } = useCallSession({
    originHarbor,
    craftProfile,
    silenceTimeoutMs: 3000,
    speechThreshold: 0.032,
    minSpeechDurationMs: 300,
    onCallEnd: onClose,
  });

  useEffect(() => {
    if (isOpen) {
      startCall();
    } else {
      endCall();
    }
  }, [isOpen]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcriptHistory, callState]);

  const langInfo = getLanguageLabel(detectedLanguage);

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) endCall(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="call-modal-backdrop fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content
          className="call-modal-container fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border/80 bg-card p-4 shadow-2xl space-y-4"
          aria-describedby={undefined}
        >
          {/* Top Header */}
          <header className="call-header flex items-center justify-between border-b border-border/60 pb-3">
            <div className="call-branding flex items-center gap-2.5">
              <div className="call-logo-icon flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Anchor size={16} />
              </div>
              <div>
                <Dialog.Title className="call-title text-sm font-bold text-foreground">{t.callTitle}</Dialog.Title>
                <div className="call-status-row flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={cn('call-status-dot size-1.5 rounded-full', callState === 'ERROR' ? 'bg-destructive' : 'bg-emerald-500 animate-pulse')} />
                  <span className="call-duration-text font-mono text-[11px]">{formattedDuration}</span>
                  <Badge variant="outline" className="call-harbor-tag text-[9px] h-3.5 px-1 font-semibold">
                    {originHarbor}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="call-header-right flex items-center gap-1.5">
              {detectedLanguage && (
                <Badge variant="secondary" className="call-lang-pill gap-1 text-[10px] font-normal" title={`${t.callDetectedLanguage}: ${langInfo.name}`}>
                  <Globe size={11} />
                  <span>{langInfo.flag} {langInfo.name}</span>
                </Badge>
              )}
              <Dialog.Close asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="call-close-icon-btn size-7 p-0 text-muted-foreground hover:text-foreground"
                  aria-label={t.callEndBtn}
                  title={t.callEndBtn}
                >
                  <X size={16} />
                </Button>
              </Dialog.Close>
            </div>
          </header>

          {/* Central Visualizer Section */}
          <section className="call-visualizer-section flex flex-col items-center py-2">
            <div className={cn('call-avatar-wrapper relative flex size-28 items-center justify-center', `state-${callState.toLowerCase()}`)}>
              <div
                className={cn('call-pulse-ring ring-1 absolute inset-0 rounded-full border border-primary/40 transition-all duration-300', callState === 'HEARING_YOU' && 'hearing')}
                style={{
                  transform: `scale(${1 + (callState === 'LISTENING' || callState === 'HEARING_YOU' ? volumeLevel * 0.45 : 0.05)})`,
                  opacity: callState === 'HEARING_YOU' ? 0.6 + volumeLevel * 0.4 : callState === 'LISTENING' ? 0.25 + volumeLevel * 0.4 : 0.2,
                }}
              />
              <div
                className={cn('call-pulse-ring ring-2 absolute inset-0 rounded-full border border-primary/20 transition-all duration-300', callState === 'HEARING_YOU' && 'hearing')}
                style={{
                  transform: `scale(${1 + (callState === 'LISTENING' || callState === 'HEARING_YOU' ? volumeLevel * 0.9 : 0.1)})`,
                  opacity: callState === 'HEARING_YOU' ? 0.35 + volumeLevel * 0.35 : callState === 'LISTENING' ? 0.12 + volumeLevel * 0.25 : 0.1,
                }}
              />

              {/* Main Avatar Core */}
              <div className={cn('call-avatar-core z-10 flex size-20 items-center justify-center rounded-full bg-primary/15 shadow-inner', callState === 'HEARING_YOU' && 'hearing')}>
                <div className="call-avatar-inner text-primary">
                  {callState === 'SPEAKING' ? (
                    <Volume2 size={36} className="call-speaking-icon animate-bounce" />
                  ) : callState === 'PROCESSING' ? (
                    <Loader2 size={36} className="call-processing-icon spin animate-spin" />
                  ) : callState === 'HEARING_YOU' ? (
                    <Radio size={36} className="call-hearing-icon pulse animate-pulse" />
                  ) : isMuted ? (
                    <MicOff size={36} className="call-muted-icon text-muted-foreground" />
                  ) : (
                    <Mic size={36} className="call-listening-icon" />
                  )}
                </div>
              </div>
            </div>

            {/* Audio Waveform Bars */}
            <div className="call-waveform-bars mt-3 flex items-center justify-center gap-1" aria-hidden="true">
              {[0.4, 0.7, 1.0, 0.6, 0.9, 0.5, 0.8, 0.3].map((heightMult, i) => (
                <span
                  key={i}
                  className={cn('call-wave-bar w-1 rounded-full bg-primary transition-all duration-150', callState.toLowerCase())}
                  style={{
                    height:
                      callState === 'SPEAKING'
                        ? `${12 + heightMult * 18}px`
                        : callState === 'HEARING_YOU'
                        ? `${8 + volumeLevel * heightMult * 24}px`
                        : callState === 'LISTENING'
                        ? `${4 + volumeLevel * heightMult * 14}px`
                        : '4px',
                  }}
                />
              ))}
            </div>

            {/* Status Label Banner */}
            <div className="call-state-banner mt-3">
              {callState === 'CONNECTING' && (
                <Badge variant="outline" className="call-state-pill connecting gap-1 text-xs">
                  <Radio size={12} className="pulse animate-pulse" />
                  {t.callStatusConnecting}
                </Badge>
              )}
              {callState === 'LISTENING' && !isMuted && (
                <Badge variant="outline" className="call-state-pill listening gap-1 text-xs border-primary/50 text-primary">
                  <Mic size={12} className="animate-pulse" />
                  {t.callStatusListening}
                </Badge>
              )}
              {callState === 'HEARING_YOU' && !isMuted && (
                <Badge variant="go" className="call-state-pill hearing gap-1 text-xs font-bold">
                  <Sparkles size={12} className="animate-pulse" />
                  {t.callStatusHearing}
                </Badge>
              )}
              {callState === 'LISTENING' && isMuted && (
                <Badge variant="secondary" className="call-state-pill muted gap-1 text-xs">
                  <MicOff size={12} />
                  {t.callStatusMuted}
                </Badge>
              )}
              {callState === 'PROCESSING' && (
                <Badge variant="outline" className="call-state-pill processing gap-1 text-xs border-primary/50 text-primary">
                  <Loader2 size={12} className="spin animate-spin" />
                  {t.callStatusProcessing}
                </Badge>
              )}
              {callState === 'SPEAKING' && (
                <Badge variant="go" className="call-state-pill speaking gap-1 text-xs">
                  <Volume2 size={12} />
                  {t.callStatusSpeaking}
                </Badge>
              )}
              {callState === 'ERROR' && (
                <Badge variant="destructive" className="call-state-pill error text-xs">
                  {error || 'Connection issue'}
                </Badge>
              )}
            </div>
          </section>

          {/* Live Conversation Transcript History */}
          <section className="call-transcript-container rounded-xl border border-border/70 bg-background/60 p-3 h-36 overflow-y-auto" aria-label="Call live transcript">
            <div className="call-transcript-list space-y-2 text-xs">
              {transcriptHistory.length === 0 ? (
                <div className="call-transcript-empty flex flex-col items-center justify-center text-center p-2 text-muted-foreground">
                  <p className="call-empty-hint font-medium">
                    🎙️ Speak naturally in <strong>मराठी</strong>, <strong>हिन्दी</strong>, or <strong>English</strong>.
                  </p>
                  <p className="call-empty-subhint text-[10px] mt-1 opacity-80">
                    SAMUDRA automatically detects when you speak and responds.
                  </p>
                </div>
              ) : (
                transcriptHistory.map(turn => (
                  <div
                    key={turn.id}
                    className={cn('call-turn-item space-y-0.5', turn.role === 'user' ? 'text-right' : 'text-left')}
                  >
                    <div className={cn('call-turn-header flex items-center gap-1 text-[10px] text-muted-foreground', turn.role === 'user' && 'justify-end')}>
                      <span className="call-turn-author font-semibold">
                        {turn.role === 'user' ? t.callSubtitleUser : t.callSubtitleSamudra}
                      </span>
                      {turn.language && (
                        <Badge variant="outline" className="call-turn-lang h-3 px-1 text-[9px]">
                          {turn.language.slice(0, 2).toUpperCase()}
                        </Badge>
                      )}
                    </div>
                    <div
                      className={cn(
                        'call-turn-bubble inline-block max-w-[90%] rounded-lg p-2 text-xs',
                        turn.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-tr-xs'
                          : 'bg-muted text-foreground rounded-tl-xs'
                      )}
                    >
                      <p>{turn.text}</p>
                    </div>
                  </div>
                ))
              )}
              <div ref={transcriptEndRef} />
            </div>
          </section>

          {/* Bottom Call Action Toolbar */}
          <footer className="call-toolbar flex flex-col items-center gap-2 pt-1 border-t border-border/40">
            {(callState === 'HEARING_YOU' || callState === 'LISTENING') && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="call-fallback-send-btn h-6 gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                onClick={finishSpeakingTurn}
                aria-label={t.callTapToSendNow}
                title={t.callTapToSendNow}
              >
                <SendHorizontal size={12} />
                <span>{t.callTapToSendNow}</span>
              </Button>
            )}

            {callState === 'ERROR' && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="call-retry-btn h-7 gap-1.5 text-xs"
                onClick={retryTurn}
                aria-label={t.callRetryBtn}
              >
                <RefreshCw size={13} />
                <span>{t.callRetryBtn}</span>
              </Button>
            )}

            <div className="call-action-buttons flex items-center justify-center gap-6">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={cn('call-action-circle-btn size-12 rounded-full', isMuted && 'border-destructive text-destructive')}
                onClick={toggleMute}
                title={isMuted ? 'Unmute' : 'Mute'}
                aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              >
                {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
              </Button>

              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="call-hangup-btn size-12 rounded-full shadow-md hover:bg-destructive/90"
                onClick={endCall}
                title={t.callEndBtn}
                aria-label={t.callEndBtn}
              >
                <PhoneOff size={22} />
              </Button>
            </div>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
