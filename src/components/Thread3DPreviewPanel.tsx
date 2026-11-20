import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  Box,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Play,
  Pause,
  Layers,
  Eye,
} from 'lucide-react';
import { TrCalculatedRow } from '../data/trThreadData';

interface Thread3DPreviewPanelProps {
  row: TrCalculatedRow;
}

type AssemblyViewMode = 'screw_and_nut' | 'screw_only' | 'nut_cutaway';

/**
 * Evaluate the exact radial profile r(phase) of a 30-deg ISO 2901 / DIN 103
 * Trapezoidal Thread for phase in [0, 1).
 */
function evaluateTrapezoidalRadius(
  phase: number,
  rMinor: number,
  rMajor: number,
  crestFrac: number,
  flankTrailFrac: number,
  flankLeadFrac: number = flankTrailFrac
): number {
  const u = ((phase % 1) + 1) % 1;
  const cEnd = crestFrac;
  const f1End = cEnd + flankTrailFrac;
  const rEnd = Math.max(f1End, 1.0 - flankLeadFrac);

  if (u < cEnd) {
    // External thread crest flat (width f)
    return rMajor;
  } else if (u < f1End) {
    // Trailing flank (from rMajor down to rMinor)
    const t = (u - cEnd) / Math.max(0.0001, flankTrailFrac);
    return rMajor - t * (rMajor - rMinor);
  } else if (u < rEnd) {
    // Root flat (width w)
    return rMinor;
  } else {
    // Leading flank (from rMinor up to rMajor)
    const t = (u - rEnd) / Math.max(0.0001, flankLeadFrac);
    return rMinor + t * (rMajor - rMinor);
  }
}

function getProfileFractions(row: TrCalculatedRow) {
  const tType = row.threadType || 'TR';
  if (tType === 'SQ') {
    return { crestFrac: 0.46, flankTrailFrac: 0.03, flankLeadFrac: 0.03 };
  }
  if (tType === 'BUTTRESS_S') {
    return { crestFrac: 0.24, flankTrailFrac: 0.48, flankLeadFrac: 0.06 };
  }
  if (tType === 'METRIC_M' || tType === 'UNC_UNF') {
    return { crestFrac: 0.125, flankTrailFrac: 0.36, flankLeadFrac: 0.36 };
  }
  if (tType === 'BSW_BSF' || tType === 'BSP_NPT') {
    return { crestFrac: 0.16, flankTrailFrac: 0.34, flankLeadFrac: 0.34 };
  }
  const crestFrac = Math.min(0.45, Math.max(0.14, row.f / row.p));
  const halfAngle = row.flankHalfAngleDeg ?? 15;
  const flankAxi = row.h3 * Math.tan((halfAngle * Math.PI) / 180);
  const flankFrac = Math.min(
    (1 - crestFrac - 0.08) / 2,
    Math.max(0.08, flankAxi / row.p)
  );
  return { crestFrac, flankTrailFrac: flankFrac, flankLeadFrac: flankFrac };
}

/**
 * Build a watertight parametric 3D helical Trapezoidal Screw BufferGeometry
 * normalized to visual scene units while preserving exact d / P / d3 / h3 / starts proportions.
 */
function createHelicalTrScrewGeometry(
  row: TrCalculatedRow,
  scaleFactor: number,
  numPitches: number
): THREE.BufferGeometry {
  const rMajor = (row.d / 2) * scaleFactor;
  const rMinor = (row.d3 / 2) * scaleFactor;
  const pitch = row.p * scaleFactor;
  const starts = row.starts;
  const totalLen = numPitches * pitch;
  const halfLen = totalLen / 2;

  const { crestFrac, flankTrailFrac, flankLeadFrac } = getProfileFractions(row);

  const radialSegments = 88;
  const axialSamplesPerPitch = 28;
  const axialSegments = Math.max(80, Math.round(numPitches * axialSamplesPerPitch));

  const positions: number[] = [];
  const indices: number[] = [];

  // Ring 0: bottom center pole (0, -halfLen, 0)
  positions.push(0, -halfLen, 0);
  const bottomCenterIdx = 0;

  // Rings 1 .. axialSegments + 1: helical thread surface
  for (let iy = 0; iy <= axialSegments; iy++) {
    const v = iy / axialSegments;
    const y = -halfLen + v * totalLen;

    // Smooth chamfer taper at the very top and bottom ends of the screw
    const distFromEnd = Math.min(y - -halfLen, halfLen - y);
    const chamferZone = pitch * 0.65;
    const chamferT =
      distFromEnd < chamferZone
        ? Math.max(0, distFromEnd / Math.max(0.0001, chamferZone))
        : 1.0;

    for (let it = 0; it <= radialSegments; it++) {
      const u = it / radialSegments;
      const theta = u * Math.PI * 2;

      // Helical phase along the axis and around circumference
      const phase = y / pitch - (starts * theta) / (Math.PI * 2);
      const rawR = evaluateTrapezoidalRadius(
        phase,
        rMinor,
        rMajor,
        crestFrac,
        flankTrailFrac,
        flankLeadFrac
      );
      const r = rMinor + (rawR - rMinor) * chamferT;

      const x = r * Math.cos(theta);
      const z = r * Math.sin(theta);
      positions.push(x, y, z);
    }
  }

  // Final vertex: top center pole (0, +halfLen, 0)
  const topCenterIdx = positions.length / 3;
  positions.push(0, halfLen, 0);

  const stride = radialSegments + 1;

  // Bottom cap triangles
  for (let it = 0; it < radialSegments; it++) {
    const p1 = 1 + it;
    const p2 = 1 + it + 1;
    indices.push(bottomCenterIdx, p1, p2);
  }

  // Helical side quads
  for (let iy = 0; iy < axialSegments; iy++) {
    const rowStart = 1 + iy * stride;
    const nextRowStart = 1 + (iy + 1) * stride;
    for (let it = 0; it < radialSegments; it++) {
      const a = rowStart + it;
      const b = rowStart + it + 1;
      const c = nextRowStart + it;
      const d = nextRowStart + it + 1;

      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  // Top cap triangles
  const lastRowStart = 1 + axialSegments * stride;
  for (let it = 0; it < radialSegments; it++) {
    const p1 = lastRowStart + it;
    const p2 = lastRowStart + it + 1;
    indices.push(topCenterIdx, p2, p1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3)
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Build a 240-degree cutaway Internal Trapezoidal Nut (Mur Perunggu) BufferGeometry
 * so the user can see the internal thread engagement clearly in 3D.
 */
function createCutawayNutGeometry(
  row: TrCalculatedRow,
  scaleFactor: number,
  nutPitches: number
): THREE.BufferGeometry {
  const rBoreMinor = (row.D1 / 2) * scaleFactor;
  const rRootMajor = (row.D4 / 2) * scaleFactor;
  const rOuterBody = Math.max(
    rRootMajor * 1.38,
    rRootMajor + row.p * scaleFactor * 1.1
  );
  const pitch = row.p * scaleFactor;
  const starts = row.starts;
  const nutLen = nutPitches * pitch;
  const halfLen = nutLen / 2;

  const { crestFrac, flankTrailFrac, flankLeadFrac } = getProfileFractions(row);

  // 240 degree cutaway arc (-30 deg to +210 deg) so the front 120 deg is open to inspect meshing
  const startAngle = (-25 * Math.PI) / 180;
  const sweepAngle = (235 * Math.PI) / 180;

  const arcSegments = 64;
  const axialSegments = Math.max(48, Math.round(nutPitches * 26));

  const positions: number[] = [];
  const indices: number[] = [];

  const stride = arcSegments + 1;

  // 0. Inner helical thread surface vertices (facing inward)
  const innerOffset = 0;
  for (let iy = 0; iy <= axialSegments; iy++) {
    const v = iy / axialSegments;
    const y = -halfLen + v * nutLen;
    for (let it = 0; it <= arcSegments; it++) {
      const u = it / arcSegments;
      const theta = startAngle + u * sweepAngle;
      const phase = y / pitch - (starts * theta) / (Math.PI * 2);
      const rInner = evaluateTrapezoidalRadius(
        phase,
        rBoreMinor,
        rRootMajor,
        crestFrac,
        flankTrailFrac,
        flankLeadFrac
      );
      positions.push(rInner * Math.cos(theta), y, rInner * Math.sin(theta));
    }
  }

  // 1. Outer cylindrical nut body vertices (facing outward)
  const outerOffset = positions.length / 3;
  for (let iy = 0; iy <= axialSegments; iy++) {
    const v = iy / axialSegments;
    const y = -halfLen + v * nutLen;
    for (let it = 0; it <= arcSegments; it++) {
      const u = it / arcSegments;
      const theta = startAngle + u * sweepAngle;
      positions.push(
        rOuterBody * Math.cos(theta),
        y,
        rOuterBody * Math.sin(theta)
      );
    }
  }

  // Inner surface triangles (inverted winding so normals point inward toward center)
  for (let iy = 0; iy < axialSegments; iy++) {
    for (let it = 0; it < arcSegments; it++) {
      const a = innerOffset + iy * stride + it;
      const b = a + 1;
      const c = innerOffset + (iy + 1) * stride + it;
      const d = c + 1;
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  // Outer surface triangles (normals point outward)
  for (let iy = 0; iy < axialSegments; iy++) {
    for (let it = 0; it < arcSegments; it++) {
      const a = outerOffset + iy * stride + it;
      const b = a + 1;
      const c = outerOffset + (iy + 1) * stride + it;
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  // Bottom annular face (iy = 0)
  for (let it = 0; it < arcSegments; it++) {
    const inA = innerOffset + it;
    const inB = innerOffset + it + 1;
    const outA = outerOffset + it;
    const outB = outerOffset + it + 1;
    indices.push(inA, outA, inB);
    indices.push(inB, outA, outB);
  }

  // Top annular face (iy = axialSegments)
  const topRow = axialSegments * stride;
  for (let it = 0; it < arcSegments; it++) {
    const inA = innerOffset + topRow + it;
    const inB = inA + 1;
    const outA = outerOffset + topRow + it;
    const outB = outA + 1;
    indices.push(inA, inB, outA);
    indices.push(inB, outB, outA);
  }

  // Cutaway cross-section wall 1 (it = 0, at startAngle) showing the 30-deg thread teeth in section!
  for (let iy = 0; iy < axialSegments; iy++) {
    const inLow = innerOffset + iy * stride;
    const inHigh = innerOffset + (iy + 1) * stride;
    const outLow = outerOffset + iy * stride;
    const outHigh = outerOffset + (iy + 1) * stride;
    indices.push(inLow, inHigh, outLow);
    indices.push(inHigh, outHigh, outLow);
  }

  // Cutaway cross-section wall 2 (it = arcSegments, at startAngle + sweepAngle)
  for (let iy = 0; iy < axialSegments; iy++) {
    const inLow = innerOffset + iy * stride + arcSegments;
    const inHigh = innerOffset + (iy + 1) * stride + arcSegments;
    const outLow = outerOffset + iy * stride + arcSegments;
    const outHigh = outerOffset + (iy + 1) * stride + arcSegments;
    indices.push(inLow, outLow, inHigh);
    indices.push(inHigh, outLow, outHigh);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3)
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export const Thread3DPreviewPanel: React.FC<Thread3DPreviewPanelProps> = ({
  row,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const screwGroupRef = useRef<THREE.Group | null>(null);
  const nutMeshRef = useRef<THREE.Mesh | null>(null);

  const [assemblyMode, setAssemblyMode] =
    useState<AssemblyViewMode>('screw_and_nut');
  const [showPitchCylinder, setShowPitchCylinder] = useState<boolean>(true);
  const [wireframeMode, setWireframeMode] = useState<boolean>(false);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);

  const autoRotateRef = useRef<boolean>(autoRotate);
  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 420;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0F172A');

    // Camera setup
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 200);
    camera.position.set(6.2, 3.6, 7.4);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // OrbitControls for interactive rotation, pan, and zoom
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 2.2;
    controls.maxDistance = 24;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // Studio Engineering Lighting
    const ambientLight = new THREE.AmbientLight('#E2E8F0', 1.15);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight('#FFFFFF', 2.2);
    keyLight.position.set(8, 12, 10);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight('#93C5FD', 1.1);
    fillLight.position.set(-10, 4, -8);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight('#FDE68A', 0.9);
    rimLight.position.set(0, -10, 6);
    scene.add(rimLight);

    // Subtle Reference Grid at bottom
    const gridHelper = new THREE.GridHelper(12, 24, '#334155', '#1E293B');
    gridHelper.position.y = -3.1;
    scene.add(gridHelper);

    // Scale factor so any thread from Tr 8 to Tr 1120 fits nicely inside a ~3.6 unit radius
    const scaleFactor = 3.2 / Math.max(4, row.d);
    const rawNumPitches = (row.d * 1.55) / Math.max(0.5, row.p);
    const numPitches = Math.min(12, Math.max(4.5, rawNumPitches));
    const nutPitches = Math.min(4.5, Math.max(2.5, numPitches * 0.42));

    // Root Group for the Screw + Pitch Cylinder
    const screwGroup = new THREE.Group();
    screwGroupRef.current = screwGroup;
    scene.add(screwGroup);

    const geometriesToDispose: THREE.BufferGeometry[] = [];
    const materialsToDispose: THREE.Material[] = [];

    // 1. Build Helical Trapezoidal Screw Mesh
    if (assemblyMode !== 'nut_cutaway') {
      const screwGeo = createHelicalTrScrewGeometry(
        row,
        scaleFactor,
        numPitches
      );
      geometriesToDispose.push(screwGeo);

      const isBronzeScrew = row.materialGrade === 'BRONZE';
      const screwColor = isBronzeScrew
        ? '#D97706'
        : row.materialGrade === 'SUS304'
        ? '#CBD5E1'
        : '#94A3B8';

      const screwMat = new THREE.MeshStandardMaterial({
        color: screwColor,
        metalness: isBronzeScrew ? 0.72 : 0.78,
        roughness: 0.28,
        wireframe: wireframeMode,
        side: THREE.DoubleSide,
      });
      materialsToDispose.push(screwMat);

      const screwMesh = new THREE.Mesh(screwGeo, screwMat);
      screwGroup.add(screwMesh);

      // Machined Cylindrical Shank Extensions at Top & Bottom
      const rCore = (row.d3 / 2) * scaleFactor;
      const halfThreadLen = (numPitches * row.p * scaleFactor) / 2;
      const shankGeo = new THREE.CylinderGeometry(
        rCore * 0.96,
        rCore * 0.96,
        0.55,
        48
      );
      geometriesToDispose.push(shankGeo);

      const topShank = new THREE.Mesh(shankGeo, screwMat);
      topShank.position.y = halfThreadLen + 0.275;
      screwGroup.add(topShank);

      const bottomShank = new THREE.Mesh(shankGeo, screwMat);
      bottomShank.position.y = -halfThreadLen - 0.275;
      screwGroup.add(bottomShank);
    }

    // 2. Build Cutaway Internal Bronze Nut Mesh (240 deg section)
    if (assemblyMode === 'screw_and_nut' || assemblyMode === 'nut_cutaway') {
      const nutGeo = createCutawayNutGeometry(row, scaleFactor, nutPitches);
      geometriesToDispose.push(nutGeo);

      const nutMat = new THREE.MeshStandardMaterial({
        color: '#D97706', // CuSn12 Bronze
        metalness: 0.68,
        roughness: 0.32,
        wireframe: wireframeMode,
        side: THREE.DoubleSide,
      });
      materialsToDispose.push(nutMat);

      const nutMesh = new THREE.Mesh(nutGeo, nutMat);
      nutMeshRef.current = nutMesh;
      scene.add(nutMesh);
    }

    // 3. Build Transparent Pitch Diameter Cylinder (d2 = D2)
    if (showPitchCylinder) {
      const rPitch = (row.d2 / 2) * scaleFactor;
      const cylLen = numPitches * row.p * scaleFactor * 1.04;
      const pitchCylGeo = new THREE.CylinderGeometry(
        rPitch,
        rPitch,
        cylLen,
        64,
        1,
        true
      );
      geometriesToDispose.push(pitchCylGeo);

      const pitchCylMat = new THREE.MeshBasicMaterial({
        color: '#10B981',
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      materialsToDispose.push(pitchCylMat);

      const pitchCylMesh = new THREE.Mesh(pitchCylGeo, pitchCylMat);
      scene.add(pitchCylMesh);

      // Upper & lower pitch diameter rings
      const ringGeo = new THREE.RingGeometry(
        rPitch * 0.985,
        rPitch * 1.015,
        64
      );
      ringGeo.rotateX(Math.PI / 2);
      geometriesToDispose.push(ringGeo);

      const ringMat = new THREE.MeshBasicMaterial({
        color: '#34D399',
        side: THREE.DoubleSide,
      });
      materialsToDispose.push(ringMat);

      const topRing = new THREE.Mesh(ringGeo, ringMat);
      topRing.position.y = cylLen / 2;
      scene.add(topRing);

      const bottomRing = new THREE.Mesh(ringGeo, ringMat);
      bottomRing.position.y = -cylLen / 2;
      scene.add(bottomRing);
    }

    // Center Axis Line
    const axisPoints = [
      new THREE.Vector3(0, -3.1, 0),
      new THREE.Vector3(0, 3.1, 0),
    ];
    const axisGeo = new THREE.BufferGeometry().setFromPoints(axisPoints);
    geometriesToDispose.push(axisGeo);
    const axisMat = new THREE.LineBasicMaterial({
      color: '#38BDF8',
      transparent: true,
      opacity: 0.55,
    });
    materialsToDispose.push(axisMat);
    const axisLine = new THREE.Line(axisGeo, axisMat);
    scene.add(axisLine);

    // Animation Loop
    let frameId = 0;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      if (autoRotateRef.current && screwGroupRef.current) {
        screwGroupRef.current.rotation.y += 0.008;
      }
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Responsive Resize Observer
    const handleResize = () => {
      if (!container) return;
      const newW = container.clientWidth || 800;
      const newH = container.clientHeight || 420;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(frameId);
      controls.dispose();
      geometriesToDispose.forEach((g) => g.dispose());
      materialsToDispose.forEach((m) => m.dispose());
      renderer.dispose();
    };
  }, [
    row.threadType,
    row.threadAngleDeg,
    row.d,
    row.p,
    row.starts,
    row.d2,
    row.d3,
    row.D1,
    row.D4,
    row.f,
    row.h3,
    row.materialGrade,
    assemblyMode,
    showPitchCylinder,
    wireframeMode,
  ]);

  // Camera Preset Handlers
  const handleCameraPreset = (preset: 'iso' | 'side' | 'top' | 'zoom_in' | 'zoom_out') => {
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    if (!cam || !ctrl) return;

    if (preset === 'iso') {
      cam.position.set(6.2, 3.6, 7.4);
      ctrl.target.set(0, 0, 0);
    } else if (preset === 'side') {
      cam.position.set(0, 0, 9.2);
      ctrl.target.set(0, 0, 0);
    } else if (preset === 'top') {
      cam.position.set(0.01, 9.5, 0.01);
      ctrl.target.set(0, 0, 0);
    } else if (preset === 'zoom_in') {
      cam.position.multiplyScalar(0.82);
    } else if (preset === 'zoom_out') {
      cam.position.multiplyScalar(1.22);
    }
    ctrl.update();
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      {/* Top Control Header */}
      <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Box className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-slate-900">
              Pratinjau 3D Interaktif (Three.js WebGL) — {row.designation}
            </h3>
            <span className="px-2 py-0.5 text-[11px] font-mono font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded">
              {row.threadType === 'BUTTRESS_S'
                ? 'S 3°/30°'
                : row.threadType === 'SQ'
                ? 'Sq 0°'
                : `α = ${row.threadAngleDeg ?? 30}°`}{' '}
              · {row.starts} Start
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Klik &amp; seret untuk memutar 360°, gunakan scroll/cubit untuk zoom in/out, dan klik kanan untuk menggeser geometri ulir trapesium secara real-time.
          </p>
        </div>

        {/* Interactive 3D Mode & Camera Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Assembly Mode Segmented Control */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md text-xs">
            <button
              type="button"
              onClick={() => setAssemblyMode('screw_and_nut')}
              className={`px-2.5 py-1 font-medium rounded transition-colors ${
                assemblyMode === 'screw_and_nut'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Baut + Mur Cutaway
            </button>
            <button
              type="button"
              onClick={() => setAssemblyMode('screw_only')}
              className={`px-2.5 py-1 font-medium rounded transition-colors ${
                assemblyMode === 'screw_only'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Poros Ulir Luar
            </button>
            <button
              type="button"
              onClick={() => setAssemblyMode('nut_cutaway')}
              className={`px-2.5 py-1 font-medium rounded transition-colors ${
                assemblyMode === 'nut_cutaway'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Mur Dalam (Cutaway)
            </button>
          </div>

          {/* Pitch Cylinder d2 Toggle */}
          <button
            type="button"
            onClick={() => setShowPitchCylinder((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors ${
              showPitchCylinder
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            Silinder d2 ({row.d2} mm)
          </button>

          {/* Wireframe CAD Toggle */}
          <button
            type="button"
            onClick={() => setWireframeMode((w) => !w)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors ${
              wireframeMode
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Wireframe
          </button>

          {/* Auto-Rotate Toggle */}
          <button
            type="button"
            onClick={() => setAutoRotate((r) => !r)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors ${
              autoRotate
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            {autoRotate ? (
              <Pause className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            {autoRotate ? 'Putar Aktif' : 'Putar Otomatis'}
          </button>
        </div>
      </div>

      {/* Main 3D WebGL Viewport Container */}
      <div className="relative bg-slate-950">
        <div
          ref={mountRef}
          className="w-full h-[400px] sm:h-[440px] cursor-grab active:cursor-grabbing"
        />

        {/* Floating Top-Left Real-Time Dimension Telemetry Overlay */}
        <div className="absolute top-3 left-3 bg-slate-900/90 border border-slate-700/80 rounded-md p-2.5 text-[11px] font-mono text-slate-200 space-y-1 pointer-events-none">
          <div className="text-xs font-bold text-white border-b border-slate-700 pb-1">
            {row.designation} (ISO 2901 / DIN 103)
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 pt-0.5">
            <span className="text-slate-400">Dia. Luar (d):</span>
            <span className="text-right font-semibold text-sky-300">
              {row.d.toFixed(2)} mm
            </span>
            <span className="text-slate-400">Pitch (P):</span>
            <span className="text-right font-semibold text-white">
              {row.p.toFixed(2)} mm
            </span>
            <span className="text-slate-400">Dia. Pitch (d2):</span>
            <span className="text-right font-semibold text-emerald-400">
              {row.d2.toFixed(3)} mm
            </span>
            <span className="text-slate-400">Dia. Inti (d3):</span>
            <span className="text-right font-semibold text-blue-300">
              {row.d3.toFixed(3)} mm
            </span>
            <span className="text-slate-400">Bor Mur (D1):</span>
            <span className="text-right font-semibold text-amber-300">
              {row.D1.toFixed(3)} mm
            </span>
            <span className="text-slate-400">Tinggi Ulir (h3):</span>
            <span className="text-right text-slate-200">
              {row.h3.toFixed(3)} mm
            </span>
            <span className="text-slate-400">Sudut Heliks (λ):</span>
            <span className="text-right text-slate-200">
              {row.leadAngleDeg.toFixed(2)}°
            </span>
          </div>
        </div>

        {/* Floating Bottom-Right Camera View & Zoom Toolbar */}
        <div className="absolute bottom-3 right-3 flex flex-wrap items-center gap-1.5 bg-slate-900/90 border border-slate-700/80 p-1.5 rounded-md text-xs text-slate-200">
          <button
            type="button"
            onClick={() => handleCameraPreset('iso')}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 font-mono text-[11px] transition-colors"
          >
            3D Isometrik
          </button>
          <button
            type="button"
            onClick={() => handleCameraPreset('side')}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 font-mono text-[11px] transition-colors"
          >
            Tampak Samping
          </button>
          <button
            type="button"
            onClick={() => handleCameraPreset('top')}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 font-mono text-[11px] transition-colors"
          >
            Tampak Aksial
          </button>
          <button
            type="button"
            onClick={() => handleCameraPreset('zoom_in')}
            title="Perbesar (Zoom In)"
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleCameraPreset('zoom_out')}
            title="Perkecil (Zoom Out)"
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleCameraPreset('iso')}
            title="Reset Kamera"
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
