import * as THREE from 'three';
import { MOUNTAIN_RIDGES, WORLD_LANDMASSES } from '../data/worldGeo';

export interface EarthTextureSet {
  realisticColorMap: THREE.CanvasTexture;
  scientificColorMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  cloudMap: THREE.CanvasTexture;
  cloudShadowMap: THREE.CanvasTexture;
  dispose: () => void;
}

function projectToCanvas(lng: number, lat: number, width: number, height: number): [number, number] {
  const x = ((lng + 180) / 360) * width;
  const y = ((90 - lat) / 180) * height;
  return [x, y];
}

function drawPolygonPath(
  ctx: CanvasRenderingContext2D,
  coords: [number, number][],
  width: number,
  height: number
) {
  ctx.beginPath();
  coords.forEach(([lng, lat], idx) => {
    const [x, y] = projectToCanvas(lng, lat, width, height);
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
}

// Deterministic tileable 2D value noise (seamless horizontally across ±180° longitude)
function hash2D(ix: number, iy: number, periodX: number): number {
  const wx = ((ix % periodX) + periodX) % periodX;
  const n = Math.sin(wx * 127.1 + iy * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function smoothNoiseTileable(x: number, y: number, periodX: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);

  const a = hash2D(ix, iy, periodX);
  const b = hash2D(ix + 1, iy, periodX);
  const c = hash2D(ix, iy + 1, periodX);
  const d = hash2D(ix + 1, iy + 1, periodX);

  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbmTileable(u: number, v: number, baseFreqX: number, baseFreqY: number, octaves: number): number {
  let value = 0;
  let amp = 0.52;
  let fx = baseFreqX;
  let fy = baseFreqY;
  for (let o = 0; o < octaves; o++) {
    value += amp * smoothNoiseTileable(u * fx, v * fy, fx);
    fx *= 2;
    fy *= 2;
    amp *= 0.48;
  }
  return value;
}

/**
 * Generates domain-warped satellite-style cloud formations and a matching soft shadow map.
 */
function createProceduralCloudMaps(maxAnisotropy: number): {
  cloudMap: THREE.CanvasTexture;
  cloudShadowMap: THREE.CanvasTexture;
} {
  const nw = 512;
  const nh = 256;

  const cloudSmall = document.createElement('canvas');
  cloudSmall.width = nw;
  cloudSmall.height = nh;
  const cCtx = cloudSmall.getContext('2d')!;
  const cImg = cCtx.createImageData(nw, nh);

  const shadowSmall = document.createElement('canvas');
  shadowSmall.width = nw;
  shadowSmall.height = nh;
  const sCtx = shadowSmall.getContext('2d')!;
  const sImg = sCtx.createImageData(nw, nh);

  for (let y = 0; y < nh; y++) {
    const v = y / nh;
    const latRad = (v - 0.5) * Math.PI;
    // Richer weather bands along ITCZ (equator) and mid-latitude storm tracks (~45 deg)
    const poleFade = Math.max(0.18, Math.cos(latRad * 0.94));
    const itczBoost = 0.14 * Math.exp(-Math.pow(latRad / 0.24, 2));
    const midLatBoost = 0.12 * Math.exp(-Math.pow((Math.abs(latRad) - 0.78) / 0.3, 2));
    const bandMult = 0.84 + itczBoost + midLatBoost;

    for (let x = 0; x < nw; x++) {
      const u = x / nw;
      // Domain warping for authentic swirling synoptic weather fronts
      const warpU = (fbmTileable(u, v, 6, 3, 2) - 0.5) * 0.11;
      const warpV = (fbmTileable(u + 0.37, v + 0.19, 6, 3, 2) - 0.5) * 0.08;
      const jetShear = Math.sin(v * Math.PI * 3.5) * 0.05;

      const n = fbmTileable(u + warpU + jetShear, Math.max(0, Math.min(1, v + warpV)), 8, 4, 4) * bandMult;
      const wisp = Math.max(0, Math.min(1, (n - 0.5) / 0.36)) * poleFade;
      const alpha = Math.round(Math.pow(wisp, 1.32) * 238);
      const shadowAlpha = Math.round(Math.pow(wisp, 1.5) * 115);

      // Slight self-shading on denser cloud cores
      const shade = Math.round(238 + 17 * Math.min(1, wisp * 1.3));
      const idx = (y * nw + x) * 4;

      cImg.data[idx] = shade;
      cImg.data[idx + 1] = Math.min(255, shade + 2);
      cImg.data[idx + 2] = 255;
      cImg.data[idx + 3] = alpha;

      sImg.data[idx] = 6;
      sImg.data[idx + 1] = 20;
      sImg.data[idx + 2] = 36;
      sImg.data[idx + 3] = shadowAlpha;
    }
  }

  cCtx.putImageData(cImg, 0, 0);
  sCtx.putImageData(sImg, 0, 0);

  // Upscale smoothly to 1024x512 for crisp grazing angles
  const outW = 1024;
  const outH = 512;

  const cloudCanvas = document.createElement('canvas');
  cloudCanvas.width = outW;
  cloudCanvas.height = outH;
  const outCCtx = cloudCanvas.getContext('2d')!;
  outCCtx.imageSmoothingEnabled = true;
  outCCtx.imageSmoothingQuality = 'high';
  outCCtx.drawImage(cloudSmall, 0, 0, outW, outH);

  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = outW;
  shadowCanvas.height = outH;
  const outSCtx = shadowCanvas.getContext('2d')!;
  outSCtx.imageSmoothingEnabled = true;
  outSCtx.imageSmoothingQuality = 'high';
  outSCtx.drawImage(shadowSmall, 0, 0, outW, outH);

  const cloudMap = new THREE.CanvasTexture(cloudCanvas);
  cloudMap.colorSpace = THREE.SRGBColorSpace;
  cloudMap.anisotropy = Math.min(8, maxAnisotropy);
  cloudMap.wrapS = THREE.RepeatWrapping;
  cloudMap.wrapT = THREE.ClampToEdgeWrapping;

  const cloudShadowMap = new THREE.CanvasTexture(shadowCanvas);
  cloudShadowMap.colorSpace = THREE.SRGBColorSpace;
  cloudShadowMap.anisotropy = Math.min(4, maxAnisotropy);
  cloudShadowMap.wrapS = THREE.RepeatWrapping;
  cloudShadowMap.wrapT = THREE.ClampToEdgeWrapping;

  return { cloudMap, cloudShadowMap };
}

/**
 * Generates an organic terrain grain overlay (subtle light/shadow relief mottling) for realistic continents.
 */
function createTerrainGrainCanvas(): HTMLCanvasElement {
  const gw = 512;
  const gh = 256;
  const canvas = document.createElement('canvas');
  canvas.width = gw;
  canvas.height = gh;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(gw, gh);

  for (let y = 0; y < gh; y++) {
    const v = y / gh;
    for (let x = 0; x < gw; x++) {
      const u = x / gw;
      const n = fbmTileable(u, v, 16, 8, 4);
      const val = Math.round(Math.max(0, Math.min(255, n * 255)));
      const idx = (y * gw + x) * 4;
      img.data[idx] = val;
      img.data[idx + 1] = val;
      img.data[idx + 2] = val;
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// Natural geographic biome patches [lng, lat, radiusLngDeg, radiusLatDeg, rgbaCenter, rgbaMid]
const BIOME_PATCHES: [number, number, number, number, string, string][] = [
  // Amazon rainforest (Brazil / Northern South America)
  [-61, -4, 21, 14, 'rgba(18, 102, 48, 0.94)', 'rgba(34, 126, 62, 0.56)'],
  // Atlantic Forest coastal Brazil
  [-44, -20, 10, 10, 'rgba(26, 114, 56, 0.78)', 'rgba(54, 128, 66, 0.35)'],
  // Brazilian Cerrado & Northeast Caatinga warmth
  [-44, -11, 13, 10, 'rgba(134, 146, 70, 0.7)', 'rgba(88, 132, 66, 0.28)'],
  // Congo Basin equatorial rainforest (Central Africa / DRC)
  [22, -1, 16, 12, 'rgba(18, 100, 48, 0.94)', 'rgba(38, 122, 58, 0.5)'],
  // Sahara Desert (North Africa)
  [12, 23, 31, 12, 'rgba(216, 180, 118, 0.97)', 'rgba(192, 154, 96, 0.62)'],
  // Arabian Peninsula Desert
  [46, 23, 14, 10, 'rgba(218, 182, 120, 0.96)', 'rgba(190, 154, 98, 0.55)'],
  // Kalahari / Namib arid south Africa
  [21, -24, 12, 9, 'rgba(188, 150, 94, 0.82)', 'rgba(138, 138, 76, 0.38)'],
  // Australian Outback (rich iron-oxide terracotta ochre)
  [133, -25, 19, 11, 'rgba(196, 124, 72, 0.94)', 'rgba(170, 124, 72, 0.52)'],
  // Gobi & Central Asian dry steppe
  [92, 42, 24, 10, 'rgba(186, 160, 110, 0.88)', 'rgba(138, 142, 88, 0.42)'],
  // US Southwest & Northern Mexico arid plateau
  [-110, 33, 15, 9, 'rgba(190, 150, 98, 0.85)', 'rgba(132, 138, 84, 0.38)'],
  // Southeast Asia & Indonesia lush tropical green
  [108, 4, 22, 14, 'rgba(22, 116, 58, 0.88)', 'rgba(38, 130, 66, 0.44)'],
  // Europe & Eastern North America rich temperate forests
  [12, 50, 22, 11, 'rgba(50, 128, 68, 0.82)', 'rgba(64, 134, 76, 0.38)'],
  [-86, 42, 24, 12, 'rgba(46, 122, 64, 0.82)', 'rgba(64, 128, 74, 0.38)'],
  // Subarctic Boreal & Siberian Tundra
  [100, 64, 48, 10, 'rgba(90, 126, 94, 0.76)', 'rgba(154, 178, 170, 0.38)'],
  [-110, 64, 34, 9, 'rgba(96, 132, 104, 0.76)', 'rgba(168, 192, 188, 0.38)'],
];

export function createProceduralEarthTextures(maxAnisotropy: number): EarthTextureSet {
  const width = 2048;
  const height = 1024;
  const terrainGrain = createTerrainGrainCanvas();

  // ===========================================================================
  // 1A. REALISTIC COLOR "BLUE MARBLE" ALBEDO MAP
  // ===========================================================================
  const realCanvas = document.createElement('canvas');
  realCanvas.width = width;
  realCanvas.height = height;
  const cCtx = realCanvas.getContext('2d')!;

  // Rich natural sapphire-azure ocean gradient
  const oceanGrad = cCtx.createLinearGradient(0, 0, 0, height);
  oceanGrad.addColorStop(0.0, '#0F3E68');
  oceanGrad.addColorStop(0.18, '#0C4E84');
  oceanGrad.addColorStop(0.5, '#095B99');
  oceanGrad.addColorStop(0.82, '#0C4E84');
  oceanGrad.addColorStop(1.0, '#10406B');
  cCtx.fillStyle = oceanGrad;
  cCtx.fillRect(0, 0, width, height);

  // Subtle deep abyssal ocean basin depth variation
  const basins: [number, number, number][] = [
    [-35, 12, 340],
    [-145, 5, 440],
    [78, -18, 320],
  ];
  for (const [lng, lat, rad] of basins) {
    const [bx, by] = projectToCanvas(lng, lat, width, height);
    const rg = cCtx.createRadialGradient(bx, by, 20, bx, by, rad);
    rg.addColorStop(0, 'rgba(4, 28, 58, 0.52)');
    rg.addColorStop(0.6, 'rgba(8, 52, 92, 0.22)');
    rg.addColorStop(1, 'rgba(9, 91, 153, 0)');
    cCtx.fillStyle = rg;
    cCtx.fillRect(bx - rad, by - rad, rad * 2, rad * 2);
  }

  // Subtle organic oceanic current mottling
  cCtx.save();
  cCtx.globalAlpha = 0.08;
  cCtx.globalCompositeOperation = 'overlay';
  cCtx.drawImage(terrainGrain, 0, 0, width, height);
  cCtx.restore();

  // Delicate scientific Latitude / Longitude Graticule over ocean
  cCtx.lineWidth = 1;
  for (let lat = -75; lat <= 75; lat += 15) {
    const [, y] = projectToCanvas(0, lat, width, height);
    cCtx.strokeStyle = lat === 0 ? 'rgba(186, 232, 252, 0.18)' : 'rgba(165, 220, 245, 0.08)';
    cCtx.beginPath();
    cCtx.moveTo(0, y);
    cCtx.lineTo(width, y);
    cCtx.stroke();
  }
  for (let lng = -180; lng <= 180; lng += 15) {
    const [x] = projectToCanvas(lng, 0, width, height);
    cCtx.strokeStyle = lng === 0 ? 'rgba(186, 232, 252, 0.16)' : 'rgba(165, 220, 245, 0.07)';
    cCtx.beginPath();
    cCtx.moveTo(x, 0);
    cCtx.lineTo(x, height);
    cCtx.stroke();
  }

  // Shallow turquoise coastal shelves around landmasses
  cCtx.save();
  for (const land of WORLD_LANDMASSES) {
    if (land.region === 'focus-brazil' || land.region === 'focus-africa') continue;
    drawPolygonPath(cCtx, land.coords, width, height);
    cCtx.strokeStyle = 'rgba(36, 178, 208, 0.44)';
    cCtx.lineWidth = 15;
    cCtx.lineJoin = 'round';
    cCtx.stroke();

    cCtx.strokeStyle = 'rgba(104, 218, 236, 0.38)';
    cCtx.lineWidth = 5;
    cCtx.stroke();
  }
  cCtx.restore();

  // Clip continents and paint rich satellite biome colors + organic fractal terrain texture
  cCtx.save();
  cCtx.beginPath();
  for (const land of WORLD_LANDMASSES) {
    if (
      land.region === 'focus-brazil' ||
      land.region === 'focus-africa' ||
      land.name === 'Antarctica' ||
      land.name === 'Greenland'
    ) {
      continue;
    }
    land.coords.forEach(([lng, lat], idx) => {
      const [x, y] = projectToCanvas(lng, lat, width, height);
      if (idx === 0) cCtx.moveTo(x, y);
      else cCtx.lineTo(x, y);
    });
    cCtx.closePath();
  }
  cCtx.clip();

  const landGrad = cCtx.createLinearGradient(0, 0, 0, height);
  landGrad.addColorStop(0.0, '#C9DCDA');
  landGrad.addColorStop(0.14, '#5A8463');
  landGrad.addColorStop(0.28, '#42844E');
  landGrad.addColorStop(0.45, '#2A7C40');
  landGrad.addColorStop(0.55, '#287A3F');
  landGrad.addColorStop(0.72, '#5C8A52');
  landGrad.addColorStop(0.88, '#87A089');
  landGrad.addColorStop(1.0, '#DCEAF2');
  cCtx.fillStyle = landGrad;
  cCtx.fillRect(0, 0, width, height);

  for (const [lng, lat, radLng, radLat, centerCol, midCol] of BIOME_PATCHES) {
    const [cx, cy] = projectToCanvas(lng, lat, width, height);
    const rx = (radLng / 360) * width;
    const ry = (radLat / 180) * height;
    cCtx.save();
    cCtx.translate(cx, cy);
    cCtx.scale(1, ry / rx);
    const bg = cCtx.createRadialGradient(0, 0, rx * 0.08, 0, 0, rx);
    bg.addColorStop(0, centerCol);
    bg.addColorStop(0.55, midCol);
    bg.addColorStop(1, 'rgba(0, 0, 0, 0)');
    cCtx.fillStyle = bg;
    cCtx.beginPath();
    cCtx.arc(0, 0, rx, 0, Math.PI * 2);
    cCtx.fill();
    cCtx.restore();
  }

  // Apply multi-octave organic fractal land grain (gives canopy/desert/mountain realism)
  cCtx.save();
  cCtx.globalAlpha = 0.34;
  cCtx.globalCompositeOperation = 'overlay';
  cCtx.drawImage(terrainGrain, 0, 0, width, height);
  cCtx.restore();

  // Mountain cordilleras (rocky warm umber + alpine snow peaks)
  for (const [lng, lat, radiusDeg, intensity] of MOUNTAIN_RIDGES) {
    const [mx, my] = projectToCanvas(lng, lat, width, height);
    const rPx = (radiusDeg / 360) * width;
    const mg = cCtx.createRadialGradient(mx, my, 1, mx, my, rPx);
    mg.addColorStop(0, `rgba(240, 246, 250, ${0.62 * intensity})`);
    mg.addColorStop(0.32, `rgba(136, 112, 88, ${0.74 * intensity})`);
    mg.addColorStop(0.7, `rgba(116, 102, 76, ${0.4 * intensity})`);
    mg.addColorStop(1, 'rgba(116, 102, 76, 0)');
    cCtx.fillStyle = mg;
    cCtx.beginPath();
    cCtx.arc(mx, my, rPx, 0, Math.PI * 2);
    cCtx.fill();
  }
  cCtx.restore();

  // Ice-covered polar landmasses
  for (const land of WORLD_LANDMASSES) {
    if (land.name === 'Greenland' || land.name === 'Antarctica') {
      drawPolygonPath(cCtx, land.coords, width, height);
      cCtx.fillStyle = land.name === 'Antarctica' ? '#E8F2F8' : '#DCEAF4';
      cCtx.fill();
      cCtx.strokeStyle = 'rgba(176, 214, 236, 0.78)';
      cCtx.lineWidth = 1.6;
      cCtx.stroke();
    }
  }

  // Coastlines & subtle educational boundary highlights for Brazil and DRC
  for (const land of WORLD_LANDMASSES) {
    drawPolygonPath(cCtx, land.coords, width, height);
    if (land.region === 'focus-brazil') {
      cCtx.strokeStyle = 'rgba(251, 191, 36, 0.88)';
      cCtx.lineWidth = 2.2;
      cCtx.stroke();
    } else if (land.region === 'focus-africa') {
      cCtx.strokeStyle = 'rgba(251, 113, 133, 0.88)';
      cCtx.lineWidth = 2.0;
      cCtx.stroke();
    } else if (land.name !== 'Antarctica' && land.name !== 'Greenland') {
      cCtx.strokeStyle = 'rgba(216, 238, 212, 0.36)';
      cCtx.lineWidth = 1.2;
      cCtx.stroke();
    }
  }

  // ===========================================================================
  // 1B. SCIENTIFIC CARTOGRAPHY ALBEDO MAP (Sober Clinical Atlas Mode)
  // ===========================================================================
  const sciCanvas = document.createElement('canvas');
  sciCanvas.width = width;
  sciCanvas.height = height;
  const sCtx = sciCanvas.getContext('2d')!;
  const sciOcean = sCtx.createLinearGradient(0, 0, 0, height);
  sciOcean.addColorStop(0, '#2B5370');
  sciOcean.addColorStop(0.5, '#244A66');
  sciOcean.addColorStop(1, '#2B5370');
  sCtx.fillStyle = sciOcean;
  sCtx.fillRect(0, 0, width, height);

  sCtx.lineWidth = 1;
  for (let lat = -75; lat <= 75; lat += 15) {
    const [, y] = projectToCanvas(0, lat, width, height);
    sCtx.strokeStyle = lat === 0 ? 'rgba(219, 234, 245, 0.3)' : 'rgba(203, 224, 238, 0.14)';
    sCtx.beginPath();
    sCtx.moveTo(0, y);
    sCtx.lineTo(width, y);
    sCtx.stroke();
  }
  for (let lng = -180; lng <= 180; lng += 15) {
    const [x] = projectToCanvas(lng, 0, width, height);
    sCtx.strokeStyle = lng === 0 ? 'rgba(219, 234, 245, 0.28)' : 'rgba(203, 224, 238, 0.12)';
    sCtx.beginPath();
    sCtx.moveTo(x, 0);
    sCtx.lineTo(x, height);
    sCtx.stroke();
  }

  for (const land of WORLD_LANDMASSES) {
    drawPolygonPath(sCtx, land.coords, width, height);
    if (land.region === 'focus-brazil') {
      sCtx.fillStyle = '#4B7D94';
      sCtx.fill();
      sCtx.strokeStyle = 'rgba(217, 119, 6, 0.9)';
      sCtx.lineWidth = 2.2;
      sCtx.stroke();
    } else if (land.region === 'focus-africa') {
      sCtx.fillStyle = '#53738D';
      sCtx.fill();
      sCtx.strokeStyle = 'rgba(200, 30, 58, 0.9)';
      sCtx.lineWidth = 2.0;
      sCtx.stroke();
    } else {
      sCtx.fillStyle = '#6E8FA6';
      sCtx.fill();
      sCtx.strokeStyle = 'rgba(226, 236, 244, 0.52)';
      sCtx.lineWidth = 1.4;
      sCtx.stroke();
    }
  }

  // ===========================================================================
  // 2. BUMP / ELEVATION MAP (With Fractal Micro-Relief on Land)
  // ===========================================================================
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = width;
  bumpCanvas.height = height;
  const bCtx = bumpCanvas.getContext('2d')!;
  bCtx.fillStyle = '#0E0E0E';
  bCtx.fillRect(0, 0, width, height);

  bCtx.save();
  bCtx.beginPath();
  for (const land of WORLD_LANDMASSES) {
    land.coords.forEach(([lng, lat], idx) => {
      const [x, y] = projectToCanvas(lng, lat, width, height);
      if (idx === 0) bCtx.moveTo(x, y);
      else bCtx.lineTo(x, y);
    });
    bCtx.closePath();
  }
  bCtx.clip();

  bCtx.fillStyle = '#6A6A6A';
  bCtx.fillRect(0, 0, width, height);
  bCtx.globalAlpha = 0.42;
  bCtx.drawImage(terrainGrain, 0, 0, width, height);
  bCtx.globalAlpha = 1;

  for (const [lng, lat, radiusDeg, intensity] of MOUNTAIN_RIDGES) {
    const [mx, my] = projectToCanvas(lng, lat, width, height);
    const rPx = (radiusDeg / 360) * width;
    const mg = bCtx.createRadialGradient(mx, my, 2, mx, my, rPx);
    const val = Math.round(188 + intensity * 65);
    mg.addColorStop(0, `rgba(${val}, ${val}, ${val}, 0.92)`);
    mg.addColorStop(1, 'rgba(106, 106, 106, 0)');
    bCtx.fillStyle = mg;
    bCtx.beginPath();
    bCtx.arc(mx, my, rPx, 0, Math.PI * 2);
    bCtx.fill();
  }
  bCtx.restore();

  // ===========================================================================
  // 3. ROUGHNESS MAP (Technical Matte PBR Range: 0.72 Ocean / 0.78 Ice / 0.90 Land)
  // ===========================================================================
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = width;
  roughCanvas.height = height;
  const rCtx = roughCanvas.getContext('2d')!;
  rCtx.fillStyle = '#B8B8B8'; // Matte-satin ocean (~0.72 roughness)
  rCtx.fillRect(0, 0, width, height);

  for (const land of WORLD_LANDMASSES) {
    drawPolygonPath(rCtx, land.coords, width, height);
    rCtx.fillStyle = land.name === 'Antarctica' || land.name === 'Greenland' ? '#C8C8C8' : '#E6E6E6';
    rCtx.fill();
  }

  const realisticColorMap = new THREE.CanvasTexture(realCanvas);
  realisticColorMap.colorSpace = THREE.SRGBColorSpace;
  realisticColorMap.anisotropy = maxAnisotropy;
  realisticColorMap.wrapS = THREE.RepeatWrapping;
  realisticColorMap.wrapT = THREE.ClampToEdgeWrapping;

  const scientificColorMap = new THREE.CanvasTexture(sciCanvas);
  scientificColorMap.colorSpace = THREE.SRGBColorSpace;
  scientificColorMap.anisotropy = maxAnisotropy;
  scientificColorMap.wrapS = THREE.RepeatWrapping;
  scientificColorMap.wrapT = THREE.ClampToEdgeWrapping;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.colorSpace = THREE.NoColorSpace;
  bumpMap.anisotropy = maxAnisotropy;
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.ClampToEdgeWrapping;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.colorSpace = THREE.NoColorSpace;
  roughnessMap.anisotropy = maxAnisotropy;
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.ClampToEdgeWrapping;

  const { cloudMap, cloudShadowMap } = createProceduralCloudMaps(maxAnisotropy);

  return {
    realisticColorMap,
    scientificColorMap,
    bumpMap,
    roughnessMap,
    cloudMap,
    cloudShadowMap,
    dispose: () => {
      realisticColorMap.dispose();
      scientificColorMap.dispose();
      bumpMap.dispose();
      roughnessMap.dispose();
      cloudMap.dispose();
      cloudShadowMap.dispose();
    },
  };
}
