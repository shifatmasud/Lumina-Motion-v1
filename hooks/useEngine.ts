
import { useRef, useEffect, useState } from 'react';
import { Engine, SceneObject, GlobalSettings } from '../engine';

export const useEngine = (
    objects: SceneObject[],
    globalSettings: GlobalSettings,
    currentTime: number,
    isPlaying: boolean,
    onSelectObject: (id: string | null) => void
) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const engineRef = useRef<Engine | null>(null);
    const prevTimeRef = useRef(0);
    const [engineInstance, setEngineInstance] = useState<Engine | null>(null);

    // Engine Init
    useEffect(() => {
        if (containerRef.current && !engineRef.current) {
            const engine = new Engine(containerRef.current, onSelectObject);
            engineRef.current = engine;
            setEngineInstance(engine);
        }
    }, [onSelectObject]);

    // Sync state to engine
    useEffect(() => {
        if (engineRef.current) engineRef.current.sync(objects);
    }, [objects]);
  
    useEffect(() => {
        if (engineRef.current) {
            const timeHasChanged = prevTimeRef.current !== currentTime;
            engineRef.current.setTime(currentTime, objects, isPlaying, timeHasChanged);
            prevTimeRef.current = currentTime;
        }
    }, [currentTime, objects, isPlaying]);

    useEffect(() => {
        if (engineRef.current) engineRef.current.updateGlobalSettings(globalSettings);
    }, [globalSettings]);

    // Aspect Ratio and Resize Handler
    useEffect(() => {
        const applyAspectRatio = () => {
            if (!containerRef.current) return;
            const canvasContainer = containerRef.current;
            const parent = canvasContainer.parentElement;
            if (!parent) return;
            
            const parentWidth = parent.clientWidth;
            const parentHeight = parent.clientHeight;

            if (globalSettings.aspectRatio === 'free' || !globalSettings.aspectRatio) {
                canvasContainer.style.width = '100%';
                canvasContainer.style.height = '100%';
                canvasContainer.style.position = 'absolute';
                canvasContainer.style.top = '0';
                canvasContainer.style.left = '0';
                canvasContainer.style.transform = 'none';
            } else {
                const [w, h] = globalSettings.aspectRatio.split(':').map(Number);
                const targetRatio = w / h;
                const parentRatio = parentWidth / parentHeight;

                let newWidth, newHeight;
                if (parentRatio > targetRatio) { // Pillarbox
                    newHeight = parentHeight;
                    newWidth = newHeight * targetRatio;
                } else { // Letterbox
                    newWidth = parentWidth;
                    newHeight = newWidth / targetRatio;
                }

                canvasContainer.style.width = `${newWidth}px`;
                canvasContainer.style.height = `${newHeight}px`;
                canvasContainer.style.position = 'absolute';
                canvasContainer.style.top = '50%';
                canvasContainer.style.left = '50%';
                canvasContainer.style.transform = 'translate(-50%, -50%)';
            }

            if (engineRef.current) {
                engineRef.current.onResize();
            }
        };

        applyAspectRatio();
        const resizeObserver = new ResizeObserver(applyAspectRatio);
        if (containerRef.current?.parentElement) {
            resizeObserver.observe(containerRef.current.parentElement);
        }
        
        return () => {
            resizeObserver.disconnect();
        };
    }, [globalSettings.aspectRatio]);

    return { containerRef, engine: engineInstance };
};
