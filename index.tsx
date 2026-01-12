
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { DesignSystem } from './theme';
import { GlobalSettings, SceneObject } from './engine';
import { Window } from './components/Core/Window';
import { TimelineSequencer } from './components/Section/Timeline';
import { Dock } from './components/Section/Dock';
import { AssetsPanel } from './components/Section/AssetsPanel';
import { PropertiesPanel } from './components/Section/PropertiesPanel';
import { ProjectSettingsPanel } from './components/Section/ProjectSettingsPanel';
import { PhysicsPanel } from './components/Section/PhysicsPanel';
import { ExportModal } from './components/Package/ExportModal';
import { createYamlString } from './utils/yamlExporter';
import { SimulationSettings } from './utils/physics';
import { INITIAL_OBJECTS, INITIAL_GLOBAL_SETTINGS, DEFAULT_ACCENT_COLOR } from './constants';
import { useUIState } from './hooks/useUIState';
import { usePlayback } from './hooks/usePlayback';
import { useSceneObjects } from './hooks/useSceneObjects';
import { useEngine } from './hooks/useEngine';

import './index.css';

const App = () => {
  // --- State ---
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT_COLOR);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>(JSON.parse(JSON.stringify(INITIAL_GLOBAL_SETTINGS)));
  
  // --- Custom Hooks for Logic Separation ---
  const { 
    showAssets, setShowAssets, showTimeline, setShowTimeline, showProperties, setShowProperties,
    showProjectSettings, setShowProjectSettings, showPhysicsPanel, setShowPhysicsPanel, showExportModal, setShowExportModal
  } = useUIState();

  const scene = useSceneObjects(accentColor, setShowProperties);
  const { objects, setObjects, selectedObject, selectedKeyframe, handleBakePhysics, handleUpdateObject } = scene;
  
  const playback = usePlayback(objects);
  const { currentTime, setCurrentTime, totalDuration, isPlaying, setIsPlaying } = playback;

  const { containerRef, engine } = useEngine(
    objects, 
    globalSettings, 
    currentTime, 
    isPlaying,
    scene.setSelectedId
  );
  
  // --- Effects ---
  
  const adjustColor = (color: string, amount: number) => {
      return '#' + color.replace(/^#/, '').match(/.{1,2}/g)!.map(c => Math.max(0, Math.min(255, parseInt(c, 16) + amount)).toString(16).padStart(2, '0')).join('');
  }
  
  // Theme Update Effect
  useEffect(() => {
    document.documentElement.style.setProperty('--accent-surface', accentColor);
    document.documentElement.style.setProperty('--accent-surface-dim', adjustColor(accentColor, -40));
    document.documentElement.style.setProperty('--accent-glow', `${accentColor}66`); // 40% opacity
    setGlobalSettings(prev => ({ ...prev, accentColor }));
    setObjects(prev => prev.map(o => 
      o.id === 'rim-light' ? { ...o, color: accentColor } : o
    ));
  }, [accentColor, setObjects]);

  // --- Actions ---

  const handleTogglePlay = () => {
      engine?.resumeAudioContext();
      setIsPlaying(!isPlaying);
  };
  
  const handleResetScene = () => {
      setAccentColor(DEFAULT_ACCENT_COLOR);
      setObjects(JSON.parse(JSON.stringify(INITIAL_OBJECTS)));
      setGlobalSettings(JSON.parse(JSON.stringify(INITIAL_GLOBAL_SETTINGS)));
      scene.setSelectedId(null);
      setCurrentTime(0);
      setIsPlaying(false);
      scene.setSelectedKeyframe(null);
  };

  const handleExportYaml = () => {
    try {
        const yamlString = createYamlString(globalSettings, objects);
        const blob = new Blob([yamlString], { type: 'text/yaml' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'lumina-scene.yaml';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error("Failed to generate YAML:", e);
        alert("Sorry, there was an error exporting the YAML file.");
    }
  };
  
  const handleLightSettingChange = (light: 'ambientLight', property: string, value: any) => {
    setGlobalSettings(g => {
        const newLightSettings = { ...g[light] } as any;
        newLightSettings[property] = value;
        return { ...g, [light]: newLightSettings };
    });
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: DesignSystem.Color.Base.Surface[1] }}>
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 0,
        }}
      />

      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        engine={engine}
        objects={objects}
        totalDuration={totalDuration}
      />

      <Window 
        id="assets" 
        title="ASSETS" 
        isOpen={showAssets} 
        onClose={() => setShowAssets(false)} 
        width={300} 
        height={420}
      >
         <AssetsPanel 
            onAddObject={(type, url, width, height) => scene.handleAddObject(type, currentTime, url, width, height)}
            onExportVideo={() => setShowExportModal(true)} 
            onExportYaml={handleExportYaml} 
            onFileDrop={(e) => scene.handleDrop(e, currentTime)} 
            onFileUpload={(e) => scene.handleFileUpload(e, currentTime)} 
        />
      </Window>

      <Window
        id="project-settings"
        title="PROJECT SETTINGS"
        isOpen={showProjectSettings}
        onClose={() => setShowProjectSettings(false)}
        width={320}
        height={560}
      >
          <ProjectSettingsPanel 
            settings={globalSettings} 
            setSettings={setGlobalSettings}
            accentColor={accentColor}
            setAccentColor={setAccentColor}
            handleLightSettingChange={handleLightSettingChange}
          />
      </Window>
      
      <Window
        id="physics-simulator"
        title="PHYSICS SIMULATOR"
        isOpen={showPhysicsPanel}
        onClose={() => setShowPhysicsPanel(false)}
        width={320}
        height={520}
      >
          <PhysicsPanel onBake={(settings: SimulationSettings) => handleBakePhysics(settings, currentTime)} />
      </Window>

      <Window 
        id="props" 
        title="CONTROLS" 
        isOpen={showProperties} 
        onClose={() => setShowProperties(false)} 
        width={280} 
        onResetScene={handleResetScene}
        selectedKeyframe={selectedKeyframe}
        copiedKeyframeYaml={scene.copiedKeyframeYaml}
        onCopyKeyframeAsYaml={scene.handleCopySelectedKeyframeValuesAsYaml}
        onPasteKeyframeFromYaml={scene.handlePasteValuesToSelectedKeyframeFromYaml}
        onOpenProjectSettings={() => setShowProjectSettings(true)}
        onOpenPhysicsPanel={() => setShowPhysicsPanel(prev => !prev)}
      >
        <PropertiesPanel
            selectedObject={selectedObject}
            selectedKeyframe={selectedKeyframe}
            isScaleLocked={scene.isScaleLocked}
            getControlValue={(prop, axis) => scene.getControlValue(prop, currentTime, axis)}
            handleControlChange={scene.handleControlChange}
            handleUpdateObject={handleUpdateObject}
            handleRemoveObject={scene.handleRemoveObject}
            handleKeyframePropertyChange={scene.handleKeyframePropertyChange}
            handleRemoveKeyframe={scene.handleRemoveKeyframe}
            setIsScaleLocked={scene.setIsScaleLocked}
        />
      </Window>

      <Window 
        id="timeline" 
        title="SEQUENCER" 
        isOpen={showTimeline} 
        onClose={() => setShowTimeline(false)} 
        width={800} 
        height={450}
        isSnappingEnabled={scene.isSnappingEnabled}
        onToggleSnapping={() => scene.setIsSnappingEnabled(!scene.isSnappingEnabled)}
      >
          <TimelineSequencer 
            objects={objects} 
            setObjects={setObjects} 
            selectedId={scene.selectedId} 
            onSelect={(id) => { scene.setSelectedId(id); setShowProperties(true); }} 
            isPlaying={isPlaying} 
            onTogglePlay={handleTogglePlay} 
            currentTime={currentTime} 
            setCurrentTime={setCurrentTime} 
            totalDuration={totalDuration} 
            onAddKeyframe={() => scene.handleAddKeyframe(currentTime)} 
            selectedKeyframe={selectedKeyframe}
            onSelectKeyframe={(id, index) => scene.handleSelectKeyframe(id, index, setCurrentTime)}
            onRemoveKeyframe={scene.handleRemoveKeyframe}
            isSnappingEnabled={scene.isSnappingEnabled}
            onCopyAllKeyframesAsYaml={scene.handleCopyAllKeyframesAsYaml}
            onPasteAllKeyframesFromYaml={scene.handlePasteAllKeyframesFromYaml}
            onRemoveAllKeyframes={scene.handleRemoveAllKeyframes}
            copiedKeyframeYaml={scene.copiedKeyframeYaml}
          />
      </Window>

      <Dock 
        containerRef={containerRef}
        showAssets={showAssets}
        setShowAssets={setShowAssets}
        showTimeline={showTimeline}
        setShowTimeline={setShowTimeline}
        showProperties={showProperties}
        setShowProperties={setShowProperties}
      />
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
