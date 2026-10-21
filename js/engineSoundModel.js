/* Présentation sonore ; ne commande jamais la locomotion des Vehicle.
   Le temps reçu est celui de la simulation, en secondes. */
class EngineSoundModel {
  static limits = [48, 84, 126, 174, 224, 290]; // km/h à 6 200 tr/min
  static clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
  constructor(speed = 0) {
    this.speed = Math.max(0, Number.isFinite(speed) ? speed : 0);
    this.gear = Math.min(
      6,
      1 +
        EngineSoundModel.limits.slice(0, 5).filter((v) => this.speed * 24 > v)
          .length,
    );
    this.rpm = this.targetRpm(this.speed);
    this.load = 0.3;
    this.shift = 0;
    this.cooldown = 0;
  }
  targetRpm(speed) {
    return EngineSoundModel.clamp(
      1100 + ((speed * 24) / EngineSoundModel.limits[this.gear - 1]) * 5100,
      1100,
      6600,
    );
  }
  step(speed, desiredSpeed, boosting, dt) {
    if (
      !Number.isFinite(speed) ||
      !Number.isFinite(desiredSpeed) ||
      !Number.isFinite(dt) ||
      dt <= 0
    )
      return this.frame();
    dt = Math.min(dt, 0.1);
    speed = Math.max(0, speed);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.shift = Math.max(0, this.shift - dt);
    const kmh = speed * 24;
    if (this.cooldown === 0) {
      const before = this.gear;
      if (this.gear < 6 && kmh > EngineSoundModel.limits[this.gear - 1])
        this.gear++;
      else if (
        this.gear > 1 &&
        kmh < EngineSoundModel.limits[this.gear - 2] * 0.77
      )
        this.gear--;
      if (this.gear !== before) {
        this.shift = 0.13;
        this.cooldown = 0.32;
      }
    }
    const acceleration = (speed - this.speed) / dt;
    const wantedLoad = EngineSoundModel.clamp(
      0.5 +
        (desiredSpeed - speed) * 0.24 +
        acceleration * 0.025 +
        (boosting ? 0.2 : 0),
      0.12,
      1,
    );
    this.load += (wantedLoad - this.load) * (1 - Math.exp(-dt / 0.12));
    this.rpm +=
      (this.targetRpm(speed) - this.rpm) * (1 - Math.exp(-dt / 0.055));
    this.speed = speed;
    return this.frame();
  }
  frame() {
    return {
      gear: this.speed < 0.2 ? 0 : this.gear,
      rpm: this.rpm,
      load: this.load,
      rate: this.rpm / 2600,
      shifting: this.shift > 0,
      gain: (0.56 + this.load * 0.32) * (this.shift > 0 ? 0.42 : 1),
      cutoff: 850 + this.load * 1050 + this.rpm * 0.075,
    };
  }
}
