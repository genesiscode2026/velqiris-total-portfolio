(function (root) {
  'use strict';
  const Core = root.VelqirisHeatmapCore;
  if (!Core) throw new Error('VelqirisHeatmapCore must be loaded first');

  const VERTEX_SHADER = `#version 300 es
    precision highp float;
    layout(location = 0) in vec4 aPoint;
    out float vIntensity;
    out float vSide;
    uniform float uPointSize;
    void main() {
      gl_Position = vec4(aPoint.xy, 0.0, 1.0);
      gl_PointSize = uPointSize * (0.35 + aPoint.z * 0.65);
      vIntensity = aPoint.z;
      vSide = aPoint.w;
    }`;

  const FRAGMENT_SHADER = `#version 300 es
    precision highp float;
    in float vIntensity;
    in float vSide;
    out vec4 outColor;
    void main() {
      vec2 delta = gl_PointCoord - vec2(0.5);
      float radial = max(0.0, 1.0 - length(delta) * 2.0);
      float alpha = radial * (0.12 + vIntensity * 0.88);
      vec3 bid = mix(vec3(0.02, 0.20, 0.28), vec3(0.00, 0.95, 0.65), vIntensity);
      vec3 ask = mix(vec3(0.30, 0.05, 0.16), vec3(1.00, 0.18, 0.32), vIntensity);
      outColor = vec4(vSide < 0.0 ? bid : ask, alpha);
    }`;

  function compile(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compilation failed: ${message}`);
    }
    return shader;
  }

  class VelqirisWebGLHeatmap {
    constructor(canvas, options = {}) {
      if (!(canvas instanceof HTMLCanvasElement)) throw new TypeError('canvas must be an HTMLCanvasElement');
      const gl = canvas.getContext('webgl2', { alpha: false, antialias: true });
      if (!gl) throw new Error('WebGL2 is required');
      this.canvas = canvas;
      this.gl = gl;
      this.pointSize = Number(options.pointSize || 24);
      this.book = new Core.RollingOrderBook(options);
      const program = gl.createProgram();
      gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
      gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`Program link failed: ${gl.getProgramInfoLog(program)}`);
      this.program = program;
      this.buffer = gl.createBuffer();
      this.pointSizeLocation = gl.getUniformLocation(program, 'uPointSize');
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    }

    setLevels(levels, now = Date.now()) { this.book.clear(); this.book.append(levels, now); return this.render(); }
    append(levels, now = Date.now()) { this.book.append(levels, now); return this.render(); }

    render() {
      const gl = this.gl;
      const points = Core.normalizeLevels(this.book.snapshot());
      const gpu = Core.flattenForGpu(points);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.floor(this.canvas.clientWidth * pixelRatio));
      const height = Math.max(1, Math.floor(this.canvas.clientHeight * pixelRatio));
      if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width = width; this.canvas.height = height; }
      gl.viewport(0, 0, width, height);
      gl.clearColor(0.015, 0.025, 0.06, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (!points.length) return { rendered: 0 };
      gl.useProgram(this.program);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      gl.bufferData(gl.ARRAY_BUFFER, gpu, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 16, 0);
      gl.uniform1f(this.pointSizeLocation, this.pointSize * pixelRatio);
      gl.drawArrays(gl.POINTS, 0, points.length);
      return { rendered: points.length };
    }

    destroy() { this.gl.deleteBuffer(this.buffer); this.gl.deleteProgram(this.program); this.book.clear(); }
  }

  root.VelqirisWebGLHeatmap = VelqirisWebGLHeatmap;
}(globalThis));
