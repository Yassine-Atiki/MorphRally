class RaceHud {
  constructor(race, actions) {
    this.race = race;
    this.actions = actions;
    this.listeners = [];
    this.$ = (id) => document.getElementById(id);
    this.rows = this.$("leaderboard-rows");
    this.$("debug-sensors").innerHTML = [-60, -30, 0, 30, 60]
      .map(
        (angle) =>
          '<div class="debug-sensor" data-ray="' +
          angle +
          '"><span>' +
          angle +
          '°</span><div class="debug-sensor-track"><i></i></div><b>≥150</b></div>',
      )
      .join("");
    this.$("debug-forces").innerHTML = [
      ["follow", "Suivi"],
      ["edge", "Bord"],
      ["avoid", "Voisins"],
      ["total", "Total appliqué"],
    ]
      .map(
        ([key, label]) =>
          '<div data-force="' +
          key +
          '" style="--force:' +
          RaceDebugRenderer.colors[key] +
          '"><span>' +
          label +
          "</span><i><i></i></i><b>0,000</b></div>",
      )
      .join("");
    this.rows.innerHTML = race.cars
      .map(
        (c) =>
          '<button class="standing" data-car="' +
          c.id +
          '" style="--car:' +
          c.driver.color +
          '"><b>' +
          (c.id + 1) +
          "</b><i></i><span>" +
          c.driver.name +
          "</span><em>—</em></button>",
      )
      .join("");
    this.$("garage-cars").innerHTML = race.cars
      .map(
        (c) =>
          '<button data-car="' +
          c.id +
          '" style="--car:' +
          c.driver.color +
          '" aria-pressed="' +
          (c.id === race.selected) +
          '"><span>' +
          c.driver.number +
          "</span><b>" +
          c.driver.team +
          "</b></button>",
      )
      .join("");
    const points = race.track.points
      .map(
        (p) =>
          (p.x * 0.047 + 84).toFixed(1) + "," + (p.y * 0.047 + 77).toFixed(1),
      )
      .join(" ");
    this.$("map-line").setAttribute("points", points);
    document.querySelector(".minimap>span").textContent =
      "Atlas · " +
      (race.track.length * 0.00011).toFixed(2).replace(".", ",") +
      " km";
    this.$("map-cars").innerHTML = race.cars
      .map(
        (c) =>
          '<circle id="map-car-' +
          c.id +
          '" r="2.3" fill="' +
          c.driver.color +
          '"/>',
      )
      .join("");
    this.bind(this.$("start-race"), "click", () => {
      actions.audio?.unlock();
      actions.resetClock?.();
      race.start();
      this.update();
    });
    this.bind(this.$("pause-race"), "click", () => this.togglePause());
    this.bind(this.$("camera-race"), "click", () => this.toggleCamera());
    this.bind(this.$("restart-race"), "click", actions.restart);
    this.bind(this.$("results-replay"), "click", actions.restart);
    this.bind(this.$("quality-race"), "click", () => {
      race.quality = race.quality === "high" ? "light" : "high";
      actions.quality();
      this.update();
    });
    this.bind(this.$("audio-race"), "click", async () => {
      await actions.audio?.toggle();
      this.update();
    });
    this.bind(this.$("audio-volume"), "input", (e) => {
      actions.audio?.setVolume(Number(e.target.value) / 100);
      this.update();
    });
    this.bind(this.$("debug-race"), "click", () => this.toggleDebug());
    this.bind(this.$("debug-close"), "click", () => this.toggleDebug(false));
    this.bind(this.$("debug-step"), "click", () => {
      race.stepOnce();
      actions.resetClock?.();
      this.update();
    });
    document.querySelectorAll("[data-debug-layer]").forEach((el) =>
      this.bind(el, "click", () => {
        const layer = el.dataset.debugLayer;
        race.debugLayers[layer] = !race.debugLayers[layer];
        this.update();
      }),
    );
    this.bind(this.$("fullscreen-race"), "click", async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen();
      } catch {
        this.$("race-announcement").textContent =
          "Le plein écran est indisponible dans cet aperçu.";
      }
    });
    document.querySelectorAll("[data-car]").forEach((el) =>
      this.bind(el, "click", () => {
        race.selected = Number(el.dataset.car);
        this.update();
      }),
    );
    document.querySelectorAll("[data-strategy]").forEach((el) =>
      this.bind(el, "click", () => {
        race.strategy = el.dataset.strategy;
        this.update();
      }),
    );
    const boost = this.$("boost-race");
    this.bind(boost, "pointerdown", (e) => {
      boost.setPointerCapture(e.pointerId);
      race.boostHeld = true;
    });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
      this.bind(boost, type, () => {
        race.boostHeld = false;
      });
    this.bind(window, "blur", () => {
      race.boostHeld = false;
      if (race.phase === "racing" || race.phase === "countdown")
        race.paused = true;
      actions.audio?.silence();
    });
    this.bind(document, "visibilitychange", () => {
      if (document.hidden) {
        race.boostHeld = false;
        if (race.phase === "racing" || race.phase === "countdown")
          race.paused = true;
        actions.audio?.silence();
      }
    });
    this.bind(window, "keydown", (e) => {
      if (
        e.target.matches('input:not([type="range"]),select,textarea') ||
        e.target.isContentEditable
      ) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (race.phase === "grid") {
          actions.audio?.unlock();
          actions.resetClock?.();
          race.start();
        } else race.boostHeld = true;
      }
      if (e.repeat) return;
      if (e.code === "KeyP") {
        e.preventDefault();
        this.togglePause();
      }
      if (e.code === "KeyC") this.toggleCamera();
      if (e.code === "KeyR") actions.restart();
      if (e.code === "KeyD") {
        e.preventDefault();
        this.toggleDebug();
      }
      if (["Digit1", "Digit2", "Digit3"].includes(e.code))
        race.strategy = ["safe", "balanced", "attack"][
          Number(e.code.slice(-1)) - 1
        ];
    });
    this.bind(window, "keyup", (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        race.boostHeld = false;
      }
    });
    this.resultShown = false;
    this.update();
  }
  bind(element, type, handler) {
    element.addEventListener(type, handler);
    this.listeners.push(() => element.removeEventListener(type, handler));
  }
  togglePause() {
    if (this.race.phase === "racing" || this.race.phase === "countdown")
      this.race.paused = !this.race.paused;
    this.actions.resetClock?.();
    this.actions.audio?.update(this.race);
    this.update();
  }
  toggleCamera() {
    this.race.cameraMode =
      this.race.cameraMode === "chase" ? "aerial" : "chase";
    this.update();
  }
  toggleDebug(enabled = !this.race.debug) {
    this.race.debug = enabled;
    this.update();
  }
  static time(ticks) {
    if (ticks === null) return "—";
    const ms = Math.floor((ticks / 60) * 1000);
    return (
      Math.floor(ms / 60000)
        .toString()
        .padStart(2, "0") +
      ":" +
      Math.floor((ms / 1000) % 60)
        .toString()
        .padStart(2, "0") +
      "." +
      Math.floor((ms % 1000) / 10)
        .toString()
        .padStart(2, "0")
    );
  }
  update(diagnostics) {
    const race = this.race,
      car = race.focus,
      order = race.standings(),
      position = order.indexOf(car) + 1;
    this.$("garage").hidden = race.phase !== "grid";
    this.$("race-ui").classList.toggle("in-garage", race.phase === "grid");
    this.$("race-position").textContent = String(position).padStart(2, "0");
    this.$("lap-number").textContent = Math.min(car.lap + 1, race.laps);
    this.$("race-time").textContent = RaceHud.time(car.finishTime ?? race.tick);
    this.$("lap-time").textContent = RaceHud.time(race.tick - car.lapStart);
    this.$("best-time").textContent = RaceHud.time(
      car.lapTimes.length ? Math.min(...car.lapTimes) : null,
    );
    this.$("car-speed").textContent = Math.round(car.vel.mag() * 24);
    this.$("speed-fill").style.width =
      Math.min(100, (car.vel.mag() / car.maxSpeed) * 100) + "%";
    this.$("gear").textContent = this.actions.audio?.gearFor(car) || "N";
    this.$("energy-fill").style.width = car.energy + "%";
    this.$("boost-percent").textContent = Math.round(car.energy) + "%";
    this.$("boost-race").classList.toggle("active", car.boosting);
    this.$("boost-race").disabled =
      race.phase !== "racing" || race.paused || car.finishTime !== null;
    this.$("pause-race").textContent = race.paused ? "Reprendre" : "Pause";
    this.$("pause-race").setAttribute("aria-pressed", race.paused);
    this.$("camera-race").textContent =
      race.cameraMode === "chase" ? "Vue aérienne" : "Vue poursuite";
    this.$("quality-race").textContent =
      race.quality === "high" ? "Graphismes : élevés" : "Graphismes : légers";
    const audio = this.actions.audio,
      failed = audio?.status === "error" || audio?.status === "unsupported";
    this.$("audio-race").textContent = failed
      ? "Son : indisponible"
      : audio?.enabled
        ? "Son : activé"
        : "Son : coupé";
    this.$("audio-race").setAttribute(
      "aria-pressed",
      !!this.actions.audio?.enabled,
    );
    const volume = Math.round((audio?.volume ?? 0.3) * 100);
    this.$("audio-volume").value = volume;
    this.$("audio-volume").setAttribute("aria-valuetext", volume + " %");
    this.$("audio-volume-value").textContent = volume + " %";
    this.$("focus-name").textContent = car.driver.team;
    this.$("focus-number").textContent = car.driver.number;
    this.$("focus-number").style.color = car.driver.color;
    this.$("race-position").style.color = car.driver.color;
    this.$("leaderboard-title").textContent =
      race.phase === "results" ? "Classement final" : "Classement";
    order.forEach((entry, i) => {
      const row = this.rows.querySelector('[data-car="' + entry.id + '"]');
      row.style.order = i;
      row.classList.toggle("selected", entry.id === race.selected);
      row.querySelector("b").textContent = i + 1;
      row.setAttribute("aria-pressed", entry.id === race.selected);
      const gap =
        (order[0].distance - entry.distance) /
        Math.max(5, entry.vel.mag()) /
        60;
      row.querySelector("em").textContent =
        entry.finishTime !== null
          ? RaceHud.time(entry.finishTime)
          : i === 0
            ? "Leader"
            : "+" + gap.toFixed(1);
      const map = this.$("map-car-" + entry.id);
      map.setAttribute("cx", entry.pos.x * 0.047 + 84);
      map.setAttribute("cy", entry.pos.y * 0.047 + 77);
      map.setAttribute("r", entry.id === race.selected ? "3.6" : "2.3");
    });
    document
      .querySelectorAll("#garage-cars [data-car]")
      .forEach((el) =>
        el.setAttribute(
          "aria-pressed",
          Number(el.dataset.car) === race.selected,
        ),
      );
    document
      .querySelectorAll("[data-strategy]")
      .forEach((el) =>
        el.setAttribute("aria-pressed", el.dataset.strategy === race.strategy),
      );
    const label = this.$("race-announcement");
    label.hidden =
      race.phase === "grid" ||
      (!race.paused &&
        race.phase !== "countdown" &&
        race.tick > race.eventUntil);
    label.textContent = race.paused
      ? "Course en pause"
      : race.phase === "countdown"
        ? String(Math.ceil(race.countdown / 60))
        : race.lastEvent;
    label.classList.toggle(
      "countdown",
      race.phase === "countdown" && !race.paused,
    );
    this.$("results").hidden = race.phase !== "results";
    if (race.phase === "results" && !this.resultShown) {
      this.resultShown = true;
      this.$("results-title").textContent =
        position === 1 ? "Victoire à l’Atlas." : "La course est jouée.";
      this.$("results-summary").textContent =
        "P" +
        position +
        " · " +
        car.driver.team +
        " · " +
        RaceHud.time(car.finishTime);
      this.$("results-body").innerHTML = order
        .map(
          (c, i) =>
            "<tr" +
            (c.id === race.selected ? ' class="you"' : "") +
            "><td>" +
            (i + 1) +
            '</td><td><i style="background:' +
            c.driver.color +
            '"></i>' +
            c.driver.name +
            "<small>" +
            c.driver.team +
            "</small></td><td>" +
            RaceHud.time(c.finishTime) +
            "</td><td>" +
            RaceHud.time(Math.min(...c.lapTimes)) +
            "</td></tr>",
        )
        .join("");
    }
    this.updateDebug(diagnostics ?? this.actions.inspect?.());
  }
  updateDebug(data) {
    const race = this.race;
    this.$("race-ui").classList.toggle("debug-mode", race.debug);
    this.$("debug-inspector").hidden = !race.debug;
    this.$("debug-race").setAttribute("aria-pressed", race.debug);
    this.$("debug-race").setAttribute("aria-expanded", race.debug);
    if (!race.debug || !data) return;
    this.$("debug-car-number").textContent = data.number;
    this.$("debug-car-name").textContent = data.name + " · " + data.team;
    data.rays.forEach((ray) => {
      const row = this.$("debug-sensors").querySelector(
        '[data-ray="' + ray.degrees + '"]',
      );
      row.dataset.hit = ray.hit ? "true" : "false";
      row.dataset.danger = ray.distance < 45 ? "true" : "false";
      row.querySelector("i").style.height = ray.value * 100 + "%";
      row.querySelector("b").textContent = ray.hit
        ? Math.round(ray.distance)
        : "≥150";
      row.title =
        ray.degrees +
        "° : " +
        (ray.hit
          ? "mur à " + ray.distance.toFixed(1) + " unités"
          : "aucun mur avant 150 unités");
    });
    Object.entries(data.forces).forEach(([key, force]) => {
      const row = this.$("debug-forces").querySelector(
          '[data-force="' + key + '"]',
        ),
        magnitude = Math.hypot(force.x, force.y);
      row.querySelector("b").textContent = magnitude
        .toFixed(3)
        .replace(".", ",");
      row.querySelector("i>i").style.width =
        Math.min(100, (magnitude / data.maxForce) * 100) + "%";
    });
    const reasons = {
      waiting: "En attente du premier pas",
      traffic: "Régulation derrière une voiture",
      corner: "Allure limitée par le virage",
      boost: "Boost sur portion droite",
      cruise: "Maintien de l’allure",
    };
    const reason =
      Math.hypot(data.forces.edge.x, data.forces.edge.y) > 0.001
        ? "Évitement du bord"
        : Math.hypot(data.forces.avoid.x, data.forces.avoid.y) > 0.001
          ? "Évitement d’un voisin"
          : reasons[data.reason];
    this.$("debug-decision").textContent = reason;
    this.$("debug-speed").textContent =
      Math.round(data.speed * 24) +
      " / " +
      Math.round(data.desiredSpeed * 24) +
      " km/h";
    this.$("debug-wall").textContent =
      data.wallClearance.toFixed(1).replace(".", ",") + " u";
    this.$("debug-neighbors").textContent =
      data.neighbors.length +
      " / " +
      data.neighbors.filter((n) => n.threat).length;
    this.$("debug-lane").textContent =
      Math.round(data.lane) + " / " + Math.round(data.targetLane) + " u";
    this.$("debug-step-label").textContent =
      (race.paused ? "En pause · " : "") + "pas " + data.step;
    this.$("debug-step").disabled =
      !race.paused || !["countdown", "racing"].includes(race.phase);
    document
      .querySelectorAll("[data-debug-layer]")
      .forEach((el) =>
        el.setAttribute(
          "aria-pressed",
          race.debugLayers[el.dataset.debugLayer],
        ),
      );
  }
  destroy() {
    this.listeners.splice(0).forEach((off) => off());
  }
}
