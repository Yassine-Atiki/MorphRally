/* Géométrie pure ; toutes les positions et distances sont en pixels monde. */
class Geometry {
  // Allocation vectorielle pure. Les sous-classes choisissent et pondèrent les comportements.
  static allocate(contributions, maximum) {
    const total = createVector(0, 0),
      protectedDirections = [];
    let remaining = maximum;
    for (const item of contributions) {
      const candidate = item.force.copy().mult(item.weight ?? 1);
      if (!Number.isFinite(candidate.x) || !Number.isFinite(candidate.y))
        throw new TypeError("Force non finie");
      if (
        protectedDirections.some(
          (direction) => candidate.dot(direction) < -1e-10,
        )
      )
        continue;
      candidate.limit(Math.max(0, remaining));
      total.add(candidate);
      remaining -= candidate.mag();
      if (item.protected && candidate.magSq() > 1e-12)
        protectedDirections.push(candidate.copy().normalize());
      if (remaining <= 1e-10) break;
    }
    return total.limit(maximum);
  }
  static threat(entity, obstacles) {
    const forward =
      entity.vel.magSq() > 0.25
        ? entity.vel.copy().normalize()
        : entity.forwardHint
          ? entity.forwardHint.copy()
          : createVector(
              Math.cos(entity.heading || 0),
              Math.sin(entity.heading || 0),
            );
    const length = 40 + 18 * entity.vel.mag(),
      end = entity.pos.copy().add(forward.copy().mult(length));
    const side = createVector(-forward.y, forward.x);
    let best = null;
    for (const obstacle of obstacles) {
      if (obstacle.id === entity.id || obstacle.collidable === false) continue;
      if (obstacle.shape === "segment") {
        const axis = p5.Vector.sub(obstacle.b, obstacle.a).normalize(),
          normal = createVector(-axis.y, axis.x);
        const signed = p5.Vector.sub(entity.pos, obstacle.a).dot(normal);
        if (
          Math.abs(axis.dot(forward)) > 0.95 &&
          forward.dot(normal) * Math.sign(signed) >= -0.001
        )
          continue;
      }
      const radius =
        entity.r +
        3 +
        (obstacle.shape === "segment" ? obstacle.thickness : obstacle.radius);
      const t =
        obstacle.shape === "segment"
          ? Geometry.capsuleTime(
              entity.pos,
              end,
              obstacle.a,
              obstacle.b,
              radius,
            )
          : Geometry.circleTime(entity.pos, end, obstacle.pos, radius);
      if (
        t === null ||
        (best &&
          (t > best.t + 1e-9 ||
            (Math.abs(t - best.t) < 1e-9 && obstacle.id > best.id)))
      )
        continue;
      if (t === 0) {
        const closest =
          obstacle.shape === "segment"
            ? Geometry.closest(entity.pos, obstacle.a, obstacle.b).point
            : obstacle.pos;
        if (p5.Vector.sub(closest, entity.pos).dot(forward) <= 1e-6) continue;
      }
      const center =
        obstacle.shape === "segment"
          ? Geometry.closest(
              entity.pos.copy().add(forward.copy().mult(t * length + 12)),
              obstacle.a,
              obstacle.b,
            ).point
          : obstacle.pos;
      if (p5.Vector.sub(center, entity.pos).dot(forward) < -1e-7) continue;
      best = {
        id: obstacle.id,
        t,
        distance: t * length,
        offset: p5.Vector.sub(center, entity.pos).dot(side),
        forward,
        side,
        length,
      };
    }
    return best;
  }
  static clamp(value, low, high) {
    return Math.max(low, Math.min(high, value));
  }
  static vector(value) {
    if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y))
      throw new TypeError("Vecteur non fini");
    return createVector(value.x, value.y);
  }
  static closest(point, a, b) {
    const direction = p5.Vector.sub(b, a);
    const lengthSquared = direction.magSq();
    const t =
      lengthSquared < 1e-12
        ? 0
        : Geometry.clamp(
            p5.Vector.sub(point, a).dot(direction) / lengthSquared,
            0,
            1,
          );
    return { point: a.copy().add(direction.mult(t)), t };
  }
  static normal(a, b) {
    const d = p5.Vector.sub(b, a).normalize();
    return createVector(-d.y, d.x);
  }
  static pairDirection(id, otherId) {
    const ids = [String(id), String(otherId)].sort();
    let hash = 2166136261;
    for (const letter of ids.join(":"))
      hash = Math.imul(hash ^ letter.charCodeAt(0), 16777619);
    const angle = ((hash >>> 0) / 4294967296) * Math.PI * 2;
    return createVector(Math.cos(angle), Math.sin(angle)).mult(
      String(id) === ids[0] ? 1 : -1,
    );
  }
  static circleTime(start, end, center, radius) {
    const movement = p5.Vector.sub(end, start),
      offset = p5.Vector.sub(start, center);
    const c = offset.magSq() - radius * radius;
    if (c < -1e-7) return 0;
    const a = movement.magSq(),
      b = 2 * offset.dot(movement);
    if (a < 1e-12 || b >= 0) return null;
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return null;
    const t = (-b - Math.sqrt(discriminant)) / (2 * a);
    return t >= -1e-7 && t <= 1 ? Math.max(0, t) : null;
  }
  static capsuleTime(start, end, a, b, radius) {
    if (
      Math.max(start.x, end.x) < Math.min(a.x, b.x) - radius ||
      Math.min(start.x, end.x) > Math.max(a.x, b.x) + radius ||
      Math.max(start.y, end.y) < Math.min(a.y, b.y) - radius ||
      Math.min(start.y, end.y) > Math.max(a.y, b.y) + radius
    )
      return null;
    const axis = p5.Vector.sub(b, a),
      length = axis.mag();
    if (length < 1e-9) return Geometry.circleTime(start, end, a, radius);
    axis.div(length);
    const side = createVector(-axis.y, axis.x),
      relative = p5.Vector.sub(start, a);
    const delta = p5.Vector.sub(end, start),
      y = relative.dot(side),
      dy = delta.dot(side);
    const candidates = [
      Geometry.circleTime(start, end, a, radius),
      Geometry.circleTime(start, end, b, radius),
    ];
    if (Math.abs(dy) > 1e-12) {
      for (const sign of [-1, 1]) {
        const t = (sign * radius - y) / dy;
        const x = relative.dot(axis) + delta.dot(axis) * t;
        if (t >= 0 && t <= 1 && x >= 0 && x <= length && dy * sign < 0)
          candidates.push(t);
      }
    }
    const closest = Geometry.closest(start, a, b).point;
    if (p5.Vector.dist(start, closest) < radius - 1e-7) candidates.push(0);
    const valid = candidates.filter((t) => t !== null);
    return valid.length ? Math.min(...valid) : null;
  }
}
