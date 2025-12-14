# Lumina Scene Editor

Welcome to Lumina, a powerful and intuitive scene editor designed for creating captivating 3D animations and visuals directly in your browser. This application allows you to manipulate 3D objects, configure lighting, apply effects, and animate properties over a timeline with ease.

## Project Structure

```
.
├── index.html              # The main entry point for the web application.
├── index.tsx               # The core React application component that orchestrates everything.
├── index.css               # Global styles and font imports for the application.
├── importmap.js            # Defines how modules are imported, managing external dependencies.
├── theme.tsx               # Centralized design system with color tokens, typography, and effects.
├── engine.tsx              # The Three.js engine that renders and manages the 3D scene.
├── constants.tsx           # Stores initial state, material presets, and other fixed values.
├── utils/                  # Utility functions for common tasks.
│   └── yamlExporter.tsx    # Handles converting scene data to a human-readable YAML format.
├── components/             # Reusable UI components.
│   ├── Core/               # Basic, single-purpose UI elements.
│   │   ├── Primitives.tsx  # Fundamental UI controls like buttons, sliders, and inputs.
│   │   └── Window.tsx      # Draggable, resizable window component for panels.
│   ├── Package/            # Components composed of multiple Core components.
│   │   └── TransitionControls.tsx # Controls for defining object intro/outro transitions.
│   └── Section/            # Larger UI sections that combine packages and core components.
│       ├── AssetsPanel.tsx # Panel for adding new objects and importing media.
│       ├── Dock.tsx        # The main navigation dock for opening and closing panels.
│       ├── PropertiesPanel.tsx # Panel for editing properties of selected objects or global settings.
│       ├── ProjectSettingsPanel.tsx # Panel for adjusting global project and rendering settings.
│       └── Timeline.tsx    # The animation timeline for sequencing objects and keyframes.
└── metadata.json           # Application metadata, including viewport settings and permissions.
```

## ELI10 TLDR Humane Comments

*   **`index.html`**: This is the very first file your browser loads. It sets up the webpage and tells it where to find the main app code and styles. Think of it as the foundation of your house.
*   **`index.tsx`**: This is like the main conductor of an orchestra. It manages all the different parts of the Lumina app, handles how they talk to each other, and keeps track of what's happening.
*   **`index.css`**: These are the rules for how everything on the page looks – colors, fonts, spacing. It makes sure the app has a consistent and beautiful style.
*   **`importmap.js`**: This file is like a special directory that tells the browser exactly where to find all the extra tools and libraries the app needs, like React, Three.js, and Framer Motion.
*   **`theme.tsx`**: This is our design bible. It defines all the colors (like "primary surface" instead of `#FFFFFF`), fonts, and visual effects, ensuring everything looks cohesive and premium.
*   **`engine.tsx`**: This is the magic box that brings your 3D world to life! It uses Three.js to draw objects, lights, and effects, making everything you see in the viewport appear.
*   **`constants.tsx`**: This file stores all the important starting values and common settings, like what your scene looks like when you first open it, or predefined material styles.
*   **`utils/yamlExporter.tsx`**: This helper takes all your scene's data and neatly organizes it into a human-readable `.yaml` file, so you can save, share, or even manually edit your projects easily.
*   **`components/Core/Primitives.tsx`**: These are the basic building blocks of our user interface, like simple buttons, sliders, and switches. They're designed to be used everywhere.
*   **`components/Core/Window.tsx`**: This component creates those cool draggable and closable panels (like ASSETS or CONTROLS) that float over your scene, giving you flexible workspace.
*   **`components/Package/TransitionControls.tsx`**: This helps you create awesome entrance and exit animations for your objects, making them fade in, scale up, or slide into view smoothly.
*   **`components/Section/AssetsPanel.tsx`**: This is where you bring in new items for your scene, whether it's a 3D model, an image, a video, or just a simple cube.
*   **`components/Section/Dock.tsx`**: This is the sleek bar at the bottom with icons. It's your quick launcher to open and close different panels like the timeline or properties.
*   **`components/Section/PropertiesPanel.tsx`**: When you select an object or the scene itself, this panel lets you tweak all its settings – position, color, special effects, and more!
*   **`components/Section/ProjectSettingsPanel.tsx`**: This panel holds all the global settings for your project, like the overall look of the rendering, the aspect ratio of your video, and performance options.
*   **`components/Section/Timeline.tsx`**: This is where you orchestrate your animation! You can see all your objects laid out in time, set keyframes, and control when things happen.
*   **`metadata.json`**: This tiny file holds basic info about the app, like its name and any special permissions it might need from your browser.
