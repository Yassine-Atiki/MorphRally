/* Monde 3D original, construit une fois. Ce service lit la simulation sans
   modifier positions, vitesses, fitness, hasard ni états de course. */
class RaceRenderer3D {
  constructor(race) {
    this.track = race.track;
    this.materials = new RaceMaterials();
    this.sky = new RaceMesh();
    this.buildSky();
    this.terrain = new RaceMesh();
    this.road = new RaceMesh();
    this.scenery = new RaceMesh();
    this.forest = new RaceMesh();
    this.forestLite = new RaceMesh();
    this.cars = race.cars.map((c) => this.buildCar(c.driver));
    this.eye = null;
    this.look = null;
    this.cameraMode = null;
    this.wheelStates = new WeakMap();
    this.lastFrameMs = 0;
    this.buildWorld();
    this.signs = [];
    this.createSigns();
  }
  static hash(x, z) {
    const v = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
    return v - Math.floor(v);
  }
  buildSky() {
    const radius = 12000,
      rows = 16,
      columns = 64;
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < columns; i++) {
        const point = (a, b) => {
          const phi = -0.15 + (b / rows) * Math.PI * 0.55,
            theta = (a / columns) * Math.PI * 2;
          return [
            Math.cos(theta) * Math.cos(phi) * radius,
            Math.sin(phi) * radius,
            Math.sin(theta) * Math.cos(phi) * radius,
          ];
        };
        const q = j / rows,
          color = [0.77 - q * 0.41, 0.83 - q * 0.29, 0.83 - q * 0.12, 1];
        this.sky.quad(
          point(i, j),
          point(i + 1, j),
          point(i + 1, j + 1),
          point(i, j + 1),
          color,
        );
      }
    this.sky.geometry.vertices.forEach((v, i) => {
      const t = Geometry.clamp((-v.y / radius - 0.02) / 0.9, 0, 1);
      this.sky.geometry.vertexColors.splice(
        i * 4,
        4,
        0.7 - t * 0.4,
        0.8 - t * 0.28,
        0.84 - t * 0.1,
        1,
      );
    });
  }
  ribbon(mesh, s1, s2, from, to, h, color) {
    const a = this.track.lanePoint(s1, from),
      b = this.track.lanePoint(s1, to),
      c = this.track.lanePoint(s2, to),
      d = this.track.lanePoint(s2, from);
    mesh.quad(
      [a.x, h, a.y],
      [b.x, h, b.y],
      [c.x, h, c.y],
      [d.x, h, d.y],
      color,
      [0, -1, 0],
    );
  }
  rail(s1, s2, lane, color, height = 6) {
    const a = this.track.lanePoint(s1, lane),
      b = this.track.lanePoint(s2, lane);
    this.scenery.quad(
      [a.x, 1, a.y],
      [a.x, height, a.y],
      [b.x, height, b.y],
      [b.x, 1, b.y],
      color,
    );
    const n = this.track.normalAt(s1).mult(lane > 0 ? 1 : -1);
    this.scenery.quad(
      [a.x, height, a.y],
      [a.x + n.x * 2, height, a.y + n.y * 2],
      [b.x + n.x * 2, height, b.y + n.y * 2],
      [b.x, height, b.y],
      color,
      [0, -1, 0],
    );
  }
  buildWorld() {
    const t = this.track,
      L = t.length;
    // Relief continu à 14 km de bord à bord ; l'eau prolonge la côte.
    const size = 7000,
      step = 125;
    const sample = (x, z) => {
      const near = t.nearest({ x, y: z }),
        distance = near.distance;
      const wave =
        (Math.sin(x * 0.0014 + z * 0.0017) +
          Math.cos(z * 0.0023 - x * 0.0012) +
          2) *
        90;
      const mountain = Math.max(0, distance - 200) * 0.14;
      let h =
        (wave + mountain) * Math.min(1, Math.max(0, distance - 280) / 750) - 1;
      const sea = Geometry.clamp((x - 1650) / 480, 0, 1);
      h = h * (1 - sea) - 43 * sea;
      return { p: [x, h, z], h, sea, distance, s: near.s };
    };
    const rows = [];
    for (let x = -size; x <= size; x += step) {
      const row = [];
      for (let z = -size; z <= size; z += step) row.push(sample(x, z));
      rows.push(row);
    }
    for (let i = 0; i < rows.length - 1; i++)
      for (let j = 0; j < rows[i].length - 1; j++) {
        const a = rows[i][j],
          b = rows[i][j + 1],
          c = rows[i + 1][j + 1],
          d = rows[i + 1][j];
        const noise = RaceRenderer3D.hash(i, j),
          avg = (a.h + b.h + c.h + d.h) / 4;
        const color =
          avg > 220
            ? [0.46 + noise * 0.06, 0.43 + noise * 0.04, 0.38 + noise * 0.04, 1]
            : avg > 55
              ? [
                  0.56 + noise * 0.08,
                  0.47 + noise * 0.05,
                  0.35 + noise * 0.03,
                  1,
                ]
              : [
                  0.55 + noise * 0.06,
                  0.52 + noise * 0.05,
                  0.37 + noise * 0.04,
                  1,
                ];
        this.terrain.quad(a.p, b.p, c.p, d.p, color);
      }
    // Surface marine, reflets discrets construits en géométrie statique.
    this.terrain.quad(
      [1800, -25, -9000],
      [1800, -25, 9000],
      [11000, -25, 9000],
      [11000, -25, -9000],
      "#3e8299",
      [0, -1, 0],
    );
    for (let i = 0; i < 240; i++) {
      const x = 2050 + RaceRenderer3D.hash(i, 4) * 6500,
        z = (RaceRenderer3D.hash(i, 6) - 0.5) * 15000;
      this.terrain.quad(
        [x, -24, z],
        [x, -24, z + 2],
        [x + 40 + RaceRenderer3D.hash(i, 3) * 130, -24, z + 2],
        [x + 45, -24, z],
        "#67a3ae",
        [0, -1, 0],
      );
    }
    const pieces = Math.ceil(L / 17);
    for (let i = 0; i < pieces; i++) {
      const s = (i * L) / pieces,
        next = ((i + 1) * L) / pieces;
      this.ribbon(this.road, s, next, 98, -98, 0.55, "#b2aa95");
      this.ribbon(this.road, s, next, 84, -84, 0.7, "#6d8977");
      this.ribbon(this.road, s, next, 78, -78, 1, "#39434c");
      for (const side of [-1, 1]) {
        this.ribbon(
          this.road,
          s,
          next,
          side * 78,
          side * 86,
          1.1,
          i % 4 < 2 ? "#df6255" : "#e5e1d8",
        );
        this.ribbon(
          this.road,
          s,
          next,
          side * 72,
          side * 73.2,
          1.14,
          "#dadbcf",
        );
        this.rail(s, next, side * 89, i % 8 < 4 ? "#c8c8bc" : "#e26d58", 5.8);
      }
      // Marquage de la ligne des stands sur la longue ligne droite.
      if (s < 1550 && i % 6 < 3)
        this.ribbon(this.road, s, next, 48, 49.5, 1.15, "#d4d7cc");
      if (i % 3 === 0)
        for (const side of [-1, 1]) {
          const p = t.lanePoint(s, side * 91);
          this.scenery.box(p.x, 0, p.y, 2.5, 11, 2.5, "#57636a");
        }
      if (t.curvature(s) > 0.003)
        for (const lane of [-29, -17, 17, 29])
          this.ribbon(this.road, s, next, lane, lane + 0.7, 1.18, "#2e3942");
    }
    // Damier et huit emplacements de grille.
    for (let row = 0; row < 2; row++)
      for (let col = 0; col < 20; col++)
        this.ribbon(
          this.road,
          row * 6,
          (row + 1) * 6,
          70 - col * 7,
          63 - col * 7,
          1.22,
          (row + col) % 2 ? "#f0eee0" : "#1d2934",
        );
    for (let i = 0; i < 8; i++) {
      const s = -45 - Math.floor(i / 2) * 65,
        lane = (i % 2 ? 1 : -1) * 23;
      this.ribbon(
        this.road,
        s - 18,
        s - 16,
        lane - 10,
        lane + 10,
        1.2,
        "#d8d8cc",
      );
      this.ribbon(
        this.road,
        s - 18,
        s + 15,
        lane - 11,
        lane - 10,
        1.2,
        "#d8d8cc",
      );
      this.ribbon(
        this.road,
        s - 18,
        s + 15,
        lane + 10,
        lane + 11,
        1.2,
        "#d8d8cc",
      );
    }
    // Stands, paddock et tribunes à la ligne droite.
    for (let i = 0; i < 10; i++) {
      const p = t.lanePoint(90 + i * 95, 155);
      this.scenery.box(p.x, 0, p.y, 87, 38, 58, "#b1b5b0");
      this.scenery.box(p.x, 38, p.y, 91, 5, 63, "#e7e2d1");
      this.scenery.box(p.x, 8, p.y - 30, 72, 21, 1, "#263c4c");
      this.scenery.box(
        p.x,
        30,
        p.y - 30,
        72,
        3,
        2,
        i % 2 ? "#23bdbb" : "#ef8864",
      );
      for (let j = 0; j < 4; j++)
        this.scenery.box(p.x - 27 + j * 18, 10, p.y - 31, 1, 19, 1, "#b4b6a8");
    }
    for (let i = 0; i < 5; i++) {
      const p = t.lanePoint(60 + i * 165, -165);
      for (let tier = 0; tier < 5; tier++) {
        this.scenery.box(
          p.x,
          0,
          p.y - tier * 7,
          146,
          7 + tier * 5,
          8,
          "#6a777c",
        );
        for (let j = 0; j < 25; j++) {
          const shade = ["#e1d2af", "#d86d53", "#477a90", "#e4e7de", "#597b69"][
            Math.floor(RaceRenderer3D.hash(j + i * 25, tier) * 5)
          ];
          this.scenery.box(
            p.x - 68 + j * 5.6,
            8 + tier * 5,
            p.y - tier * 7,
            2.3,
            4,
            2.5,
            shade,
          );
        }
      }
      this.scenery.box(p.x - 73, 0, p.y - 16, 2, 54, 2, "#899a9d");
      this.scenery.box(p.x + 73, 0, p.y - 16, 2, 54, 2, "#899a9d");
      this.scenery.box(p.x, 54, p.y - 16, 153, 3, 48, "#c1b5a0");
    }
    // Portiques : structure physique hors chaussée, signalétique originale.
    for (const s of [5, L * 0.3, L * 0.63]) {
      for (const side of [-1, 1]) {
        const p = t.lanePoint(s, side * 99);
        this.scenery.box(p.x, 0, p.y, 6, 72, 6, "#536674");
      }
    }
    // Éléments de paysage : pins, rochers, arbustes. Jamais sur le ruban routier.
    for (let i = 0; i < 1300; i++) {
      const x = -2450 + RaceRenderer3D.hash(i, 23) * 4300,
        z = -2000 + RaceRenderer3D.hash(i, 47) * 3600;
      const p = sample(x, z);
      if (
        p.distance < 112 ||
        p.sea > 0.2 ||
        (p.s < 1400 && p.distance < 300) ||
        (p.s > L - 300 && p.distance < 230)
      )
        continue;
      const h = p.h,
        n = RaceRenderer3D.hash(i, 41);
      for (const mesh of i % 4 === 0
        ? [this.forest, this.forestLite]
        : [this.forest]) {
        if (n < 0.69) {
          const r = 12 + RaceRenderer3D.hash(i, 11) * 18;
          mesh.box(x, h, z, 3, r * 1.3, 3, "#605b46");
          mesh.cone(
            x,
            h + r * 0.5,
            z,
            r,
            r * 1.8,
            n < 0.3 ? "#375f50" : "#4a6c54",
          );
          mesh.cone(x, h + r * 1.2, z, r * 0.72, r * 1.25, "#53765b");
        } else if (n < 0.88) {
          const r = 10 + RaceRenderer3D.hash(i, 18) * 28;
          mesh.cone(x, h, z, r, r * 0.9, "#9e937d", 5);
        } else mesh.cone(x, h, z, 7, 5, "#718061", 7);
      }
    }
    // Virages signalés et poteaux de freinage.
    for (let s = 900; s < L; s += 310) {
      if (t.turnSeverity(s) < 0.004) continue;
      const p = t.lanePoint(s, -106);
      this.scenery.box(p.x, 0, p.y, 3, 25, 3, "#556473");
      this.scenery.box(p.x, 21, p.y, 22, 13, 2, "#e9c46b");
    }
    // Ferme de montagne et tour d'observation.
    for (const [s, lane] of [
      [L * 0.44, -240],
      [L * 0.68, 250],
      [L * 0.84, -230],
    ]) {
      const p = t.lanePoint(s, lane),
        h = sample(p.x, p.y).h;
      for (let i = 0; i < 3; i++) {
        this.scenery.box(p.x + i * 66, h, p.y, 58, 31 + i * 7, 45, "#cfb79a");
        this.scenery.box(
          p.x + i * 66,
          h + 31 + i * 7,
          p.y,
          64,
          4,
          51,
          "#b67154",
        );
        for (let j = 0; j < 3; j++)
          this.scenery.box(
            p.x - 17 + i * 66 + j * 17,
            h + 13,
            p.y - 23,
            8,
            10,
            1,
            "#415465",
          );
      }
    }
  }
  buildCar(driver) {
    const body = new RaceMesh(),
      glass = new RaceMesh(),
      trim = new RaceMesh(),
      lights = new RaceMesh(),
      wheel = new RaceMesh();
    const paint = driver.color,
      dark = "#172630",
      carbon = "#24313a",
      silver = "#a9b9bc";
    // GT à moteur avant, empattement 22, longueur 39, voie 17.
    body.loft(
      [
        { x: -20, base: 3.3, top: 6.1, width: 7.4 },
        { x: -17, base: 3.1, top: 7.7, width: 8.4 },
        { x: -11, base: 3.1, top: 8.7, width: 9 },
        { x: -6, base: 3.0, top: 7.9, width: 8.1 },
        { x: 3, base: 3.0, top: 7.7, width: 8 },
        { x: 10, base: 3.1, top: 8.4, width: 9 },
        { x: 15, base: 3.2, top: 7.1, width: 8.6 },
        { x: 20, base: 3.6, top: 5.5, width: 7.2 },
      ],
      paint,
    );
    for (const z of [-8.1, 8.1]) {
      for (const x of [-11, 11])
        for (let i = 0; i < 12; i++) {
          const a = (i * Math.PI) / 12,
            c = ((i + 1) * Math.PI) / 12;
          trim.quad(
            [x + Math.cos(a) * 4.2, 3.8 + Math.sin(a) * 4.2, z * 1.08],
            [x + Math.cos(c) * 4.2, 3.8 + Math.sin(c) * 4.2, z * 1.08],
            [x + Math.cos(c) * 3.6, 3.8 + Math.sin(c) * 3.6, z * 1.08],
            [x + Math.cos(a) * 3.6, 3.8 + Math.sin(a) * 3.6, z * 1.08],
            dark,
          );
        }
      trim.box(0, 2.4, z, 25, 1, 1.4, carbon);
      trim.box(0, 7.4, z, 6, 0.5, 0.3, dark);
      // Rétroviseurs et prises d'air latérales.
      body.box(5, 9, z * 1.15, 2.4, 1.3, 2.2, paint);
      trim.box(-4, 5.3, z * 1.05, 3.2, 1.5, 0.45, dark);
    }
    // Pavillon, pare-brise incliné et lunette. La pointe est +X.
    const roofFront = 3.4,
      roofBack = -5.7;
    body.quad(
      [roofBack, 12.2, -5.6],
      [roofBack, 12.2, 5.6],
      [roofFront, 12.2, 5.6],
      [roofFront, 12.2, -5.6],
      paint,
      [0, -1, 0],
    );
    glass.quad(
      [3.4, 12, -5.6],
      [3.4, 12, 5.6],
      [9.5, 7.7, 6.5],
      [9.5, 7.7, -6.5],
      "#537d95",
    );
    glass.quad(
      [-11, 8, -6.5],
      [-11, 8, 6.5],
      [-5.7, 12, 5.6],
      [-5.7, 12, -5.6],
      "#324e66",
    );
    for (const side of [-1, 1]) {
      glass.quad(
        [-10, 8.1, side * 6.8],
        [-5.4, 11.8, side * 5.75],
        [3.1, 11.8, side * 5.75],
        [8.4, 8.1, side * 6.8],
        "#25475f",
      );
      trim.box(-2, 8, side * 6.9, 0.7, 4, 0.6, carbon);
      trim.box(0, 7.6, side * 7.4, 15, 0.45, 0.6, carbon);
    }
    // Bandes de livrée et grilles capot, splitter et diffuseur.
    for (const z of [-1.7, 1.7]) {
      trim.quad(
        [9.7, 7.73, z - 0.55],
        [9.7, 7.73, z + 0.55],
        [18, 4.98, z + 0.55],
        [18, 4.98, z - 0.55],
        "#edf2e8",
        [0, -1, 0],
      );
      trim.box(-1, 12.26, z, 8.2, 0.08, 1.1, "#edf2e8");
      trim.box(-14, 8.03, z, 4, 0.08, 1.1, "#edf2e8");
    }
    trim.box(19.6, 3.7, 0, 0.45, 1.4, 10, dark);
    trim.box(18.7, 2.8, 0, 4, 0.45, 18.5, carbon);
    trim.box(-19, 2.8, 0, 3, 0.5, 18, carbon);
    for (const z of [-4, -2, 0, 2, 4])
      trim.box(-19, 2.4, z, 3, 1.5, 0.25, carbon);
    for (const z of [-5, 5]) {
      trim.box(11.8, 7.1, z, 3.2, 0.2, 1.2, dark);
      trim.box(-15, 7, z, 0.7, 4.7, 0.6, carbon);
    }
    trim.box(-15, 11.8, 0, 4.4, 0.7, 20, carbon);
    body.box(-15, 11.3, -10, 4, 1.8, 0.45, paint);
    body.box(-15, 11.3, 10, 4, 1.8, 0.45, paint);
    for (const z of [-5.7, 5.7]) {
      lights.box(18.5, 5.7, z, 1.2, 0.65, 3.5, "#e7f9ff");
      lights.box(18.5, 4.7, z, 1, 0.35, 3.4, "#a8e8f3");
      lights.box(-19.2, 5.8, z, 0.6, 0.55, 3.7, "#ff343c");
    }
    trim.cylinderZ(-18.5, 3.3, -3.9, 0.8, 1.1, silver, 8);
    trim.cylinderZ(-18.5, 3.3, 3.9, 0.8, 1.1, silver, 8);
    // Roues noires à jantes à cinq rayons ; géométrie locale réutilisée quatre fois.
    wheel.cylinderZ(0, 0, 0, 3.7, 2.8, "#17222a", 18);
    for (const z of [-1.45, 1.45]) {
      wheel.cylinderZ(0, 0, z, 2.9, 0.12, "#8397a0", 16);
      wheel.cylinderZ(0, 0, z * 1.06, 2.45, 0.1, "#243944", 14);
      for (let i = 0; i < 5; i++) {
        const a = (i * Math.PI * 2) / 5,
          b = a + 0.13,
          c = a - 0.13;
        const f = [Math.cos(a) * 0.6, Math.sin(a) * 0.6, z * 1.1],
          v = [Math.cos(b) * 2.65, Math.sin(b) * 2.65, z * 1.1],
          w = [Math.cos(c) * 2.65, Math.sin(c) * 2.65, z * 1.1];
        wheel.triangle(f, v, w, "#d0d9d8");
      }
      wheel.cylinderZ(0, 0, z * 1.12, 0.65, 0.13, "#e4ad51", 10);
    }
    return { body, glass, trim, lights, wheel };
  }
  createSigns() {
    const textTexture = (words, background = "#172e3c", accent = "#e9f5ed") => {
      const g = createGraphics(1024, 160);
      g.pixelDensity(1);
      g.background(background);
      g.fill(accent);
      g.textAlign(CENTER, CENTER);
      g.textStyle(BOLD);
      g.textFont("Arial");
      g.textSize(66);
      g.text(words, 512, 76);
      g.fill("#28d6ce");
      g.rect(0, 148, 1024, 8);
      return g;
    };
    this.signTextures = [
      textTexture("M O R P H   R A L L Y"),
      textTexture("A T L A S   G R A N D   P R I X"),
      textTexture("C O R N I C H E   D U   C A P"),
    ];
    [5, this.track.length * 0.3, this.track.length * 0.63].forEach((s, i) =>
      this.signs.push({ s, texture: this.signTextures[i] }),
    );
    this.numberTextures = RaceDirector.drivers.map((d) => {
      const g = createGraphics(256, 256);
      g.pixelDensity(1);
      g.clear();
      g.fill("#142a38");
      g.rect(28, 16, 200, 224, 14);
      g.fill("#f0f4e6");
      g.textAlign(CENTER, CENTER);
      g.textFont("Arial");
      g.textStyle(BOLD);
      g.textSize(140);
      g.text(d.number, 128, 113);
      g.fill(d.color);
      g.rect(45, 214, 166, 8);
      return g;
    });
  }
  drawSign(sign) {
    const p = this.track.pointAtDistance(sign.s),
      t = this.track.tangentAt(sign.s),
      heading = t.heading();
    push();
    resetShader();
    translate(p.x, -66, p.y);
    rotateY(-heading);
    noStroke();
    noLights();
    texture(sign.texture);
    beginShape(QUADS);
    vertex(0, -9, -99, 0, 0);
    vertex(0, 9, -99, 0, 1);
    vertex(0, 9, 99, 1, 1);
    vertex(0, -9, 99, 1, 0);
    endShape();
    pop();
  }
  draw(race, diagnostics = null) {
    const started = performance.now(),
      car = race.focus,
      heading = car.heading;
    background("#b4cbd3");
    perspective(Math.PI * 0.32, width / height, 2, 16000);
    const aerial = race.cameraMode === "aerial";
    const view = aerial
      ? { back: 360, up: 570, ahead: 110 }
      : race.debug
        ? { back: 110, up: 75, ahead: 90 }
        : { back: 68, up: 35, ahead: 110 };
    const desiredEye = [
      car.pos.x - Math.cos(heading) * view.back,
      -view.up,
      car.pos.y - Math.sin(heading) * view.back,
    ];
    const desiredLook = [
      car.pos.x + Math.cos(heading) * view.ahead,
      -(aerial ? 0 : 6),
      car.pos.y + Math.sin(heading) * view.ahead,
    ];
    if (!this.eye || this.cameraMode !== race.cameraMode) {
      this.eye = desiredEye.slice();
      this.look = desiredLook.slice();
      this.cameraMode = race.cameraMode;
    }
    const elapsed = Number.isFinite(deltaTime)
      ? Geometry.clamp(deltaTime, 1, 100)
      : 1000 / 60;
    const rate = 1 - Math.exp(-elapsed / (aerial ? 360 : 145));
    for (let i = 0; i < 3; i++) {
      this.eye[i] += (desiredEye[i] - this.eye[i]) * rate;
      this.look[i] += (desiredLook[i] - this.look[i]) * rate;
    }
    camera(...this.eye, ...this.look, 0, 1, 0);
    push();
    resetShader();
    noLights();
    translate(car.pos.x, 0, car.pos.y);
    this.sky.draw();
    pop();
    // Normales de sol vers -Y, ciel doux et lumière de soleil chaude.
    noLights();
    noStroke();
    fill(255);
    this.materials.use(0, 0.15);
    this.terrain.draw();
    this.materials.opacity = 1;
    this.materials.use(0, 0.08);
    this.road.draw();
    this.materials.use(0, 0.03);
    this.scenery.draw();
    (race.quality === "high" ? this.forest : this.forestLite).draw();
    this.signs.forEach((s) => this.drawSign(s));
    // push/pop conserve l'éclairage autour des panneaux auto-éclairés.
    for (const racer of race.cars) {
      if (p5.Vector.dist(racer.pos, car.pos) > 2600) continue;
      this.drawCar(racer, this.cars[racer.id], race);
    }
    if (race.debug) RaceDebugRenderer.draw(diagnostics, race.debugLayers);
    resetShader();
    this.lastFrameMs = performance.now() - started;
  }
  wheelAngle(car) {
    let state = this.wheelStates.get(car);
    if (!state) {
      state = { x: car.pos.x, y: car.pos.y, angle: (-car.distance / 3.7) % (Math.PI * 2) };
      this.wheelStates.set(car, state);
    } else {
      const travelled = Math.hypot(car.pos.x - state.x, car.pos.y - state.y);
      state.angle = (state.angle - travelled / 3.7) % (Math.PI * 2);
      state.x = car.pos.x;
      state.y = car.pos.y;
    }
    return state.angle;
  }
  drawCar(car, meshes, race) {
    // Cache visuel seulement : la distance de classement se fige à l'arrivée.
    const wheelAngle = this.wheelAngle(car);
    const relative = p5.Vector.sub(car.pos, race.focus.pos),
      heading = race.focus.heading;
    const behind =
      relative.x * Math.cos(heading) + relative.y * Math.sin(heading);
    const side =
      -relative.x * Math.sin(heading) + relative.y * Math.cos(heading);
    const opacity =
      race.cameraMode === "chase" &&
      car.id !== race.selected &&
      behind < -10 &&
      behind > -110 &&
      Math.abs(side) < 32
        ? 0.12
        : 1;
    this.materials.opacity = opacity;
    push();
    translate(car.pos.x, -1.6, car.pos.y);
    rotateY(-car.heading);
    // Ombre de contact attachée à la voiture, pas d'entité mobile supplémentaire.
    push();
    resetShader();
    noLights();
    fill(12, 25, 34, 85 * opacity);
    beginShape(TRIANGLE_FAN);
    vertex(0, -0.05, 0);
    for (let i = 0; i <= 24; i++) {
      const a = (i * Math.PI * 2) / 24;
      vertex(Math.cos(a) * 22, -0.05, Math.sin(a) * 10.5);
    }
    endShape();
    pop();
    this.materials.use(0.75, 0, 95);
    meshes.body.draw();
    this.materials.use(1.3, 0, 120);
    meshes.glass.draw();
    this.materials.use(0.1, 0.03, 30);
    meshes.trim.draw();
    for (const x of [-11, 11])
      for (const z of [-8.8, 8.8]) {
        push();
        translate(x, -3.7, z);
        if (x > 0)
          rotateY(
            Geometry.clamp(
              Math.atan2(car.lastForce.y, car.lastForce.x) - car.heading,
              -0.25,
              0.25,
            ) * 0.12,
          );
        rotateZ(wheelAngle);
        meshes.wheel.draw();
        pop();
      }
    if (opacity === 1) {
      push();
      resetShader();
      noLights();
      meshes.lights.draw();
      pop();
    }
    // Numéro d'écurie sur le toit, texture locale originale lisible en vue aérienne.
    push();
    resetShader();
    noLights();
    tint(255, 255 * opacity);
    texture(this.numberTextures[car.id]);
    beginShape(QUADS);
    vertex(-4.8, -12.32, -3.4, 0, 1);
    vertex(2.8, -12.32, -3.4, 0, 0);
    vertex(2.8, -12.32, 3.4, 1, 0);
    vertex(-4.8, -12.32, 3.4, 1, 1);
    endShape();
    pop();
    if (car.boosting) {
      resetShader();
      noLights();
      fill(63, 219, 255, 170);
      for (const z of [-3.9, 3.9]) {
        beginShape(TRIANGLES);
        vertex(-19, -3.3, z - 0.8);
        vertex(-19, -3.3, z + 0.8);
        vertex(-24 - Math.min(4, car.vel.mag()), -3.3, z);
        endShape();
      }
    }
    pop();
    this.materials.opacity = 1;
  }
  destroy() {
    this.signTextures.forEach((t) => t.remove());
    this.numberTextures.forEach((t) => t.remove());
    // La page contient un seul renderer ; les buffers p5 sont libérés avec le canvas.
  }
}
