
import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { TimelineKeyframe } from '../engine';

export interface PhysicsConfig {
    duration: number;
    fps: number;
    mass: number;
    bounciness: number;
    friction: number;
    velocity: [number, number, number];
    gravity: number;
    initialPosition: [number, number, number];
    initialRotation: [number, number, number]; // Degrees
    scale: [number, number, number];
    simplification: number; // Detail level from 1 (max simplify) to 100 (raw)
}

type RDPPoint = { index: number; position: CANNON.Vec3 };

// --- Ramer-Douglas-Peucker Simplification ---

function perpendicularDistance(point: CANNON.Vec3, lineStart: CANNON.Vec3, lineEnd: CANNON.Vec3): number {
    const l2 = lineStart.distanceSquared(lineEnd);
    if (l2 === 0.0) return point.distanceTo(lineStart);
    
    const t = Math.max(0, Math.min(1, point.vsub(lineStart).dot(lineEnd.vsub(lineStart)) / l2));
    const projection = lineStart.vadd(lineEnd.vsub(lineStart).scale(t));
    
    return point.distanceTo(projection);
}

function ramerDouglasPeucker(points: RDPPoint[], epsilon: number): RDPPoint[] {
    if (points.length < 3) return points;

    let dmax = 0;
    let index = 0;
    const end = points.length - 1;

    for (let i = 1; i < end; i++) {
        const d = perpendicularDistance(points[i].position, points[0].position, points[end].position);
        if (d > dmax) {
            index = i;
            dmax = d;
        }
    }

    if (dmax > epsilon) {
        const recResults1 = ramerDouglasPeucker(points.slice(0, index + 1), epsilon);
        const recResults2 = ramerDouglasPeucker(points.slice(index), epsilon);
        return recResults1.slice(0, recResults1.length - 1).concat(recResults2);
    } else {
        return [points[0], points[end]];
    }
}

function simplifyKeyframes(keyframes: TimelineKeyframe[], epsilon: number): TimelineKeyframe[] {
    if (epsilon <= 0 || keyframes.length < 3) {
        return keyframes;
    }

    const rdpPoints: RDPPoint[] = keyframes.map((kf, i) => ({
        index: i,
        position: new CANNON.Vec3(kf.values.position![0], kf.values.position![1], kf.values.position![2]),
    }));

    const simplifiedPoints = ramerDouglasPeucker(rdpPoints, epsilon);
    
    const simplifiedKeyframes = simplifiedPoints.map(p => keyframes[p.index]);
    
    // Set a smooth easing for the new, longer segments between keyframes
    return simplifiedKeyframes.map((kf, i, arr) => {
        if (i < arr.length - 1) {
            return { ...kf, easing: 'power1.out' };
        }
        return { ...kf, easing: 'none' }; // Last keyframe doesn't need an ease
    });
}

// --- Main Generation Function ---

export const generatePhysicsKeyframes = (config: PhysicsConfig): TimelineKeyframe[] => {
    // Setup World
    const world = new CANNON.World();
    world.gravity.set(0, config.gravity, 0);
    world.broadphase = new CANNON.NaiveBroadphase();
    (world.solver as CANNON.GSSolver).iterations = 10;

    // Materials
    const mat = new CANNON.Material('objMat');
    const groundMat = new CANNON.Material('groundMat');
    const contactMat = new CANNON.ContactMaterial(groundMat, mat, {
        friction: config.friction,
        restitution: config.bounciness
    });
    world.addContactMaterial(contactMat);

    // Body
    const halfExtents = new CANNON.Vec3(Math.abs(config.scale[0])/2, Math.abs(config.scale[1])/2, Math.abs(config.scale[2])/2);
    const shape = new CANNON.Box(halfExtents);
    const body = new CANNON.Body({
        mass: config.mass,
        material: mat,
        shape: shape
    });

    body.position.set(config.initialPosition[0], config.initialPosition[1], config.initialPosition[2]);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(
        THREE.MathUtils.degToRad(config.initialRotation[0]),
        THREE.MathUtils.degToRad(config.initialRotation[1]),
        THREE.MathUtils.degToRad(config.initialRotation[2])
    ));
    body.quaternion.set(q.x, q.y, q.z, q.w);
    body.velocity.set(config.velocity[0], config.velocity[1], config.velocity[2]);
    world.addBody(body);

    // Ground
    const groundShape = new CANNON.Plane();
    const groundBody = new CANNON.Body({ mass: 0, material: groundMat });
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0); 
    groundBody.addShape(groundShape);
    world.addBody(groundBody);

    const rawKeyframes: TimelineKeyframe[] = [];
    const timeStep = 1 / config.fps;
    const totalSteps = Math.ceil(config.duration * config.fps);

    for (let i = 1; i <= totalSteps; i++) {
        world.step(timeStep);
        
        const pos: [number, number, number] = [body.position.x, body.position.y, body.position.z];
        
        const quat = new THREE.Quaternion(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w);
        const euler = new THREE.Euler().setFromQuaternion(quat);
        const rot: [number, number, number] = [
            THREE.MathUtils.radToDeg(euler.x),
            THREE.MathUtils.radToDeg(euler.y),
            THREE.MathUtils.radToDeg(euler.z)
        ];

        rawKeyframes.push({
            time: Number((i * timeStep).toFixed(3)),
            values: {
                position: pos,
                rotation: rot
            },
            easing: 'none'
        });
    }
    
    // If simplification is set to max (100), return raw frames. Otherwise, simplify.
    if (config.simplification >= 100) {
        return rawKeyframes;
    }
    
    // Map simplification (1-100) to an epsilon value for the algorithm.
    // Lower simplification value = higher epsilon = more simplification.
    const maxEpsilon = 0.5; // Controls max simplification strength
    const epsilon = maxEpsilon * (1 - (config.simplification / 100));

    return simplifyKeyframes(rawKeyframes, epsilon);
}
