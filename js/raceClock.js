/* Horloge fixe : les forces et Vehicle conservent leurs unités par pas.
   Le rendu peut tourner à 30 Hz, la simulation avance à 60 pas/s.
   Une interruption ne rattrape jamais plus de 100 ms (six pas). */
class RaceClock {
  constructor() {
    this.stepMs = 1000 / 60;
    this.accumulator = 0;
  }
  reset() {
    this.accumulator = 0;
  }
  advance(scene, elapsedMs) {
    if (scene.paused || scene.phase === "grid" || scene.phase === "results") {
      this.reset();
      return 0;
    }
    const elapsed = Number.isFinite(elapsedMs)
      ? Geometry.clamp(elapsedMs, 0, 100)
      : 0;
    this.accumulator += elapsed;
    let steps = 0;
    while (this.accumulator + 1e-8 >= this.stepMs && steps < 6) {
      scene.step();
      this.accumulator = Math.max(0, this.accumulator - this.stepMs);
      steps++;
    }
    return steps;
  }
}
