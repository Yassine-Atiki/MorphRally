class Path {
  constructor(points, radius = 100, id = "main") {
    if (!Array.isArray(points) || !points.length)
      throw new TypeError("Chemin vide");
    this.id = id;
    this.radius = radius;
    this.radii = points.map((p) =>
      Array.isArray(p) && Number.isFinite(p[2]) ? p[2] : radius,
    );
    this.points = points.map((p) =>
      Array.isArray(p) ? createVector(p[0], p[1]) : Geometry.vector(p),
    );
    this.segments = [];
    this.length = 0;
    for (let i = 1; i < this.points.length; i++) {
      const a = this.points[i - 1],
        b = this.points[i],
        length = p5.Vector.dist(a, b);
      if (length < 1e-9) continue;
      this.segments.push({ a, b, length, start: this.length, index: i - 1 });
      this.length += length;
    }
  }
  pointAtDistance(distance) {
    const s = Geometry.clamp(distance, 0, this.length);
    const segment = this.segmentAt(s);
    if (!segment) return this.points[0].copy();
    return segment.a
      .copy()
      .add(
        p5.Vector.sub(segment.b, segment.a).mult(
          (s - segment.start) / segment.length,
        ),
      );
  }
  tangentAt(distance) {
    const segment = this.segmentAt(distance);
    return segment
      ? p5.Vector.sub(segment.b, segment.a).normalize()
      : createVector(1, 0);
  }
  radiusAt(distance) {
    const segment = this.segmentAt(distance);
    if (!segment) return this.radius;
    const t = Geometry.clamp((distance - segment.start) / segment.length, 0, 1);
    return (
      this.radii[segment.index] * (1 - t) + this.radii[segment.index + 1] * t
    );
  }
  segmentAt(distance) {
    let low = 0,
      high = this.segments.length - 1;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (this.segments[middle].start + this.segments[middle].length < distance)
        low = middle + 1;
      else high = middle;
    }
    return this.segments[low];
  }
  nearest(point, hint = null) {
    let bestSquared = Infinity,
      bestX = this.points[0].x,
      bestY = this.points[0].y,
      bestS = 0,
      bestIndex = 0,
      bestT = 0;
    for (const segment of this.segments) {
      if (
        hint !== null &&
        (segment.start > hint + 230 ||
          segment.start + segment.length < hint - 260)
      )
        continue;
      const dx = segment.b.x - segment.a.x,
        dy = segment.b.y - segment.a.y;
      const t = Geometry.clamp(
        ((point.x - segment.a.x) * dx + (point.y - segment.a.y) * dy) /
          (segment.length * segment.length),
        0,
        1,
      );
      const x = segment.a.x + dx * t,
        y = segment.a.y + dy * t,
        distance = (point.x - x) ** 2 + (point.y - y) ** 2;
      if (distance < bestSquared) {
        bestSquared = distance;
        bestX = x;
        bestY = y;
        bestS = segment.start + t * segment.length;
        bestIndex = segment.index;
        bestT = t;
      }
    }
    if (!Number.isFinite(bestSquared) && hint !== null)
      return this.nearest(point);
    if (!this.segments.length)
      bestSquared = (point.x - bestX) ** 2 + (point.y - bestY) ** 2;
    return {
      point: createVector(bestX, bestY),
      distance: Math.sqrt(bestSquared),
      s: bestS,
      index: bestIndex,
      t: bestT,
    };
  }
}
