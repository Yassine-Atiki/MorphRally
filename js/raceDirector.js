/* Règles de course : chrono déterministe, départ, collisions et checkpoints.
   Elles sont séparées des forces et du rendu. */
class RaceDirector {
  static drivers = [
    {
      name: "Nora",
      team: "Apex Works",
      number: "07",
      color: "#ff7051",
      speed: 9.25,
      skill: 1.06,
      aggression: 0.9,
    },
    {
      name: "Ilyes",
      team: "Vortex Racing",
      number: "22",
      color: "#916aff",
      speed: 9.45,
      skill: 0.96,
      aggression: 0.8,
    },
    {
      name: "Sofia",
      team: "Scuderia Atlas",
      number: "16",
      color: "#f3c34d",
      speed: 8.95,
      skill: 1.02,
      aggression: 0.6,
    },
    {
      name: "Adam",
      team: "Nightshift",
      number: "31",
      color: "#e9eef2",
      speed: 9.55,
      skill: 0.94,
      aggression: 0.75,
    },
    {
      name: "Vous",
      team: "Morph Motorsport",
      number: "01",
      color: "#21ddda",
      speed: 9.4,
      skill: 1.09,
      aggression: 0.8,
    },
    {
      name: "Maya",
      team: "Rosso GT",
      number: "88",
      color: "#ed4878",
      speed: 9.1,
      skill: 1.12,
      aggression: 0.7,
    },
    {
      name: "Rayan",
      team: "Cobalt Garage",
      number: "54",
      color: "#468afa",
      speed: 9.65,
      skill: 0.98,
      aggression: 0.95,
    },
    {
      name: "Lina",
      team: "Solar Racing",
      number: "09",
      color: "#b4db59",
      speed: 9.2,
      skill: 1.04,
      aggression: 0.65,
    },
  ];
  constructor(options = {}) {
    this.track = new RaceTrack();
    this.laps = options.laps ?? 3;
    this.selected = 4;
    this.cars = RaceDirector.drivers.map(
      (d, i) => new RacingCar(this.track, { ...d }, i),
    );
    this.phase = "grid";
    this.countdown = 180;
    this.tick = 0;
    this.paused = false;
    this.strategy = "balanced";
    this.boostHeld = false;
    this.cameraMode = "chase";
    this.quality = "high";
    this.debug = false;
    this.debugLayers = {
      sensors: true,
      forces: true,
      anticipation: true,
      path: true,
    };
    this.contacts = 0;
    this.rankChanges = 0;
    this.previousOrder = this.cars.map((c) => c.id);
    this.events = [];
    this.lastEvent = "Grand Prix Atlas";
    this.eventUntil = 0;
    this.lastSplits = new Map();
    this.maxStep = 0;
    this.bestLap = null;
  }
  get focus() {
    return this.cars[this.selected];
  }
  stepOnce() {
    if (!this.paused || !["countdown", "racing"].includes(this.phase))
      return false;
    this.paused = false;
    try {
      this.step();
    } finally {
      this.paused = true;
    }
    return true;
  }
  start() {
    if (this.phase === "grid") {
      this.phase = "countdown";
      this.countdown = 180;
    }
  }
  notify(message) {
    this.lastEvent = message;
    this.eventUntil = this.tick + 160;
    this.events.push({ tick: this.tick, message });
    if (this.events.length > 100) this.events.shift();
  }
  standings() {
    return this.cars.slice().sort((a, b) => {
      if (a.finishTime !== null || b.finishTime !== null) {
        if (a.finishTime === null) return 1;
        if (b.finishTime === null) return -1;
        return a.finishTime - b.finishTime || a.id - b.id;
      }
      return b.distance - a.distance || a.id - b.id;
    });
  }
  step() {
    if (this.paused || this.phase === "grid" || this.phase === "results")
      return;
    if (this.phase === "countdown") {
      if (--this.countdown <= 0) {
        this.phase = "racing";
        this.notify("Départ ! Trouvez votre ouverture.");
      }
      return;
    }
    this.tick++;
    const states = this.cars.map((c) => c.snapshot()),
      before = this.cars.map((c) => c.pos.copy());
    for (const car of this.cars) {
      const aiBoost =
        car.id !== this.selected &&
        car.energy > 24 &&
        Math.sin((this.tick + car.id * 149) / 130) > 0.3;
      car.applyBehaviors(this.track, states, {
        strategy: car.id === this.selected ? this.strategy : "balanced",
        boost: car.id === this.selected ? this.boostHeld : aiBoost,
      });
    }
    for (const car of this.cars) car.update();
    this.resolveCollisions(before);
    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];
      this.maxStep = Math.max(this.maxStep, p5.Vector.dist(before[i], car.pos));
      this.advanceProgress(car, before[i]);
    }
    const order = this.standings().map((c) => c.id);
    if (order.some((id, i) => id !== this.previousOrder[i])) {
      for (let i = 0; i < order.length; i++) {
        const car = this.cars[order[i]],
          old = this.previousOrder.indexOf(car.id);
        if (i < old && this.tick > 120) {
          car.overtakes += old - i;
          this.rankChanges++;
        }
        car.lastPosition = i + 1;
      }
      const place = order.indexOf(this.selected);
      if (place < this.previousOrder.indexOf(this.selected) && this.tick > 120)
        this.notify("Dépassement ! Vous êtes P" + (place + 1));
      this.previousOrder = order;
    }
    if (this.cars.every((c) => c.finishTime !== null)) {
      this.phase = "results";
      this.notify("Drapeau à damier");
    }
  }
  advanceProgress(car, previous) {
    const near = this.track.nearest(car.pos, car.trackS);
    if (car.finishTime !== null) {
      car.trackS = near.s;
      return;
    }
    let delta = near.s - car.trackS;
    if (delta > this.track.length / 2) delta -= this.track.length;
    if (delta < -this.track.length / 2) delta += this.track.length;
    // Pas de raccourci ni tour crédité par téléportation : progression locale bornée.
    if (Math.abs(delta) > car.maxSpeed * 2.5) return;
    car.distance += delta;
    car.trackS = near.s;
    const cp = this.track.checkpoint(car.nextCheckpoint);
    const a = p5.Vector.sub(previous, cp.pos).dot(cp.tangent),
      b = p5.Vector.sub(car.pos, cp.pos).dot(cp.tangent);
    if (a <= 0 && b > 0 && near.distance < this.track.radius - car.r + 1) {
      const crossing = previous
        .copy()
        .add(p5.Vector.sub(car.pos, previous).mult(-a / (b - a)));
      if (p5.Vector.dist(crossing, cp.pos) > this.track.radius - car.r) return;
      car.checkpoints++;
      car.nextCheckpoint++;
      if (car.nextCheckpoint > this.track.checkpointCount) {
        car.lap++;
        car.nextCheckpoint = 1;
        const lapTime = this.tick - car.lapStart;
        car.lapStart = this.tick;
        car.lapTimes.push(lapTime);
        this.bestLap =
          this.bestLap === null ? lapTime : Math.min(this.bestLap, lapTime);
        if (car.id === this.selected)
          this.notify(
            car.lap >= this.laps
              ? "Arrivée ! P" + (this.standings().indexOf(car) + 1)
              : "Tour " + (car.lap + 1) + " / " + this.laps,
          );
        if (car.lap >= this.laps) {
          car.finishTime = this.tick;
          car.boosting = false;
        }
      }
    }
  }
  resolveCollisions(before) {
    // Balayage des murs : retour au premier contact, jamais un retour à la ligne idéale.
    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i],
        walls = this.track.grid.query(car.pos, car.maxSpeed + car.r + 10);
      let fraction = 1,
        hit = null;
      for (const wall of walls) {
        const t = Geometry.capsuleTime(
          before[i],
          car.pos,
          wall.a,
          wall.b,
          car.r + wall.thickness,
        );
        if (t !== null && t < fraction) {
          fraction = t;
          hit = wall;
        }
      }
      if (hit) {
        car.pos.set(
          before[i]
            .copy()
            .add(
              p5.Vector.sub(car.pos, before[i]).mult(
                Math.max(0, fraction - 0.0001),
              ),
            ),
        );
        const tangent = p5.Vector.sub(hit.b, hit.a).normalize(),
          along = car.vel.dot(tangent);
        car.vel.set(tangent.mult(along * 0.7));
        car.contactCount++;
        this.contacts++;
      }
    }
    // Reprendre les paires : une correction B/C peut rendre A/B dangereux à nouveau.
    // Chaque réduction reste sur le segment avant->après, sans seconde intégration.
    const touched = new Set();
    for (let iteration = 0; iteration < 24; iteration++) {
      let changed = false;
      for (let a = 0; a < this.cars.length; a++)
        for (let b = a + 1; b < this.cars.length; b++) {
          const first = this.cars[a],
            second = this.cars[b],
            relativeStart = p5.Vector.sub(before[a], before[b]);
          const relativeEnd = p5.Vector.sub(first.pos, second.pos);
          const t = Geometry.circleTime(
            relativeStart,
            relativeEnd,
            createVector(0, 0),
            first.r + second.r,
          );
          if (t === null || t >= 1) continue;
          changed = true;
          const fa = first.pos.copy(),
            fb = second.pos.copy();
          const safe = Math.max(0, t - 0.0001);
          first.pos.set(
            before[a].copy().add(p5.Vector.sub(fa, before[a]).mult(safe)),
          );
          second.pos.set(
            before[b].copy().add(p5.Vector.sub(fb, before[b]).mult(safe)),
          );
          let normal = p5.Vector.sub(first.pos, second.pos);
          if (normal.magSq() < 1e-9)
            normal = Geometry.pairDirection(first.id, second.id);
          else normal.normalize();
          touched.add(a + "," + b);
        }
      if (!changed) break;
    }
    for (const pair of touched) {
      const [a, b] = pair.split(",").map(Number),
        first = this.cars[a],
        second = this.cars[b];
      let normal = p5.Vector.sub(first.pos, second.pos);
      if (normal.magSq() < 1e-9)
        normal = Geometry.pairDirection(first.id, second.id);
      else normal.normalize();
      const closing = p5.Vector.sub(first.vel, second.vel).dot(normal);
      if (closing < 0) {
        first.vel.sub(normal.copy().mult(closing * 0.5));
        second.vel.add(normal.copy().mult(closing * 0.5));
      }
      first.vel.limit(first.maxSpeed);
      second.vel.limit(second.maxSpeed);
      first.contactCount++;
      second.contactCount++;
      this.contacts++;
    }
    for (const car of this.cars) {
      if (car.vel.magSq() > 1e-7) car.heading = car.vel.heading();
    }
  }
  telemetry() {
    return {
      phase: this.phase,
      tick: this.tick,
      countdown: this.countdown,
      selected: this.selected,
      paused: this.paused,
      laps: this.laps,
      trackLength: this.track.length,
      contacts: this.contacts,
      rankChanges: this.rankChanges,
      maxStep: this.maxStep,
      standings: this.standings().map((c) => ({
        id: c.id,
        name: c.driver.name,
        position: this.standings().indexOf(c) + 1,
        distance: c.distance,
        lap: c.lap,
        nextCheckpoint: c.nextCheckpoint,
        checkpoints: c.checkpoints,
        finishTime: c.finishTime,
        speed: c.vel.mag(),
        energy: c.energy,
        overtakes: c.overtakes,
        pos: { x: c.pos.x, y: c.pos.y },
        force: { x: c.lastForce.x, y: c.lastForce.y },
        updates: c.updateCount,
        offset: this.track.nearest(c.pos, c.trackS).distance,
      })),
    };
  }
}
