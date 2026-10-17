import * as THREE from "three";

/**
 * Builds a tube around a flat (z = 0) polyline in a single O(n) pass.
 *
 * Drop-in for THREE.TubeGeometry over a CurvePath of line segments — same
 * vertex/index layout (rings of radialSegments + 1 verts, 6 indices per
 * radial step per segment, uv.x running 0→1 by arc length) so per-vertex
 * gradients, the tracer's alphaMap and drawRange reveals behave identically.
 * TubeGeometry re-walks the whole CurvePath for every sample, which made
 * building ~90 routes × 3 tubes take several seconds on load.
 */
export function buildRouteTube(
  points: THREE.Vector3[],
  radius: number,
  radialSegments: number
): THREE.BufferGeometry {
  const n = points.length;
  const ringSize = radialSegments + 1;

  // Cumulative arc length → uv.x
  const lengths = new Float32Array(n);
  for (let i = 1; i < n; i++) {
    lengths[i] = lengths[i - 1] + points[i].distanceTo(points[i - 1]);
  }
  const total = lengths[n - 1] || 1;

  const positions = new Float32Array(n * ringSize * 3);
  const normals = new Float32Array(n * ringSize * 3);
  const uvs = new Float32Array(n * ringSize * 2);

  for (let i = 0; i < n; i++) {
    // Central-difference tangent smooths the frame through corners
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(n - 1, i + 1)];
    let tx = next.x - prev.x;
    let ty = next.y - prev.y;
    const len = Math.hypot(tx, ty) || 1;
    tx /= len;
    ty /= len;

    // Route lies in the XY plane: in-plane normal + Z binormal
    const nx = -ty;
    const ny = tx;
    const p = points[i];

    for (let j = 0; j <= radialSegments; j++) {
      const v = (j / radialSegments) * Math.PI * 2;
      const cos = Math.cos(v);
      const sin = Math.sin(v);
      const ox = cos * nx;
      const oy = cos * ny;
      const oz = sin;

      const k = (i * ringSize + j) * 3;
      positions[k] = p.x + radius * ox;
      positions[k + 1] = p.y + radius * oy;
      positions[k + 2] = p.z + radius * oz;
      normals[k] = ox;
      normals[k + 1] = oy;
      normals[k + 2] = oz;

      const u = (i * ringSize + j) * 2;
      uvs[u] = lengths[i] / total;
      uvs[u + 1] = j / radialSegments;
    }
  }

  const indices: number[] = [];
  for (let i = 1; i < n; i++) {
    for (let j = 1; j <= radialSegments; j++) {
      const a = ringSize * (i - 1) + (j - 1);
      const b = ringSize * i + (j - 1);
      const c = ringSize * i + j;
      const d = ringSize * (i - 1) + j;
      indices.push(a, b, d, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setIndex(indices);
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  return geo;
}
