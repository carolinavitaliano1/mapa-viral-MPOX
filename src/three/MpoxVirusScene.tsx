import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { VIRUS_STRUCTURES, VirusPartId } from '../data/virusAnatomy';
import {
  buildSurfaceTubuleMatrices,
  createContactShadowTexture,
  createCutawayShellGeometry,
  createGranularBumpTexture,
  createOrganicLateralBodyGeometry,
  createPalisadeBumpTexture,
  evalBrickPoint,
  evalDumbbellPoint,
  VirusCutMode,
} from './virusGeometry';

export interface MpoxVirusSceneProps {
  selectedId: VirusPartId | null;
  onSelectStructure: (id: VirusPartId) => void;
  visibility: Record<VirusPartId, boolean>;
  explodeTarget: number;
  cutMode: VirusCutMode;
  autoRotate: boolean;
  showLabels: boolean;
  cameraResetTrigger: number;
  focusTrigger: number;
}

interface HoverTooltipState {
  name: string;
  colorHex: string;
  x: number;
  y: number;
}

const INITIAL_CAMERA_POS = new THREE.Vector3(3.2, 2.05, 3.7);
const INITIAL_TARGET = new THREE.Vector3(0, 0, 0);

// Pre-allocated scratch vectors/colors (zero GC inside animation loop)
const _worldPos = new THREE.Vector3();
const _explodeVec = new THREE.Vector3();
const _highlightTint = new THREE.Color('#FFFFFF');

function detectSoftwareWebGL(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export const MpoxVirusScene: React.FC<MpoxVirusSceneProps> = ({
  selectedId,
  onSelectStructure,
  visibility,
  explodeTarget,
  cutMode,
  autoRotate,
  showLabels,
  cameraResetTrigger,
  focusTrigger,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const labelRefs = useRef<Partial<Record<VirusPartId, HTMLButtonElement | null>>>({});

  const [hoverTooltip, setHoverTooltip] = useState<HoverTooltipState | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);

  const selectedIdRef = useRef<VirusPartId | null>(selectedId);
  selectedIdRef.current = selectedId;

  const onSelectRef = useRef(onSelectStructure);
  onSelectRef.current = onSelectStructure;

  const visibilityRef = useRef(visibility);
  visibilityRef.current = visibility;

  const explodeTargetRef = useRef(explodeTarget);
  explodeTargetRef.current = explodeTarget;

  const cutModeRef = useRef<VirusCutMode>(cutMode);
  cutModeRef.current = cutMode;

  const autoRotateRef = useRef(autoRotate);
  autoRotateRef.current = autoRotate;

  const showLabelsRef = useRef(showLabels);
  showLabelsRef.current = showLabels;

  const triggerResetRef = useRef<(() => void) | null>(null);
  const triggerFocusRef = useRef<((id: VirusPartId | null) => void) | null>(null);
  const applyCutModeRef = useRef<((mode: VirusCutMode) => void) | null>(null);
  const syncVisibilityAndHighlightsRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (cameraResetTrigger > 0) {
      triggerResetRef.current?.();
    }
  }, [cameraResetTrigger]);

  useEffect(() => {
    if (focusTrigger > 0) {
      triggerFocusRef.current?.(selectedId);
    }
  }, [focusTrigger, selectedId]);

  useEffect(() => {
    applyCutModeRef.current?.(cutMode);
  }, [cutMode]);

  useEffect(() => {
    syncVisibilityAndHighlightsRef.current?.();
  }, [visibility, selectedId]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglError('WebGL não está disponível neste navegador.');
      return;
    }

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.cursor = 'grab';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.copy(INITIAL_CAMERA_POS);

    // Neutral studio IBL for gentle, physically-accurate diffuse shading across matte surfaces
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.28;
    pmremGenerator.dispose();

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 1.85;
    controls.maxDistance = 11.5;
    controls.autoRotate = autoRotateRef.current && !isSoftwareGl;
    controls.autoRotateSpeed = 0.45;
    controls.target.copy(INITIAL_TARGET);

    // Sober Diffuse Laboratory Lighting Rig (Zero Colored Neon/Game Lights)
    const hemiLight = new THREE.HemisphereLight(0xf8fafc, 0xcbd5e1, 1.08);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfffaf2, 1.38);
    keyLight.position.set(4.8, 6.4, 5.2);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 1;
      keyLight.shadow.camera.far = 18;
      keyLight.shadow.camera.left = -2.8;
      keyLight.shadow.camera.right = 2.8;
      keyLight.shadow.camera.top = 2.8;
      keyLight.shadow.camera.bottom = -2.8;
      keyLight.shadow.bias = -0.0004;
      keyLight.shadow.normalBias = 0.025;
      keyLight.shadow.radius = 4;
    }
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xeef5fc, 0.72);
    fillLight.position.set(-5.5, 2.8, 4.2);
    scene.add(fillLight);

    const backLight = new THREE.DirectionalLight(0xf1f5f9, 0.56);
    backLight.position.set(-3.2, 4.0, -5.8);
    scene.add(backLight);

    // Gentle neutral frontal cavity fill so the dumbbell core & DNA read clearly without artificial glow
    const cavityFillLight = new THREE.DirectionalLight(0xffffff, 0.42);
    cavityFillLight.position.set(1.8, 1.2, 4.8);
    scene.add(cavityFillLight);

    const geometriesToDispose: THREE.BufferGeometry[] = [];
    const materialsToDispose: THREE.Material[] = [];
    const texturesToDispose: THREE.Texture[] = [];

    // Soft studio contact shadow plane beneath the anatomical specimen
    const shadowTex = createContactShadowTexture();
    const shadowPlaneGeo = new THREE.PlaneGeometry(4.2, 3.1);
    const shadowPlaneMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.75,
    });
    const contactShadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
    contactShadowPlane.rotation.x = -Math.PI / 2;
    contactShadowPlane.position.y = -1.28;
    geometriesToDispose.push(shadowPlaneGeo);
    materialsToDispose.push(shadowPlaneMat);
    texturesToDispose.push(shadowTex);
    scene.add(contactShadowPlane);

    // =========================================================================
    // ASSEMBLY OF THE 7 MPOX VIRUS STRUCTURES
    // =========================================================================
    const virusRoot = new THREE.Group();
    scene.add(virusRoot);

    const structureGroups: Partial<Record<VirusPartId, THREE.Group>> = {};
    const structureMaterials: Partial<Record<VirusPartId, THREE.MeshStandardMaterial[]>> = {};
    const lateralBodyMeshes: THREE.Mesh[] = [];
    const maxAniso = renderer.capabilities.getMaxAnisotropy();

    const registerMesh = (mesh: THREE.Object3D, id: VirusPartId, enableShadow = true) => {
      mesh.userData.structureId = id;
      mesh.layers.enable(1);
      if (enableShadow && !isSoftwareGl && (mesh as THREE.Mesh).isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
      if (!structureMaterials[id]) structureMaterials[id] = [];
      const mat = (mesh as THREE.Mesh).material;
      if (mat && !Array.isArray(mat) && mat instanceof THREE.MeshStandardMaterial) {
        if (!mat.userData.baseColor) {
          mat.userData.baseColor = mat.color.clone();
        }
        if (!structureMaterials[id]!.includes(mat)) {
          structureMaterials[id]!.push(mat);
        }
      }
    };

    // Pre-build geometries for all 3 cut modes for instant zero-hitch switching
    const cutModes: VirusCutMode[] = ['quarter', 'half', 'full'];
    const outerShellGeos = {} as Record<VirusCutMode, THREE.BufferGeometry>;
    const innerShellGeos = {} as Record<VirusCutMode, THREE.BufferGeometry>;
    const palisadeGeos = {} as Record<VirusCutMode, THREE.BufferGeometry>;
    const coreGeos = {} as Record<VirusCutMode, THREE.BufferGeometry>;
    const tubuleMatricesByMode = {} as Record<VirusCutMode, THREE.Matrix4[]>;

    for (const mode of cutModes) {
      outerShellGeos[mode] = createCutawayShellGeometry(
        (u, v) => evalBrickPoint(u, v, 1.65, 0.94, 1.1),
        (u, v) => evalBrickPoint(u, v, 1.58, 0.88, 1.03),
        mode,
        64,
        40
      );
      innerShellGeos[mode] = createCutawayShellGeometry(
        (u, v) => evalBrickPoint(u, v, 1.48, 0.82, 0.96),
        (u, v) => evalBrickPoint(u, v, 1.42, 0.76, 0.9),
        mode,
        64,
        40
      );
      palisadeGeos[mode] = createCutawayShellGeometry(
        (u, v) => evalDumbbellPoint(u, v, 1.24, 0.55, 0.71, 0.018),
        (u, v) => evalDumbbellPoint(u, v, 1.16, 0.48, 0.64, 0),
        mode,
        72,
        40
      );
      coreGeos[mode] = createCutawayShellGeometry(
        (u, v) => evalDumbbellPoint(u, v, 1.13, 0.455, 0.615, 0),
        (u, v) => evalDumbbellPoint(u, v, 1.05, 0.39, 0.545, 0),
        mode,
        64,
        40
      );
      tubuleMatricesByMode[mode] = buildSurfaceTubuleMatrices(mode);
      geometriesToDispose.push(
        outerShellGeos[mode],
        innerShellGeos[mode],
        palisadeGeos[mode],
        coreGeos[mode]
      );
    }

    const initialMode = cutModeRef.current;

    // 1. Membrana Externa (Envelope EV) — MeshStandardMaterial fosco (verde-petróleo clínico)
    const outerGroup = new THREE.Group();
    const outerMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#2E7D78'),
      roughness: 0.76,
      metalness: 0.04,
      envMapIntensity: 0.28,
      transparent: true,
      opacity: 0.86,
      side: THREE.DoubleSide,
    });
    materialsToDispose.push(outerMat);
    const outerMesh = new THREE.Mesh(outerShellGeos[initialMode], outerMat);
    registerMesh(outerMesh, 'outer_membrane');
    outerGroup.add(outerMesh);
    virusRoot.add(outerGroup);
    structureGroups.outer_membrane = outerGroup;

    // 2. Espículas / Túbulos de Superfície — MeshStandardMaterial fosco cerâmico (terracota mineral)
    const tubulesGroup = new THREE.Group();
    const spikeGeo = new THREE.CapsuleGeometry(0.032, 0.085, 6, 12);
    const spikeMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#C46334'),
      roughness: 0.86,
      metalness: 0.02,
      envMapIntensity: 0.22,
    });
    geometriesToDispose.push(spikeGeo);
    materialsToDispose.push(spikeMat);

    const maxSpikes = Math.max(
      tubuleMatricesByMode.quarter.length,
      tubuleMatricesByMode.half.length,
      tubuleMatricesByMode.full.length
    );
    const instancedSpikes = new THREE.InstancedMesh(spikeGeo, spikeMat, maxSpikes);
    const applySpikeMatrices = (mode: VirusCutMode) => {
      const mats = tubuleMatricesByMode[mode];
      instancedSpikes.count = mats.length;
      for (let i = 0; i < mats.length; i++) {
        instancedSpikes.setMatrixAt(i, mats[i]);
      }
      instancedSpikes.instanceMatrix.needsUpdate = true;
      instancedSpikes.computeBoundingSphere();
    };
    applySpikeMatrices(initialMode);
    registerMesh(instancedSpikes, 'surface_tubules');
    tubulesGroup.add(instancedSpikes);
    virusRoot.add(tubulesGroup);
    structureGroups.surface_tubules = tubulesGroup;

    // 3. Membrana Interna (Vírion Maduro MV) — MeshStandardMaterial fosco (azul ardósia técnico)
    const innerGroup = new THREE.Group();
    const innerMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#3B74A6'),
      roughness: 0.74,
      metalness: 0.05,
      envMapIntensity: 0.26,
      side: THREE.DoubleSide,
    });
    materialsToDispose.push(innerMat);
    const innerMesh = new THREE.Mesh(innerShellGeos[initialMode], innerMat);
    registerMesh(innerMesh, 'inner_membrane');
    innerGroup.add(innerMesh);
    virusRoot.add(innerGroup);
    structureGroups.inner_membrane = innerGroup;

    // 4. Corpos Laterais — MeshStandardMaterial granular ultra-fosco (ocre mineral)
    const lbGroup = new THREE.Group();
    const lbGeo = createOrganicLateralBodyGeometry();
    const granularTex = createGranularBumpTexture(maxAniso);
    geometriesToDispose.push(lbGeo);
    texturesToDispose.push(granularTex);
    const lbMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#C28D38'),
      roughness: 0.9,
      metalness: 0.0,
      envMapIntensity: 0.18,
      bumpMap: granularTex,
      bumpScale: 0.024,
    });
    materialsToDispose.push(lbMat);

    const topBody = new THREE.Mesh(lbGeo, lbMat);
    topBody.position.set(0, 0.44, 0);
    topBody.userData.baseY = 0.44;
    topBody.userData.explodeDirY = 1;
    registerMesh(topBody, 'lateral_bodies');

    const bottomBody = new THREE.Mesh(lbGeo, lbMat);
    bottomBody.position.set(0, -0.44, 0);
    bottomBody.userData.baseY = -0.44;
    bottomBody.userData.explodeDirY = -1;
    registerMesh(bottomBody, 'lateral_bodies');

    lateralBodyMeshes.push(topBody, bottomBody);
    lbGroup.add(topBody, bottomBody);
    virusRoot.add(lbGroup);
    structureGroups.lateral_bodies = lbGroup;

    // 5. Camada Paliçada — MeshStandardMaterial estriado fosco (violeta-ameixa mineral)
    const palisadeGroup = new THREE.Group();
    const palisadeTex = createPalisadeBumpTexture(maxAniso);
    palisadeTex.repeat.set(6, 2);
    texturesToDispose.push(palisadeTex);
    const palisadeMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#6E568E'),
      roughness: 0.84,
      metalness: 0.04,
      envMapIntensity: 0.22,
      bumpMap: palisadeTex,
      bumpScale: 0.028,
      side: THREE.DoubleSide,
    });
    materialsToDispose.push(palisadeMat);
    const palisadeMesh = new THREE.Mesh(palisadeGeos[initialMode], palisadeMat);
    registerMesh(palisadeMesh, 'palisade_layer');
    palisadeGroup.add(palisadeMesh);
    virusRoot.add(palisadeGroup);
    structureGroups.palisade_layer = palisadeGroup;

    // 6. Núcleo Bicôncavo — MeshStandardMaterial estrutural fosco (bordô anatômico)
    const coreGroup = new THREE.Group();
    const coreMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#A6445B'),
      roughness: 0.78,
      metalness: 0.04,
      envMapIntensity: 0.24,
      side: THREE.DoubleSide,
    });
    materialsToDispose.push(coreMat);
    const coreMesh = new THREE.Mesh(coreGeos[initialMode], coreMat);
    registerMesh(coreMesh, 'biconcave_core');
    coreGroup.add(coreMesh);
    virusRoot.add(coreGroup);
    structureGroups.biconcave_core = coreGroup;

    // 7. Genoma de DNA Fita Dupla Linear — MeshStandardMaterial fosco (azul petróleo + pares em marfim mineral)
    const dnaGroup = new THREE.Group();
    const pathPoints = [
      new THREE.Vector3(-0.78, -0.05, -0.18),
      new THREE.Vector3(-0.62, 0.16, 0.2),
      new THREE.Vector3(-0.34, -0.1, 0.14),
      new THREE.Vector3(-0.08, 0.04, -0.12),
      new THREE.Vector3(0.18, 0.02, 0.16),
      new THREE.Vector3(0.46, 0.15, 0.24),
      new THREE.Vector3(0.74, 0.04, 0.02),
      new THREE.Vector3(0.62, -0.17, -0.22),
      new THREE.Vector3(0.28, -0.08, 0.18),
      new THREE.Vector3(0.55, 0.12, -0.14),
    ];

    const spineCurve = new THREE.CatmullRomCurve3(pathPoints, false, 'catmullrom', 0.5);
    const samples = 240;
    const frames = spineCurve.computeFrenetFrames(samples, false);
    const helixRadius = 0.052;
    const helixTurns = 18;

    const strand1Pts: THREE.Vector3[] = [];
    const strand2Pts: THREE.Vector3[] = [];

    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const p = spineCurve.getPointAt(t);
      const N = frames.normals[i];
      const B = frames.binormals[i];
      const angle = t * Math.PI * 2 * helixTurns;

      const offset = new THREE.Vector3()
        .addScaledVector(N, Math.cos(angle) * helixRadius)
        .addScaledVector(B, Math.sin(angle) * helixRadius);

      strand1Pts.push(p.clone().add(offset));
      strand2Pts.push(p.clone().sub(offset));
    }

    const strand1Curve = new THREE.CatmullRomCurve3(strand1Pts);
    const strand2Curve = new THREE.CatmullRomCurve3(strand2Pts);

    const strandMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1E6FA8'),
      roughness: 0.72,
      metalness: 0.08,
      envMapIntensity: 0.26,
    });
    materialsToDispose.push(strandMat);

    const tube1Geo = new THREE.TubeGeometry(strand1Curve, 220, 0.0155, 10, false);
    const tube2Geo = new THREE.TubeGeometry(strand2Curve, 220, 0.0155, 10, false);
    geometriesToDispose.push(tube1Geo, tube2Geo);

    const tube1 = new THREE.Mesh(tube1Geo, strandMat);
    const tube2 = new THREE.Mesh(tube2Geo, strandMat);
    registerMesh(tube1, 'dna_genome');
    registerMesh(tube2, 'dna_genome');
    dnaGroup.add(tube1, tube2);

    const rungCount = 86;
    const rungGeo = new THREE.CylinderGeometry(0.0078, 0.0078, helixRadius * 2, 8);
    const rungMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#D6E2EC'),
      roughness: 0.8,
      metalness: 0.02,
      envMapIntensity: 0.22,
    });
    geometriesToDispose.push(rungGeo);
    materialsToDispose.push(rungMat);

    const rungsInstanced = new THREE.InstancedMesh(rungGeo, rungMat, rungCount);
    const upVec = new THREE.Vector3(0, 1, 0);
    const dummy = new THREE.Object3D();

    for (let i = 0; i < rungCount; i++) {
      const idx = Math.floor((i / (rungCount - 1)) * samples);
      const p1 = strand1Pts[idx];
      const p2 = strand2Pts[idx];
      const mid = p1.clone().add(p2).multiplyScalar(0.5);
      const dir = p2.clone().sub(p1).normalize();

      dummy.position.copy(mid);
      dummy.quaternion.setFromUnitVectors(upVec, dir);
      dummy.updateMatrix();
      rungsInstanced.setMatrixAt(i, dummy.matrix);
    }
    rungsInstanced.instanceMatrix.needsUpdate = true;
    rungsInstanced.computeBoundingSphere();

    registerMesh(rungsInstanced, 'dna_genome');
    dnaGroup.add(rungsInstanced);
    virusRoot.add(dnaGroup);
    structureGroups.dna_genome = dnaGroup;

    // Pre-warm shaders on GPU devices
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Dynamic cut mode swapper
    applyCutModeRef.current = (mode: VirusCutMode) => {
      outerMesh.geometry = outerShellGeos[mode];
      innerMesh.geometry = innerShellGeos[mode];
      palisadeMesh.geometry = palisadeGeos[mode];
      coreMesh.geometry = coreGeos[mode];
      applySpikeMatrices(mode);
    };

    // Pure diffuse albedo inspection feedback on hover/selection (zero emissive properties)
    let hoveredId: VirusPartId | null = null;
    const syncVisibilityAndHighlights = () => {
      const vis = visibilityRef.current;
      const sel = selectedIdRef.current;
      for (const s of VIRUS_STRUCTURES) {
        const grp = structureGroups[s.id];
        if (grp) grp.visible = vis[s.id] !== false;

        const mats = structureMaterials[s.id] ?? [];
        const isSel = sel === s.id;
        const isHov = hoveredId === s.id;
        const lift = isSel ? 0.22 : isHov ? 0.11 : 0;
        for (const mat of mats) {
          const baseColor = mat.userData.baseColor as THREE.Color | undefined;
          if (baseColor) {
            mat.color.copy(baseColor);
            if (lift > 0) {
              mat.color.lerp(_highlightTint, lift);
            }
          }
        }
      }
    };
    syncVisibilityAndHighlightsRef.current = syncVisibilityAndHighlights;
    syncVisibilityAndHighlights();

    // Camera transition state
    let isResettingCamera = false;
    let isFocusingTarget = false;
    const desiredTarget = new THREE.Vector3().copy(INITIAL_TARGET);

    triggerResetRef.current = () => {
      isFocusingTarget = false;
      isResettingCamera = true;
    };

    triggerFocusRef.current = (id: VirusPartId | null) => {
      const spec = VIRUS_STRUCTURES.find((s) => s.id === id);
      if (spec) {
        desiredTarget.set(spec.focusPoint[0], spec.focusPoint[1], spec.focusPoint[2]);
        if (spec.id !== 'lateral_bodies') {
          desiredTarget.x += spec.explodeOffset[0] * explodeTargetRef.current * 0.5;
          desiredTarget.y += spec.explodeOffset[1] * explodeTargetRef.current * 0.5;
          desiredTarget.z += spec.explodeOffset[2] * explodeTargetRef.current * 0.5;
        }
        isResettingCamera = false;
        isFocusingTarget = true;
      } else {
        desiredTarget.copy(INITIAL_TARGET);
        isResettingCamera = false;
        isFocusingTarget = true;
      }
    };

    const onControlStart = () => {
      isResettingCamera = false;
      isFocusingTarget = false;
    };
    controls.addEventListener('start', onControlStart);

    // =========================================================================
    // RAYCASTING (VISIBLE LAYERS ONLY, THROTTLED HOVER + CLICK)
    // =========================================================================
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };
    let lastHoverCheck = 0;

    const getVisibleObjects = (): THREE.Object3D[] => {
      const objs: THREE.Object3D[] = [];
      const vis = visibilityRef.current;
      for (const s of VIRUS_STRUCTURES) {
        if (vis[s.id] !== false) {
          const grp = structureGroups[s.id];
          grp?.traverse((child) => {
            if ((child as THREE.Mesh).isMesh && child.visible) {
              objs.push(child);
            }
          });
        }
      }
      return objs;
    };

    const raycastAtPoint = (clientX: number, clientY: number): VirusPartId | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(getVisibleObjects(), false);
      if (hits.length === 0) return null;
      return (hits[0].object.userData.structureId as VirusPartId) ?? null;
    };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
      renderer.domElement.style.cursor = 'grabbing';
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.buttons > 0) {
        setHoverTooltip(null);
        return;
      }
      const now = performance.now();
      if (now - lastHoverCheck < 32) return;
      lastHoverCheck = now;

      const hitId = raycastAtPoint(e.clientX, e.clientY);
      if (hitId !== hoveredId) {
        hoveredId = hitId;
        syncVisibilityAndHighlights();
      }

      if (hitId) {
        const s = VIRUS_STRUCTURES.find((item) => item.id === hitId);
        if (s) {
          const rect = container.getBoundingClientRect();
          setHoverTooltip({
            name: s.name,
            colorHex: s.colorHex,
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
          });
          renderer.domElement.style.cursor = 'pointer';
          return;
        }
      }

      setHoverTooltip(null);
      renderer.domElement.style.cursor = 'grab';
    };

    const onPointerUp = (e: PointerEvent) => {
      renderer.domElement.style.cursor = hoveredId ? 'pointer' : 'grab';
      const dx = e.clientX - pointerDownPos.x;
      const dy = e.clientY - pointerDownPos.y;
      if (Math.hypot(dx, dy) < 6) {
        const hitId = raycastAtPoint(e.clientX, e.clientY);
        if (hitId) {
          onSelectRef.current(hitId);
        }
      }
    };

    const onPointerLeave = () => {
      hoveredId = null;
      setHoverTooltip(null);
      renderer.domElement.style.cursor = 'grab';
      syncVisibilityAndHighlights();
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointerleave', onPointerLeave);

    // ResizeObserver for crisp container tracking
    let viewportW = width;
    let viewportH = height;
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const w = Math.max(1, Math.floor(entry.contentRect.width));
      const h = Math.max(1, Math.floor(entry.contentRect.height));
      if (w === viewportW && h === viewportH) return;
      viewportW = w;
      viewportH = h;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    // =========================================================================
    // ANIMATION LOOP WITH SOFTWARE-WEBGL PACING & 3D LABEL PROJECTION
    // =========================================================================
    let disposed = false;
    let frameId = 0;
    let explodeCurrent = explodeTargetRef.current;
    const clock = new THREE.Clock();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      if (!sync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const poll = () => {
        if (disposed) {
          gl.deleteSync(sync);
          return;
        }
        const status = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (status === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const updateLabels3D = () => {
      const vis = visibilityRef.current;
      const labelsOn = showLabelsRef.current;
      for (const s of VIRUS_STRUCTURES) {
        const el = labelRefs.current[s.id];
        if (!el) continue;

        if (!labelsOn || vis[s.id] === false) {
          el.style.display = 'none';
          continue;
        }

        const grp = structureGroups[s.id];
        _worldPos.set(s.labelAnchor[0], s.labelAnchor[1], s.labelAnchor[2]);
        if (s.id === 'lateral_bodies') {
          _worldPos.y += explodeCurrent * 0.58;
        } else if (grp) {
          _worldPos.add(grp.position);
        }

        _worldPos.applyMatrix4(virusRoot.matrixWorld);
        _worldPos.project(camera);

        if (_worldPos.z > 1) {
          el.style.display = 'none';
          continue;
        }

        const x = (_worldPos.x * 0.5 + 0.5) * viewportW;
        const y = (-_worldPos.y * 0.5 + 0.5) * viewportH;

        el.style.display = 'flex';
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;
      }
    };

    const tick = () => {
      if (disposed) return;
      const dt = Math.min(clock.getDelta(), 0.05);

      // Sync autoRotate toggle
      controls.autoRotate = autoRotateRef.current && !isSoftwareGl;

      // 1) Damped Exploded View separation
      explodeCurrent = THREE.MathUtils.damp(explodeCurrent, explodeTargetRef.current, 6.5, dt);

      for (const s of VIRUS_STRUCTURES) {
        const grp = structureGroups[s.id];
        if (!grp) continue;
        if (s.id === 'lateral_bodies') {
          for (const mesh of lateralBodyMeshes) {
            const baseY = mesh.userData.baseY as number;
            const dirY = mesh.userData.explodeDirY as number;
            mesh.position.y = baseY + dirY * explodeCurrent * 0.58;
          }
        } else {
          _explodeVec.set(s.explodeOffset[0], s.explodeOffset[1], s.explodeOffset[2]);
          grp.position.copy(_explodeVec).multiplyScalar(explodeCurrent);
        }
      }

      // 2) Smooth camera focus or reset transitions
      if (isResettingCamera) {
        camera.position.lerp(INITIAL_CAMERA_POS, 1 - Math.exp(-6 * dt));
        controls.target.lerp(INITIAL_TARGET, 1 - Math.exp(-6 * dt));
        if (
          camera.position.distanceTo(INITIAL_CAMERA_POS) < 0.03 &&
          controls.target.distanceTo(INITIAL_TARGET) < 0.03
        ) {
          camera.position.copy(INITIAL_CAMERA_POS);
          controls.target.copy(INITIAL_TARGET);
          isResettingCamera = false;
        }
      } else if (isFocusingTarget) {
        controls.target.lerp(desiredTarget, 1 - Math.exp(-6 * dt));
        if (controls.target.distanceTo(desiredTarget) < 0.015) {
          controls.target.copy(desiredTarget);
          isFocusingTarget = false;
        }
      }

      controls.update();
      renderer.render(scene, camera);
      updateLabels3D();

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      controls.removeEventListener('start', onControlStart);
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);

      envRT.dispose();
      geometriesToDispose.forEach((g) => g.dispose());
      materialsToDispose.forEach((m) => m.dispose());
      texturesToDispose.forEach((t) => t.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        background:
          'radial-gradient(circle at 50% 44%, #F9FBFD 0%, #EDF3F8 58%, #DFE8F1 100%)',
      }}
    >
      {/* Dedicated WebGL Mount Container */}
      <div
        ref={mountRef}
        className="h-full w-full"
        aria-label="Visualizador 3D interativo do vírus mpox em corte transversal"
      />

      {/* Clickable 3D Projected Floating Labels */}
      {!webglError && (
        <div
          className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
          aria-hidden={!showLabels}
        >
          {VIRUS_STRUCTURES.map((s) => {
            const isActive = selectedId === s.id;
            return (
              <button
                key={s.id}
                ref={(el) => {
                  labelRefs.current[s.id] = el;
                }}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectStructure(s.id);
                }}
                style={{ display: 'none', left: 0, top: 0 }}
                className={`pointer-events-auto absolute flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide shadow-md transition-colors ${
                  isActive
                    ? 'border-[#0052A3] bg-[#E6F0FA] text-[#003E7E] shadow-[0_6px_18px_rgba(0,82,163,0.18)]'
                    : 'border-[#CBD5E1] bg-white/95 text-[#0F172A] hover:border-[#0052A3] hover:bg-[#F0F7FD]'
                }`}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-slate-900/15"
                  style={{ backgroundColor: s.colorHex }}
                  aria-hidden="true"
                />
                <span>{s.shortName}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Cursor-following Hover Tooltip */}
      {hoverTooltip && !webglError && (
        <div
          className="pointer-events-none absolute z-30 flex items-center gap-2 whitespace-nowrap rounded-xl border border-[#CBD5E1] bg-white/96 px-3 py-1.5 text-xs font-semibold text-[#0F172A] shadow-lg"
          style={{
            left: `${hoverTooltip.x}px`,
            top: `${hoverTooltip.y}px`,
            transform: 'translate(14px, -50%)',
          }}
        >
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-slate-900/15"
            style={{ backgroundColor: hoverTooltip.colorHex }}
            aria-hidden="true"
          />
          <span>{hoverTooltip.name}</span>
        </div>
      )}

      {webglError && (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-6">
          <div className="max-w-md rounded-2xl border border-[#CBD5E1] bg-white p-6 text-center shadow-lg">
            <h3 className="text-lg font-semibold text-[#0F172A]">Visualização 3D indisponível</h3>
            <p className="mt-2 text-sm text-[#475569]">{webglError}</p>
          </div>
        </div>
      )}
    </div>
  );
};
