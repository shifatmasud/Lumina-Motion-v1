
import React, { useRef, useState, useMemo } from 'react';
import { motion, Reorder } from 'framer-motion';
import { Play, Pause, Scissors, Trash, Eye, EyeSlash, DotsSixVertical, Copy, ArrowsMerge, Waveform } from '@phosphor-icons/react';
import { Theme } from '../../theme.tsx';
import { Button, DropdownMenu } from '../Core/Primitives.tsx';

// --- TYPES ---
export interface Clip {
  id: string;
  name: string;
  start: number;
  duration: number;
  color: string;
}

export interface Track {
  id: string;
  name: string;
  clips: Clip[];
  visible: boolean;
  type: 'object' | 'audio' | 'effect';
}

interface TimelineProps {
  tracks: Track[];
  currentTime: number;
  duration: number;
  bpm?: number;
  isPlaying: boolean;
  selectedTrackId: string | null;
  onPlayPause: () => void;
  onScrub: (time: number) => void;
  onSplitClip: (trackId: string, clipId: string, time: number) => void;
  onMergeClips: (trackId: string, clipIds: string[]) => void;
  onRemoveClip: (trackId: string, clipId: string) => void;
  onReorderTracks: (newTracks: Track[]) => void;
  onSelectTrack: (trackId: string) => void;
  onToggleTrackVisibility: (trackId: string) => void;
  onRemoveTrack: (trackId: string) => void;
  onUpdateClip: (trackId: string, clipId: string, newStart: number) => void;
  onDuplicateClip: (trackId: string, clipId: string) => void;
}

const TRACK_HEIGHT = 44;
const PIXELS_PER_SECOND = 80;

// --- SUB-COMPONENTS ---

const BeatGrid = ({ duration, zoom, bpm }: { duration: number, zoom: number, bpm: number }) => {
    const beatInterval = 60 / bpm;
    const totalBeats = Math.floor(duration / beatInterval);
    
    return (
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, pointerEvents: 'none' }}>
            {Array.from({ length: totalBeats + 1 }).map((_, i) => {
                const isMeasure = i % 4 === 0;
                return (
                    <div key={i} style={{
                        position: 'absolute',
                        left: i * beatInterval * zoom,
                        top: 0, bottom: 0,
                        width: '1px',
                        background: isMeasure ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
                        borderLeft: i % 16 === 0 ? `1px dashed ${Theme.Color.Action.Surface[3]}` : 'none'
                    }}>
                        {isMeasure && (
                            <span style={{ 
                                position: 'absolute', top: 4, left: 4, 
                                ...Theme.Type.Expressive.Label.XS, 
                                opacity: 0.3 
                            }}>{i/4 + 1}</span>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

const ClipBlock = ({ clip, track, zoom, selected, onSelect, onUpdate, maxTime, bpm, onContextMenu }: any) => {
    const snap = (val: number) => {
        const beat = 60 / bpm;
        const snapped = Math.round(val / beat) * beat;
        return Math.abs(val - snapped) < 0.2 ? snapped : val;
    };

    return (
        <motion.div
            onClick={(e) => { e.stopPropagation(); onSelect(e); }}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onSelect(e); onContextMenu(e); }}
            drag="x" dragMomentum={false}
            dragConstraints={{ left: 0, right: (maxTime - clip.duration) * zoom }}
            onDragEnd={(_, info) => {
                const delta = info.offset.x / zoom;
                onUpdate(snap(Math.max(0, clip.start + delta)));
            }}
            whileHover={{ y: -1 }}
            style={{
                position: 'absolute',
                left: clip.start * zoom,
                width: clip.duration * zoom,
                height: '30px',
                top: '7px',
                background: selected ? Theme.Color.Action.Surface[1] : Theme.Color.Base.Surface[2],
                borderRadius: Theme.Effect.Radius.S,
                border: selected ? `1px solid ${Theme.Color.Action.Content[3]}` : `1px solid ${Theme.Color.Effect.Border}`,
                color: selected ? Theme.Color.Action.Content[1] : Theme.Color.Base.Content[2],
                fontSize: '0.75rem',
                fontFamily: 'var(--font-code)',
                fontWeight: 500,
                display: 'flex', alignItems: 'center', padding: '0 8px',
                cursor: 'grab',
                boxShadow: selected ? Theme.Effect.Shadow.Glow : 'none',
                zIndex: selected ? 10 : 1,
                overflow: 'hidden'
            }}
        >
            <div style={{ flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                {clip.name}
            </div>
            {track.type === 'audio' && <Waveform size={12} weight="bold" style={{ opacity: 0.5 }} />}
        </motion.div>
    );
};

export const Timeline = ({ tracks, currentTime, duration, bpm = 120, isPlaying, selectedTrackId, onPlayPause, onScrub, onSplitClip, onMergeClips, onRemoveClip, onReorderTracks, onSelectTrack, onToggleTrackVisibility, onRemoveTrack, onUpdateClip, onDuplicateClip }: TimelineProps) => {
  const [selectedClips, setSelectedClips] = useState<{trackId: string, clipId: string}[]>([]);
  const scrubberRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, trackId: string, clipId: string } | null>(null);

  const handleScrub = (e: React.PointerEvent) => {
      if (!scrubberRef.current) return;
      const rect = scrubberRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left + scrubberRef.current.scrollLeft;
      onScrub(Math.max(0, Math.min(duration, x / PIXELS_PER_SECOND)));
  };

  const formattedTime = useMemo(() => {
      const mins = Math.floor(currentTime / 60);
      const secs = Math.floor(currentTime % 60);
      const ms = Math.floor((currentTime % 1) * 100);
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }, [currentTime]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', color: Theme.Color.Base.Content[2] }} onClick={() => setContextMenu(null)}>
      {/* Toolbar */}
      <div style={{ 
          height: '48px', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px', 
          padding: '0 12px', 
          borderBottom: `1px solid ${Theme.Color.Effect.Border}`,
          background: 'rgba(0,0,0,0.2)'
      }}>
        <Button variant="primary" icon={isPlaying ? Pause : Play} onClick={onPlayPause} size="S" />
        <div style={{ width: '1px', height: '16px', background: Theme.Color.Effect.Border, margin: '0 4px' }} />
        
        <Button variant="ghost" icon={Scissors} title="Split at Playhead" size="S" 
            onClick={() => selectedClips[0] && onSplitClip(selectedClips[0].trackId, selectedClips[0].clipId, currentTime)} 
            disabled={selectedClips.length !== 1} 
        />
        <Button variant="ghost" icon={Copy} title="Duplicate" size="S"
            onClick={() => selectedClips[0] && onDuplicateClip(selectedClips[0].trackId, selectedClips[0].clipId)}
            disabled={selectedClips.length === 0}
        />
        <Button variant="ghost" icon={Trash} title="Delete" size="S" 
            onClick={() => { selectedClips.forEach(c => onRemoveClip(c.trackId, c.clipId)); setSelectedClips([]); }} 
            disabled={selectedClips.length === 0} 
            style={{ color: Theme.Color.Feedback.Error }} 
        />
        
        <div style={{ flex: 1 }} />
        <div style={{ ...Theme.Type.Readable.Code.M, fontSize: '0.9rem', color: Theme.Color.Action.Content[3] }}>
            {formattedTime}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Track Headers */}
        <div style={{ 
            width: '180px', 
            borderRight: `1px solid ${Theme.Color.Effect.Border}`, 
            overflowY: 'hidden', 
            background: Theme.Color.Base.Surface[1] 
        }}>
             <Reorder.Group axis="y" values={tracks} onReorder={onReorderTracks}>
                 {tracks.map(track => (
                     <Reorder.Item key={track.id} value={track} 
                        style={{ 
                            height: TRACK_HEIGHT, 
                            display: 'flex', alignItems: 'center', 
                            padding: '0 8px', 
                            borderBottom: `1px solid ${Theme.Color.Effect.Border}`, 
                            background: selectedTrackId === track.id ? 'rgba(255,255,255,0.03)' : 'transparent',
                            position: 'relative'
                        }} 
                        onClick={() => onSelectTrack(track.id)}
                     >
                         <DotsSixVertical size={14} style={{ cursor: 'grab', marginRight: '8px', opacity: 0.3 }} />
                         <span style={{ ...Theme.Type.Readable.Body.S, fontSize: '0.75rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.name}</span>
                         <div style={{ display: 'flex', gap: '4px' }}>
                            <div onClick={(e) => { e.stopPropagation(); onToggleTrackVisibility(track.id); }} style={{ cursor: 'pointer', opacity: track.visible ? 1 : 0.3 }}>
                                {track.visible ? <Eye size={14} /> : <EyeSlash size={14} />}
                            </div>
                            <DropdownMenu 
                                trigger={<div style={{ padding: '2px', cursor: 'pointer', opacity: 0.5 }}><DotsSixVertical size={14} /></div>} 
                                align="right" 
                                items={[
                                    { label: 'Duplicate Track', onClick: () => {} },
                                    { label: 'Delete Track', danger: true, onClick: () => onRemoveTrack(track.id) }
                                ]} 
                            />
                         </div>
                         {/* Selection Indicator */}
                         {selectedTrackId === track.id && (
                             <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '2px', background: Theme.Color.Action.Surface[1] }} />
                         )}
                     </Reorder.Item>
                 ))}
             </Reorder.Group>
        </div>

        {/* Sequencer Area */}
        <div 
            ref={scrubberRef} 
            style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', position: 'relative', cursor: 'text', background: '#080808' }} 
            onPointerDown={handleScrub} 
            onPointerMove={(e) => e.buttons === 1 && handleScrub(e)}
        >
            <div style={{ width: Math.max(1200, duration * PIXELS_PER_SECOND), height: '100%', position: 'relative' }}>
                <BeatGrid duration={duration} zoom={PIXELS_PER_SECOND} bpm={bpm} />
                
                {tracks.map(track => (
                    <div key={track.id} style={{ 
                        height: TRACK_HEIGHT, 
                        borderBottom: `1px solid rgba(255,255,255,0.03)`, 
                        position: 'relative', 
                        opacity: track.visible ? 1 : 0.4 
                    }}>
                        {track.clips.map(clip => (
                            <ClipBlock 
                                key={clip.id} clip={clip} track={track} zoom={PIXELS_PER_SECOND} maxTime={duration} bpm={bpm} 
                                selected={selectedClips.some(c => c.clipId === clip.id)} 
                                onSelect={(e: any) => setSelectedClips([{ trackId: track.id, clipId: clip.id }])} 
                                onUpdate={(val: number) => onUpdateClip(track.id, clip.id, val)}
                                onContextMenu={(e: any) => setContextMenu({ x: e.clientX, y: e.clientY, trackId: track.id, clipId: clip.id })}
                            />
                        ))}
                    </div>
                ))}
                
                {/* Playhead */}
                <motion.div style={{ 
                    position: 'absolute', top: 0, bottom: 0, 
                    width: '1px', background: Theme.Color.Action.Surface[1], 
                    left: currentTime * PIXELS_PER_SECOND, 
                    pointerEvents: 'none', zIndex: 50,
                    boxShadow: '0 0 10px rgba(212, 255, 0, 0.5)'
                }}>
                     <div style={{ 
                         width: 0, height: 0, 
                         borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: `6px solid ${Theme.Color.Action.Surface[1]}`, 
                         position: 'absolute', top: 0, left: '-5px' 
                    }} />
                </motion.div>
            </div>
        </div>
      </div>

      {/* Context Menu (Custom) */}
      {contextMenu && (
          <div style={{
              position: 'fixed', top: contextMenu.y, left: contextMenu.x,
              background: Theme.Color.Base.Surface[2],
              border: `1px solid ${Theme.Color.Effect.Border}`,
              borderRadius: Theme.Effect.Radius.S,
              padding: '4px',
              zIndex: 9999,
              boxShadow: Theme.Effect.Shadow.Window
          }} onClick={(e) => e.stopPropagation()}>
              {[
                  { label: 'Split Clip', icon: Scissors, onClick: () => { onSplitClip(contextMenu.trackId, contextMenu.clipId, currentTime); setContextMenu(null); } },
                  { label: 'Duplicate', icon: Copy, onClick: () => { onDuplicateClip(contextMenu.trackId, contextMenu.clipId); setContextMenu(null); } },
                  { label: 'Delete', icon: Trash, danger: true, onClick: () => { onRemoveClip(contextMenu.trackId, contextMenu.clipId); setContextMenu(null); } },
              ].map((item, i) => (
                  <div key={i} onClick={item.onClick} style={{
                      display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', cursor: 'pointer',
                      color: item.danger ? Theme.Color.Feedback.Error : Theme.Color.Base.Content[1],
                      ...Theme.Type.Readable.Body.S
                  }} onMouseEnter={e => e.currentTarget.style.background = Theme.Color.Base.Surface[3]} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <item.icon /> {item.label}
                  </div>
              ))}
          </div>
      )}
    </div>
  );
};
