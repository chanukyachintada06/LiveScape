/**
 * LiveScape – animations/particles.js
 * Full-featured particle system for canvas backgrounds.
 * Supports multiple animation styles: particles, matrix, nebula, aurora.
 */

'use strict';

/* ────────────────────────────────────────────────────────
   ParticleEngine Class
──────────────────────────────────────────────────────── */
class ParticleEngine {
  constructor(canvas) {
    this.canvas  = canvas;
    this.ctx     = canvas.getContext('2d');
    this.running = false;
    this.raf     = null;
    this.style   = 'particles';
    this.reduced = false;

    // Particle pool
    this.particles = [];

    // Mouse interaction
    this.mouse = { x: null, y: null, radius: 120 };

    // Matrix rain state
    this.matrixColumns = [];
    this.matrixDrops   = [];

    // Nebula blobs
    this.nebulae = [];

    // Aurora waves
    this.auroraTime = 0;

    this._boundMouseMove = this._onMouseMove.bind(this);
    this._boundMouseLeave = this._onMouseLeave.bind(this);
  }

  /* ── Lifecycle ── */
  init(style = 'particles', reduced = false) {
    this.style   = style;
    this.reduced = reduced;
    this._resize();
    this._setupStyle();
    window.addEventListener('resize', () => this._resize());
    this.canvas.addEventListener('mousemove', this._boundMouseMove);
    this.canvas.addEventListener('mouseleave', this._boundMouseLeave);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._loop();
  }

  stop() {
    this.running = false;
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = null;
    }
  }

  destroy() {
    this.stop();
    window.removeEventListener('resize', () => this._resize());
    this.canvas.removeEventListener('mousemove', this._boundMouseMove);
    this.canvas.removeEventListener('mouseleave', this._boundMouseLeave);
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  setStyle(style) {
    this.style = style;
    this._setupStyle();
  }

  setReduced(reduced) {
    this.reduced = reduced;
    this._setupStyle();
  }

  /* ── Internal ── */
  _resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this._setupStyle();
  }

  _onMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = e.clientX - rect.left;
    this.mouse.y = e.clientY - rect.top;
  }

  _onMouseLeave() {
    this.mouse.x = null;
    this.mouse.y = null;
  }

  _setupStyle() {
    this.particles    = [];
    this.matrixDrops  = [];
    this.nebulae      = [];
    this.auroraTime   = 0;

    const W = this.canvas.width;
    const H = this.canvas.height;

    switch (this.style) {
      case 'particles': this._setupParticles(W, H); break;
      case 'matrix':    this._setupMatrix(W, H);    break;
      case 'nebula':    this._setupNebula(W, H);    break;
      case 'aurora':    this._setupAurora(W, H);    break;
    }
  }

  /* ── Particles Setup ── */
  _setupParticles(W, H) {
    const count = this.reduced ? 60 : 120;
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x:  Math.random() * W,
        y:  Math.random() * H,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        r:  Math.random() * 2.5 + 0.5,
        alpha: Math.random() * 0.7 + 0.2,
        color: Math.random() > 0.5 ? '#63b3ed' : '#b794f4',
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: (Math.random() * 0.02 + 0.005),
      });
    }
  }

  /* ── Matrix Setup ── */
  _setupMatrix(W, H) {
    const fontSize = 14;
    const cols = Math.floor(W / fontSize);
    this.matrixFontSize = fontSize;
    this.matrixDrops = Array.from({ length: cols }, () => Math.floor(Math.random() * -50));
    this.matrixChars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEF';
  }

  /* ── Nebula Setup ── */
  _setupNebula(W, H) {
    const count = this.reduced ? 5 : 8;
    const colors = ['#b794f4', '#63b3ed', '#f6ad55', '#68d391', '#fc8181'];
    for (let i = 0; i < count; i++) {
      this.nebulae.push({
        x:  Math.random() * W,
        y:  Math.random() * H,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        r:  Math.random() * 200 + 100,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: Math.random() * 0.15 + 0.05,
        phase: Math.random() * Math.PI * 2,
        phaseSpeed: (Math.random() * 0.005 + 0.002),
      });
    }
    // Add star particles
    const stars = this.reduced ? 80 : 200;
    for (let i = 0; i < stars; i++) {
      this.particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.5 + 0.2,
        alpha: Math.random() * 0.8 + 0.1,
        twinkle: Math.random() * Math.PI * 2,
        twinkleSpeed: Math.random() * 0.03 + 0.005,
      });
    }
  }

  /* ── Aurora Setup ── */
  _setupAurora(W, H) {
    // Stars background
    const stars = this.reduced ? 60 : 150;
    for (let i = 0; i < stars; i++) {
      this.particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.2 + 0.2,
        alpha: Math.random() * 0.8 + 0.1,
        twinkle: Math.random() * Math.PI * 2,
        twinkleSpeed: Math.random() * 0.02 + 0.003,
      });
    }
  }

  /* ── Main Loop ── */
  _loop() {
    if (!this.running) return;
    this._draw();
    this.raf = requestAnimationFrame(() => this._loop());
  }

  _draw() {
    const ctx = this.ctx;
    const W   = this.canvas.width;
    const H   = this.canvas.height;

    switch (this.style) {
      case 'particles': this._drawParticles(ctx, W, H); break;
      case 'matrix':    this._drawMatrix(ctx, W, H);    break;
      case 'nebula':    this._drawNebula(ctx, W, H);    break;
      case 'aurora':    this._drawAurora(ctx, W, H);    break;
    }
  }

  /* ── Draw: Particles ── */
  _drawParticles(ctx, W, H) {
    // Fade trail
    ctx.fillStyle = 'rgba(5, 8, 16, 0.15)';
    ctx.fillRect(0, 0, W, H);

    for (const p of this.particles) {
      // Update
      p.x += p.vx;
      p.y += p.vy;
      p.pulse += p.pulseSpeed;

      // Mouse repulsion
      if (this.mouse.x !== null) {
        const dx = p.x - this.mouse.x;
        const dy = p.y - this.mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < this.mouse.radius) {
          const force = (this.mouse.radius - dist) / this.mouse.radius;
          p.x += dx / dist * force * 2;
          p.y += dy / dist * force * 2;
        }
      }

      // Wrap edges
      if (p.x < 0) p.x = W;
      if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H;
      if (p.y > H) p.y = 0;

      // Pulsing alpha
      const a = p.alpha * (0.7 + 0.3 * Math.sin(p.pulse));

      // Draw
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = this._hexToRgba(p.color, a);
      ctx.fill();
    }

    // Draw connection lines
    this._drawConnections(ctx);
  }

  _drawConnections(ctx) {
    const maxDist = 120;
    const pts = this.particles;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x;
        const dy = pts[i].y - pts[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < maxDist) {
          const alpha = (1 - dist / maxDist) * 0.25;
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.strokeStyle = `rgba(99, 179, 237, ${alpha})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
    }
  }

  /* ── Draw: Matrix ── */
  _drawMatrix(ctx, W, H) {
    // Fade
    ctx.fillStyle = 'rgba(2, 10, 2, 0.07)';
    ctx.fillRect(0, 0, W, H);

    const fontSize = this.matrixFontSize;
    ctx.font = `${fontSize}px "Courier New", monospace`;

    const chars = this.matrixChars;
    const drops = this.matrixDrops;

    for (let i = 0; i < drops.length; i++) {
      const char  = chars[Math.floor(Math.random() * chars.length)];
      const x     = i * fontSize;
      const y     = drops[i] * fontSize;

      // Leading character (bright white)
      if (drops[i] > 0) {
        ctx.fillStyle = '#ffffff';
        ctx.fillText(char, x, y);
      }

      // Trail (green shades)
      const trailAlpha = Math.random() * 0.5 + 0.3;
      ctx.fillStyle = `rgba(0, 255, 70, ${trailAlpha})`;
      ctx.fillText(chars[Math.floor(Math.random() * chars.length)], x, y - fontSize);

      // Advance drop
      if (y > H + fontSize * 20 || Math.random() > 0.975) {
        drops[i] = -Math.floor(Math.random() * 50);
      }
      drops[i]++;
    }
  }

  /* ── Draw: Nebula ── */
  _drawNebula(ctx, W, H) {
    ctx.fillStyle = 'rgba(5, 0, 16, 0.2)';
    ctx.fillRect(0, 0, W, H);

    // Draw nebula blobs
    for (const n of this.nebulae) {
      n.x += n.vx;
      n.y += n.vy;
      n.phase += n.phaseSpeed;

      if (n.x < -n.r) n.x = W + n.r;
      if (n.x > W + n.r) n.x = -n.r;
      if (n.y < -n.r) n.y = H + n.r;
      if (n.y > H + n.r) n.y = -n.r;

      const pulseR = n.r * (1 + 0.1 * Math.sin(n.phase));
      const gradient = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, pulseR);
      const a = n.alpha * (0.8 + 0.2 * Math.sin(n.phase));
      gradient.addColorStop(0, this._hexToRgba(n.color, a));
      gradient.addColorStop(0.5, this._hexToRgba(n.color, a * 0.4));
      gradient.addColorStop(1, 'transparent');

      ctx.beginPath();
      ctx.fillStyle = gradient;
      ctx.arc(n.x, n.y, pulseR, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw twinkling stars
    for (const p of this.particles) {
      p.twinkle += p.twinkleSpeed;
      const a = p.alpha * (0.5 + 0.5 * Math.sin(p.twinkle));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
      ctx.fill();
    }
  }

  /* ── Draw: Aurora ── */
  _drawAurora(ctx, W, H) {
    ctx.fillStyle = 'rgba(5, 8, 16, 0.25)';
    ctx.fillRect(0, 0, W, H);

    this.auroraTime += 0.003;
    const t = this.auroraTime;

    const auroraColors = [
      { r: 0,   g: 255, b: 170 },
      { r: 99,  g: 179, b: 237 },
      { r: 183, g: 148, b: 244 },
      { r: 0,   g: 200, b: 255 },
    ];

    const bands = 6;
    for (let b = 0; b < bands; b++) {
      const progress = b / bands;
      const yBase    = H * (0.2 + progress * 0.5);
      const waveAmp  = 60 + Math.sin(t * 1.3 + b) * 30;
      const colorIdx = b % auroraColors.length;
      const c        = auroraColors[colorIdx];
      const alpha    = 0.04 + 0.03 * Math.sin(t * 0.7 + b * 1.2);

      ctx.beginPath();
      ctx.moveTo(0, yBase);

      for (let x = 0; x <= W; x += 6) {
        const xNorm = x / W;
        const y = yBase
          + Math.sin(xNorm * 4 + t + b * 0.8) * waveAmp
          + Math.sin(xNorm * 7 + t * 1.5 + b) * (waveAmp * 0.4)
          + Math.sin(xNorm * 2 - t * 0.5 + b * 0.3) * (waveAmp * 0.6);
        ctx.lineTo(x, y);
      }

      ctx.lineTo(W, H);
      ctx.lineTo(0, H);
      ctx.closePath();

      const gradient = ctx.createLinearGradient(0, yBase - waveAmp, 0, yBase + waveAmp * 2);
      gradient.addColorStop(0, `rgba(${c.r}, ${c.g}, ${c.b}, 0)`);
      gradient.addColorStop(0.3, `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`);
      gradient.addColorStop(0.6, `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha * 0.6})`);
      gradient.addColorStop(1, `rgba(${c.r}, ${c.g}, ${c.b}, 0)`);

      ctx.fillStyle = gradient;
      ctx.fill();
    }

    // Stars
    for (const p of this.particles) {
      p.twinkle += p.twinkleSpeed;
      const a = p.alpha * (0.4 + 0.6 * Math.abs(Math.sin(p.twinkle)));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
      ctx.fill();
    }
  }

  /* ── Helpers ── */
  _hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}

// Expose globally
window.ParticleEngine = ParticleEngine;
