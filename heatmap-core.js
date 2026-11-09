(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.VelqirisHeatmapCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function finiteNumber(value, field) {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new TypeError(`${field} must be finite`);
    return number;
  }

  function validateLevel(level) {
    if (!level || typeof level !== 'object') throw new TypeError('level must be an object');
    const side = String(level.side || '').toLowerCase();
    if (side !== 'bid' && side !== 'ask') throw new TypeError('side must be bid or ask');
    const price = finiteNumber(level.price, 'price');
    const size = finiteNumber(level.size, 'size');
    const timestamp = finiteNumber(level.timestamp, 'timestamp');
    if (price <= 0) throw new RangeError('price must be greater than zero');
    if (size < 0) throw new RangeError('size cannot be negative');
    if (timestamp <= 0) throw new RangeError('timestamp must be greater than zero');
    return { side, price, size, timestamp, venue: String(level.venue || 'unknown') };
  }

  function normalizeLevels(levels, options = {}) {
    if (!Array.isArray(levels) || levels.length === 0) return [];
    const clean = levels.map(validateLevel);
    const prices = clean.map((level) => level.price);
    const times = clean.map((level) => level.timestamp);
    const sizes = clean.map((level) => level.size);
    const priceMin = Math.min(...prices);
    const priceMax = Math.max(...prices);
    const timeMin = Math.min(...times);
    const timeMax = Math.max(...times);
    const sizeMax = Math.max(...sizes, 1);
    const priceSpan = priceMax - priceMin || 1;
    const timeSpan = timeMax - timeMin || 1;
    const gamma = Number.isFinite(options.gamma) && options.gamma > 0 ? options.gamma : 0.55;

    return clean.map((level) => ({
      x: ((level.timestamp - timeMin) / timeSpan) * 2 - 1,
      y: ((level.price - priceMin) / priceSpan) * 2 - 1,
      intensity: Math.pow(level.size / sizeMax, gamma),
      side: level.side === 'bid' ? -1 : 1,
      price: level.price,
      size: level.size,
      timestamp: level.timestamp,
      venue: level.venue,
    }));
  }

  function flattenForGpu(points) {
    const output = new Float32Array(points.length * 4);
    points.forEach((point, index) => {
      const offset = index * 4;
      output[offset] = finiteNumber(point.x, 'x');
      output[offset + 1] = finiteNumber(point.y, 'y');
      output[offset + 2] = Math.max(0, Math.min(1, finiteNumber(point.intensity, 'intensity')));
      output[offset + 3] = finiteNumber(point.side, 'side') < 0 ? -1 : 1;
    });
    return output;
  }

  class RollingOrderBook {
    constructor({ maxLevels = 20000, maxAgeMs = 300000 } = {}) {
      if (!Number.isInteger(maxLevels) || maxLevels < 1) throw new RangeError('maxLevels must be a positive integer');
      if (!Number.isFinite(maxAgeMs) || maxAgeMs <= 0) throw new RangeError('maxAgeMs must be positive');
      this.maxLevels = maxLevels;
      this.maxAgeMs = maxAgeMs;
      this.levels = [];
    }

    append(levels, now = Date.now()) {
      if (!Array.isArray(levels)) throw new TypeError('levels must be an array');
      const clean = levels.map(validateLevel);
      const cutoff = now - this.maxAgeMs;
      this.levels = this.levels.concat(clean).filter((level) => level.timestamp >= cutoff);
      if (this.levels.length > this.maxLevels) this.levels = this.levels.slice(-this.maxLevels);
      return this.snapshot();
    }

    snapshot() { return this.levels.map((level) => ({ ...level })); }
    clear() { this.levels = []; }
  }

  return { validateLevel, normalizeLevels, flattenForGpu, RollingOrderBook };
}));
