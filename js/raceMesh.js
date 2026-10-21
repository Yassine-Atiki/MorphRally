/* Meshes originaux : faces et normales mises en cache par p5.Geometry.
   Coordonnées d'auteur (x, hauteur, z), conversion Y vers le haut de WEBGL. */
class RaceMesh {
  constructor() {
    this.geometry = new p5.Geometry();
    this.geometry.gid = "race-" + RaceMesh.serial++;
  }
  static serial = 0;
  static color(hex) {
    if (Array.isArray(hex)) return hex;
    return [
      parseInt(hex.slice(1, 3), 16) / 255,
      parseInt(hex.slice(3, 5), 16) / 255,
      parseInt(hex.slice(5, 7), 16) / 255,
      1,
    ];
  }
  triangle(a, b, c, color, normal = null) {
    const verts = [a, b, c].map((p) => [p[0], -p[1], p[2]]),
      u = verts[1].map((v, i) => v - verts[0][i]),
      v = verts[2].map((n, i) => n - verts[0][i]);
    let n = normal ?? [
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0],
    ];
    const mag = Math.hypot(...n) || 1;
    n = n.map((x) => x / mag);
    const start = this.geometry.vertices.length,
      rgba = RaceMesh.color(color);
    for (const p of verts) {
      this.geometry.vertices.push(new p5.Vector(...p));
      this.geometry.vertexNormals.push(new p5.Vector(...n));
      this.geometry.vertexColors.push(...rgba);
      this.geometry.uvs.push(0, 0);
    }
    this.geometry.faces.push([start, start + 1, start + 2]);
    return this;
  }
  quad(a, b, c, d, color, normal = null) {
    this.triangle(a, b, c, color, normal);
    this.triangle(a, c, d, color, normal);
    return this;
  }
  box(x, h, z, w, high, deep, color) {
    const a = x - w / 2,
      b = x + w / 2,
      c = z - deep / 2,
      d = z + deep / 2,
      t = h + high;
    this.quad([a, t, c], [a, t, d], [b, t, d], [b, t, c], color, [0, -1, 0]);
    this.quad([a, h, c], [b, h, c], [b, t, c], [a, t, c], color, [0, 0, -1]);
    this.quad([a, h, d], [a, t, d], [b, t, d], [b, h, d], color, [0, 0, 1]);
    this.quad([a, h, c], [a, t, c], [a, t, d], [a, h, d], color, [-1, 0, 0]);
    this.quad([b, h, c], [b, h, d], [b, t, d], [b, t, c], color, [1, 0, 0]);
    return this;
  }
  cone(x, h, z, r, high, color, sides = 7) {
    for (let i = 0; i < sides; i++) {
      const a = (i * Math.PI * 2) / sides,
        b = ((i + 1) * Math.PI * 2) / sides;
      this.triangle(
        [x + Math.cos(a) * r, h, z + Math.sin(a) * r],
        [x, h + high, z],
        [x + Math.cos(b) * r, h, z + Math.sin(b) * r],
        color,
      );
    }
    return this;
  }
  cylinderZ(x, h, z, r, depth, color, sides = 14) {
    for (let i = 0; i < sides; i++) {
      const a = (i * Math.PI * 2) / sides,
        b = ((i + 1) * Math.PI * 2) / sides;
      const ax = x + Math.cos(a) * r,
        ay = h + Math.sin(a) * r,
        bx = x + Math.cos(b) * r,
        by = h + Math.sin(b) * r;
      this.quad(
        [ax, ay, z - depth / 2],
        [bx, by, z - depth / 2],
        [bx, by, z + depth / 2],
        [ax, ay, z + depth / 2],
        color,
      );
      this.triangle(
        [x, h, z - depth / 2],
        [bx, by, z - depth / 2],
        [ax, ay, z - depth / 2],
        color,
      );
      this.triangle(
        [x, h, z + depth / 2],
        [ax, ay, z + depth / 2],
        [bx, by, z + depth / 2],
        color,
      );
    }
    return this;
  }
  draw() {
    model(this.geometry);
  }
  loft(sections, color) {
    const profile = [
      [-1, 0],
      [-1, 0.45],
      [-0.93, 0.83],
      [-0.68, 1],
      [0.68, 1],
      [0.93, 0.83],
      [1, 0.45],
      [1, 0],
    ];
    for (let i = 0; i < sections.length - 1; i++) {
      const ring = (s) =>
        profile.map(([z, y]) => [
          s.x,
          s.base + (s.top - s.base) * y,
          z * s.width,
        ]);
      const a = ring(sections[i]),
        b = ring(sections[i + 1]);
      for (let j = 0; j < a.length; j++) {
        const k = (j + 1) % a.length;
        this.quad(a[j], b[j], b[k], a[k], color);
      }
      if (i === 0 || i === sections.length - 2) {
        const ring = i === 0 ? a : b,
          s = sections[i === 0 ? i : i + 1],
          middle = [s.x, (s.base + s.top) * 0.5, 0];
        for (let j = 0; j < ring.length; j++) {
          const k = (j + 1) % ring.length;
          if (i === 0) this.triangle(middle, ring[j], ring[k], color);
          else this.triangle(middle, ring[k], ring[j], color);
        }
      }
    }
    return this;
  }
}
