/* Orchestration seule : pas fixes à 60 Hz, sans multiplier une force par deltaTime.
   RaceClock accumule le temps entre deux rendus et borne le rattrapage. */
let grandPrix,
  raceRenderer,
  raceHud,
  raceAudio,
  raceClock,
  raceFrame = 0;
let raceDebugFrame = null;
function refreshRaceDebug() {
  raceDebugFrame = grandPrix.debug ? RaceDiagnostics.capture(grandPrix) : null;
  return raceDebugFrame;
}
const racePerformance = { frames: [], simulation: [], render: [] };
function restartGrandPrix() {
  const selected = grandPrix?.selected ?? 4,
    quality = grandPrix?.quality ?? "high";
  const debug = grandPrix?.debug ?? false,
    layers = grandPrix?.debugLayers;
  raceHud?.destroy();
  raceAudio?.reset();
  grandPrix = new RaceDirector();
  grandPrix.selected = selected;
  grandPrix.quality = quality;
  grandPrix.debug = debug;
  if (layers) grandPrix.debugLayers = { ...layers };
  raceClock?.reset();
  // La géométrie n'a pas changé ; les meshes mis en cache sont réutilisés.
  if (raceRenderer) {
    raceRenderer.eye = null;
    raceRenderer.look = null;
  }
  raceHud = new RaceHud(grandPrix, {
    restart: restartGrandPrix,
    quality: setRaceQuality,
    audio: raceAudio,
    resetClock: () => raceClock.reset(),
    inspect: refreshRaceDebug,
  });
  window.__grandPrix = {
    get telemetry() {
      return grandPrix.telemetry();
    },
    get diagnostics() {
      return raceDebugFrame;
    },
  };
}
function setRaceQuality() {
  // Le HUD reste natif. Seule la scène est bornée en pixels pour les grands écrans.
  const budget = grandPrix.quality === "high" ? 1350000 : 800000;
  pixelDensity(
    Math.min(
      1.5,
      window.devicePixelRatio || 1,
      Math.sqrt(budget / (windowWidth * windowHeight)),
    ),
  );
}
function setup() {
  setAttributes({
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: false,
  });
  const canvas = createCanvas(windowWidth, windowHeight, WEBGL);
  canvas.parent("race-world");
  frameRate(60);
  textureMode(NORMAL);
  describe(
    "Course de huit voitures GT en trois dimensions sur un circuit côtier sinueux. Utilisez les commandes accessibles pour choisir une voiture, une tactique et la caméra.",
  );
  raceClock = new RaceClock();
  raceAudio = new RaceAudio();
  restartGrandPrix();
  setRaceQuality();
  raceRenderer = new RaceRenderer3D(grandPrix);
  document.getElementById("loading-race").hidden = true;
}
function draw() {
  const start = performance.now();
  raceClock.advance(grandPrix, deltaTime);
  const simulated = performance.now();
  raceAudio.update(grandPrix);
  const diagnostics = refreshRaceDebug();
  raceRenderer.draw(grandPrix, diagnostics);
  if (++raceFrame % 6 === 0) raceHud.update(diagnostics);
  racePerformance.frames.push(deltaTime);
  racePerformance.simulation.push(simulated - start);
  racePerformance.render.push(performance.now() - simulated);
  if (racePerformance.frames.length > 3600)
    for (const values of Object.values(racePerformance)) values.shift();
}
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  setRaceQuality();
}
function destroyGrandPrix() {
  raceHud?.destroy();
  raceRenderer?.destroy();
  raceAudio?.destroy();
  noLoop();
}
window.addEventListener("pagehide", destroyGrandPrix, { once: true });
// Une restauration BFCache revient après le nettoyage de pagehide : recréer
// le contexte plutôt que réutiliser un canvas arrêté et un AudioContext fermé.
window.addEventListener("pageshow", (event) => {
  if (event.persisted) window.location.reload();
});
window.addEventListener("error", (event) => {
  const el = document.getElementById("loading-race");
  if (el) {
    el.hidden = false;
    el.textContent =
      "Le rendu 3D n’a pas pu démarrer. Vérifiez que WebGL est activé puis rechargez la page.";
  }
});
