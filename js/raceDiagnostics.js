/* Observation pure, indépendante des forces. Les sondes sont des mesures
   de diagnostic : elles ne remplacent pas la perception Reynolds du pilote.
   Les forces, voisins et prédictions proviennent du dernier pas réel. */
class RaceDiagnostics {
  static capture(race) {
    const car = race.focus,
      track = race.track,
      decision = car.diagnostics;
    const point = (v) => ({ x: v.x, y: v.y });
    const pose = point(car.pos),
      heading = car.heading;
    const walls = track.grid.query(car.pos, 150);
    const rays = [-60, -30, 0, 30, 60].map((degrees) => {
      const sensor = new RaySensor((degrees * Math.PI) / 180, 150);
      sensor.sense(car.pos, heading, walls);
      return {
        degrees,
        origin: point(sensor.origin),
        end: point(sensor.end),
        distance: sensor.distance,
        range: sensor.range,
        value: sensor.value,
        hit: sensor.hit,
      };
    });
    const near = track.nearest(car.pos, car.trackS);
    const d = decision.forces ? decision : null;
    const zero = { x: 0, y: 0 };
    const forces = Object.fromEntries(
      ["follow", "edge", "avoid", "total"].map((key) => [
        key,
        point(d?.forces[key] ?? zero),
      ]),
    );
    const neighbors = (d?.neighbors ?? []).map((n) => ({
      id: n.id,
      pos: point(n.pos),
      radius: n.radius,
      time: n.time,
      closestDistance: n.closestDistance,
      clearance: n.clearance,
      threat: n.threat,
      selfFuture: point(n.selfFuture),
      otherFuture: point(n.otherFuture),
    }));
    const planned = [],
      left = [],
      right = [];
    const safeRadius = track.radius - car.r - 1;
    for (let ahead = 0; ahead <= 240; ahead += 16) {
      planned.push(point(track.lanePoint(near.s + ahead, car.lane)));
      left.push(point(track.lanePoint(near.s + ahead, -safeRadius)));
      right.push(point(track.lanePoint(near.s + ahead, safeRadius)));
    }
    const checkpoint = track.checkpoint(car.nextCheckpoint);
    const data = {
      tick: race.tick,
      id: car.id,
      number: car.driver.number,
      name: car.driver.name,
      team: car.driver.team,
      pose,
      heading,
      radius: car.r,
      velocity: point(car.vel),
      speed: car.vel.mag(),
      desiredSpeed: car.desiredSpeed,
      maxForce: car.maxForce,
      maxSpeed: car.maxSpeed,
      step: d?.step ?? 0,
      origin: point(d?.origin ?? pose),
      target: point(d?.target ?? car.lastTarget),
      prediction: point(d?.prediction ?? pose),
      desiredVelocity: point(d?.desiredVelocity ?? zero),
      forces,
      neighbors,
      rays,
      planned,
      left,
      right,
      offset: track.signedOffset(car.pos, near),
      wallClearance: track.radius - near.distance - car.r - 1,
      lane: car.lane,
      targetLane: d?.laneTarget ?? car.targetLane,
      reason: d?.reason ?? "waiting",
      danger: d?.danger ?? 0,
      curvature: d?.curvature ?? 0,
      trafficLimiter: d?.trafficLimiter ? { ...d.trafficLimiter } : null,
      checkpoint: {
        index: car.nextCheckpoint,
        position: point(checkpoint.pos),
      },
      contactCount: car.contactCount,
      boosting: car.boosting,
      limits: {
        sensorRange: 150,
        sensorAngle: 120,
        edgeHorizon: 12,
        neighborHorizon: 16,
        neighborRange: 130,
        safeCorridor: safeRadius,
      },
    };
    return RaceDiagnostics.freeze(data);
  }
  static freeze(value) {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      Object.values(value).forEach((item) => RaceDiagnostics.freeze(item));
      Object.freeze(value);
    }
    return value;
  }
}
