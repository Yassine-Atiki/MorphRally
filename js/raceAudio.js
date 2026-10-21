/* Enregistrement local de qubodup, CC BY 3.0 : assets/audio/CREDITS.md.
   Graphe fixe après interaction ; aucun oscillateur ni source créée par draw(). */
class RaceAudio {
  constructor() {
    this.enabled = true;
    this.volume = 0.3;
    this.context = null;
    this.voices = [];
    this.nodes = [];
    this.models = new Map();
    this.closed = false;
    this.status = "idle";
    this.sampleUrl = "assets/audio/engine-gt.wav";
    this.resetNitro();
  }
  async unlock() {
    if (this.closed) return false;
    try {
      if (!this.context) {
        const Context = window.AudioContext || window.webkitAudioContext;
        if (!Context) {
          this.status = "unsupported";
          this.enabled = false;
          return false;
        }
        this.context = new Context();
        this.createOutput(this.context);
      }
      // resume reste lié au geste, avant le téléchargement.
      const resumed =
        this.enabled && this.context.state !== "running"
          ? this.context.resume()
          : Promise.resolve();
      if (!this.loading && !this.voices.length) {
        this.status = "loading";
        this.loading = this.loadSample().finally(() => {
          this.loading = null;
        });
      }
      await Promise.all([resumed, this.loading]);
      return !this.closed && this.status === "ready";
    } catch {
      // Un fichier absent ne bloque pas le départ et ne déclenche pas un bip.
      if (!this.closed) {
        this.status = "error";
        this.silence();
      }
      return false;
    }
  }
  async loadSample() {
    const response = await fetch(this.sampleUrl);
    if (!response.ok) throw new Error("Enregistrement moteur indisponible");
    const decoded = await this.context.decodeAudioData(
      await response.arrayBuffer(),
    );
    if (this.closed) return;
    this.createVoices(RaceAudio.prepareLoop(this.context, decoded));
    this.status = "ready";
  }
  static prepareLoop(context, decoded) {
    // Mono pour le placement spatial ; recouvrement de 60 ms à la jointure.
    // Le WAV crédité est conservé à l'identique.
    const fade = Math.min(
      Math.round(decoded.sampleRate * 0.06),
      Math.floor(decoded.length / 4),
    );
    const length = decoded.length - fade,
      mono = new Float32Array(decoded.length);
    for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
      const data = decoded.getChannelData(channel);
      for (let i = 0; i < mono.length; i++)
        mono[i] += data[i] / decoded.numberOfChannels;
    }
    const mean = mono.reduce((sum, value) => sum + value, 0) / mono.length;
    const buffer = context.createBuffer(1, length, decoded.sampleRate),
      data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      const value =
        i < fade
          ? mono[length + i] * (1 - i / fade) + mono[i] * (i / fade)
          : mono[i];
      data[i] = value - mean;
    }
    return buffer;
  }
  keep(node) {
    this.nodes.push(node);
    return node;
  }
  createOutput(context) {
    this.context = context;
    this.bus = this.keep(context.createBiquadFilter());
    this.bus.type = "highpass";
    this.bus.frequency.value = 32;
    this.bus.Q.value = 0.5;
    this.warmth = this.keep(context.createBiquadFilter());
    this.warmth.type = "highshelf";
    this.warmth.frequency.value = 1800;
    this.warmth.gain.value = -8;
    this.compressor = this.keep(context.createDynamicsCompressor());
    this.compressor.threshold.value = -14;
    this.compressor.knee.value = 8;
    this.compressor.ratio.value = 5;
    this.compressor.attack.value = 0.008;
    this.compressor.release.value = 0.16;
    this.master = this.keep(context.createGain());
    this.master.gain.value = 0;
    this.analyser = this.keep(context.createAnalyser());
    this.analyser.fftSize = 2048;
    this.bus.connect(this.warmth);
    this.warmth.connect(this.compressor);
    this.compressor.connect(this.master);
    this.master.connect(this.analyser);
    this.analyser.connect(context.destination);
  }
  createVoices(buffer) {
    for (let i = 0; i < 8; i++) {
      const source = this.keep(this.context.createBufferSource()),
        filter = this.keep(this.context.createBiquadFilter());
      const gain = this.keep(this.context.createGain()),
        pan = this.keep(this.context.createStereoPanner());
      source.buffer = buffer;
      source.loop = true;
      source.playbackRate.value = 0.43;
      filter.type = "lowpass";
      filter.frequency.value = 1600;
      filter.Q.value = 0.5;
      gain.gain.value = 0;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(pan);
      pan.connect(this.bus);
      source.start(0, (i * 0.37) % buffer.duration);
      this.voices.push({ source, filter, gain, pan });
    }
    // Souffle feutré du boost et du roulement, sans tonalité aiguë.
    const noise = this.context.createBuffer(
        1,
        this.context.sampleRate * 2,
        this.context.sampleRate,
      ),
      data = noise.getChannelData(0);
    let seed = 3181;
    for (let i = 0; i < data.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      data[i] = seed / 2147483648 - 1;
    }
    this.air = this.keep(this.context.createBufferSource());
    this.air.buffer = noise;
    this.air.loop = true;
    this.airFilter = this.keep(this.context.createBiquadFilter());
    this.airFilter.type = "lowpass";
    this.airFilter.frequency.value = 700;
    this.airFilter.Q.value = 0.5;
    this.airGain = this.keep(this.context.createGain());
    this.airGain.gain.value = 0;
    this.air.connect(this.airFilter);
    this.airFilter.connect(this.airGain);
    this.airGain.connect(this.bus);
    this.air.start();
    // Une dixième source fixe, distincte du roulement. Le balayage du
    // filtre et l'enveloppe donnent une attaque de nitro, sans sifflet tonal.
    const source = this.keep(this.context.createBufferSource());
    const filter = this.keep(this.context.createBiquadFilter());
    const softener = this.keep(this.context.createBiquadFilter());
    const gain = this.keep(this.context.createGain());
    source.buffer = noise;
    source.loop = true;
    filter.type = "bandpass";
    filter.frequency.value = 1100;
    filter.Q.value = 0.55;
    softener.type = "lowpass";
    softener.frequency.value = 2800;
    softener.Q.value = 0.5;
    gain.gain.value = 0;
    source.connect(filter);
    filter.connect(softener);
    softener.connect(gain);
    gain.connect(this.bus);
    source.start(0, 0.83);
    this.nitro = { source, filter, softener, gain };
  }
  resetNitro() {
    this.nitroBoosting = false;
    this.nitroFocus = null;
    this.nitroMixActive = false;
    this.nitroSounding = false;
    this.lastNitroStart = -Infinity;
    this.nitroStarts = 0;
  }
  planNitro(frame, time) {
    const active = !!frame.active && this.enabled;
    const boosting = !!frame.nitro?.boosting;
    const focus = frame.nitro?.carId ?? null;
    const switched = this.nitroFocus !== null && this.nitroFocus !== focus;
    const rising = boosting && !this.nitroBoosting;
    const resuming = active && !this.nitroMixActive;
    let action = "none";
    if (!active) {
      if (this.nitroSounding) action = "release";
    } else if (boosting) {
      // Le délai empêche le mitraillage lorsque la réserve est presque vide.
      if (rising && !switched && time - this.lastNitroStart >= 0.65) {
        action = "attack";
        this.lastNitroStart = time;
        this.nitroStarts++;
      } else if (rising || switched || resuming) action = "sustain";
    } else if (this.nitroSounding) action = "release";
    this.nitroSounding = active && boosting;
    this.nitroBoosting = boosting;
    this.nitroFocus = focus;
    this.nitroMixActive = active;
    return action;
  }
  applyNitro(action, time) {
    if (!this.nitro || action === "none") return;
    const gain = this.nitro.gain.gain, frequency = this.nitro.filter.frequency;
    gain.cancelAndHoldAtTime(time);
    frequency.cancelAndHoldAtTime(time);
    if (action === "attack") {
      gain.setValueAtTime(0, time);
      gain.linearRampToValueAtTime(1.05, time + 0.035);
      gain.exponentialRampToValueAtTime(0.38, time + 0.28);
      frequency.setValueAtTime(500, time);
      frequency.exponentialRampToValueAtTime(1900, time + 0.13);
      frequency.exponentialRampToValueAtTime(1100, time + 0.32);
    } else if (action === "sustain") {
      gain.setTargetAtTime(0.38, time, 0.055);
      frequency.setTargetAtTime(1100, time, 0.06);
    } else {
      gain.setTargetAtTime(0, time, 0.035);
      gain.setValueAtTime(0, time + 0.24);
    }
  }
  reset() {
    this.silence();
    this.resetNitro();
    this.models.clear();
    this.race = null;
    this.lastFrame = null;
  }
  setVolume(value) {
    if (!Number.isFinite(value)) return;
    this.volume = EngineSoundModel.clamp(value, 0, 1);
    if (this.master && !this.closed)
      this.master.gain.setTargetAtTime(
        this.active ? this.volume * 0.42 : 0,
        this.context.currentTime,
        0.025,
      );
  }
  async toggle() {
    if (this.status === "error") {
      this.enabled = true;
      await this.unlock();
      return;
    }
    this.enabled = !this.enabled;
    if (this.enabled) await this.unlock();
    else this.silence();
  }
  silence() {
    this.active = false;
    if (this.context && !this.closed) this.applyNitro("release", this.context.currentTime);
    this.nitroSounding = false;
    this.nitroMixActive = false;
    if (this.master && !this.closed) {
      this.master.gain.cancelScheduledValues(this.context.currentTime);
      this.master.gain.setTargetAtTime(0, this.context.currentTime, 0.015);
    }
  }
  frameFor(race) {
    const fresh = this.race !== race || race.tick < this.lastTick;
    if (fresh) {
      this.models.clear();
      this.race = race;
      this.lastTick = race.tick;
    }
    const dt = race.paused
      ? 0
      : Math.min(0.1, Math.max(0, race.tick - this.lastTick) / 60);
    this.lastTick = race.tick;
    const focus = race.focus,
      forward = { x: Math.cos(focus.heading), y: Math.sin(focus.heading) };
    const nearby = race.cars
      .filter((c) => c !== focus)
      .map((c) => ({ id: c.id, distance: c.pos.dist(focus.pos) }))
      .filter((c) => c.distance < 260)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3);
    const audible = new Map(nearby.map((c) => [c.id, c.distance]));
    const voices = race.cars.map((car) => {
      if (!this.models.has(car.id))
        this.models.set(car.id, new EngineSoundModel(car.vel.mag()));
      const engine = this.models
        .get(car.id)
        .step(car.vel.mag(), car.desiredSpeed, car.boosting, dt);
      const distance = audible.get(car.id),
        followed = car === focus;
      const gain = followed
        ? engine.gain
        : distance === undefined
          ? 0
          : (engine.gain * 0.13) / (1 + (distance / 65) ** 2);
      const lateral =
        (car.pos.x - focus.pos.x) * -forward.y +
        (car.pos.y - focus.pos.y) * forward.x;
      return {
        ...engine,
        rate: engine.rate * (0.97 + car.id * 0.009),
        gain,
        cutoff: engine.cutoff * (followed ? 1 : 0.68),
        pan: followed ? 0 : EngineSoundModel.clamp(lateral / 100, -0.85, 0.85),
      };
    });
    return {
      active: this.enabled && !race.paused && race.phase === "racing",
      voices,
      air: Math.min(0.018, (focus.vel.mag() / 12) ** 2 * 0.018),
      nitro: { boosting: !!focus.boosting, carId: focus.id },
    };
  }
  gearFor(car) {
    return (
      this.models.get(car.id)?.frame().gear ?? (car.vel.mag() < 0.2 ? 0 : 1)
    );
  }
  update(race) {
    if (this.closed) return;
    this.lastFrame = this.frameFor(race);
    if (this.voices.length) this.applyFrame(this.lastFrame);
  }
  applyFrame(frame, time = this.context.currentTime) {
    this.applyNitro(this.planNitro(frame, time), time);
    this.active = frame.active && this.enabled;
    this.master.gain.setTargetAtTime(
      this.active ? this.volume * 0.42 : 0,
      time,
      this.active ? 0.04 : 0.015,
    );
    if (!this.active) return;
    this.voices.forEach((voice, i) => {
      const state = frame.voices[i];
      voice.source.playbackRate.setTargetAtTime(
        EngineSoundModel.clamp(state.rate, 0.35, 2.7),
        time,
        0.045,
      );
      voice.filter.frequency.setTargetAtTime(state.cutoff, time, 0.08);
      voice.gain.gain.setTargetAtTime(state.gain, time, 0.035);
      voice.pan.pan.setTargetAtTime(state.pan, time, 0.06);
    });
    this.airGain.gain.setTargetAtTime(frame.air, time, 0.09);
  }
  destroy() {
    if (this.closed) return;
    this.silence();
    this.closed = true;
    for (const voice of this.voices) voice.source.stop();
    this.air?.stop();
    this.nitro?.source.stop();
    this.nitro = null;
    this.nodes.forEach((node) => node.disconnect());
    this.voices.length = 0;
    this.nodes.length = 0;
    this.models.clear();
    if (this.context && this.context.state !== "closed")
      this.context.close().catch(() => {});
  }
}
