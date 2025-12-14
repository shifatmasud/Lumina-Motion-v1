

import React from 'react';
import { Plus, Export, Image as ImageIcon, Cube } from '@phosphor-icons/react';
import { DesignSystem } from '../../theme';
import { Button, Divider } from '../Core/Primitives';
import { SceneObject } from '../../engine';

interface AssetsPanelProps {
    onAddObject: (type: SceneObject['type'], url?: string, width?: number, height?: number) => void;
    onExportVideo: () => void;
    onExportYaml: () => void;
    onFileDrop: (e: React.DragEvent) => void;
    onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const AssetsPanel: React.FC<AssetsPanelProps> = ({ onAddObject, onExportVideo, onExportYaml, onFileDrop, onFileUpload }) => {
    return (
        <div onDragOver={(e) => e.preventDefault()} onDrop={onFileDrop} style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: DesignSystem.Space(3) }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: DesignSystem.Space(2) }}>
                <Button onClick={() => onAddObject('mesh')} style={{ flexDirection: 'column', height: '90px', gap: '8px' }}>
                    <div style={{ width: '32px', height: '32px', background: DesignSystem.Color.Base.Surface[2], borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: DesignSystem.Color.Accent.Surface[1] }}>
                        <Cube size={18} weight="fill" />
                    </div> <span style={DesignSystem.Type.Label.S}>Cube</span>
                </Button>
                <label style={{ display: 'contents' }}>
                    <input type="file" accept=".png,.gif,.jpg,.jpeg,.webp,.mp4,.svg,.wav,.mp3,.ogg,.glb,.gltf,.lottie" hidden onChange={onFileUpload} />
                    <Button as="div" style={{ flexDirection: 'column', height: '90px', gap: '8px' }}>
                        <div style={{ width: '32px', height: '32px', background: DesignSystem.Color.Base.Surface[2], borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                             <Plus size={18} />
                        </div> <span style={DesignSystem.Type.Label.S}>Import</span>
                    </Button>
                </label>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: DesignSystem.Space(2) }}>
                <Button onClick={onExportVideo} variant="primary" style={{ width: '100%', gap: '8px' }}>
                    <Export size={16} weight="bold" /> VIDEO
                </Button>
                <Button onClick={onExportYaml} variant="secondary" style={{ width: '100%', gap: '8px' }}>
                    <Export size={16} weight="bold" /> YAML
                </Button>
            </div>

            <Divider />
            <div style={{ flex: 1, border: `1px dashed ${DesignSystem.Color.Base.Border[2]}`, borderRadius: DesignSystem.Effect.Radius.M, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', color: DesignSystem.Color.Base.Content[3], background: 'rgba(255,255,255,0.01)', textAlign: 'center', padding: '12px' }}>
                <ImageIcon size={24} /> <span style={DesignSystem.Type.Label.S}>Drag PNG, GIF, JPG, MP4, WAV, GLB, .LOTTIE...</span>
            </div>
         </div>
    );
};