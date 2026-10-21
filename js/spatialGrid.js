class SpatialGrid {
  constructor(size = 128) {
    this.size = size;
    this.cells = new Map();
  }
  clear() {
    this.cells.clear();
  }
  insert(item) {
    const points = item.shape === "segment" ? [item.a, item.b] : [item.pos];
    const radius = item.shape === "segment" ? item.thickness : item.radius;
    const minX = Math.floor(
        (Math.min(...points.map((p) => p.x)) - radius) / this.size,
      ),
      maxX = Math.floor(
        (Math.max(...points.map((p) => p.x)) + radius) / this.size,
      );
    const minY = Math.floor(
        (Math.min(...points.map((p) => p.y)) - radius) / this.size,
      ),
      maxY = Math.floor(
        (Math.max(...points.map((p) => p.y)) + radius) / this.size,
      );
    for (let x = minX; x <= maxX; x++)
      for (let y = minY; y <= maxY; y++) {
        const key = x + "," + y;
        if (!this.cells.has(key)) this.cells.set(key, []);
        this.cells.get(key).push(item);
      }
  }
  query(pos, radius) {
    const found = new Map();
    for (
      let x = Math.floor((pos.x - radius) / this.size);
      x <= Math.floor((pos.x + radius) / this.size);
      x++
    )
      for (
        let y = Math.floor((pos.y - radius) / this.size);
        y <= Math.floor((pos.y + radius) / this.size);
        y++
      )
        for (const item of this.cells.get(x + "," + y) || [])
          found.set(item.id, item);
    return [...found.values()].sort((a, b) => a.id.localeCompare(b.id));
  }
}
