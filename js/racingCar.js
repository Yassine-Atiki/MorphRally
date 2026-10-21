/* Action -> steering borné -> applyForce -> un super.update(). Aucun point de
   circuit n'est copié dans pos ; le chemin n'est qu'une cible de vitesse. */
class RacingCar extends Vehicle {
  constructor(track, driver, index) {
    const startS = -45 - Math.floor(index / 2) * 65,
      lane = (index % 2 ? 1 : -1) * 23;
    const pos = track.lanePoint(startS, lane);
    super(pos.x, pos.y);
    this.id = index;
    this.driver = driver;
    this.r = 12;
    this.maxSpeed = 11.8;
    this.maxForce = 0.42;
    this.heading = track.tangentAt(startS).heading();
    this.distance = startS;
    this.trackS = track.wrap(startS);
    this.lane = lane;
    this.targetLane = lane;
    this.nextCheckpoint = 0;
    this.checkpoints = 0;
    this.lap = 0;
    this.finishTime = null;
    this.lapStart = 0;
    this.lapTimes = [];
    this.lastPosition = index + 1;
    this.overtakes = 0;
    this.updateCount = 0;
    this.energy = 100;
    this.boosting = false;
    this.strategy = "balanced";
    this.laneCooldown = 0;
    this.lastForce = createVector(0, 0);
    this.desiredSpeed = 0;
    this.lastTarget = pos.copy();
    this.lastLaneChoice = lane;
    this.contactCount = 0;
    this.diagnostics = {};
  }
  snapshot() {
    return {
      id: this.id,
      pos: this.pos.copy(),
      vel: this.vel.copy(),
      distance: this.distance,
      lane: this.lane,
      r: this.r,
      finished: this.finishTime !== null,
    };
  }
  chooseLane(track, states, attack) {
    if (this.laneCooldown > 0) {
      this.laneCooldown--;
      return;
    }
    const candidates = [-42, -22, 0, 22, 42];
    let best = this.targetLane,
      bestScore = -Infinity;
    for (const lane of candidates) {
      let score =
        -Math.abs(lane - this.targetLane) * 0.045 - Math.abs(lane) * 0.009;
      for (const other of states) {
        if (other.id === this.id) continue;
        let gap = other.distance - this.distance;
        // Distance de proximité valable également de part et d'autre de l'arrivée.
        gap -= Math.round(gap / track.length) * track.length;
        const lateral = Math.abs(lane - other.lane);
        if (lateral < 29) {
          if (gap > -40 && gap < 155)
            score -= (155 - Math.abs(gap)) * (gap < 0 ? 0.1 : 0.06);
          if (gap > 0 && gap < 210) score -= attack * 3;
        }
      }
      // Une petite préférence stable crée des personnalités, jamais de tirage par frame.
      score +=
        Math.cos(this.id * 2.1 + lane * 0.05) * this.driver.aggression * 0.5;
      if (score > bestScore) {
        bestScore = score;
        best = lane;
      }
    }
    if (Math.abs(best - this.targetLane) > 5) {
      this.targetLane = best;
      this.laneCooldown = 36;
    }
  }
  followRaceLine(track, desiredSpeed) {
    const near = track.nearest(this.pos, this.trackS);
    const look = 38 + this.vel.mag() * 5.0;
    const target = track.lanePoint(near.s + look, this.lane);
    this.lastTarget = target;
    const desired = p5.Vector.sub(target, this.pos);
    if (desired.magSq() > 1e-12) desired.setMag(desiredSpeed);
    return desired.sub(this.vel).mult(0.24);
  }
  avoidEdges(track) {
    const future = this.pos.copy().add(this.vel.copy().mult(12));
    const near = track.nearest(future, this.trackS),
      offset = track.signedOffset(future, near);
    if (Math.abs(offset) < track.radius - 24) return createVector(0, 0);
    const desired = track
      .tangentAt(near.s)
      .mult(Math.max(2, this.vel.mag() * 0.85));
    desired.add(track.normalAt(near.s).mult(-Math.sign(offset) * 2.8));
    return desired.sub(this.vel).mult(0.4).limit(this.maxForce);
  }
  avoidCars(states) {
    const force = createVector(0, 0);
    const neighbors = [];
    let danger = 0;
    for (const other of states) {
      if (other.id === this.id) continue;
      const delta = p5.Vector.sub(this.pos, other.pos),
        relative = p5.Vector.sub(this.vel, other.vel);
      const t =
        relative.magSq() > 1e-8
          ? Geometry.clamp(-delta.dot(relative) / relative.magSq(), 0, 16)
          : 0;
      const future = delta.copy().add(relative.mult(t)),
        d = future.mag(),
        now = delta.mag();
      if (now > 130) continue;
      const clearance = this.r + other.r + 6;
      neighbors.push({
        id: other.id,
        pos: other.pos.copy(),
        radius: other.r,
        time: t,
        closestDistance: d,
        clearance,
        threat: d < clearance,
        selfFuture: this.pos.copy().add(this.vel.copy().mult(t)),
        otherFuture: other.pos.copy().add(other.vel.copy().mult(t)),
      });
      if (d < clearance) {
        const away =
          future.magSq() > 1e-8
            ? future.normalize()
            : Geometry.pairDirection(this.id, other.id);
        const urgency = (1 - d / clearance) * (0.4 + 0.6 * (1 - t / 18));
        force.add(away.mult(urgency * this.maxForce * 1.6));
        danger = Math.max(danger, urgency);
      }
      if (now < clearance && now > 1e-7)
        force.add(delta.normalize().mult((1 - now / clearance) * 0.45));
    }
    return { force: force.limit(this.maxForce), danger, neighbors };
  }
  applyBehaviors(track, states, controls = {}) {
    const mode = controls.strategy ?? "balanced";
    const attack = mode === "attack" ? 1 : mode === "safe" ? 0 : 0.5;
    this.strategy = mode;
    this.chooseLane(track, states, attack);
    const severity = track.turnSeverity(this.trackS);
    const laneLimit = severity > 0.008 ? 28 : 42;
    const laneTarget = Geometry.clamp(this.targetLane, -laneLimit, laneLimit);
    this.lane += (laneTarget - this.lane) * 0.035;
    const requested =
      this.finishTime === null &&
      !!controls.boost &&
      this.energy > 1 &&
      severity < 0.006;
    this.boosting = requested;
    this.energy = Geometry.clamp(
      this.energy + (requested ? -0.34 : 0.075),
      0,
      100,
    );
    const cruise =
      this.finishTime !== null
        ? 7
        : this.driver.speed *
          (mode === "attack" ? 1.035 : mode === "safe" ? 0.9 : 1);
    const corner = Math.sqrt(
      ((mode === "safe" ? 0.18 : 0.225) * this.driver.skill) /
        Math.max(0.001, severity),
    );
    let speed = Math.min(
      cruise + (requested ? 2.15 : 0),
      Math.max(3.35, corner),
    );
    let trafficLimiter = null;
    const forward = track.tangentAt(this.trackS);
    for (const other of states) {
      if (other.id === this.id) continue;
      const delta = p5.Vector.sub(other.pos, this.pos),
        gap = delta.dot(forward);
      const lateral = Math.abs(delta.x * forward.y - delta.y * forward.x);
      if (gap > 0 && gap < 82 && lateral < 25) {
        const limit = Math.max(1.8, other.vel.mag() + (gap - 35) * 0.09);
        if (limit < speed) trafficLimiter = { id: other.id, gap };
        speed = Math.min(speed, limit);
      }
    }
    this.desiredSpeed = speed;
    const edge = this.avoidEdges(track),
      cars = this.avoidCars(states);
    const follow = this.followRaceLine(track, speed);
    // Priorité bord, puis séparation prédictive, puis suivi dans le budget restant.
    const force = Geometry.allocate(
      [
        { force: edge, protected: true },
        { force: cars.force, protected: true },
        { force: follow },
      ],
      this.maxForce,
    );
    this.lastForce = force.copy();
    this.diagnostics = {
      edge: edge.mag(),
      avoid: cars.force.mag(),
      danger: cars.danger,
      curvature: severity,
      step: this.updateCount + 1,
      origin: this.pos.copy(),
      heading: this.heading,
      velocity: this.vel.copy(),
      prediction: this.pos.copy().add(this.vel.copy().mult(12)),
      target: this.lastTarget.copy(),
      desiredVelocity: p5.Vector.sub(this.lastTarget, this.pos).setMag(speed),
      forces: {
        follow: follow.copy(),
        edge: edge.copy(),
        avoid: cars.force.copy(),
        total: force.copy(),
      },
      neighbors: cars.neighbors,
      trafficLimiter,
      laneTarget,
      cornerSpeed: Math.max(3.35, corner),
      cruiseSpeed: cruise,
      reason: trafficLimiter
        ? "traffic"
        : corner < cruise + (requested ? 2.15 : 0)
          ? "corner"
          : requested
            ? "boost"
            : "cruise",
    };
    this.applyForce(force);
  }
  update() {
    super.update();
    this.updateCount++;
    if (this.vel.magSq() > 1e-7) this.heading = this.vel.heading();
  }
}
