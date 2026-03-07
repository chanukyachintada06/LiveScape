/**
 * LiveScape – animations/canvas-bg.js
 * Canvas background fill and gradient utilities.
 * Called before the particle engine starts to paint the base layer.
 */

'use strict';

/* ────────────────────────────────────────────────────────
   CanvasBackground Utility
   Draws the initial static background gradient for each
   animation style so the canvas never looks raw/empty.
──────────────────────────────────────────────────────── */
const CanvasBackground = {

  /**
   * Paint the initial background for a given style.
   * @param {HTMLCanvasElement} canvas
   * @param {string} style - 'particles' | 'matrix' | 'nebula' | 'aurora'
   */
  paint(canvas, style) {
    const ctx = canvas.getContext('2d');
    const W   = canvas.width  = window.innerWidth;
    const H   = canvas.height = window.innerHeight;

    ctx.clearRect(0, 0, W, H);

    switch (style) {
      case 'particles': this._paintParticlesBg(ctx, W, H); break;
      case 'matrix':    this._paintMatrixBg(ctx, W, H);    break;
      case 'nebula':    this._paintNebulaBg(ctx, W, H);    break;
      case 'aurora':    this._paintAuroraBg(ctx, W, H);    break;
      default:          this._paintParticlesBg(ctx, W, H); break;
    }
  },

  _paintParticlesBg(ctx, W, H) {
    const grad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
    grad.addColorStop(0,   'rgba(15, 25, 50, 1)');
    grad.addColorStop(0.5, 'rgba(8, 15, 30, 1)');
    grad.addColorStop(1,   'rgba(3, 6, 15, 1)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Subtle radial accent
    const accent = ctx.createRadialGradient(W * 0.6, H * 0.4, 0, W * 0.6, H * 0.4, W * 0.4);
    accent.addColorStop(0,   'rgba(99, 179, 237, 0.06)');
    accent.addColorStop(0.5, 'rgba(183, 148, 244, 0.03)');
    accent.addColorStop(1,   'transparent');
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, W, H);
  },

  _paintMatrixBg(ctx, W, H) {
    ctx.fillStyle = '#020a02';
    ctx.fillRect(0, 0, W, H);
  },

  _paintNebulaBg(ctx, W, H) {
    // Deep space
    const grad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H));
    grad.addColorStop(0,   'rgba(10, 2, 25, 1)');
    grad.addColorStop(0.6, 'rgba(5, 0, 18, 1)');
    grad.addColorStop(1,   'rgba(2, 0, 10, 1)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Far galaxy glow
    const glow = ctx.createRadialGradient(W * 0.4, H * 0.5, 0, W * 0.4, H * 0.5, W * 0.5);
    glow.addColorStop(0,   'rgba(183, 148, 244, 0.04)');
    glow.addColorStop(0.7, 'rgba(99, 179, 237, 0.02)');
    glow.addColorStop(1,   'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
  },

  _paintAuroraBg(ctx, W, H) {
    // Dark night sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0,    'rgba(3, 5, 15, 1)');
    grad.addColorStop(0.4,  'rgba(5, 10, 25, 1)');
    grad.addColorStop(0.7,  'rgba(8, 18, 35, 1)');
    grad.addColorStop(1,    'rgba(5, 12, 20, 1)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Horizon glow
    const horizon = ctx.createLinearGradient(0, H * 0.6, 0, H);
    horizon.addColorStop(0,   'transparent');
    horizon.addColorStop(0.5, 'rgba(0, 200, 150, 0.04)');
    horizon.addColorStop(1,   'rgba(0, 150, 100, 0.08)');
    ctx.fillStyle = horizon;
    ctx.fillRect(0, 0, W, H);
  }
};

// Expose globally
window.CanvasBackground = CanvasBackground;
