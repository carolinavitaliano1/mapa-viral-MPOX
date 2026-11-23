import * as THREE from 'three';

export type VirusCutMode = 'quarter' | 'half' | 'full';

function sgnPow(val: number, exp: number): number {
  return Math.sign(val) * Math.pow(Math.abs(val), exp);
}

/**
 * Superelipsoide arredondado ("brick-shaped") proporcional a ~300 × 200 × 170 nm.
 */
export function evalBrickPoint(
  u: number,
  v: number,
  rx: number,
  ry: number,
  rz: number,
  e1 = 0.78,
  e2 = 0.78
): THREE.Vector3 {
  const sinV = Math.sin(v);
  const cosV = Math.cos(v);
  const cosU = Math.cos(u);
  const sinU = Math.sin(u);

  const x = rx * sgnPow(sinV, e1) * sgnPow(cosU, e2);
  const y = ry * sgnPow(cosV, e1);
  const z = rz * sgnPow(sinV, e1) * sgnPow(sinU, e2);
  return new THREE.Vector3(x, y, z);
}

/**
 * Núcleo bicôncavo (formato de haltere) com constrição na cintura central
 * e opção de estrias radiais para a camada paliçada.
 */
export function evalDumbbellPoint(
  u: number,
  v: number,
  rx: number,
  ry: number,
  rz: number,
  ridgeAmp = 0
): THREE.Vector3 {
  const sinV = Math.sin(v);
  const cosV = Math.cos(v);
  const cosU = Math.cos(u);
  const sinU = Math.sin(u);

  const e1 = 0.86;
  const e2 = 0.84;

  let x = rx * sgnPow(sinV, e1) * sgnPow(cosU, e2);
  const xNorm = x / rx;

  const pinchY = 1.0 - 0.5 * Math.exp(-(xNorm * xNorm) * 4.2);
  const pinchZ = 1.0 - 0.14 * Math.exp(-(xNorm * xNorm) * 3.8);

  let y = ry * pinchY * sgnPow(cosV, e1);
  let z = rz * pinchZ * sgnPow(sinV, e1) * sgnPow(sinU, e2);

  if (ridgeAmp > 0) {
    const ridge = ridgeAmp * Math.sin(u * 44) * Math.pow(sinV, 0.6);
    const dir = new THREE.Vector3(x, y, z).normalize();
    x += dir.x * ridge;
    y += dir.y * ridge;
    z += dir.z * ridge;
  }

  return new THREE.Vector3(x, y, z);
}

/**
 * Constrói uma casca fechada com espessura real e corte limpo:
 * - 'quarter': quadrante frontal superior direito removido (X > 0, Y > 0, Z > 0)
 * - 'half': metade frontal removida (Z > 0, u em [0, PI])
 * - 'full': casca completa íntegra
 */
export function createCutawayShellGeometry(
  evalOuter: (u: number, v: number) => THREE.Vector3,
  evalInner: (u: number, v: number) => THREE.Vector3,
  cutMode: VirusCutMode,
  uSegs = 64,
  vSegs = 40
): THREE.BufferGeometry {
  const uQuarter = Math.floor(uSegs / 4); // u in [0, PI/2] -> X > 0, Z > 0
  const uHalf = Math.floor(uSegs / 2); // u in [0, PI] -> Z > 0
  const vHalf = Math.floor(vSegs / 2); // v in [0, PI/2] -> Y > 0

  const outerGrid: THREE.Vector3[][] = [];
  const innerGrid: THREE.Vector3[][] = [];

  for (let iv = 0; iv <= vSegs; iv++) {
    const v = (iv / vSegs) * Math.PI;
    const rowOut: THREE.Vector3[] = [];
    const rowIn: THREE.Vector3[] = [];
    for (let iu = 0; iu <= uSegs; iu++) {
      const u = (iu / uSegs) * Math.PI * 2;
      rowOut.push(evalOuter(u, v));
      rowIn.push(evalInner(u, v));
    }
    outerGrid.push(rowOut);
    innerGrid.push(rowIn);
  }

  const computeGridNormals = (grid: THREE.Vector3[][], invert: boolean): THREE.Vector3[][] => {
    const normals: THREE.Vector3[][] = [];
    for (let iv = 0; iv <= vSegs; iv++) {
      const row: THREE.Vector3[] = [];
      for (let iu = 0; iu <= uSegs; iu++) {
        let n: THREE.Vector3;
        if (iv === 0) {
          n = new THREE.Vector3(0, 1, 0);
        } else if (iv === vSegs) {
          n = new THREE.Vector3(0, -1, 0);
        } else {
          const iuPrev = (iu - 1 + uSegs) % uSegs;
          const iuNext = (iu + 1) % uSegs;
          const ivPrev = Math.max(0, iv - 1);
          const ivNext = Math.min(vSegs, iv + 1);
          const du = grid[iv][iuNext].clone().sub(grid[iv][iuPrev]);
          const dv = grid[ivNext][iu].clone().sub(grid[ivPrev][iu]);
          n = du.cross(dv);
          if (n.lengthSq() < 1e-10) {
            n.copy(grid[iv][iu]).normalize();
          } else {
            n.normalize();
          }
        }
        if (invert) n.negate();
        row.push(n);
      }
      normals.push(row);
    }
    return normals;
  };

  const outerNormals = computeGridNormals(outerGrid, false);
  const innerNormals = computeGridNormals(innerGrid, true);

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];

  const pushSmoothTri = (
    pA: THREE.Vector3,
    nA: THREE.Vector3,
    uvA: [number, number],
    pB: THREE.Vector3,
    nB: THREE.Vector3,
    uvB: [number, number],
    pC: THREE.Vector3,
    nC: THREE.Vector3,
    uvC: [number, number]
  ) => {
    positions.push(pA.x, pA.y, pA.z, pB.x, pB.y, pB.z, pC.x, pC.y, pC.z);
    normals.push(nA.x, nA.y, nA.z, nB.x, nB.y, nB.z, nC.x, nC.y, nC.z);
    uvs.push(uvA[0], uvA[1], uvB[0], uvB[1], uvC[0], uvC[1]);
  };

  const pushSmoothQuad = (
    p00: THREE.Vector3,
    n00: THREE.Vector3,
    uv00: [number, number],
    p10: THREE.Vector3,
    n10: THREE.Vector3,
    uv10: [number, number],
    p11: THREE.Vector3,
    n11: THREE.Vector3,
    uv11: [number, number],
    p01: THREE.Vector3,
    n01: THREE.Vector3,
    uv01: [number, number],
    flip = false
  ) => {
    if (!flip) {
      pushSmoothTri(p00, n00, uv00, p01, n01, uv01, p11, n11, uv11);
      pushSmoothTri(p00, n00, uv00, p11, n11, uv11, p10, n10, uv10);
    } else {
      pushSmoothTri(p00, n00, uv00, p10, n10, uv10, p11, n11, uv11);
      pushSmoothTri(p00, n00, uv00, p11, n11, uv11, p01, n01, uv01);
    }
  };

  const pushFlatCapQuad = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
    d: THREE.Vector3,
    faceNormal: THREE.Vector3
  ) => {
    const e1 = b.clone().sub(a);
    const e2 = c.clone().sub(a);
    const computed = e1.cross(e2);
    const align = computed.dot(faceNormal) >= 0;
    const uv0: [number, number] = [0, 0];
    const uv1: [number, number] = [1, 0];
    const uv2: [number, number] = [1, 1];
    const uv3: [number, number] = [0, 1];

    if (align) {
      pushSmoothTri(a, faceNormal, uv0, b, faceNormal, uv1, c, faceNormal, uv2);
      pushSmoothTri(a, faceNormal, uv0, c, faceNormal, uv2, d, faceNormal, uv3);
    } else {
      pushSmoothTri(a, faceNormal, uv0, c, faceNormal, uv2, b, faceNormal, uv1);
      pushSmoothTri(a, faceNormal, uv0, d, faceNormal, uv3, c, faceNormal, uv2);
    }
  };

  // 1) Superfície Externa (normais suaves para fora) e Interna (normais suaves para dentro)
  for (let iv = 0; iv < vSegs; iv++) {
    const v0 = iv / vSegs;
    const v1 = (iv + 1) / vSegs;
    for (let iu = 0; iu < uSegs; iu++) {
      if (cutMode === 'quarter' && iu < uQuarter && iv < vHalf) continue;
      if (cutMode === 'half' && iu < uHalf) continue;

      const u0 = iu / uSegs;
      const u1 = (iu + 1) / uSegs;

      pushSmoothQuad(
        outerGrid[iv][iu],
        outerNormals[iv][iu],
        [u0, v0],
        outerGrid[iv + 1][iu],
        outerNormals[iv + 1][iu],
        [u0, v1],
        outerGrid[iv + 1][iu + 1],
        outerNormals[iv + 1][iu + 1],
        [u1, v1],
        outerGrid[iv][iu + 1],
        outerNormals[iv][iu + 1],
        [u1, v0],
        false
      );

      pushSmoothQuad(
        innerGrid[iv][iu],
        innerNormals[iv][iu],
        [u0, v0],
        innerGrid[iv + 1][iu],
        innerNormals[iv + 1][iu],
        [u0, v1],
        innerGrid[iv + 1][iu + 1],
        innerNormals[iv + 1][iu + 1],
        [u1, v1],
        innerGrid[iv][iu + 1],
        innerNormals[iv][iu + 1],
        [u1, v0],
        true
      );
    }
  }

  // 2) Paredes de corte sólidas com normais planas nítidas
  const nPosZ = new THREE.Vector3(0, 0, 1);
  const nPosX = new THREE.Vector3(1, 0, 0);
  const nPosY = new THREE.Vector3(0, 1, 0);

  if (cutMode === 'quarter') {
    // Plano u = 0 (Z = 0, X > 0, Y > 0) — face voltada para +Z
    for (let iv = 0; iv < vHalf; iv++) {
      pushFlatCapQuad(
        outerGrid[iv][0],
        innerGrid[iv][0],
        innerGrid[iv + 1][0],
        outerGrid[iv + 1][0],
        nPosZ
      );
    }
    // Plano u = PI/2 (X = 0, Z > 0, Y > 0) — face voltada para +X
    for (let iv = 0; iv < vHalf; iv++) {
      pushFlatCapQuad(
        outerGrid[iv][uQuarter],
        outerGrid[iv + 1][uQuarter],
        innerGrid[iv + 1][uQuarter],
        innerGrid[iv][uQuarter],
        nPosX
      );
    }
    // Plano horizontal v = PI/2 (Y = 0, X > 0, Z > 0) — face voltada para +Y
    for (let iu = 0; iu < uQuarter; iu++) {
      pushFlatCapQuad(
        outerGrid[vHalf][iu],
        innerGrid[vHalf][iu],
        innerGrid[vHalf][iu + 1],
        outerGrid[vHalf][iu + 1],
        nPosY
      );
    }
  } else if (cutMode === 'half') {
    // Plano frontal Z = 0, lado direito (u = 0, v de 0 a PI) — face voltada para +Z
    for (let iv = 0; iv < vSegs; iv++) {
      pushFlatCapQuad(
        outerGrid[iv][0],
        innerGrid[iv][0],
        innerGrid[iv + 1][0],
        outerGrid[iv + 1][0],
        nPosZ
      );
    }
    // Plano frontal Z = 0, lado esquerdo (u = PI, v de 0 a PI) — face voltada para +Z
    for (let iv = 0; iv < vSegs; iv++) {
      pushFlatCapQuad(
        outerGrid[iv][uHalf],
        outerGrid[iv + 1][uHalf],
        innerGrid[iv + 1][uHalf],
        innerGrid[iv][uHalf],
        nPosZ
      );
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return geometry;
}

/**
 * Textura procedural de estrias para a camada paliçada.
 */
export function createPalisadeBumpTexture(anisotropy = 4): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 256, 256);
    for (let x = 0; x < 256; x += 8) {
      const grad = ctx.createLinearGradient(x, 0, x + 8, 0);
      grad.addColorStop(0, '#505050');
      grad.addColorStop(0.5, '#dcdcdc');
      grad.addColorStop(1, '#505050');
      ctx.fillStyle = grad;
      ctx.fillRect(x, 0, 8, 256);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = anisotropy;
  return tex;
}

/**
 * Textura procedural granular sutil para os corpos laterais.
 */
export function createGranularBumpTexture(anisotropy = 4): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const imgData = ctx.createImageData(128, 128);
    // Deterministic seeded PRNG for clean, repeatable texture
    let seed = 1337;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < imgData.data.length; i += 4) {
      const v = 90 + Math.floor(rand() * 120);
      imgData.data[i] = v;
      imgData.data[i + 1] = v;
      imgData.data[i + 2] = v;
      imgData.data[i + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = anisotropy;
  return tex;
}

/**
 * Textura procedural radial para sombra de contato suave sob o modelo anatômico.
 */
export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 124);
    grad.addColorStop(0, 'rgba(15, 23, 42, 0.28)');
    grad.addColorStop(0.5, 'rgba(15, 23, 42, 0.12)');
    grad.addColorStop(0.82, 'rgba(15, 23, 42, 0.03)');
    grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Elipsoide orgânico com micro-relevo para os dois corpos laterais.
 */
export function createOrganicLateralBodyGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, 32, 24);
  const posAttr = geo.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < posAttr.count; i++) {
    v.fromBufferAttribute(posAttr, i);
    const bump =
      1.0 +
      0.048 * Math.sin(v.x * 8.5) * Math.cos(v.z * 7.5) +
      0.032 * Math.cos(v.y * 10.5 + v.x * 5.0);
    v.x *= 0.44 * bump;
    v.y *= 0.16 * bump;
    v.z *= 0.34 * bump;
    posAttr.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Matrizes de transformação orientadas pelas normais para as espículas de superfície,
 * excluindo o setor recortado conforme o modo de corte.
 */
export function buildSurfaceTubuleMatrices(cutMode: VirusCutMode): THREE.Matrix4[] {
  const totalSamples = 290;
  const validTransforms: THREE.Matrix4[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const upVec = new THREE.Vector3(0, 1, 0);
  const eps = 0.01;
  const dummy = new THREE.Object3D();

  for (let i = 0; i < totalSamples; i++) {
    const yUnit = 1 - (i / (totalSamples - 1)) * 2;
    const v = Math.acos(THREE.MathUtils.clamp(yUnit, -1, 1));
    const u = ((i * goldenAngle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);

    const pos = evalBrickPoint(u, v, 1.65, 0.94, 1.1);

    if (cutMode === 'quarter' && pos.x > -0.07 && pos.y > -0.07 && pos.z > -0.07) continue;
    if (cutMode === 'half' && pos.z > -0.07) continue;
    if (v < 0.06 || v > Math.PI - 0.06) continue;

    const pu = evalBrickPoint(u + eps, v, 1.65, 0.94, 1.1).sub(pos);
    const pv = evalBrickPoint(u, v + eps, 1.65, 0.94, 1.1).sub(pos);
    const normal = new THREE.Vector3().crossVectors(pv, pu).normalize();
    if (normal.dot(pos) < 0) normal.negate();

    dummy.position.copy(pos).addScaledVector(normal, 0.042);
    dummy.quaternion.setFromUnitVectors(upVec, normal);
    const scaleVar = 0.88 + Math.sin(i * 12.9898) * 0.14;
    dummy.scale.set(scaleVar, scaleVar, scaleVar);
    dummy.updateMatrix();
    validTransforms.push(dummy.matrix.clone());
  }

  return validTransforms;
}
