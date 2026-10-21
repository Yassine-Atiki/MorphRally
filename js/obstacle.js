class Obstacle extends Vehicle {
  constructor(x, y, radius = 22, id = "obstacle", shape = null) {
    super(x, y);
    this.id = id;
    this.r = radius;
    this.active = true;
    this.shape = shape;
    this.mobile = false;
    this.heading = 0;
    this.lastForce = createVector(0, 0);
    this.diagnostics = {};
  }
  snapshot() {
    if (this.shape)
      return {
        id: this.id,
        shape: "segment",
        a: this.pos.copy().add(this.shape.a),
        b: this.pos.copy().add(this.shape.b),
        thickness: this.r,
        pos: this.pos.copy(),
        vel: this.vel.copy(),
      };
    return {
      id: this.id,
      shape: "circle",
      pos: this.pos.copy(),
      vel: this.vel.copy(),
      radius: this.r,
    };
  }
}
