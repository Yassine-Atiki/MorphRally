/* Les rayons voient uniquement les segments physiques, jamais les checkpoints. */
class RaySensor {
  constructor(offset, range = 150) {
    this.offset = offset;
    this.range = range;
    this.distance = range;
    this.value = 0;
    this.end = { x: 0, y: 0 };
    this.origin = { x: 0, y: 0 };
    this.hit = false;
  }
  static distanceToSegment(x, y, dx, dy, wall) {
    const ax = wall.a.x - x,
      ay = wall.a.y - y;
    const sx = wall.b.x - wall.a.x,
      sy = wall.b.y - wall.a.y;
    const denominator = dx * sy - dy * sx;
    if (Math.abs(denominator) < 1e-10) {
      if (Math.abs(ax * dy - ay * dx) > 1e-8) return null;
      const first = ax * dx + ay * dy,
        last = first + sx * dx + sy * dy;
      if (Math.max(first, last) < -1e-8) return null;
      return Math.max(0, Math.min(first, last));
    }
    const distance = (ax * sy - ay * sx) / denominator;
    const t = (ax * dy - ay * dx) / denominator;
    return distance >= -1e-8 && t >= -1e-8 && t <= 1 + 1e-8
      ? Math.max(0, distance)
      : null;
  }
  sense(pos, heading, walls) {
    this.origin.x = pos.x;
    this.origin.y = pos.y;
    const angle = heading + this.offset,
      dx = Math.cos(angle),
      dy = Math.sin(angle);
    let nearest = this.range,
      hit = false;
    for (const wall of walls) {
      const distance = RaySensor.distanceToSegment(pos.x, pos.y, dx, dy, wall);
      if (distance !== null && distance <= nearest) {
        nearest = distance;
        hit = true;
      }
    }
    this.distance = nearest;
    this.value = Math.max(0, Math.min(1, 1 - nearest / this.range));
    this.end.x = pos.x + dx * nearest;
    this.end.y = pos.y + dy * nearest;
    this.hit = hit;
    return this.value;
  }
}
