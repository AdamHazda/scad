# OpenSCAD Web Studio

A modern, browser-based OpenSCAD 3D Parametric CAD environment with real-time 3D viewport, OpenSCAD Customizer parameters, STL/OBJ export, preset library, and Gemini AI assistant.

![OpenSCAD Web Studio](https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80)

## Features

- **Interactive 3D CAD Viewport**: Real-time rendering powered by Three.js and BVH CSG boolean engine (`difference`, `union`, `intersection`).
- **Wireframe & Edges View**: One-click technical wireframe mode and sharp silhouette CAD edges.
- **OpenSCAD Customizer**: Dynamic sliders, toggles, dropdowns, and color pickers automatically extracted from your SCAD code comments (`// [min:step:max]`, `// [color]`, etc.).
- **Bed Snapping (Z=0)**: Automatically snaps models to rest on the 220×220 mm 3D printer build plate.
- **3D Print Export**: Instant download of binary **STL** (compatible with Bambu Studio, PrusaSlicer, Cura, OrcaSlicer) and **OBJ**.
- **Parametric Preset Library**: Curated, ready-to-print models (Electronics enclosure, Spur gear, Phone stand, Pipe flange, Spiral twisted vase, OpenSCAD logo).
- **Gemini AI Assistant**: Generate OpenSCAD models from natural language descriptions or enhance existing code with Customizer parameters.

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation & Run Locally

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/openscad-web-studio.git
cd openscad-web-studio

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
```

Open your browser at `http://localhost:3000`.

### Production Build (For Static Hosting like GitHub Pages, Vercel, Netlify)

```bash
npm run build
```

The output will be in the `dist/` directory. You can deploy this folder directly to:
- **GitHub Pages**
- **Vercel**
- **Netlify**
- **Cloudflare Pages**

*Note:* The core 3D engine, SCAD parser, Customizer, and STL exporter run 100% in client-side WebAssembly/JavaScript without needing any server. If you host statically, you can enter your own free Gemini API key in the AI Assistant settings to use AI features.

## License

Apache-2.0
