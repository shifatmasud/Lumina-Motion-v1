

import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import gsap from 'gsap';
import { SceneObject, TimelineKeyframe } from '../engine';

// --- RDP Simplification Algorithm ---
interface RDPPoint {
    time: number;
    position: [number, number, number];
    keyframe: TimelineKeyframe;
}

function perpendicularDistance(point: RDPPoint, lineStart: RDPPoint, lineEnd: RDPPoint): number {
    const p = new THREE.Vector3().fromArray(point.position);
    const start = new THREE.Vector3().fromArray(lineStart.position);
    const end = new THREE.Vector3().fromArray(lineEnd.position);

    const lineVec = new THREE.Vector3().subVectors(end, start);
    const pointVec = new THREE.Vector3().subVectors(p, start);
    
    const lineLenSq = lineVec.lengthSq();
    if (lineLenSq === 0.0) {
        return pointVec.length();
    }

    const t = Math.max(0, Math.min(1, pointVec.dot(lineVec) / lineLenSq));
    const projection = start.clone().add(lineVec.multiplyScalar(t));
    return p.distanceTo(projection);
}

function rdp(points: RDPPoint[], tolerance: number): RDPPoint[] {
    if (points.length < 3) return points;

    let dmax = 0;
    let index = 0;
    const end = points.length - 1;

    for (let i = 1; i < end; i++) {
        const d = perpendicularDistance(points[i], points[0], points[end]);
        if (d > dmax) {
            index = i;
            dmax = d;
        }
    }

    if (dmax > tolerance) {
        const res1 = rdp(points.slice(0, index + 1), tolerance);
        const res2 = rdp(points.slice(index), tolerance);
        return res1.slice(0, res1.length - 1).concat(res2);
    } else {
        return [points[0], points[end]];
    }
}


export interface SimulationSettings {
    duration: number;
    fps: number;
    gravity: number;
    timeScale: number;
    simplificationTolerance: number;
    easing: 'none' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

export interface BakeConfig {
    objects: SceneObject[];
    startTime: number;
    simulationSettings: SimulationSettings;
    getInterpolatedValueAtTime: (objData: SceneObject, property: string, localTime: number) => any;
}

export const bakeScenePhysics = (config: BakeConfig): Map<string, TimelineKeyframe[]> => {
    const { objects, startTime, simulationSettings, getInterpolatedValueAtTime } = config;
    const { duration, fps, gravity, timeScale, simplificationTolerance, easing } = simulationSettings;

    const world = new CANNON.World();
    world.gravity.set(0, gravity, 0);
    world.broadphase = new CANNON.SAPBroadphase(world);
    (world.solver as CANNON.GSSolver).iterations = 10;
    world.allowSleep = true;

    const materials: { [id: string]: CANNON.Material } = {};
    const getMaterial = (id: string) => {
        if (!materials[id]) materials[id] = new CANNON.Material(`mat_${id}`);
        return materials[id];
    };
    
    const bodiesMap = new Map<string, CANNON.Body>();
    const dynamicBodyIds: string[] = [];

    objects.forEach(obj => {
        if (!obj.physics?.enabled) return;
        const localTime = Math.max(0, startTime - obj.startTime);
        const position = getInterpolatedValueAtTime(obj, 'position', localTime);
        const rotation = getInterpolatedValueAtTime(obj, 'rotation', localTime);
        const scale = getInterpolatedValueAtTime(obj, 'scale', localTime);
        const shape = new CANNON.Box(new CANNON.Vec3(Math.abs(scale[0])/2, Math.abs(scale[1])/2, Math.abs(scale[2])/2));
        const body = new CANNON.Body({ mass: obj.physics.type === 'dynamic' ? obj.physics.mass : 0, material: getMaterial(obj.id) });
        body.addShape(shape);
        body.position.set(position[0], position[1], position[2]);
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(THREE.MathUtils.degToRad(rotation[0]), THREE.MathUtils.degToRad(rotation[1]), THREE.MathUtils.degToRad(rotation[2])));
        body.quaternion.set(q.x, q.y, q.z, q.w);
        world.addBody(body);
        bodiesMap.set(obj.id, body);
        if(obj.physics.type === 'dynamic') dynamicBodyIds.push(obj.id);
    });

    const objIds = Array.from(bodiesMap.keys());
    for(let i = 0; i < objIds.length; i++) {
        for(let j = i; j < objIds.length; j++) {
            const idA = objIds[i]; const idB = objIds[j];
            const objA = objects.find(o => o.id === idA)!; const objB = objects.find(o => o.id === idB)!;
            const matA = getMaterial(idA); const matB = getMaterial(idB);
            const contactMaterial = new CANNON.ContactMaterial(matA, matB, { friction: Math.min(objA.physics!.friction, objB.physics!.friction), restitution: Math.max(objA.physics!.restitution, objB.physics!.restitution) });
            world.addContactMaterial(contactMaterial);
        }
    }
    
    // One-time impulse logic
    bodiesMap.forEach((body, id) => {
        const obj = objects.find(o => o.id === id);
        if (body.mass > 0 && obj?.physics?.force && obj.physics.force.preset !== 'none') {
            const { preset, strength } = obj.physics.force;
            if (['pull_in_source', 'push_out_source'].includes(preset)) return;

            let direction = new CANNON.Vec3(0, 0, 0);
            switch (preset) {
                case 'push_up': direction.set(0, 1, 0); break;
                case 'push_down': direction.set(0, -1, 0); break;
                case 'push_forward': direction.set(0, 0, -1); break;
                case 'push_backward': direction.set(0, 0, 1); break;
                case 'pull_center': direction = body.position.clone().negate(); break;
                case 'push_from_center': direction = body.position.clone(); break;
            }
            if (direction.lengthSquared() > 0) {
                direction.normalize();
                body.applyImpulse(direction.scale(strength), body.position);
            }
        }
    });
    
    // Continuous force sources
    const forceSources = objects.filter(obj => 
        obj.physics?.enabled && obj.physics.force && ['pull_in_source', 'push_out_source'].includes(obj.physics.force.preset)
    );

    const timeStep = 1 / fps;
    const totalSteps = Math.ceil(duration * fps);
    const recordings = new Map<string, TimelineKeyframe[]>();
    dynamicBodyIds.forEach(id => recordings.set(id, []));

    for (let i = 0; i < totalSteps; i++) {
        // Apply continuous forces before stepping the world
        forceSources.forEach(sourceObj => {
            const sourceBody = bodiesMap.get(sourceObj.id);
            if (!sourceBody) return;

            const { preset, strength } = sourceObj.physics!.force!;
            dynamicBodyIds.forEach(targetId => {
                if (sourceObj.id === targetId) return;

                const targetBody = bodiesMap.get(targetId);
                if (!targetBody) return;
                
                const direction = new CANNON.Vec3();
                targetBody.position.vsub(sourceBody.position, direction);
                
                if (direction.lengthSquared() < 0.01) return;
                
                direction.normalize();

                if (preset === 'pull_in_source') {
                    direction.scale(-strength, direction);
                } else {
                    direction.scale(strength, direction);
                }
                targetBody.applyForce(direction, targetBody.position);
            });
        });

        world.step(timeStep * timeScale);

        dynamicBodyIds.forEach(id => {
            const body = bodiesMap.get(id)!;
            const pos: [number, number, number] = [body.position.x, body.position.y, body.position.z];
            const quat = new THREE.Quaternion(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w);
            const euler = new THREE.Euler().setFromQuaternion(quat, 'XYZ');
            const rot: [number, number, number] = [THREE.MathUtils.radToDeg(euler.x), THREE.MathUtils.radToDeg(euler.y), THREE.MathUtils.radToDeg(euler.z)];
            recordings.get(id)!.push({ time: Number(((i + 1) * timeStep).toFixed(3)), values: { position: pos, rotation: rot }, easing: 'none' });
        });
    }

    const finalKeyframes = new Map<string, TimelineKeyframe[]>();
    recordings.forEach((keyframes, id) => {
        let processedKeyframes = [...keyframes];
        if (processedKeyframes.length === 0) {
            finalKeyframes.set(id, []);
            return;
        }

        if (simplificationTolerance > 0 && processedKeyframes.length > 2) {
            const rdpPoints: RDPPoint[] = processedKeyframes.map(kf => ({ time: kf.time, position: kf.values.position as [number, number, number], keyframe: kf }));
            const simplifiedPoints = rdp(rdpPoints, simplificationTolerance);
            processedKeyframes = simplifiedPoints.map(p => p.keyframe);
        }

        if (easing !== 'none' && processedKeyframes.length > 1) {
            const easingFunction = gsap.parseEase({ 'ease-in': 'power2.in', 'ease-out': 'power2.out', 'ease-in-out': 'power2.inOut' }[easing] || 'none');
            const simDuration = processedKeyframes[processedKeyframes.length - 1].time;
            if (simDuration > 0) {
                processedKeyframes = processedKeyframes.map(kf => ({ ...kf, time: Number((easingFunction(kf.time / simDuration) * simDuration).toFixed(3)) }));
            }
        }
        
        finalKeyframes.set(id, processedKeyframes);
    });
    return finalKeyframes;
}