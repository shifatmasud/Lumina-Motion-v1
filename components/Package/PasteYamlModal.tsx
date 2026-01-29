
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ClipboardText } from '@phosphor-icons/react';

import { DesignSystem } from '../../theme';
import { Button } from '../Core/Primitives';

interface PasteYamlModalProps {
    isOpen: boolean;
    onClose: () => void;
    onPaste: (yaml: string) => void;
    title: string;
}

export const PasteYamlModal: React.FC<PasteYamlModalProps> = ({ isOpen, onClose, onPaste, title }) => {
    const [yaml, setYaml] = useState('');

    const handleSubmit = () => {
        if (yaml.trim()) {
            onPaste(yaml);
        }
    };

    useEffect(() => {
        if (isOpen) {
            setYaml('');
        }
    }, [isOpen]);

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }}
                    onPointerDown={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.95, y: 10, opacity: 0 }}
                        animate={{ scale: 1, y: 0, opacity: 1 }}
                        exit={{ scale: 0.95, y: 10, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        style={{
                            width: '400px',
                            maxWidth: '90vw',
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
                            <span style={DesignSystem.Type.Label.L}>{title || 'PASTE YAML'}</span>
                            <Button variant="ghost" onClick={onClose} style={{ padding: '4px', width: '28px', height: '28px' }}>
                                <X size={16} />
                            </Button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: DesignSystem.Space(3) }}>
                            <p style={{...DesignSystem.Type.Body.M, color: DesignSystem.Color.Base.Content[2], lineHeight: 1.4}}>
                                Automatic clipboard access was blocked. Please manually paste your YAML content below and click "Submit".
                            </p>
                            <textarea
                                value={yaml}
                                onChange={(e) => setYaml(e.target.value)}
                                placeholder="--- Paste YAML here ---"
                                style={{
                                    width: '100%',
                                    minHeight: '200px',
                                    background: DesignSystem.Color.Base.Surface[3],
                                    border: `1px solid ${DesignSystem.Color.Base.Border[2]}`,
                                    borderRadius: DesignSystem.Effect.Radius.M,
                                    color: DesignSystem.Color.Base.Content[1],
                                    padding: DesignSystem.Space(3),
                                    fontFamily: DesignSystem.Type.Label.S.fontFamily,
                                    fontSize: '12px',
                                    outline: 'none',
                                    resize: 'vertical',
                                    transition: 'border-color 0.2s',
                                }}
                                onFocus={(e) => e.target.style.borderColor = DesignSystem.Color.Accent.Surface[1]}
                                onBlur={(e) => e.target.style.borderColor = DesignSystem.Color.Base.Border[2]}
                            />
                            <Button onClick={handleSubmit} variant="primary" style={{ gap: DesignSystem.Space(2) }}>
                                <ClipboardText size={16} weight="bold" />
                                SUBMIT & APPLY
                            </Button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};