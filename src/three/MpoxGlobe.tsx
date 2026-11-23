import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { BRAZIL_SURVEILLANCE_NODES, BrazilSurveillanceNode, MPOX_STEPS, MpoxStep } from '../data/mpoxTimeline';
import { createProceduralEarthTextures } from './earthTexture';

export type GlobeSurfaceTheme = 'realistic' | 'scientific';

export interface MpoxGlobeProps {
  activeStepIndex: number;
  onSelectStep: (index: number) => void;
  focusTrigger: number;
  panelOpen: boolean;
  showClouds: boolean;
  showLabels: boolean;
  showBrazilColumns: boolean;
  surfaceTheme: GlobeSurfaceTheme;
  brazilNodes?: BrazilSurveillanceNode[];
}

interface HoveredPinInfo {
  step: MpoxStep;
  x: number;
  y: number;
}

const GLOBE_RADIUS = 2.15;

// Pre-allocated scratch math helpers (zero GC inside animation loop)
const _vA = new THREE.Vector3();
const _vDir = new THREE.Vector3();
const _vProj = new THREE.Vector3();
const _vNorm = new THREE.Vector3();
const _vToCam = new THREE.Vector3();
const _qRot = new THREE.Quaternion();
const _upVec = new THREE.Vector3(0, 1, 0);
const _fallbackAxis = new THREE.Vector3(0, 1, 0);
const _pinHighlightTint = new THREE.Color('#FFFFFF');

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function latLngToVec3(lat: number, lng: number, radius: number, out = new THREE.Vector3()): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(lng + 180);
  const theta = THREE.MathUtils.degToRad(90 - lat);
  const sinTheta = Math.sin(theta);
  out.set(
    -radius * Math.cos(phi) * sinTheta,
    radius * Math.cos(theta),
    radius * Math.sin(phi) * sinTheta
  );
  return out;
}

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

interface PinAssembly {
  stepIndex: number;
  group: THREE.Group;
  crystal: THREE.Mesh;
  crystalMat: THREE.MeshStandardMaterial;
  baseColor: THREE.Color;
  halo: THREE.Mesh;
  haloMat: THREE.MeshStandardMaterial;
  collarMat: THREE.MeshStandardMaterial;
  hitProxy: THREE.Mesh;
  surfacePos: THREE.Vector3;
  normal: THREE.Vector3;
}

interface ArcAssembly {
  fromIndex: number;
  toIndex: number;
  curve: THREE.CatmullRomCurve3;
  mesh: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  pulseBead: THREE.Mesh;
  pulseMat: THREE.MeshStandardMaterial;
  totalIndices: number;
}

interface BrazilColumnAssembly {
  uf: string;
  surfacePos: THREE.Vector3;
  normal: THREE.Vector3;
  shaft: THREE.Mesh;
  cap: THREE.Mesh;
  targetHeight: number;
  currentHeight: number;
}

export const MpoxGlobe: React.FC<MpoxGlobeProps> = ({
  activeStepIndex,
  onSelectStep,
  focusTrigger,
  panelOpen,
  showClouds,
  showLabels,
  showBrazilColumns,
  surfaceTheme,
  brazilNodes,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const stepLabelRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const ufLabelRefs = useRef<(HTMLDivElement | null)[]>([]);

  const activeBrazilNodes = brazilNodes && brazilNodes.length > 0 ? brazilNodes : BRAZIL_SURVEILLANCE_NODES;
  const brazilShareByUfRef = useRef<Record<string, number>>({});
  const nextShareMap: Record<string, number> = {};
  for (const n of activeBrazilNodes) {
    nextShareMap[n.uf] = n.sharePercent;
  }
  brazilShareByUfRef.current = nextShareMap;

  const onSelectStepRef = useRef(onSelectStep);
  onSelectStepRef.current = onSelectStep;

  const activeStepRef = useRef(activeStepIndex);
  activeStepRef.current = activeStepIndex;

  const panelOpenRef = useRef(panelOpen);
  panelOpenRef.current = panelOpen;

  const showCloudsRef = useRef(showClouds);
  showCloudsRef.current = showClouds;

  const showLabelsRef = useRef(showLabels);
  showLabelsRef.current = showLabels;

  const showBrazilColumnsRef = useRef(showBrazilColumns);
  showBrazilColumnsRef.current = showBrazilColumns;

  const surfaceThemeRef = useRef<GlobeSurfaceTheme>(surfaceTheme);
  surfaceThemeRef.current = surfaceTheme;

  const triggerCameraFocusRef = useRef<((idx: number) => void) | null>(null);
  const [hoveredPin, setHoveredPin] = useState<HoveredPinInfo | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);

  useEffect(() => {
    triggerCameraFocusRef.current?.(activeStepIndex);
  }, [activeStepIndex, focusTrigger]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
        alpha: false,
      });
    } catch {
      setWebglError('WebGL não está disponível neste navegador.');
      return;
    }

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const bgHex = 0xe9f1f7;
    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.FogExp2(bgHex, 0.018);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    const initialDir = latLngToVec3(MPOX_STEPS[0].lat, MPOX_STEPS[0].lng, 1).normalize();
    camera.position.copy(initialDir).multiplyScalar(MPOX_STEPS[0].cameraDistance ?? 5.4);

    // Neutral diffuse studio environment via PMREMGenerator + RoomEnvironment
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.28;
    pmremGenerator.dispose();

    // Sober Diffuse Studio Lighting Rig (matching VirusView PBR calibration)
    const hemiLight = new THREE.HemisphereLight(0xf8fafc, 0xcbd5e1, 1.08);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfffaf2, 1.42);
    keyLight.position.set(7, 6, 8);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 1;
      keyLight.shadow.camera.far = 22;
      const d = 4.2;
      keyLight.shadow.camera.left = -d;
      keyLight.shadow.camera.right = d;
      keyLight.shadow.camera.top = d;
      keyLight.shadow.camera.bottom = -d;
      keyLight.shadow.bias = -0.0004;
      keyLight.shadow.normalBias = 0.025;
      keyLight.shadow.radius = 4;
    }
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xeef5fc, 0.72);
    fillLight.position.set(-6.5, 2.5, 4.5);
    scene.add(fillLight);

    const backLight = new THREE.DirectionalLight(0xf1f5f9, 0.56);
    backLight.position.set(-5.5, 3.2, -6.5);
    scene.add(backLight);

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.065;
    controls.minDistance = 3.2;
    controls.maxDistance = 8.6;
    controls.rotateSpeed = 0.68;
    controls.zoomSpeed = 0.85;
    controls.target.set(0, 0, 0);

    const geometriesToDispose: THREE.BufferGeometry[] = [];
    const materialsToDispose: THREE.Material[] = [];

    // =========================================================================
    // COMPOSITE 3D SCIENTIFIC GLOBE ASSEMBLY
    // =========================================================================
    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const earthTextures = createProceduralEarthTextures(maxAniso);

    // 1. Primary Earth Sphere (Technical Matte PBR Relief Globe)
    const earthGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 72, 48);
    geometriesToDispose.push(earthGeo);
    let appliedTheme: GlobeSurfaceTheme = surfaceThemeRef.current;
    const earthMat = new THREE.MeshStandardMaterial({
      map:
        appliedTheme === 'realistic'
          ? earthTextures.realisticColorMap
          : earthTextures.scientificColorMap,
      bumpMap: earthTextures.bumpMap,
      bumpScale: 0.045,
      roughnessMap: earthTextures.roughnessMap,
      roughness: 1.0,
      metalness: 0.04,
      envMapIntensity: 0.28,
    });
    materialsToDispose.push(earthMat);
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthMesh.receiveShadow = !isSoftwareGl;
    globeGroup.add(earthMesh);

    // 2A. Soft Cloud Ground Shadow Layer (subtle orbital parallax depth)
    const cloudShadowGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.007, 56, 36);
    geometriesToDispose.push(cloudShadowGeo);
    const cloudShadowMat = new THREE.MeshBasicMaterial({
      map: earthTextures.cloudShadowMap,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
    });
    materialsToDispose.push(cloudShadowMat);
    const cloudShadowMesh = new THREE.Mesh(cloudShadowGeo, cloudShadowMat);
    cloudShadowMesh.rotation.y = -0.014;
    cloudShadowMesh.rotation.x = 0.008;
    cloudShadowMesh.renderOrder = 1;
    globeGroup.add(cloudShadowMesh);

    // 2B. Animated Translucent 3D Cloud Deck (Matte PBR)
    const cloudGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.022, 56, 36);
    geometriesToDispose.push(cloudGeo);
    const cloudMat = new THREE.MeshStandardMaterial({
      map: earthTextures.cloudMap,
      transparent: true,
      opacity: 0.5,
      roughness: 0.9,
      metalness: 0.0,
      envMapIntensity: 0.2,
      depthWrite: false,
    });
    materialsToDispose.push(cloudMat);
    const cloudsMesh = new THREE.Mesh(cloudGeo, cloudMat);
    cloudsMesh.renderOrder = 2;
    globeGroup.add(cloudsMesh);

    // 3. Subtle Non-Neon Atmospheric Horizon Limb (Sober Scientific Haze)
    const innerAtmoGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.028, 56, 36);
    geometriesToDispose.push(innerAtmoGeo);
    const innerAtmoMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0x8bbad8) },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPos;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewPos = -mvPos.xyz;
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying vec3 vNormal;
        varying vec3 vViewPos;
        void main() {
          vec3 viewDir = normalize(vViewPos);
          float fresnel = pow(1.0 - max(0.0, dot(vNormal, viewDir)), 3.2);
          gl_FragColor = vec4(uColor, fresnel * 0.22);
        }
      `,
      transparent: true,
      blending: THREE.NormalBlending,
      depthWrite: false,
      side: THREE.FrontSide,
    });
    materialsToDispose.push(innerAtmoMat);
    const innerAtmoMesh = new THREE.Mesh(innerAtmoGeo, innerAtmoMat);
    innerAtmoMesh.renderOrder = 2;
    globeGroup.add(innerAtmoMesh);

    // 4. Precision Equatorial & Meridian Instrument Rings + Instanced Degree Ticks (Matte PBR)
    const eqRingGeo = new THREE.TorusGeometry(GLOBE_RADIUS + 0.16, 0.0055, 10, 128);
    geometriesToDispose.push(eqRingGeo);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x52728f,
      roughness: 0.8,
      metalness: 0.08,
      envMapIntensity: 0.24,
      transparent: true,
      opacity: 0.42,
    });
    materialsToDispose.push(ringMat);

    const eqRing = new THREE.Mesh(eqRingGeo, ringMat);
    eqRing.rotation.x = Math.PI / 2;
    globeGroup.add(eqRing);

    const meridianRingGeo = new THREE.TorusGeometry(GLOBE_RADIUS + 0.16, 0.0045, 10, 128);
    geometriesToDispose.push(meridianRingGeo);
    const meridianRing = new THREE.Mesh(meridianRingGeo, ringMat);
    globeGroup.add(meridianRing);

    const tickCount = 72;
    const tickGeo = new THREE.BoxGeometry(0.008, 0.008, 0.045);
    geometriesToDispose.push(tickGeo);
    const tickMat = new THREE.MeshStandardMaterial({
      color: 0x476682,
      roughness: 0.82,
      metalness: 0.08,
      envMapIntensity: 0.22,
    });
    materialsToDispose.push(tickMat);
    const tickInstanced = new THREE.InstancedMesh(tickGeo, tickMat, tickCount);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < tickCount; i++) {
      const angle = (i / tickCount) * Math.PI * 2;
      const isMajor = i % 6 === 0;
      const rad = GLOBE_RADIUS + 0.16;
      dummy.position.set(Math.cos(angle) * rad, 0, Math.sin(angle) * rad);
      dummy.rotation.set(0, -angle + Math.PI / 2, 0);
      dummy.scale.set(isMajor ? 1.5 : 1, isMajor ? 1.5 : 1, isMajor ? 1.65 : 0.85);
      dummy.updateMatrix();
      tickInstanced.setMatrixAt(i, dummy.matrix);
    }
    tickInstanced.instanceMatrix.needsUpdate = true;
    tickInstanced.computeBoundingSphere();
    globeGroup.add(tickInstanced);

    // =========================================================================
    // 6. COMPOSITE 5-PART PROCEDURAL 3D BEACON PINS (8 HISTORICAL STEPS)
    // =========================================================================
    const collarGeo = new THREE.TorusGeometry(0.052, 0.011, 10, 24);
    collarGeo.rotateX(Math.PI / 2);
    geometriesToDispose.push(collarGeo);

    const lathePoints = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.036, 0.0),
      new THREE.Vector2(0.024, 0.02),
      new THREE.Vector2(0.012, 0.065),
      new THREE.Vector2(0.018, 0.125),
      new THREE.Vector2(0.008, 0.14),
    ];
    const stemGeo = new THREE.LatheGeometry(lathePoints, 16);
    geometriesToDispose.push(stemGeo);

    const crystalGeo = new THREE.OctahedronGeometry(0.048, 0);
    geometriesToDispose.push(crystalGeo);

    const haloGeo = new THREE.TorusGeometry(0.088, 0.006, 8, 28);
    haloGeo.rotateX(Math.PI / 2);
    geometriesToDispose.push(haloGeo);

    const hitProxyGeo = new THREE.SphereGeometry(0.15, 10, 10);
    geometriesToDispose.push(hitProxyGeo);

    const stemMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.78,
      metalness: 0.1,
      envMapIntensity: 0.24,
    });
    const hitProxyMat = new THREE.MeshBasicMaterial({ visible: false });
    materialsToDispose.push(stemMat, hitProxyMat);

    const pinAssemblies: PinAssembly[] = [];
    const clickableProxies: THREE.Object3D[] = [];

    MPOX_STEPS.forEach((step, idx) => {
      const surfacePos = latLngToVec3(step.lat, step.lng, GLOBE_RADIUS);
      const normal = surfacePos.clone().normalize();

      const pinGroup = new THREE.Group();
      pinGroup.position.copy(surfacePos);
      pinGroup.quaternion.setFromUnitVectors(_upVec, normal);

      const baseHex = step.pinTone === 'coral' ? 0xc81e3a : 0xd97706;
      const baseColor = new THREE.Color(baseHex);

      const collarMat = new THREE.MeshStandardMaterial({
        color: baseHex,
        roughness: 0.82,
        metalness: 0.06,
        envMapIntensity: 0.22,
      });
      materialsToDispose.push(collarMat);
      const collar = new THREE.Mesh(collarGeo, collarMat);
      collar.position.y = 0.006;
      pinGroup.add(collar);

      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.castShadow = !isSoftwareGl;
      pinGroup.add(stem);

      const crystalMat = new THREE.MeshStandardMaterial({
        color: baseHex,
        roughness: 0.74,
        metalness: 0.06,
        envMapIntensity: 0.26,
      });
      materialsToDispose.push(crystalMat);
      const crystal = new THREE.Mesh(crystalGeo, crystalMat);
      crystal.position.y = 0.175;
      crystal.castShadow = !isSoftwareGl;
      pinGroup.add(crystal);

      const haloMat = new THREE.MeshStandardMaterial({
        color: baseHex,
        roughness: 0.84,
        metalness: 0.04,
        envMapIntensity: 0.2,
        transparent: true,
        opacity: 0.78,
      });
      materialsToDispose.push(haloMat);
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.position.y = 0.035;
      pinGroup.add(halo);

      const hitProxy = new THREE.Mesh(hitProxyGeo, hitProxyMat);
      hitProxy.position.y = 0.12;
      hitProxy.layers.set(1);
      hitProxy.userData.stepIndex = idx;
      pinGroup.add(hitProxy);
      clickableProxies.push(hitProxy);

      globeGroup.add(pinGroup);
      pinAssemblies.push({
        stepIndex: idx,
        group: pinGroup,
        crystal,
        crystalMat,
        baseColor,
        halo,
        haloMat,
        collarMat,
        hitProxy,
        surfacePos,
        normal,
      });
    });

    // =========================================================================
    // 7. TECHNICAL GREAT-CIRCLE PROPAGATION ARCS (MATTE PBR, ZERO EMISSIVE)
    // =========================================================================
    const arcAssemblies: ArcAssembly[] = [];
    const pulseBeadGeo = new THREE.SphereGeometry(0.028, 12, 12);
    geometriesToDispose.push(pulseBeadGeo);

    for (let i = 0; i < MPOX_STEPS.length - 1; i++) {
      const pStart = pinAssemblies[i].surfacePos.clone();
      const pEnd = pinAssemblies[i + 1].surfacePos.clone();
      const angle = pStart.clone().normalize().angleTo(pEnd.clone().normalize());
      const maxLift = Math.min(0.84, Math.max(0.2, angle * 0.44));

      const curvePoints: THREE.Vector3[] = [];
      const segments = 32;
      for (let s = 0; s <= segments; s++) {
        const t = s / segments;
        const pt = new THREE.Vector3().lerpVectors(pStart, pEnd, t).normalize();
        const elev = GLOBE_RADIUS + Math.sin(t * Math.PI) * maxLift + 0.025;
        pt.multiplyScalar(elev);
        curvePoints.push(pt);
      }

      const curve = new THREE.CatmullRomCurve3(curvePoints);
      const tubeGeo = new THREE.TubeGeometry(curve, 52, 0.0115, 7, false);
      geometriesToDispose.push(tubeGeo);

      const totalIndices = tubeGeo.index ? tubeGeo.index.count : tubeGeo.attributes.position.count;
      const isClade1b = i >= 5;
      const arcColor = isClade1b ? 0xc81e3a : 0xd97706;

      const mat = new THREE.MeshStandardMaterial({
        color: arcColor,
        roughness: 0.78,
        metalness: 0.04,
        envMapIntensity: 0.24,
        transparent: true,
        opacity: 0.85,
      });
      materialsToDispose.push(mat);

      const arcMesh = new THREE.Mesh(tubeGeo, mat);
      globeGroup.add(arcMesh);

      const pulseMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.72,
        metalness: 0.04,
        envMapIntensity: 0.26,
      });
      materialsToDispose.push(pulseMat);
      const pulseBead = new THREE.Mesh(pulseBeadGeo, pulseMat);
      globeGroup.add(pulseBead);

      arcAssemblies.push({
        fromIndex: i,
        toIndex: i + 1,
        curve,
        mesh: arcMesh,
        mat,
        pulseBead,
        pulseMat,
        totalIndices,
      });
    }

    // =========================================================================
    // 8. 3D PROPORTIONAL EPIDEMIOLOGICAL COLUMNS FOR BRAZIL (MATTE PBR)
    // =========================================================================
    const brazilGroup = new THREE.Group();
    const colBaseGeo = new THREE.TorusGeometry(0.036, 0.006, 8, 20);
    colBaseGeo.rotateX(Math.PI / 2);

    // Unit-height hexagonal column with bottom pivot at y = 0
    const colShaftGeo = new THREE.CylinderGeometry(0.021, 0.027, 1.0, 6);
    colShaftGeo.translate(0, 0.5, 0);

    const colCapGeo = new THREE.CylinderGeometry(0.024, 0.021, 0.02, 6);
    geometriesToDispose.push(colBaseGeo, colShaftGeo, colCapGeo);

    const colBaseMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.8,
      metalness: 0.08,
      envMapIntensity: 0.22,
    });
    const miniArcMat = new THREE.MeshStandardMaterial({
      color: 0xc81e3a,
      roughness: 0.82,
      metalness: 0.04,
      envMapIntensity: 0.22,
      transparent: true,
      opacity: 0.62,
    });
    materialsToDispose.push(colBaseMat, miniArcMat);

    const brazilColumns: BrazilColumnAssembly[] = [];
    const spPos = latLngToVec3(-23.5505, -46.6333, GLOBE_RADIUS);

    BRAZIL_SURVEILLANCE_NODES.forEach((node, idx) => {
      const pos = latLngToVec3(node.lat, node.lng, GLOBE_RADIUS);
      const norm = pos.clone().normalize();
      const colHolder = new THREE.Group();
      colHolder.position.copy(pos);
      colHolder.quaternion.setFromUnitVectors(_upVec, norm);

      const colHex =
        idx === 0 ? 0xc81e3a : idx <= 2 ? 0xd97706 : 0x0052a3;

      const baseRing = new THREE.Mesh(colBaseGeo, colBaseMat);
      baseRing.position.y = 0.006;
      colHolder.add(baseRing);

      const shaftMat = new THREE.MeshStandardMaterial({
        color: colHex,
        roughness: 0.78,
        metalness: 0.06,
        envMapIntensity: 0.24,
        transparent: true,
        opacity: 0.94,
      });
      const capMat = new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.74,
        metalness: 0.04,
        envMapIntensity: 0.24,
      });
      materialsToDispose.push(shaftMat, capMat);

      const shaft = new THREE.Mesh(colShaftGeo, shaftMat);
      shaft.scale.y = 0.001;
      shaft.castShadow = !isSoftwareGl;
      colHolder.add(shaft);

      const cap = new THREE.Mesh(colCapGeo, capMat);
      cap.position.y = 0.01;
      colHolder.add(cap);

      brazilGroup.add(colHolder);

      const targetHeight = 0.1 + (node.sharePercent / 41.2) * 0.44;
      brazilColumns.push({
        uf: node.uf,
        surfacePos: pos,
        normal: norm,
        shaft,
        cap,
        targetHeight,
        currentHeight: 0.001,
      });

      if (node.uf !== 'SP') {
        const pts: THREE.Vector3[] = [];
        for (let s = 0; s <= 16; s++) {
          const t = s / 16;
          const pt = new THREE.Vector3().lerpVectors(spPos, pos, t).normalize();
          pt.multiplyScalar(GLOBE_RADIUS + Math.sin(t * Math.PI) * 0.15 + 0.015);
          pts.push(pt);
        }
        const subCurve = new THREE.CatmullRomCurve3(pts);
        const subTube = new THREE.TubeGeometry(subCurve, 20, 0.005, 6, false);
        geometriesToDispose.push(subTube);
        brazilGroup.add(new THREE.Mesh(subTube, miniArcMat));
      }
    });
    brazilGroup.visible = activeStepRef.current === 7 || showBrazilColumnsRef.current;
    globeGroup.add(brazilGroup);

    // =========================================================================
    // CAMERA FLIGHT CHOREOGRAPHY + SYNCHRONIZED ARC DRAW PROGRESS
    // =========================================================================
    const BASE_FOV = 42;
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let isCameraGliding = false;
    let flightElapsed = 0;
    let flightDuration = 1.2;
    let flightAngle = 0;
    let flightStartDist = MPOX_STEPS[0].cameraDistance ?? 5.4;
    let flightEndDist = MPOX_STEPS[0].cameraDistance ?? 5.4;
    let flightZoomLift = 0;
    let revealingArcIndex = -1;
    let arcDrawProgress = 1;
    const flightStartDir = initialDir.clone();
    const flightEndDir = initialDir.clone();
    const flightAxis = new THREE.Vector3(0, 1, 0);

    const focusCameraOnStep = (idx: number, isInitial = false) => {
      const step = MPOX_STEPS[idx];
      if (!step) return;

      const isDesktop = (container.clientWidth || window.innerWidth) >= 1024;
      const lngOffset = isDesktop && panelOpenRef.current ? 13 : 0;

      latLngToVec3(step.lat, step.lng + lngOffset, 1, flightEndDir).normalize();
      flightEndDist = step.cameraDistance ?? 5.1;

      // Trigger progressive arc drawing for incoming historical connection
      if (!isInitial && idx > 0 && !prefersReducedMotion) {
        revealingArcIndex = idx - 1;
        arcDrawProgress = 0;
      } else {
        revealingArcIndex = -1;
        arcDrawProgress = 1;
      }

      if (isInitial) {
        flightStartDir.copy(flightEndDir);
        flightStartDist = prefersReducedMotion ? flightEndDist : flightEndDist + 0.65;
        flightAngle = 0;
        flightAxis.set(0, 1, 0);
        flightDuration = prefersReducedMotion ? 0.05 : 0.9;
        flightZoomLift = 0;
        flightElapsed = 0;
        camera.position.copy(flightStartDir).multiplyScalar(flightStartDist);
        camera.lookAt(0, 0, 0);
        isCameraGliding = true;
        return;
      }

      flightStartDist = camera.position.length();
      flightStartDir.copy(camera.position).normalize();
      flightAngle = flightStartDir.angleTo(flightEndDir);

      flightAxis.crossVectors(flightStartDir, flightEndDir);
      if (flightAxis.lengthSq() < 1e-6) {
        if (flightAngle > Math.PI - 0.05) {
          _fallbackAxis.set(
            Math.abs(flightStartDir.y) > 0.9 ? 1 : 0,
            Math.abs(flightStartDir.y) > 0.9 ? 0 : 1,
            0
          );
          flightAxis.crossVectors(flightStartDir, _fallbackAxis).normalize();
        } else {
          flightAngle = 0;
          flightAxis.set(0, 1, 0);
        }
      } else {
        flightAxis.normalize();
      }

      if (prefersReducedMotion) {
        flightDuration = 0.22;
        flightZoomLift = 0;
      } else {
        flightDuration = THREE.MathUtils.clamp(0.95 + (flightAngle / Math.PI) * 0.9, 0.95, 1.85);
        flightZoomLift = 0.52 + Math.min(1.25, (flightAngle / Math.PI) * 1.45);
      }

      flightElapsed = 0;
      isCameraGliding = true;
    };
    triggerCameraFocusRef.current = (idx: number) => focusCameraOnStep(idx, false);

    const handleControlStart = () => {
      if (isCameraGliding) {
        isCameraGliding = false;
        if (Math.abs(camera.fov - BASE_FOV) > 0.01) {
          camera.fov = BASE_FOV;
          camera.updateProjectionMatrix();
        }
      }
    };
    controls.addEventListener('start', handleControlStart);

    // =========================================================================
    // RAYCASTING (LAYER 1 PROXIES, THROTTLED HOVER + CLICK/TAP)
    // =========================================================================
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const pointerNdc = new THREE.Vector2();
    let hoveredIndex = -1;
    let lastHoverCheck = 0;
    let pointerDownPos = { x: 0, y: 0 };

    const updateNdc = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    };

    const projectPinToDom = (stepIdx: number) => {
      const pin = pinAssemblies[stepIdx];
      if (!pin) return null;
      _vProj.copy(pin.surfacePos).normalize().multiplyScalar(GLOBE_RADIUS + 0.3);
      _vProj.project(camera);
      const rect = renderer.domElement.getBoundingClientRect();
      return {
        x: ((_vProj.x + 1) / 2) * rect.width,
        y: (-(_vProj.y - 1) / 2) * rect.height,
      };
    };

    const handlePointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const handlePointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverCheck < 40) return;
      lastHoverCheck = now;

      updateNdc(e.clientX, e.clientY);
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(clickableProxies, false);

      if (hits.length > 0) {
        const idx = hits[0].object.userData.stepIndex as number;
        if (idx !== hoveredIndex) {
          hoveredIndex = idx;
          renderer.domElement.style.cursor = 'pointer';
        }
        if (!showLabelsRef.current) {
          const pos = projectPinToDom(idx);
          if (pos) setHoveredPin({ step: MPOX_STEPS[idx], x: pos.x, y: pos.y });
        } else {
          setHoveredPin(null);
        }
      } else if (hoveredIndex !== -1) {
        hoveredIndex = -1;
        renderer.domElement.style.cursor = 'grab';
        setHoveredPin(null);
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      const dx = e.clientX - pointerDownPos.x;
      const dy = e.clientY - pointerDownPos.y;
      if (Math.hypot(dx, dy) > 8) return;

      updateNdc(e.clientX, e.clientY);
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(clickableProxies, false);
      if (hits.length > 0) {
        const idx = hits[0].object.userData.stepIndex as number;
        onSelectStepRef.current(idx);
      }
    };

    const handlePointerLeave = () => {
      hoveredIndex = -1;
      setHoveredPin(null);
      renderer.domElement.style.cursor = 'grab';
    };

    renderer.domElement.style.cursor = 'grab';
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);
    renderer.domElement.addEventListener('pointerleave', handlePointerLeave);

    const handleContextLost = (event: Event) => {
      event.preventDefault();
      setWebglError('O contexto WebGL foi interrompido temporariamente.');
    };
    const handleContextRestored = () => {
      setWebglError(null);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    let viewportW = width;
    let viewportH = height;
    const resizeObserver = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w <= 0 || h <= 0) return;
      viewportW = w;
      viewportH = h;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    // =========================================================================
    // ANIMATION LOOP (PACED WITH afterDraw ON SOFTWARE WEBGL)
    // =========================================================================
    let frameId = 0;
    let disposed = false;
    let lastTime = performance.now();
    let elapsed = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed) {
            if (sync) gl.deleteSync(sync);
            return;
          }
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    }

    const tick = () => {
      if (disposed) return;

      const now = performance.now();
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      elapsed += dt;

      const curActive = activeStepRef.current;

      // 1. Camera spherical flight with cubic easing + zoom-out/in arc
      if (isCameraGliding) {
        flightElapsed += dt;
        const u = Math.min(1, flightElapsed / Math.max(0.01, flightDuration));
        const eased = easeInOutCubic(u);

        if (flightAngle > 0.0001) {
          _qRot.setFromAxisAngle(flightAxis, flightAngle * eased);
          _vDir.copy(flightStartDir).applyQuaternion(_qRot).normalize();
        } else {
          _vDir.copy(flightEndDir);
        }

        const arcLift = Math.pow(Math.sin(u * Math.PI), 1.35);
        const baseDist = THREE.MathUtils.lerp(flightStartDist, flightEndDist, eased);
        const currentDist = Math.min(controls.maxDistance, baseDist + flightZoomLift * arcLift);

        camera.position.copy(_vDir).multiplyScalar(currentDist);
        camera.lookAt(0, 0, 0);

        const nextFov = BASE_FOV + (flightZoomLift > 0 ? 1.8 * arcLift : 0);
        if (Math.abs(camera.fov - nextFov) > 0.005) {
          camera.fov = nextFov;
          camera.updateProjectionMatrix();
        }

        if (u >= 1) {
          isCameraGliding = false;
          camera.position.copy(flightEndDir).multiplyScalar(flightEndDist);
          camera.lookAt(0, 0, 0);
          if (camera.fov !== BASE_FOV) {
            camera.fov = BASE_FOV;
            camera.updateProjectionMatrix();
          }
          controls.update();
        }
      } else {
        controls.update();
      }

      // Advance progressive arc reveal independently so it finishes even if user interrupts camera
      if (revealingArcIndex !== -1 && arcDrawProgress < 1) {
        arcDrawProgress = Math.min(1, arcDrawProgress + dt / Math.max(0.55, flightDuration * 0.92));
      }

      // 2. Sync surface texture theme (realistic vs scientific) without tearing down WebGL
      if (surfaceThemeRef.current !== appliedTheme) {
        appliedTheme = surfaceThemeRef.current;
        earthMat.map =
          appliedTheme === 'realistic'
            ? earthTextures.realisticColorMap
            : earthTextures.scientificColorMap;
        earthMat.needsUpdate = true;
      }

      // Animated translucent 3D clouds + synchronized parallax ground shadow
      const cloudsOn = showCloudsRef.current;
      cloudsMesh.visible = cloudsOn;
      cloudShadowMesh.visible = cloudsOn;
      if (cloudsOn && !prefersReducedMotion) {
        const drift = dt * 0.022;
        cloudsMesh.rotation.y += drift;
        cloudShadowMesh.rotation.y = cloudsMesh.rotation.y - 0.014;
      }

      // 3. Animate 8 beacon pins + update occluded 3D DOM labels
      const labelsVisible = showLabelsRef.current;
      for (let i = 0; i < pinAssemblies.length; i++) {
        const pin = pinAssemblies[i];
        const isActive = i === curActive;
        const isHovered = i === hoveredIndex;
        const isVisited = i <= curActive;

        const targetScale = isActive ? 1.42 : isHovered ? 1.22 : 0.92;
        const nextScale = THREE.MathUtils.damp(pin.group.scale.x, targetScale, 8, dt);
        pin.group.scale.setScalar(nextScale);

        pin.crystal.rotation.y = elapsed * (isActive ? 1.5 : 0.55) + i;
        pin.crystalMat.color.copy(pin.baseColor);
        if (isActive) {
          pin.crystalMat.color.lerp(_pinHighlightTint, 0.22);
        } else if (isHovered) {
          pin.crystalMat.color.lerp(_pinHighlightTint, 0.12);
        } else if (!isVisited) {
          pin.crystalMat.color.multiplyScalar(0.84);
        }

        pin.halo.visible = isActive || isHovered;
        if (pin.halo.visible) {
          const ringBreath = 1.0 + Math.sin(elapsed * 2.2) * 0.12;
          pin.halo.scale.setScalar(isActive ? ringBreath * 1.15 : 1.0);
          pin.haloMat.opacity = isActive ? 0.84 : 0.52;
        }

        // Update 3D projected DOM label imperatively (zero React re-render overhead)
        const labelEl = stepLabelRefs.current[i];
        if (labelEl) {
          if (!labelsVisible) {
            labelEl.style.opacity = '0';
            labelEl.style.pointerEvents = 'none';
          } else {
            _vNorm.copy(pin.normal);
            _vToCam.subVectors(camera.position, pin.surfacePos).normalize();
            const facing = _vNorm.dot(_vToCam);

            if (facing > 0.14) {
              _vProj.copy(pin.normal).multiplyScalar(GLOBE_RADIUS + (isActive ? 0.34 : 0.24));
              _vProj.project(camera);
              const inBounds =
                _vProj.z < 1 &&
                _vProj.x >= -1.04 &&
                _vProj.x <= 1.04 &&
                _vProj.y >= -1.04 &&
                _vProj.y <= 1.04;

              if (inBounds) {
                const sx = ((_vProj.x + 1) / 2) * viewportW;
                const sy = (-(_vProj.y - 1) / 2) * viewportH;
                const limbFade = Math.min(1, (facing - 0.14) / 0.24);
                labelEl.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -100%)`;
                labelEl.style.opacity = String((isActive ? 1 : 0.86) * limbFade);
                labelEl.style.pointerEvents = 'auto';
                labelEl.style.zIndex = isActive ? '18' : '14';
              } else {
                labelEl.style.opacity = '0';
                labelEl.style.pointerEvents = 'none';
              }
            } else {
              labelEl.style.opacity = '0';
              labelEl.style.pointerEvents = 'none';
            }
          }
        }
      }

      // 4. Animate propagation arcs with progressive drawRange & photon beads
      for (let i = 0; i < arcAssemblies.length; i++) {
        const arc = arcAssemblies[i];
        const isCurrentIncoming = arc.toIndex === curActive;
        const isCompleted = arc.toIndex <= curActive;
        const isRevealing = i === revealingArcIndex && arcDrawProgress < 1;

        arc.mat.opacity = isCurrentIncoming ? 0.96 : isCompleted ? 0.62 : 0.18;

        if (isRevealing) {
          const easedDraw = easeInOutCubic(arcDrawProgress);
          const count = Math.floor((arc.totalIndices * easedDraw) / 3) * 3;
          arc.mesh.geometry.setDrawRange(0, Math.max(0, count));
          arc.pulseBead.visible = easedDraw > 0.02;
          if (arc.pulseBead.visible) {
            arc.curve.getPointAt(Math.min(0.999, easedDraw), _vA);
            arc.pulseBead.position.copy(_vA);
            arc.pulseBead.scale.setScalar(1.38);
          }
        } else {
          arc.mesh.geometry.setDrawRange(0, arc.totalIndices);
          arc.pulseBead.visible = isCompleted;
          if (arc.pulseBead.visible) {
            const speed = isCurrentIncoming ? 0.42 : 0.22;
            const t = (elapsed * speed + i * 0.19) % 1;
            arc.curve.getPointAt(t, _vA);
            arc.pulseBead.position.copy(_vA);
            arc.pulseBead.scale.setScalar(isCurrentIncoming ? 1.2 : 0.72);
          }
        }
      }

      // 5. Animate 3D Proportional Brazil Surveillance Columns + UF Labels
      const brazilActive = curActive === 7 || showBrazilColumnsRef.current;
      const liveShareMap = brazilShareByUfRef.current;
      const maxLiveShare = Math.max(
        1,
        ...BRAZIL_SURVEILLANCE_NODES.map((n) => liveShareMap[n.uf] ?? n.sharePercent)
      );
      let anyColumnVisible = false;
      for (let i = 0; i < brazilColumns.length; i++) {
        const col = brazilColumns[i];
        const shareVal = liveShareMap[col.uf] ?? 0;
        const dynamicTarget = shareVal > 0 ? 0.1 + (shareVal / maxLiveShare) * 0.44 : 0.05;
        const goal = brazilActive ? dynamicTarget : 0.001;
        col.currentHeight = THREE.MathUtils.damp(col.currentHeight, goal, 6.5, dt);
        col.shaft.scale.y = Math.max(0.001, col.currentHeight);
        col.cap.position.y = col.currentHeight + 0.01;
        if (col.currentHeight > 0.012) anyColumnVisible = true;

        const ufEl = ufLabelRefs.current[i];
        if (ufEl) {
          if (!brazilActive || !labelsVisible || col.currentHeight < 0.05) {
            ufEl.style.opacity = '0';
          } else {
            _vNorm.copy(col.normal);
            _vToCam.subVectors(camera.position, col.surfacePos).normalize();
            const facing = _vNorm.dot(_vToCam);
            if (facing > 0.2) {
              _vProj
                .copy(col.normal)
                .multiplyScalar(GLOBE_RADIUS + col.currentHeight + 0.09);
              _vProj.project(camera);
              const sx = ((_vProj.x + 1) / 2) * viewportW;
              const sy = (-(_vProj.y - 1) / 2) * viewportH;
              const fade = Math.min(1, (facing - 0.2) / 0.25);
              ufEl.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -100%)`;
              ufEl.style.opacity = String(fade);
            } else {
              ufEl.style.opacity = '0';
            }
          }
        }
      }
      brazilGroup.visible = anyColumnVisible;

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    focusCameraOnStep(activeStepRef.current, true);
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      controls.removeEventListener('start', handleControlStart);
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('pointerleave', handlePointerLeave);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);

      earthTextures.dispose();
      envRT.dispose();
      geometriesToDispose.forEach((g) => g.dispose());
      materialsToDispose.forEach((m) => m.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#E9F1F7]">
      <div ref={mountRef} className="h-full w-full" aria-label="Globo 3D interativo da história da Mpox" />

      {/* 3D Projected Floating Marker Labels with Automatic Occlusion */}
      {!webglError && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden={!showLabels}>
          {MPOX_STEPS.map((step, idx) => {
            const isActive = idx === activeStepIndex;
            const isCoral = step.pinTone === 'coral';
            return (
              <button
                key={step.id}
                ref={(el) => {
                  stepLabelRefs.current[idx] = el;
                }}
                type="button"
                onClick={() => onSelectStep(idx)}
                style={{ opacity: 0, pointerEvents: 'none', left: 0, top: 0 }}
                className={`absolute whitespace-nowrap rounded-md border px-2 py-1 text-left transition-colors ${
                  isActive
                    ? isCoral
                      ? 'border-[#C81E3A] bg-white/98 text-[#0F172A] shadow-lg'
                      : 'border-[#0052A3] bg-white/98 text-[#0F172A] shadow-lg'
                    : 'border-[#CBD5E1] bg-white/92 text-[#334155] shadow-sm hover:border-[#0052A3] hover:text-[#0F172A]'
                }`}
              >
                <span
                  className={`font-mono text-[10px] font-bold tabular-nums ${
                    isCoral ? 'text-[#C81E3A]' : 'text-[#0052A3]'
                  }`}
                >
                  {step.id}
                </span>
                <span className="mx-1 text-[#94A3B8]" aria-hidden="true">
                  ·
                </span>
                <span className="font-mono text-[10px] font-semibold tabular-nums">{step.shortYear}</span>
                {isActive && (
                  <>
                    <span className="mx-1 text-[#94A3B8]" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-[11px] font-bold text-[#0F172A]">
                      {step.location.split(',')[0].split('/')[0].trim()}
                    </span>
                  </>
                )}
              </button>
            );
          })}

          {/* Brazilian UF Column Labels (visible when Brazil 3D columns are elevated) */}
          {BRAZIL_SURVEILLANCE_NODES.map((node, idx) => {
            const liveShare = nextShareMap[node.uf] ?? node.sharePercent;
            return (
              <div
                key={node.uf}
                ref={(el) => {
                  ufLabelRefs.current[idx] = el;
                }}
                style={{ opacity: 0, left: 0, top: 0 }}
                className="pointer-events-none absolute z-[16] whitespace-nowrap rounded border border-[#CBD5E1] bg-white/96 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#0F172A] shadow-sm tabular-nums"
              >
                {node.uf}{' '}
                <span className="text-[#C81E3A]">{liveShare.toFixed(0)}%</span>
              </div>
            );
          })}
        </div>
      )}

      {webglError && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#E9F1F7] p-6">
          <div className="max-w-md rounded-xl border border-[#CBD5E1] bg-white p-6 text-center shadow-lg">
            <h3 className="text-lg font-bold text-[#0F172A]">Visualização 3D indisponível</h3>
            <p className="mt-2 text-sm text-[#334155]">{webglError}</p>
            <p className="mt-3 text-xs text-[#475569]">
              Você ainda pode navegar pelos 8 passos históricos abaixo usando os botões Anterior e Próximo.
            </p>
          </div>
        </div>
      )}

      {hoveredPin && !showLabels && !webglError && (
        <div
          className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-lg border border-[#CBD5E1] bg-white/96 px-3 py-2 shadow-lg"
          style={{
            left: `${hoveredPin.x}px`,
            top: `${Math.max(56, hoveredPin.y - 12)}px`,
          }}
        >
          <div className="flex items-center gap-2 font-mono text-[11px] font-bold text-[#0052A3] tabular-nums">
            <span>Passo {hoveredPin.step.id}</span>
            <span aria-hidden="true">·</span>
            <span>{hoveredPin.step.shortYear}</span>
          </div>
          <div className="mt-0.5 text-xs font-bold text-[#0F172A] whitespace-nowrap">
            {hoveredPin.step.location}
          </div>
        </div>
      )}
    </div>
  );
};
