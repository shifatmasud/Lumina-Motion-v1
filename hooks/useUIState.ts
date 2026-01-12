
import { useState } from 'react';

export const useUIState = () => {
  const [showAssets, setShowAssets] = useState(false);
  const [showTimeline, setShowTimeline] = useState(true);
  const [showProperties, setShowProperties] = useState(true);
  const [showProjectSettings, setShowProjectSettings] = useState(false);
  const [showPhysicsPanel, setShowPhysicsPanel] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  return {
    showAssets, setShowAssets,
    showTimeline, setShowTimeline,
    showProperties, setShowProperties,
    showProjectSettings, setShowProjectSettings,
    showPhysicsPanel, setShowPhysicsPanel,
    showExportModal, setShowExportModal,
  };
};
