import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { motion } from 'framer-motion';
import { Faders, SquaresFour, Cube, Palette, VideoCamera, Plus, ArrowsClockwise, FileVideo, FileImage, FileSvg, FileAudio, Hexagon, UploadSimple, X } from '@phosphor-icons/react';

import { Theme } from './theme.tsx';
import { Engine, EngineState } from './engine.tsx';
import { Window } from './components/Core/Window.tsx';
import { Button, InputField, Slider, SegmentedControl, NumberField, ControlGroup } from './components/Core/Primitives.tsx';
import { Timeline, Track, Clip } from './components/Section/Timeline.tsx';

// --- TYPES & CONSTANTS ---
const TIMELINE_DURATION = 30;
const BPM = 120;

interface ProjectState {
    tracks: Track[];
    objects: {
        [id: string]: {
            type: 'mesh' | 'video' | 'image' | 'glb';
            properties: EngineState;
            keyframes?: { [prop: string]: { time: number, value: any }[] };
        }
    };
}

interface Asset {
    id: string;
    type: 'video' | 'image' | 'glb' | 'mesh';
    url: string;
    name: string;
    thumbnail?: string;
}

// --- MAIN APP ---
function App() {
  // UI State
  const [windows, setWindows] = useState({
    control: { isOpen: true, title: 'Properties' },
    timeline: { isOpen: true, title: 'Sequencer' },
    library: { isOpen: true, title: 'Assets' },
  });

  // Engine & Project State
  const canvasRef = useRef<HTMLDivElement>(null);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [history, setHistory] = useState<ProjectState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [project, setProject] = useState<ProjectState>({
      tracks: [{ id: 't1', name: 'Cube', visible: true, type: 'object', clips: [{ id: 'c1', name: 'Main Clip', start: 0, duration: 10, color: '' }] }],
      objects: {
          't1': {
              type: 'mesh',
              properties: {
                  type: 'mesh', position: {x:0,y:0,z:0}, rotation: {x:0,y:0,z:0}, scale: {x:1,y:1,z:1}, opacity: 1,
                  material: { color: '#ffffff', wireframe: true, metalness: 0.5, roughness: 0.5, emissiveIntensity: 0.1 },
                  video: { playbackRate: 1, volume: 1, isPlaying: true, loop: true, chromaKey: false, keyColor: '#00ff00', threshold: 0.2, smoothing: 0.1 }
              }
          }
      }
  });

  const [selectedId, setSelectedId] = useState<string | null>('t1');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [autoKey, setAutoKey] = useState(false);

  // Asset Library State
  const [assets, setAssets] = useState<Asset[]>([
      { id: 'a1', type: 'mesh', name: 'Base Cube', url: '' },
      { id: 'a2', type: 'glb', name: 'Duck Model', url: '' },
      { id: 'a3', type: 'video', name: 'Sample Video', url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4' }
  ]);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // Initialize Engine
  useEffect(() => {
    if (canvasRef.current && !engine) {
      setEngine(new Engine(canvasRef.current, console.log, setSelectedId));
    }
    return () => engine?.dispose();
  }, [engine]);

  // Sync Engine (Render Loop)
  useEffect(() => {
      engine?.sync(project.objects);
  }, [project, engine, currentTime]);

  // Animation Loop
  useEffect(() => {
      let raf: number;
      const loop = () => {
          if (isPlaying) {
              setCurrentTime(t => {
                  const next = t + 1/60;
                  return next > TIMELINE_DURATION ? 0 : next;
              });
          }
          raf = requestAnimationFrame(loop);
      };
      loop();
      return () => cancelAnimationFrame(raf);
  }, [isPlaying]);

  // History & Updates
  const updateProject = (newProject: ProjectState) => {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newProject);
      if(newHistory.length > 20) newHistory.shift();
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      setProject(newProject);
  };

  const updateProp = (path: string, val: any) => {
      if(!selectedId) return;
      const next = JSON.parse(JSON.stringify(project));
      const obj = next.objects[selectedId];
      
      if(path.includes('.')) {
          const [p, c] = path.split('.');
          obj.properties[p][c] = val;
      } else {
          obj.properties[path] = val;
      }

      if (autoKey) {
          if (!obj.keyframes) obj.keyframes = {};
          if (!obj.keyframes[path]) obj.keyframes[path] = [];
          obj.keyframes[path].push({ time: currentTime, value: val });
      }

      setProject(next); 
  };

  const handleImport = async (type: 'mesh' | 'video' | 'image' | 'glb', customUrl?: string, name?: string) => {
      const id = `t-${Date.now()}`;
      const next = JSON.parse(JSON.stringify(project));
      next.tracks.push({ 
          id, 
          name: name || type.toUpperCase(), 
          visible: true, 
          type: type === 'video' ? 'audio' : 'object', 
          clips: [{ id: `c-${id}`, name: 'Clip', start: 0, duration: 5, color: '' }] 
      });
      
      const props: EngineState = {
          type, position: {x:0,y:0,z:0}, rotation: {x:0,y:0,z:0}, scale: {x:1,y:1,z:1}, opacity: 1,
          material: { color: '#ffffff', wireframe: false, metalness: 0.1, roughness: 0.8, emissiveIntensity: 0 },
          video: { playbackRate: 1, volume: 1, isPlaying: true, loop: true, chromaKey: false, keyColor: '#00ff00', threshold: 0.1, smoothing: 0.1 }
      };

      next.objects[id] = { type, properties: props };
      updateProject(next);
      setSelectedId(id);
      
      const url = customUrl || (type === 'video' ? 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4' : 
                 type === 'image' ? 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564' : '');
      
      if(url) await engine?.loadMedia(id, type as any, url);
  };

  const handleFileDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDraggingFile(false);
      const files = Array.from(e.dataTransfer.files);
      
      files.forEach((file: any) => {
          const url = URL.createObjectURL(file);
          let type: Asset['type'] = 'mesh';
          if (file.type.startsWith('image')) type = 'image';
          else if (file.type.startsWith('video')) type = 'video';
          else if (file.name.endsWith('.glb')) type = 'glb';

          setAssets(prev => [...prev, {
              id: `a-${Date.now()}-${Math.random().toString(36).substr(2,9)}`,
              type,
              url,
              name: file.name
          }]);
      });
  };

  // Timeline Operations
  const handleSplitClip = (tid: string, cid: string, time: number) => {
      const next = JSON.parse(JSON.stringify(project));
      const track = next.tracks.find((t:Track) => t.id === tid);
      const clipIdx = track.clips.findIndex((c:Clip) => c.id === cid);
      const clip = track.clips[clipIdx];
      
      if (time > clip.start && time < clip.start + clip.duration) {
          const newDuration = time - clip.start;
          const remDuration = clip.duration - newDuration;
          const newClip = { ...clip, id: `c-${Date.now()}`, start: time, duration: remDuration, name: clip.name + ' (Split)' };
          clip.duration = newDuration;
          track.clips.splice(clipIdx + 1, 0, newClip);
          updateProject(next);
      }
  };

  const handleDuplicateClip = (tid: string, cid: string) => {
      const next = JSON.parse(JSON.stringify(project));
      const track = next.tracks.find((t:Track) => t.id === tid);
      const clip = track.clips.find((c:Clip) => c.id === cid);
      const newClip = { ...clip, id: `c-${Date.now()}`, start: clip.start + clip.duration, name: clip.name + ' Copy' };
      track.clips.push(newClip);
      updateProject(next);
  };

  const selObj = selectedId ? project.objects[selectedId]?.properties : null;
  const selType = selectedId ? project.objects[selectedId]?.type : null;

  return (
    <div style={{ width: '100vw', height: '100vh', background: Theme.Color.Base.Surface[1], overflow: 'hidden', fontFamily: 'var(--font-body)', color: Theme.Color.Base.Content[1] }}>
      <div ref={canvasRef} style={{ position: 'absolute', inset: 0, zIndex: 0 }} />

      {/* --- PROPERTY CONTROLLER --- */}
      <Window 
        id="control" title={windows.control.title} isOpen={windows.control.isOpen} 
        onClose={() => setWindows(p => ({...p, control: {...p.control, isOpen: false}}))}
        initialPos={{ x: window.innerWidth - 380, y: 20 }} size={{ w: 340, h: 600 }}
        canUndo={historyIndex > 0} canRedo={historyIndex < history.length - 1}
        onUndo={() => { setHistoryIndex(i => i-1); setProject(history[historyIndex-1]); }}
        onRedo={() => { setHistoryIndex(i => i+1); setProject(history[historyIndex+1]); }}
      >
        {selObj ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
             <div style={{ marginBottom: Theme.Space.M, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                 <div style={{...Theme.Type.Expressive.Label.XS, color: Theme.Color.Base.Content[3]}}>ID: {selectedId}</div>
                 <Button variant={autoKey ? "danger" : "secondary"} size="S" onClick={() => setAutoKey(!autoKey)} title="Auto-Key Recording">
                     <div style={{ width: 8, height: 8, borderRadius: '50%', background: autoKey ? 'white' : 'red', marginRight: 6 }} />
                     {autoKey ? "REC" : "AUTO KEY"}
                 </Button>
             </div>

             <ControlGroup label="TRANSFORM">
                <NumberField label="POS X" value={selObj.position.x} onChange={v => updateProp('position.x', v)} />
                <NumberField label="POS Y" value={selObj.position.y} onChange={v => updateProp('position.y', v)} />
                <NumberField label="POS Z" value={selObj.position.z} onChange={v => updateProp('position.z', v)} />
             </ControlGroup>
             <ControlGroup>
                <NumberField label="ROT X" value={selObj.rotation.x} step={0.1} onChange={v => updateProp('rotation.x', v)} />
                <NumberField label="ROT Y" value={selObj.rotation.y} step={0.1} onChange={v => updateProp('rotation.y', v)} />
                <NumberField label="ROT Z" value={selObj.rotation.z} step={0.1} onChange={v => updateProp('rotation.z', v)} />
             </ControlGroup>
             <ControlGroup>
                <NumberField label="SCL X" value={selObj.scale.x} step={0.1} onChange={v => updateProp('scale.x', v)} />
                <NumberField label="SCL Y" value={selObj.scale.y} step={0.1} onChange={v => updateProp('scale.y', v)} />
                <NumberField label="SCL Z" value={selObj.scale.z} step={0.1} onChange={v => updateProp('scale.z', v)} />
             </ControlGroup>
             <Slider label="Opacity" value={selObj.opacity} min={0} max={1} step={0.01} onChange={v => updateProp('opacity', v)} />

             {selType === 'video' && (
               <>
                 <div style={{ height: '1px', background: Theme.Color.Effect.Border, margin: '16px 0' }} />
                 <ControlGroup label="VIDEO">
                    <SegmentedControl options={[{label:'Play', value:true}, {label:'Pause', value:false}]} value={selObj.video.isPlaying} onChange={v => updateProp('video.isPlaying', v)} />
                 </ControlGroup>
                 <ControlGroup label="CHROMA KEY">
                     <div style={{ flex: 1 }}>
                        <SegmentedControl options={[{label:'Off', value:false}, {label:'On', value:true}]} value={selObj.video.chromaKey} onChange={v => updateProp('video.chromaKey', v)} />
                     </div>
                     <input type="color" value={selObj.video.keyColor} onChange={e => updateProp('video.keyColor', e.target.value)} style={{ width: 32, height: 32, border: 'none', background: 'none', cursor: 'pointer' }} />
                 </ControlGroup>
                 {selObj.video.chromaKey && (
                     <>
                        <Slider label="Threshold" value={selObj.video.threshold} max={1} step={0.01} onChange={v => updateProp('video.threshold', v)} />
                        <Slider label="Smoothing" value={selObj.video.smoothing} max={1} step={0.01} onChange={v => updateProp('video.smoothing', v)} />
                     </>
                 )}
               </>
             )}

             {selType === 'mesh' && (
                 <>
                    <div style={{ height: '1px', background: Theme.Color.Effect.Border, margin: '16px 0' }} />
                    <ControlGroup label="MATERIAL">
                        <input type="color" value={selObj.material.color} onChange={e => updateProp('material.color', e.target.value)} style={{ width: '100%', height:'32px', border:'none', background:'none', borderRadius: 4 }} />
                    </ControlGroup>
                    <SegmentedControl label="RENDER MODE" options={[{label:'Solid', value:false}, {label:'Wireframe', value:true}]} value={selObj.material.wireframe} onChange={v => updateProp('material.wireframe', v)} />
                    <Slider label="Metalness" value={selObj.material.metalness} max={1} step={0.01} onChange={v => updateProp('material.metalness', v)} />
                    <Slider label="Roughness" value={selObj.material.roughness} max={1} step={0.01} onChange={v => updateProp('material.roughness', v)} />
                 </>
             )}
          </div>
        ) : <div style={{ textAlign: 'center', color: Theme.Color.Base.Content[3], padding: '40px', ...Theme.Type.Readable.Body.M }}>Select an object to edit properties</div>}
      </Window>

      {/* --- TIMELINE SEQUENCER --- */}
      <Window 
        id="timeline" title={windows.timeline.title} isOpen={windows.timeline.isOpen}
        onClose={() => setWindows(p => ({...p, timeline: {...p.timeline, isOpen: false}}))}
        initialPos={{ x: window.innerWidth/2 - 400, y: window.innerHeight - 340 }} size={{ w: 800, h: 320 }}
        canUndo={historyIndex > 0} canRedo={historyIndex < history.length - 1}
        onUndo={() => { setHistoryIndex(i => i-1); setProject(history[historyIndex-1]); }}
        onRedo={() => { setHistoryIndex(i => i+1); setProject(history[historyIndex+1]); }}
      >
        <Timeline 
          tracks={project.tracks} currentTime={currentTime} duration={TIMELINE_DURATION} bpm={BPM} isPlaying={isPlaying} selectedTrackId={selectedId}
          onPlayPause={() => setIsPlaying(!isPlaying)}
          onScrub={setCurrentTime}
          onSelectTrack={setSelectedId}
          onReorderTracks={t => { const n = {...project, tracks: t}; setProject(n); }}
          onSplitClip={handleSplitClip}
          onMergeClips={() => {}}
          onRemoveClip={(tid, cid) => { 
              const n = JSON.parse(JSON.stringify(project)); 
              const t = n.tracks.find((tr:Track)=>tr.id===tid);
              t.clips = t.clips.filter((c:Clip)=>c.id!==cid);
              updateProject(n);
          }}
          onToggleTrackVisibility={(id) => { const n = JSON.parse(JSON.stringify(project)); const t = n.tracks.find((t:Track)=>t.id===id); t.visible = !t.visible; updateProject(n); }}
          onRemoveTrack={(id) => { const n = JSON.parse(JSON.stringify(project)); n.tracks = n.tracks.filter((t:Track)=>t.id!==id); delete n.objects[id]; updateProject(n); setSelectedId(null); }}
          onUpdateClip={(tid, cid, s) => { const n = JSON.parse(JSON.stringify(project)); n.tracks.find((t:Track)=>t.id===tid).clips.find((c:Clip)=>c.id===cid).start = s; setProject(n); }}
          onDuplicateClip={handleDuplicateClip}
        />
      </Window>

      {/* --- ASSET MANAGER --- */}
      <Window
         id="library" title={windows.library.title} isOpen={windows.library.isOpen}
         onClose={() => setWindows(p => ({...p, library: {...p.library, isOpen: false}}))}
         initialPos={{ x: 20, y: 100 }} size={{ w: 260, h: 420 }}
      >
          <div 
             style={{ 
                 height: '100%', display: 'flex', flexDirection: 'column',
                 borderRadius: Theme.Effect.Radius.M,
                 border: isDraggingFile ? `2px dashed ${Theme.Color.Action.Surface[1]}` : '2px dashed transparent',
                 transition: 'all 0.2s',
                 background: isDraggingFile ? 'rgba(212,255,0,0.05)' : 'transparent'
             }}
             onDragOver={e => { e.preventDefault(); setIsDraggingFile(true); }}
             onDragLeave={() => setIsDraggingFile(false)}
             onDrop={handleFileDrop}
          >
             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: Theme.Space.S, paddingBottom: Theme.Space.M }}>
                 {assets.map(asset => (
                     <motion.div 
                        key={asset.id}
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleImport(asset.type, asset.url, asset.name)}
                        style={{
                            aspectRatio: '1',
                            background: Theme.Color.Base.Surface[3],
                            borderRadius: Theme.Effect.Radius.S,
                            border: `1px solid ${Theme.Color.Effect.Border}`,
                            cursor: 'pointer',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            overflow: 'hidden', position: 'relative'
                        }}
                     >
                        {asset.type === 'video' ? <FileVideo size={32} color={Theme.Color.Base.Content[2]} /> :
                         asset.type === 'image' ? <FileImage size={32} color={Theme.Color.Base.Content[2]} /> :
                         asset.type === 'glb' ? <Hexagon size={32} color={Theme.Color.Base.Content[2]} /> :
                         <Cube size={32} color={Theme.Color.Base.Content[2]} />}
                        
                        <div style={{ 
                            position: 'absolute', bottom: 0, left: 0, right: 0, 
                            background: 'rgba(0,0,0,0.8)', padding: '4px',
                            ...Theme.Type.Expressive.Label.XS, textAlign: 'center',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                        }}>
                            {asset.name}
                        </div>
                     </motion.div>
                 ))}
                 
                 {/* Upload Placeholder */}
                 <div style={{
                     aspectRatio: '1',
                     border: `1px dashed ${Theme.Color.Base.Content[3]}`,
                     borderRadius: Theme.Effect.Radius.S,
                     display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                     color: Theme.Color.Base.Content[3], gap: '4px'
                 }}>
                     <UploadSimple size={24} />
                     <span style={Theme.Type.Expressive.Label.XS}>DROP FILES</span>
                 </div>
             </div>
          </div>
      </Window>

      {/* --- DOCK --- */}
      <motion.div style={{
          position: 'absolute', bottom: 32, left: '50%', x: '-50%',
          display: 'flex', gap: 8, padding: '8px 16px',
          background: 'rgba(10,10,10,0.6)', backdropFilter: Theme.Effect.Blur.Dock,
          borderRadius: Theme.Effect.Radius.Full, boxShadow: Theme.Effect.Shadow.Dock,
          border: `1px solid ${Theme.Color.Effect.Border}`, zIndex: Theme.Layout.Z.Dock
      }} initial={{ y: 100 }} animate={{ y: 0 }} transition={{ type: "spring", stiffness: 200, damping: 20 }}>
          <DockIcon icon={Plus} active={windows.library.isOpen} onClick={() => setWindows(p => ({...p, library: {...p.library, isOpen: !p.library.isOpen}}))} />
          <div style={{ width: 1, background: Theme.Color.Effect.Border, margin: '4px 0' }} />
          <DockIcon icon={SquaresFour} active={windows.timeline.isOpen} onClick={() => setWindows(p => ({...p, timeline: {...p.timeline, isOpen: !p.timeline.isOpen}}))} />
          <DockIcon icon={Faders} active={windows.control.isOpen} onClick={() => setWindows(p => ({...p, control: {...p.control, isOpen: !p.control.isOpen}}))} />
          <div style={{ width: 1, background: Theme.Color.Effect.Border, margin: '4px 0' }} />
          <DockIcon icon={ArrowsClockwise} active={false} onClick={() => window.location.reload()} />
      </motion.div>
    </div>
  );
}

const DockIcon = ({ icon: Icon, active, onClick }: any) => (
    <motion.div 
        onClick={onClick}
        whileHover={{ scale: 1.1, y: -4 }} whileTap={{ scale: 0.9 }}
        style={{ 
            color: active ? Theme.Color.Action.Content[3] : Theme.Color.Base.Content[2], 
            cursor: 'pointer', padding: 10, borderRadius: '50%', 
            background: active ? 'rgba(255,255,255,0.05)' : 'transparent',
            boxShadow: active ? Theme.Effect.Shadow.Glow : 'none'
        }}
    >
        <Icon size={22} weight={active ? "fill" : "regular"} />
    </motion.div>
);

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);