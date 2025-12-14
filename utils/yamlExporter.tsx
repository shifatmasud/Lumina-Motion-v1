
import yaml from 'js-yaml';
import { GlobalSettings, SceneObject, TimelineKeyframe } from '../engine';

export const createYamlString = (settingsData: GlobalSettings, objectsData: SceneObject[]): string => {
  // Helper to build a category object, returning undefined if it has no valid keys
  const buildCategory = (data: object) => {
    // This trick removes keys with `undefined` values
    const cleaned = JSON.parse(JSON.stringify(data));
    return Object.keys(cleaned).length > 0 ? cleaned : undefined;
  };
  
  const scene = {
    projectName: "My Lumina Scene",
    version: "1.3-humane-yaml",
    exportedAt: new Date().toISOString(),
    settings: {
      backgroundColor: settingsData.backgroundColor,
      ground: { show: settingsData.showGround, color: settingsData.groundColor },
      grid: { show: settingsData.showGrid },
      lighting: {
        ambient: settingsData.ambientLight,
        main: settingsData.mainLight,
        rim: settingsData.rimLight,
      },
      effects: {
        bloom: settingsData.bloom,
        vignette: settingsData.vignette,
      },
    },
    timeline: objectsData.map(obj => {
      const {
        id, name, type, startTime, duration, position, rotation, scale,
        animations, introTransition, outroTransition,
        
        url, width, height, color, opacity,
        metalness, roughness, transmission, ior, thickness, clearcoat, clearcoatRoughness,
        extrusion, pathLength, curvature,
        volume, loop, chromaKey, fov
      } = obj;
      
      const objectYaml: any = {
        id,
        name: name || `Unnamed ${type}`,
        type,
        timing: { start: startTime, duration },
        transform: {
          position: { x: position[0], y: position[1], z: position[2] },
          rotation: { x: rotation[0], y: rotation[1], z: rotation[2] },
          scale: { x: scale[0], y: scale[1], z: scale[2] },
        },
      };

      // Conditionally add categories
      objectYaml.appearance = buildCategory({ color, opacity });
      objectYaml.material = buildCategory({ metalness, roughness, transmission, ior, thickness, clearcoat, clearcoatRoughness });
      objectYaml.geometry = buildCategory({ extrusion, pathLength });
      objectYaml.distortion = buildCategory({ cylinder_wrap: curvature });
      objectYaml.media = buildCategory({ url, width, height, volume, loop });
      objectYaml.effects = buildCategory({ chroma_key: chromaKey });
      objectYaml.camera_settings = buildCategory({ fov });

      if (animations && animations.length > 0) {
        objectYaml.keyframes = animations.map(({ time, values, easing }) => ({
          time,
          values: JSON.parse(JSON.stringify(values)), // clean undefined
          easing
        }));
      }

      const transitions: any = {};
      if (introTransition && introTransition.type !== 'none') transitions.intro = introTransition;
      if (outroTransition && outroTransition.type !== 'none') transitions.outro = outroTransition;
      if (Object.keys(transitions).length > 0) objectYaml.transitions = transitions;

      return JSON.parse(JSON.stringify(objectYaml));
    })
  };

  const header = `# 👋 Hello! This is a Lumina scene file.
# It's a human-friendly recipe for your animation. You can edit this directly!
#
# --- STRUCTURE ---
#
# settings:       Global styles for the whole scene (background, lighting, effects).
# timeline:       A list of all the objects (actors) in your scene.
#
# --- OBJECTS (in timeline) ---
#
# id:             A unique identifier for the object.
# name:           The friendly name you see in the editor.
# type:           What kind of object it is (mesh, video, camera, etc.).
# timing:         When it appears (start) and for how long (duration), in seconds.
# transform:      Its initial position, rotation, and scale.
# appearance:     How it looks (color, opacity).
# material:       Surface properties (metal, glass, plastic).
# keyframes:      The animation script for this object over time.
# transitions:    Special intro/outro effects.
#
# Enjoy creating!
# --------------------------------------------------------------------------\n\n`;
  
  return header + yaml.dump(scene, { indent: 2, skipInvalid: true, noRefs: true });
};
