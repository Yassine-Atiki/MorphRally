/* Circuit fermé : modèle plan XY, rendu 3D sur XZ. Distances en unités locales. */
class RaceTrack extends Path {
  constructor() {
    const anchors = [
      [-1050, 760],
      [-350, 760],
      [450, 760],
      [1080, 650],
      [1340, 330],
      [1210, -30],
      [850, -180],
      [550, -110],
      [435, -390],
      [880, -620],
      [1040, -990],
      [720, -1260],
      [300, -1100],
      [-80, -1100],
      [-470, -1190],
      [-730, -930],
      [-580, -570],
      [-890, -360],
      [-1250, -620],
      [-1570, -370],
      [-1400, 30],
      [-1600, 450],
      [-1410, 710],
    ];
    const points = [];
    for (let i = 0; i < anchors.length; i++) {
      const a = anchors[(i - 1 + anchors.length) % anchors.length],
        c = anchors[i],
        d = anchors[(i + 1) % anchors.length],
        e = anchors[(i + 2) % anchors.length];
      for (let j = 0; j < 32; j++) {
        const t = j / 32,
          t2 = t * t,
          t3 = t2 * t;
        const sample = (k) =>
          0.5 *
          (2 * c[k] +
            (-a[k] + d[k]) * t +
            (2 * a[k] - 5 * c[k] + 4 * d[k] - e[k]) * t2 +
            (-a[k] + 3 * c[k] - 3 * d[k] + e[k]) * t3);
        points.push([sample(0), sample(1)]);
      }
    }
    // Lissage périodique : rayon minimal > 100, donc les deux bords à 78
    // unités restent réguliers même dans les esses les plus serrées.
    for (let pass = 0; pass < 6; pass++) {
      const smooth = points.map((p, i) => {
        const sum = [0, 0];
        for (let k = -5; k <= 5; k++) {
          const q = points[(i + k + points.length) % points.length];
          sum[0] += q[0];
          sum[1] += q[1];
        }
        return sum.map((v) => v / 11);
      });
      points.splice(0, points.length, ...smooth);
    }
    points.push(points[0].slice());
    super(points, 78, "atlas-gp");
    this.closed = true;
    this.name = "Grand Prix Atlas";
    this.checkpointCount = 60;
    this.checkpointSpacing = this.length / this.checkpointCount;
    this.edges = [[], []];
    this.wallEntities = [];
    this.walls = [];
    for (let i = 0; i < this.points.length - 1; i++) {
      const s = this.segments[i].start,
        n = this.normalAt(s);
      for (let side = 0; side < 2; side++)
        this.edges[side].push(
          this.points[i]
            .copy()
            .add(n.copy().mult((side ? 1 : -1) * this.radius)),
        );
    }
    for (let side = 0; side < 2; side++) {
      const edge = this.edges[side];
      for (let i = 0; i < edge.length; i++) {
        const a = edge[i],
          c = edge[(i + 1) % edge.length],
          p = a.copy().add(c).mult(0.5);
        const wall = new Obstacle(p.x, p.y, 1, "race-wall-" + side + "-" + i, {
          a: a.copy().sub(p),
          b: c.copy().sub(p),
        });
        this.wallEntities.push(wall);
        this.walls.push(wall.snapshot());
      }
    }
    this.grid = new SpatialGrid(160);
    this.walls.forEach((w) => this.grid.insert(w));
    this.landmarks = [
      { s: 0, name: "Ligne des stands" },
      { s: this.length * 0.2, name: "Corniche des falaises" },
      { s: this.length * 0.39, name: "Les esses du cap" },
      { s: this.length * 0.58, name: "Col de l’Atlas" },
      { s: this.length * 0.76, name: "Épingle des pins" },
    ];
  }
  wrap(s) {
    return ((s % this.length) + this.length) % this.length;
  }
  pointAtDistance(s) {
    return super.pointAtDistance(this.closed ? this.wrap(s) : s);
  }
  tangentAt(s) {
    return super.tangentAt(this.closed ? this.wrap(s) : s);
  }
  normalAt(s) {
    const t = this.tangentAt(s);
    return createVector(-t.y, t.x);
  }
  lanePoint(s, lane = 0) {
    return this.pointAtDistance(s).add(this.normalAt(s).mult(lane));
  }
  nearest(p, hint = null) {
    if (hint !== null && (hint < 260 || hint > this.length - 260)) hint = null;
    return super.nearest(p, hint);
  }
  signedOffset(p, near = this.nearest(p)) {
    return p5.Vector.sub(p, near.point).dot(this.normalAt(near.s));
  }
  curvature(s) {
    const a = this.tangentAt(s - 24),
      c = this.tangentAt(s + 24);
    return Math.abs(Math.atan2(a.x * c.y - a.y * c.x, a.dot(c))) / 48;
  }
  turnSeverity(s) {
    let k = 0;
    for (let d = 10; d <= 190; d += 30) k = Math.max(k, this.curvature(s + d));
    return k;
  }
  checkpoint(index) {
    const s = index * this.checkpointSpacing;
    return { pos: this.pointAtDistance(s), tangent: this.tangentAt(s) };
  }
}
