
import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import JSZip from 'https://esm.sh/jszip@3.10.1';
import WebMWriter from 'https://esm.sh/webm-writer@^1.0.0';
import { X, FileArchive, CheckCircle, FileVideo, CircleNotch } from '@phosphor-icons/react';

import { DesignSystem } from '../../theme';
import { Engine, SceneObject } from '../../engine';
import { Button, Group, Select, Slider } from '../Core/Primitives';

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    engine: Engine | null;
    objects: SceneObject[];
    totalDuration: number;
}

type ExportFormat = 'png' | 'jpeg' | 'webp' | 'webm';
type ExportStatus = 'idle' | 'exporting' | 'done' | 'cancelled';

const FRAMES_PER_BATCH = 5; // Process this many frames before yielding control to the browser

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, engine, objects, totalDuration }) => {
    const [settings, setSettings] = useState({
        fps: 30,
        quality: 0.9,
        format: 'webm' as ExportFormat
    });
    const [status, setStatus] = useState<ExportStatus>('idle');
    const [progress, setProgress] = useState(0);
    const cancelExportRef = useRef(false);

    const handleClose = () => {
        if (status === 'exporting') return;
        setStatus('idle');
        setProgress(0);
        onClose();
    };
    
    const handleCancel = () => {
        cancelExportRef.current = true;
        setStatus('cancelled');
    };

    const canvasToBlob = (canvas: HTMLCanvasElement, format: ExportFormat, quality?: number): Promise<Blob | null> => {
        const mimeType = `image/${format}`;
        return new Promise(resolve => canvas.toBlob(resolve, mimeType, quality));
    };

    const startExport = async () => {
        if (!engine) {
            alert('Export failed: Rendering engine not available.');
            return;
        }

        setStatus('exporting');
        setProgress(0);
        cancelExportRef.current = false;

        const totalFrames = Math.ceil(totalDuration * settings.fps);
        const timeStep = 1 / settings.fps;
        
        let blob: Blob | null = null;
        let filename: string = '';

        if (settings.format === 'webm') {
            const writer = new WebMWriter({
                quality: settings.quality,
                frameRate: settings.fps,
            });

            for (let i = 0; i < totalFrames; i++) {
                if (cancelExportRef.current) { setStatus('cancelled'); return; }

                const time = i * timeStep;
                engine.setTime(time, objects, false, true);
                engine.composer.render();
                
                writer.addFrame(engine.renderer.domElement);
                
                // Yield to the event loop periodically to prevent UI freezes
                if ((i + 1) % FRAMES_PER_BATCH === 0 || i === totalFrames - 1) {
                    await new Promise(resolve => setTimeout(resolve, 0)); 
                }
                setProgress((i + 1) / totalFrames);
            }
            if (cancelExportRef.current) return;
            blob = await writer.complete();
            filename = 'lumina-export.webm';
        } else {
            const zip = new JSZip();
            const pad = totalFrames.toString().length;

            for (let i = 0; i < totalFrames; i++) {
                if (cancelExportRef.current) { setStatus('cancelled'); return; }
                const time = i * timeStep;
                engine.setTime(time, objects, false, true);
                engine.composer.render();
                
                // canvasToBlob is already async, so it yields.
                // zip.file is synchronous but typically fast per call.
                const frameBlob = await canvasToBlob(engine.renderer.domElement, settings.format, settings.format !== 'png' ? settings.quality : undefined);
                if (frameBlob) {
                    zip.file(`frame_${(i).toString().padStart(pad, '0')}.${settings.format}`, frameBlob);
                }
                
                // Yield to the event loop periodically to prevent UI freezes
                if ((i + 1) % FRAMES_PER_BATCH === 0 || i === totalFrames - 1) {
                    await new Promise(resolve => setTimeout(resolve, 0)); 
                }
                setProgress((i + 1) / totalFrames);
            }
            if (cancelExportRef.current) return;
            // The compression itself in generateAsync is highly optimized and often uses Web Workers internally,
            // so it's inherently non-blocking for the main thread during the heavy part.
            blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 9 } });
            filename = 'lumina-export.zip';
        }

        if (cancelExportRef.current) return;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setStatus('done');
    };

    const viewVariants = {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -10 },
    };

    const renderContent = () => {
        const isSequenceExport = settings.format !== 'webm';
        const infoText = isSequenceExport
            ? 'Exports an image sequence in a ZIP file. Import into any video editor to create a video.'
            : 'Exports a high-quality WebM video file, ready for sharing.';

        return (
             <div style={{ position: 'relative', minHeight: '280px' }}>
                <AnimatePresence mode="wait">
                    {status === 'exporting' && (
                         <motion.div
                            key="exporting"
                            variants={viewVariants}
                            initial="initial" animate="animate" exit="exit"
                            transition={{ duration: 0.3 }}
                            style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: DesignSystem.Space(4) }}
                        >
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                            >
                                <CircleNotch size={48} weight="bold" color={DesignSystem.Color.Accent.Surface[1]} />
                            </motion.div>
                            <span style={DesignSystem.Type.Label.L}>RENDERING...</span>
                            <div style={{ width: '100%', background: DesignSystem.Color.Base.Surface[3], borderRadius: '4px', overflow: 'hidden' }}>
                                <motion.div style={{ width: '100%', height: '8px', background: DesignSystem.Color.Accent.Surface[1], transformOrigin: 'left' }} animate={{ scaleX: progress }} transition={{ duration: 0.1 }} />
                            </div>
                            <span style={DesignSystem.Type.Label.M}>{Math.round(progress * 100)}% COMPLETE</span>
                            <Button onClick={handleCancel} variant="secondary">Cancel</Button>
                        </motion.div>
                    )}
                    {(status === 'done' || status === 'cancelled') && (
                        <motion.div
                            key="result"
                            variants={viewVariants}
                            initial="initial" animate="animate" exit="exit"
                            transition={{ duration: 0.3 }}
                            style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: DesignSystem.Space(4) }}
                        >
                            <CheckCircle size={48} weight="fill" color={DesignSystem.Color.Feedback.Success} />
                            <span style={DesignSystem.Type.Label.L}>{status === 'done' ? 'Export Complete!' : 'Export Cancelled'}</span>
                            <span style={DesignSystem.Type.Body.M}>{status === 'done' ? 'Your file has been downloaded.' : 'The export process was stopped.'}</span>
                            <Button onClick={handleClose} variant="primary">Close</Button>
                        </motion.div>
                    )}
                    {status === 'idle' && (
                        <motion.div
                            key="idle"
                            variants={viewVariants}
                            initial="initial" animate="animate" exit="exit"
                            transition={{ duration: 0.3 }}
                            style={{ display: 'flex', flexDirection: 'column', gap: DesignSystem.Space(4) }}
                        >
                             <Group title="EXPORT SETTINGS">
                                <Select label="FORMAT" value={settings.format} onChange={e => setSettings(s => ({ ...s, format: e.target.value as ExportFormat }))}>
                                    <option value="webm">Animated WebM (.webm video)</option>
                                    <option value="png">PNG Sequence (.zip)</option>
                                    <option value="jpeg">JPEG Sequence (.zip)</option>
                                    <option value="webp">WebP Sequence (.zip)</option>
                                </Select>
                                <Select label="FRAMERATE (FPS)" value={settings.fps} onChange={e => setSettings(s => ({ ...s, fps: parseInt(e.target.value, 10) }))}>
                                    <option value={24}>24 (Film)</option>
                                    <option value={30}>30 (Standard)</option>
                                    <option value={60}>60 (Smooth)</option>
                                </Select>
                                {settings.format !== 'png' && (
                                    <Slider label="QUALITY" value={settings.quality} min={0.1} max={1} step={0.05} onChange={v => setSettings(s => ({ ...s, quality: v }))} />
                                )}
                            </Group>
                            <div style={{...DesignSystem.Type.Label.S, color: DesignSystem.Color.Base.Content[3], padding: DesignSystem.Space(2), textAlign: 'center', background: DesignSystem.Color.Base.Surface[1], borderRadius: DesignSystem.Effect.Radius.S}}>
                                {infoText}
                            </div>
                            <Button onClick={startExport} variant="primary" style={{ gap: DesignSystem.Space(2) }}>
                                {isSequenceExport ? <FileArchive size={16} weight="bold" /> : <FileVideo size={16} weight="bold" />}
                                 START EXPORT
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    };

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }}
                    onPointerDown={handleClose}
                >
                    <motion.div
                        initial={{ scale: 0.95, y: 10, opacity: 0 }}
                        animate={{ scale: 1, y: 0, opacity: 1 }}
                        exit={{ scale: 0.95, y: 10, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        style={{
                            width: '360px',
                            padding: DesignSystem.Space(4),
                            position: 'relative',
                            backgroundColor: DesignSystem.Color.Base.Surface['3b'],
                            backdropFilter: 'blur(32px)',
                            WebkitBackdropFilter: 'blur(32px)',
                            borderRadius: DesignSystem.Effect.Radius.L,
                            border: `1px solid ${DesignSystem.Color.Base.Border[1]}`,
                            boxShadow: DesignSystem.Effect.Shadow.Depth,
                        }}
                        onPointerDown={e => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: DesignSystem.Space(3) }}>
                            <span style={DesignSystem.Type.Label.L}>EXPORT</span>
                            <Button variant="ghost" onClick={handleClose} style={{ padding: '4px', width: '28px', height: '28px' }}>
                                <X size={16} />
                            </Button>
                        </div>
                        {renderContent()}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};
    