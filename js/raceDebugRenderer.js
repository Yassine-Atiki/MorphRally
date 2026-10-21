/* Superpositions de diagnostic, sans écriture dans le monde. Les données
   sont capturées par l'orchestrateur avant le rendu, y compris en pause. */
class RaceDebugRenderer {
  static colors = {
    follow: "#c7a8ff",
    edge: "#ffb169",
    avoid: "#ff76ae",
    total: "#c6f58b",
    velocity: "#7cbcff",
  };
  static line(a, b, color, height = 16, weight = 2) {
    stroke(color);
    strokeWeight(weight);
    line(a.x, -height, a.y, b.x, -height, b.y);
  }
  static ring(p, r, color, height = 3, weight = 1.5) {
    noFill();
    stroke(color);
    strokeWeight(weight);
    beginShape();
    for (let i = 0; i <= 40; i++) {
      const angle = (i * Math.PI * 2) / 40;
      vertex(p.x + Math.cos(angle) * r, -height, p.y + Math.sin(angle) * r);
    }
    endShape();
  }
  static path(points, color, height = 3, weight = 1.5) {
    noFill();
    stroke(color);
    strokeWeight(weight);
    beginShape();
    points.forEach((p) => vertex(p.x, -height, p.y));
    endShape();
  }
  static arrow(origin, vector, color, scale, height = 18, maxLength = 120) {
    const magnitude = Math.hypot(vector.x, vector.y);
    if (magnitude < 1e-8) return;
    const length = Math.min(maxLength, magnitude * scale),
      dx = vector.x / magnitude,
      dy = vector.y / magnitude;
    const end = { x: origin.x + dx * length, y: origin.y + dy * length },
      size = Math.min(8, length * 0.4);
    RaceDebugRenderer.line(origin, end, color, height, 3);
    noStroke();
    fill(color);
    beginShape(TRIANGLES);
    vertex(end.x, -height, end.y);
    vertex(
      end.x - dx * size - dy * size * 0.45,
      -height,
      end.y - dy * size + dx * size * 0.45,
    );
    vertex(
      end.x - dx * size + dy * size * 0.45,
      -height,
      end.y - dy * size - dx * size * 0.45,
    );
    endShape();
  }
  static draw(data, layers) {
    if (!data) return;
    const gl = drawingContext,
      depthWasEnabled = gl.isEnabled(gl.DEPTH_TEST);
    push();
    resetShader();
    noLights();
    gl.disable(gl.DEPTH_TEST);
    try {
      RaceDebugRenderer.ring(data.pose, data.radius, "#6be4dc", 2, 2);
      if (layers.path) {
        RaceDebugRenderer.path(data.left, "#d6dfdf", 2);
        RaceDebugRenderer.path(data.right, "#d6dfdf", 2);
        RaceDebugRenderer.path(data.planned, "#40e5dd", 3, 3);
        RaceDebugRenderer.line(data.origin, data.target, "#ffd87c", 7, 2);
        RaceDebugRenderer.ring(data.target, 5, "#ffd87c", 7, 2);
      }
      if (layers.anticipation) {
        RaceDebugRenderer.line(data.origin, data.prediction, "#ffb169", 4, 2);
        RaceDebugRenderer.ring(data.prediction, data.radius, "#ffb169", 4, 2);
        for (const n of data.neighbors) {
          const color = n.threat ? "#ff76ae" : "#a68da6";
          RaceDebugRenderer.ring(
            n.pos,
            n.radius + 3,
            color,
            3,
            n.threat ? 2 : 1,
          );
          if (n.threat) {
            RaceDebugRenderer.line(n.pos, n.otherFuture, color, 5);
            RaceDebugRenderer.ring(n.otherFuture, n.radius, color, 5, 2);
            RaceDebugRenderer.line(n.selfFuture, n.otherFuture, color, 5);
          }
        }
      }
      if (layers.sensors) {
        data.rays.forEach((ray) => {
          const color = ray.hit
            ? ray.distance < 45
              ? "#ff7969"
              : "#ffd07c"
            : "#4ee8e1";
          RaceDebugRenderer.line(ray.origin, ray.end, color, 16, 2.5);
          RaceDebugRenderer.ring(ray.end, ray.hit ? 3 : 1.6, color, 16, 2);
        });
      }
      if (layers.forces) {
        RaceDebugRenderer.arrow(
          data.pose,
          data.velocity,
          RaceDebugRenderer.colors.velocity,
          10,
          19,
        );
        ["follow", "edge", "avoid", "total"].forEach((key, i) =>
          RaceDebugRenderer.arrow(
            data.origin,
            data.forces[key],
            RaceDebugRenderer.colors[key],
            100 / data.maxForce,
            21 + i * 2,
          ),
        );
      }
    } finally {
      if (depthWasEnabled) gl.enable(gl.DEPTH_TEST);
      else gl.disable(gl.DEPTH_TEST);
      pop();
    }
  }
}
