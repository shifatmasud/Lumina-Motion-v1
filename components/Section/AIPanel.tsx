
import React, { useState } from 'react';
import { MagicWand, CircleNotch, WarningCircle, CheckCircle } from '@phosphor-icons/react';
import { GoogleGenAI } from "@google/genai";
import { DesignSystem } from '../../theme';
import { Button, Group } from '../Core/Primitives';

interface AIPanelProps {
    onApplyYaml: (yaml: string) => void;
}

export const AIPanel: React.FC<AIPanelProps> = ({ onApplyYaml }) => {
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setIsLoading(true);
        setError(null);
        setSuccess(false);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: 'gemini-3-pro-preview',
                contents: `Generate a Lumina scene YAML file based on this description: "${prompt}". 
                Respond ONLY with the YAML code block. Do not include any explanation.
                Ensure the YAML follows the version 1.4-humane-yaml structure.
                Include objects like meshes, lights, and cameras with interesting animations.`,
                config: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                }
            });

            const text = response.text || '';
            const yamlContent = text.replace(/```yaml/g, '').replace(/```/g, '').trim();
            
            if (yamlContent) {
                onApplyYaml(yamlContent);
                setSuccess(true);
                setTimeout(() => setSuccess(false), 3000);
            } else {
                throw new Error("Received empty YAML from AI.");
            }
        } catch (err: any) {
            console.error("Gemini Error:", err);
            setError(err.message || "Failed to generate scene. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: DesignSystem.Space(4) }}>
            <Group title="GENERATE SCENE" icon={<MagicWand weight="fill" />}>
                <p style={{ ...DesignSystem.Type.Body.M, color: DesignSystem.Color.Base.Content[2], fontSize: '12px' }}>
                    Describe the scene you want to create, and Lumina AI will generate the objects and animations for you.
                </p>
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g. A futuristic neon city with floating cubes and glowing lights..."
                    style={{
                        width: '100%',
                        height: '100px',
                        background: DesignSystem.Color.Base.Surface[3],
                        border: `1px solid ${DesignSystem.Color.Base.Border[2]}`,
                        borderRadius: DesignSystem.Effect.Radius.M,
                        padding: DesignSystem.Space(3),
                        color: DesignSystem.Color.Base.Content[1],
                        fontFamily: DesignSystem.Type.Body.M.fontFamily,
                        fontSize: '13px',
                        outline: 'none',
                        resize: 'none',
                        transition: 'border-color 0.2s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = DesignSystem.Color.Accent.Surface[1]}
                    onBlur={(e) => e.target.style.borderColor = DesignSystem.Color.Base.Border[2]}
                />
                
                <Button 
                    onClick={handleGenerate} 
                    disabled={isLoading || !prompt.trim()}
                    variant="primary"
                    style={{ width: '100%', height: '42px', gap: '8px' }}
                >
                    {isLoading ? (
                        <CircleNotch size={18} weight="bold" className="animate-spin" />
                    ) : (
                        <MagicWand size={18} weight="fill" />
                    )}
                    {isLoading ? 'DREAMING...' : 'GENERATE MAGIC'}
                </Button>

                {error && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', background: 'rgba(255, 68, 68, 0.1)', borderRadius: '8px', color: DesignSystem.Color.Feedback.Error, fontSize: '12px' }}>
                        <WarningCircle size={16} />
                        {error}
                    </div>
                )}

                {success && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', color: DesignSystem.Color.Feedback.Success, fontSize: '12px' }}>
                        <CheckCircle size={16} />
                        Scene applied successfully!
                    </div>
                )}
            </Group>

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .animate-spin { animation: spin 1s linear infinite; }
            `}</style>
        </div>
    );
};
