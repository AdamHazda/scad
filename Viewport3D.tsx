import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { ModelStats } from '../types/scad';
import {
  RotateCcw,
  Maximize2,
  Box,
  Eye,
  Grid,
  Sparkles,
  Download,
  Layers,
  Compass,
  ArrowDownToLine,
  ScanLine,
} from 'lucide-react';
import { Language, TRANSLATIONS } from '../utils/translations';

interface Viewport3DProps {
  modelGroup: THREE.Group | null;
  stats: ModelStats | null;
  isEvaluating: boolean;
  activeLanguage?: string;
  language?: Language;
}

export type RenderStyle = 'default' | 'clay' | 'yellow' | 'metallic' | 'wireframe';

export const Viewport3D: React.FC<Viewport3DProps> = ({
  modelGroup,
  stats,
  isEvaluating,
  activeLanguage,
  language = 'en',
}) => {
  const currentLang = (language || (activeLanguage as Language) || 'en') as Language;
  const t = TRANSLATIONS[currentLang] || TRANSLATIONS.en;

  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const currentModelRef = useRef<THREE.Object3D | null>(null);
  const currentEdgesRef = useRef<THREE.Group | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const axesHelperRef = useRef<THREE.AxesHelper | null>(null);
  const bboxHelperRef = useRef<THREE.Box3Helper | null>(null);

  const [renderStyle, setRenderStyle] = useState<RenderStyle>('default');
  const [showGrid, setShowGrid] = useState(true);
  const [showAxes, setShowAxes] = useState(true);
  const [showBBox, setShowBBox] = useState(false);
  const [showWireframe, setShowWireframe] = useState(false);
  const [showEdges, setShowEdges] = useState(false);
  const [snapToBed, setSnapToBed] = useState(true);

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a); // Slate 900
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    camera.position.set(120, -140, 100);
    camera.up.set(0, 0, 1); // Z-up like OpenSCAD
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.screenSpacePanning = true;
    controls.minDistance = 5;
    controls.maxDistance = 1500;
    controls.target.set(0, 0, 15);
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
    keyLight.position.set(150, -100, 200);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 10;
    keyLight.shadow.camera.far = 1000;
    const d = 120;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.6);
    fillLight.position.set(-150, 100, 100);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xfef08a, 0.4);
    rimLight.position.set(0, 150, -100);
    scene.add(rimLight);

    // CAD Grid Helper on XY plane (Z=0)
    const grid = new THREE.GridHelper(220, 44, 0x38bdf8, 0x1e293b);
    grid.rotation.x = Math.PI / 2;
    grid.position.z = 0;
    scene.add(grid);
    gridHelperRef.current = grid;

    // 3D Printer Bed Outline (220 x 220 mm standard bed like Prusa/Bambu)
    const bedBorderGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-110, -110, 0),
      new THREE.Vector3(110, -110, 0),
      new THREE.Vector3(110, 110, 0),
      new THREE.Vector3(-110, 110, 0),
      new THREE.Vector3(-110, -110, 0),
    ]);
    const bedBorderMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.5,
    });
    const bedBorder = new THREE.Line(bedBorderGeo, bedBorderMat);
    scene.add(bedBorder);

    // Axis Helper (X=red, Y=green, Z=blue)
    const axes = new THREE.AxesHelper(30);
    axes.renderOrder = 1;
    scene.add(axes);
    axesHelperRef.current = axes;

    // Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: newWidth, height: newHeight } = entry.contentRect;
        if (newWidth > 0 && newHeight > 0) {
          camera.aspect = newWidth / newHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(newWidth, newHeight);
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update scene when modelGroup changes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Remove old model, edges and bbox helper
    if (currentModelRef.current) {
      scene.remove(currentModelRef.current);
      currentModelRef.current = null;
    }
    if (currentEdgesRef.current) {
      scene.remove(currentEdgesRef.current);
      currentEdgesRef.current = null;
    }
    if (bboxHelperRef.current) {
      scene.remove(bboxHelperRef.current);
      bboxHelperRef.current = null;
    }

    if (modelGroup) {
      // Apply render styles / materials
      applyMaterialStyle(modelGroup, renderStyle, showWireframe);

      // Reset any previous position
      modelGroup.position.set(0, 0, 0);
      modelGroup.updateMatrixWorld(true);

      // Snap to print bed (Z=0) so model sits directly on top of the bed
      if (snapToBed) {
        const rawBox = new THREE.Box3().setFromObject(modelGroup);
        if (Number.isFinite(rawBox.min.z)) {
          modelGroup.position.z = -rawBox.min.z;
          modelGroup.updateMatrixWorld(true);
        }
      }

      scene.add(modelGroup);
      currentModelRef.current = modelGroup;

      // Add CAD Contour Edges (Obrys) without triangle diagonals
      if (showEdges || renderStyle === 'wireframe') {
        const edgesGroup = new THREE.Group();
        modelGroup.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const m = child as THREE.Mesh;
            let edgeGeometry = m.geometry;
            try {
              // Merge duplicate CSG coplanar vertices so EdgesGeometry correctly calculates dihedral angles between adjacent faces
              edgeGeometry = BufferGeometryUtils.mergeVertices(m.geometry, 1e-3);
            } catch {
              edgeGeometry = m.geometry;
            }
            // 35 degrees threshold captures genuine 90° steps and real CAD corners while skipping coplanar flat subdivisions
            const edgesGeo = new THREE.EdgesGeometry(edgeGeometry, 35);
            const isBlueprint = renderStyle === 'wireframe';
            const edgesMat = new THREE.LineBasicMaterial({
              color: isBlueprint ? 0x38bdf8 : 0x0f172a,
              linewidth: isBlueprint ? 2 : 1.2,
              transparent: !isBlueprint,
              opacity: isBlueprint ? 1.0 : 0.75,
            });
            const line = new THREE.LineSegments(edgesGeo, edgesMat);
            line.matrix.copy(m.matrixWorld);
            line.matrixAutoUpdate = false;
            edgesGroup.add(line);
          }
        });
        scene.add(edgesGroup);
        currentEdgesRef.current = edgesGroup;
      }

      // Add BBox helper if requested
      const box = new THREE.Box3().setFromObject(modelGroup);
      const bboxHelper = new THREE.Box3Helper(box, new THREE.Color(0x38bdf8));
      bboxHelper.visible = showBBox;
      scene.add(bboxHelper);
      bboxHelperRef.current = bboxHelper;
    }
  }, [modelGroup, renderStyle, showWireframe, showEdges, showBBox, snapToBed]);

  // Update Grid & Axes visibility
  useEffect(() => {
    if (gridHelperRef.current) gridHelperRef.current.visible = showGrid;
    if (axesHelperRef.current) axesHelperRef.current.visible = showAxes;
    if (bboxHelperRef.current) bboxHelperRef.current.visible = showBBox;
  }, [showGrid, showAxes, showBBox]);

  const applyMaterialStyle = (
    root: THREE.Object3D,
    style: RenderStyle,
    wireframe: boolean
  ) => {
    root.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        let mat: THREE.Material;

        if (style === 'wireframe') {
          // CAD Blueprint / Technical Outline: occluding dark body so only clean topological edges are visible
          mat = new THREE.MeshBasicMaterial({
            color: 0x090d16, // Dark slate matching background
            polygonOffset: true,
            polygonOffsetFactor: 1,
            polygonOffsetUnits: 1,
            wireframe: wireframe, // Only show triangle diagonals if user explicitly toggled triangle mesh
          });
        } else if (style === 'clay') {
          mat = new THREE.MeshStandardMaterial({
            color: 0xe2e8f0,
            roughness: 0.7,
            metalness: 0.05,
            wireframe: wireframe,
          });
        } else if (style === 'yellow') {
          mat = new THREE.MeshStandardMaterial({
            color: 0xfbbf24, // Classic OpenSCAD yellow
            roughness: 0.35,
            metalness: 0.1,
            wireframe: wireframe,
          });
        } else if (style === 'metallic') {
          mat = new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            roughness: 0.2,
            metalness: 0.8,
            wireframe: wireframe,
          });
        } else {
          // Default: retain assigned colors or fallback amber
          const orig = m.material as THREE.MeshStandardMaterial;
          mat = new THREE.MeshStandardMaterial({
            color: orig?.color || new THREE.Color(0xfcd34d),
            roughness: 0.35,
            metalness: 0.15,
            transparent: orig?.transparent || false,
            opacity: orig?.opacity ?? 1.0,
            wireframe: wireframe,
          });
        }
        m.material = mat;
      }
    });
  };

  // Camera presets
  const zoomToFit = useCallback(() => {
    if (!currentModelRef.current || !cameraRef.current || !controlsRef.current) return;
    const box = new THREE.Box3().setFromObject(currentModelRef.current);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    const maxDim = Math.max(size.x, size.y, size.z, 20);
    const fov = cameraRef.current.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.8;

    const offset = new THREE.Vector3(1, -1.2, 0.9).normalize().multiplyScalar(cameraZ);
    cameraRef.current.position.copy(center).add(offset);
    cameraRef.current.lookAt(center);
    controlsRef.current.target.copy(center);
    controlsRef.current.update();
  }, []);

  const setView = (direction: 'top' | 'front' | 'right' | 'iso') => {
    if (!cameraRef.current || !controlsRef.current) return;
    const target = controlsRef.current.target.clone();
    const dist = 140;

    if (direction === 'top') {
      cameraRef.current.position.set(target.x, target.y, target.z + dist);
      cameraRef.current.up.set(0, 1, 0);
    } else if (direction === 'front') {
      cameraRef.current.position.set(target.x, target.y - dist, target.z);
      cameraRef.current.up.set(0, 0, 1);
    } else if (direction === 'right') {
      cameraRef.current.position.set(target.x + dist, target.y, target.z);
      cameraRef.current.up.set(0, 0, 1);
    } else {
      cameraRef.current.position.set(target.x + 100, target.y - 120, target.z + 80);
      cameraRef.current.up.set(0, 0, 1);
    }
    controlsRef.current.update();
  };

  // Export functions
  const handleExportSTL = (binary = true) => {
    if (!currentModelRef.current) return;
    const exporter = new STLExporter();
    const result = exporter.parse(currentModelRef.current, { binary });
    const blob = new Blob([result], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `model_${Date.now()}.stl`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportOBJ = () => {
    if (!currentModelRef.current) return;
    const exporter = new OBJExporter();
    const result = exporter.parse(currentModelRef.current);
    const blob = new Blob([result], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `model_${Date.now()}.obj`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const isCs = activeLanguage === 'cs';

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-950 overflow-hidden select-none">
      {/* 3D Canvas Container */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Evaluating Overlay Spinner */}
      {isEvaluating && (
        <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center pointer-events-none z-20">
          <div className="flex items-center gap-2.5 px-4 py-2 bg-slate-900/90 border border-slate-700/60 rounded-lg text-xs font-medium text-amber-300 shadow-xl">
            <span className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <span>{isCs ? 'Generování 3D geometrie...' : 'Computing 3D geometry...'}</span>
          </div>
        </div>
      )}

      {/* Top Floating Control Toolbar */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
        {/* Left: View Direction Buttons */}
        <div className="flex items-center gap-1 p-1 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-lg pointer-events-auto shadow-lg">
          <button
            onClick={() => setView('iso')}
            title={t.viewIso}
            className="px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
          >
            ISO
          </button>
          <button
            onClick={() => setView('top')}
            title={t.viewTop}
            className="px-2 py-1 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
          >
            {t.viewTop.split(' ')[0]}
          </button>
          <button
            onClick={() => setView('front')}
            title={t.viewFront}
            className="px-2 py-1 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
          >
            {t.viewFront.split(' ')[0]}
          </button>
          <button
            onClick={() => setView('right')}
            title={t.viewRight}
            className="px-2 py-1 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
          >
            {t.viewRight.split(' ')[0]}
          </button>
          <div className="w-px h-4 bg-slate-700 mx-0.5" />
          <button
            onClick={zoomToFit}
            title={t.zoomFit}
            className="p-1 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-md transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: Render Style and Viewport Overlays */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Material Styles Segmented Selector */}
          <div className="flex items-center gap-1 p-1 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-lg shadow-lg">
            <button
              onClick={() => setRenderStyle('default')}
              title={t.styleDefault}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                renderStyle === 'default'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              OpenSCAD
            </button>
            <button
              onClick={() => setRenderStyle('clay')}
              title={t.styleClay}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                renderStyle === 'clay'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {t.styleClay}
            </button>
            <button
              onClick={() => setRenderStyle('metallic')}
              title={t.styleMetal}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                renderStyle === 'metallic'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {t.styleMetal}
            </button>
            <button
              onClick={() => setRenderStyle('wireframe')}
              title={t.styleOutline}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                renderStyle === 'wireframe'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {t.styleOutline}
            </button>
          </div>

          {/* Quick Toggles: Grid, Axes, CAD Edges, BBox, Bed Snap */}
          <div className="flex items-center gap-1 p-1 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-lg shadow-lg">
            <button
              onClick={() => setShowGrid((v) => !v)}
              title={t.toggleGrid}
              className={`p-1.5 rounded-md transition-colors ${
                showGrid ? 'text-cyan-400 bg-cyan-950/40' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowAxes((v) => !v)}
              title={t.toggleAxes}
              className={`p-1.5 rounded-md transition-colors ${
                showAxes ? 'text-rose-400 bg-rose-950/40' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowEdges((v) => !v)}
              title={t.toggleOutline}
              className={`p-1.5 rounded-md transition-colors ${
                showEdges ? 'text-sky-400 bg-sky-950/40' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <ScanLine className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowWireframe((v) => !v)}
              title={t.toggleMesh}
              className={`p-1.5 rounded-md transition-colors ${
                showWireframe ? 'text-amber-400 bg-amber-950/40' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowBBox((v) => !v)}
              title={t.toggleBBox}
              className={`p-1.5 rounded-md transition-colors ${
                showBBox ? 'text-emerald-400 bg-emerald-950/40' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-3.5 bg-slate-800 my-auto" />
            <button
              onClick={() => setSnapToBed((v) => !v)}
              title={snapToBed ? t.snapToBedOn : t.snapToBedOff}
              className={`flex items-center gap-1 px-1.5 py-1 rounded-md text-[11px] font-mono transition-colors ${
                snapToBed
                  ? 'text-emerald-400 bg-emerald-950/50 border border-emerald-500/30'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <ArrowDownToLine className="w-3.5 h-3.5" />
              <span className="font-semibold text-[10px]">Z=0</span>
            </button>
          </div>

          {/* Export Quick Buttons */}
          <div className="flex items-center gap-1 p-1 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-lg shadow-lg">
            <button
              onClick={() => handleExportSTL(true)}
              title="Export STL (3D Print)"
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/50 rounded-md transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>STL</span>
            </button>
            <button
              onClick={handleExportOBJ}
              title="Export OBJ"
              className="px-2 py-1 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-md transition-colors"
            >
              OBJ
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Floating Stats & Measurement Pill */}
      {stats && (
        <div className="absolute bottom-3 left-3 flex items-center gap-3 px-3 py-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-800/80 rounded-lg text-[11px] text-slate-400 font-mono pointer-events-none shadow-lg z-10">
          <div className="flex items-center gap-1.5 text-slate-300">
            <span className="text-slate-500">{isCs ? 'Rozměry:' : 'Dim:'}</span>
            <span className="text-cyan-400 font-medium">
              {stats.boundingBox.size[0]} × {stats.boundingBox.size[1]} × {stats.boundingBox.size[2]} mm
            </span>
          </div>
          <span className="text-slate-600">·</span>
          <div>
            <span className="text-slate-500">{isCs ? 'Trojúhelníky:' : 'Tris:'} </span>
            <span className="text-slate-300">{stats.triangleCount.toLocaleString()}</span>
          </div>
          <span className="text-slate-600">·</span>
          <div>
            <span className="text-slate-500">{isCs ? 'Objem cca:' : 'Est. Vol:'} </span>
            <span className="text-slate-300">
              {(stats.volumeMm3 / 1000).toFixed(1)} cm³
            </span>
          </div>
        </div>
      )}

      {/* Coordinate Axis Triad Indicator in bottom right */}
      <div className="absolute bottom-3 right-3 flex items-center gap-2 px-2.5 py-1 bg-slate-900/80 border border-slate-800 rounded-lg text-[10px] font-mono pointer-events-none shadow-md z-10">
        <span className="text-red-400 font-bold">X</span>
        <span className="text-emerald-400 font-bold">Y</span>
        <span className="text-blue-400 font-bold">Z</span>
        <span className="text-slate-500">· mm</span>
      </div>
    </div>
  );
};
