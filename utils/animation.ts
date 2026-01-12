
import gsap from 'gsap';
import { SceneObject, TimelineKeyframe } from '../engine';

export const getInterpolatedValueAtTime = (objData: SceneObject, property: string, localTime: number) => {
    const baseValue = objData[property as keyof SceneObject];
    if (!objData.animations || objData.animations.length === 0) return baseValue;

    const keyframes = [...objData.animations];
    const baseState: TimelineKeyframe['values'] = {
        position: objData.position, rotation: objData.rotation, scale: objData.scale,
        metalness: objData.metalness, roughness: objData.roughness, opacity: objData.opacity, volume: objData.volume,
        curvature: objData.curvature, transmission: objData.transmission, ior: objData.ior, thickness: objData.thickness,
        clearcoat: objData.clearcoat, clearcoatRoughness: objData.clearcoatRoughness, extrusion: objData.extrusion,
        pathLength: objData.pathLength, color: objData.color, intensity: objData.intensity,
    };
    const baseKeyframe: TimelineKeyframe = { time: 0, values: {}, easing: 'none' };

    let departureKf = baseKeyframe;
    let arrivalKf: TimelineKeyframe | null = null;
    for (const kf of keyframes) {
        if (kf.time <= localTime) departureKf = kf;
        else { arrivalKf = kf; break; }
    }
    if (!arrivalKf) arrivalKf = departureKf;

    const departureValues = { ...baseState, ...departureKf.values };
    const arrivalValues = { ...baseState, ...arrivalKf.values };
    
    const startVal = departureValues[property as keyof typeof departureValues];
    const endVal = arrivalValues[property as keyof typeof arrivalValues];

    if (startVal === undefined || endVal === undefined) return baseValue;

    const duration = arrivalKf.time - departureKf.time;
    const progress = duration > 0 ? (localTime - departureKf.time) / duration : 1;
    
    const ease = gsap.parseEase(arrivalKf.easing || 'none');
    const easedProgress = ease(progress);

    if (property === 'color' && typeof startVal === 'string' && typeof endVal === 'string') {
        return gsap.utils.interpolate(startVal, endVal)(easedProgress);
    }

    return gsap.utils.interpolate(startVal, endVal, easedProgress);
};

export const getFullKeyframeValuesAtTime = (object: SceneObject, time: number): TimelineKeyframe['values'] => {
    const values: Partial<TimelineKeyframe['values']> = {};
    
    const animatableProps: { [key in SceneObject['type']]?: (keyof TimelineKeyframe['values'])[] } = {
        'mesh': ['position', 'rotation', 'scale', 'opacity', 'metalness', 'roughness', 'transmission', 'ior', 'thickness', 'clearcoat', 'clearcoatRoughness', 'color'],
        'svg': ['position', 'rotation', 'scale', 'opacity', 'metalness', 'roughness', 'transmission', 'ior', 'thickness', 'clearcoat', 'clearcoatRoughness', 'extrusion', 'pathLength', 'color'],
        'plane': ['position', 'rotation', 'scale', 'opacity', 'curvature'],
        'lottie': ['position', 'rotation', 'scale', 'opacity'],
        'video': ['position', 'rotation', 'scale', 'opacity', 'curvature', 'volume'],
        'glb': ['position', 'rotation', 'scale', 'opacity'],
        'audio': ['position', 'volume'],
        'camera': ['position', 'rotation'],
        'light': ['position', 'rotation', 'color', 'intensity']
    };

    const propsForType = animatableProps[object.type] || [];
    
    propsForType.forEach(prop => {
        const value = getInterpolatedValueAtTime(object, prop, time);
        if (value !== undefined) {
            (values as any)[prop] = value;
        }
    });
    
    return values;
};
