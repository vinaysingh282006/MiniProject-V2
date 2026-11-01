/* ==========================================================================
   RADAR FUSION — BACKGROUND SYSTEM
   One shared full-screen Canvas with 7 low-contrast, mathematically smooth
   ambient shaders tailored per page via <body data-bg="...">.
   Rules: Delta-time rAF loop, DPR cap 2, auto-pause on hide, zero mouse reactive.
   ========================================================================== */

(function () {
  'use strict';

  var canvas = document.getElementById('bg-canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'bg-canvas';
    document.body.prepend(canvas);
  }

  var ctx = canvas.getContext('2d');
  var mode = document.body.getAttribute('data-bg') || 'aurora-mesh';

  var width = 0;
  var height = 0;
  var dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 768 ? 1.5 : 2);
  var isPaused = false;
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // FPS monitoring for auto-degradation
  var lastTime = performance.now();
  var frameCount = 0;
  var fpsTimer = 0;
  var lowFpsCount = 0;
  var qualityScale = 1.0;

  // Resize Handler
  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr * qualityScale);
    canvas.height = Math.floor(height * dpr * qualityScale);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr * qualityScale, dpr * qualityScale);
  }
  window.addEventListener('resize', resize);
  resize();

  // Tab visibility pause
  document.addEventListener('visibilitychange', function () {
    isPaused = document.hidden;
    if (!isPaused) lastTime = performance.now();
  });

  // Global event triggers for simulation waves
  var waveNoiseBoost = 0;
  var alertPulseAlpha = 0;
  if (window.RFO && window.RFO.events) {
    window.RFO.events.on('radar-noise', function () {
      waveNoiseBoost = 1.0;
    });
    window.RFO.events.on('radar-alert', function () {
      alertPulseAlpha = 0.35;
    });
  }

  // ------------------------------------------------------------------------
  // Mode 1: HOME "aurora-mesh"
  // Large soft blurred blobs of maroon and green drifting slowly on graphite,
  // overlaid with thin concentric 1px radar rings slowly rotating.
  // ------------------------------------------------------------------------
  var blobs = [
    { x: 0.25, y: 0.3, r: 0.45, vx: 0.00015, vy: 0.0002, color: 'rgba(158, 53, 68, ' }, // maroon
    { x: 0.75, y: 0.6, r: 0.5, vx: -0.00018, vy: -0.00015, color: 'rgba(63, 185, 133, ' }, // green
    { x: 0.5, y: 0.75, r: 0.38, vx: 0.00012, vy: -0.00022, color: 'rgba(158, 53, 68, ' },
    { x: 0.4, y: 0.2, r: 0.4, vx: -0.00014, vy: 0.00018, color: 'rgba(99, 212, 163, ' }
  ];

  function renderAuroraMesh(t, dt) {
    ctx.fillStyle = '#0E0F11';
    ctx.fillRect(0, 0, width, height);

    // Drifting radial gradients
    for (var i = 0; i < blobs.length; i++) {
      var b = blobs[i];
      if (!reducedMotion) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.x < 0.1 || b.x > 0.9) b.vx *= -1;
        if (b.y < 0.1 || b.y > 0.9) b.vy *= -1;
      }
      var px = b.x * width;
      var py = b.y * height;
      var radius = b.r * Math.max(width, height);

      var grad = ctx.createRadialGradient(px, py, 0, px, py, radius);
      grad.addColorStop(0, b.color + '0.24)');
      grad.addColorStop(0.5, b.color + '0.10)');
      grad.addColorStop(1, 'rgba(14, 15, 17, 0)');

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }

    // Slowly rotating concentric radar rings
    var cx = width * 0.75;
    var cy = height * 0.45;
    var maxR = Math.min(width, height) * 0.65;
    var angle = t * 0.0001;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1.2;

    for (var r = 80; r < maxR; r += 90) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Subtle crosshairs
    ctx.beginPath();
    ctx.moveTo(-maxR, 0); ctx.lineTo(maxR, 0);
    ctx.moveTo(0, -maxR); ctx.lineTo(0, maxR);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.stroke();
    ctx.restore();
  }

  // ------------------------------------------------------------------------
  // Mode 2: SIMULATION "waves"
  // Flowing sine carrier & chirp lines in maroon and green at 10-18% opacity.
  // ------------------------------------------------------------------------
  function renderSimulationWaves(t, dt) {
    ctx.fillStyle = '#0E0F11';
    ctx.fillRect(0, 0, width, height);

    if (waveNoiseBoost > 0) waveNoiseBoost = Math.max(0, waveNoiseBoost - dt * 0.001);
    if (alertPulseAlpha > 0) alertPulseAlpha = Math.max(0, alertPulseAlpha - dt * 0.0008);

    // Alert ambient flash
    if (alertPulseAlpha > 0) {
      ctx.fillStyle = 'rgba(214, 69, 93, ' + alertPulseAlpha.toFixed(3) + ')';
      ctx.fillRect(0, 0, width, height);
    }

    var waveCount = 5;
    var baseY = height * 0.5;

    for (var i = 0; i < waveCount; i++) {
      var isMaroon = i % 2 === 0;
      var alpha = 0.22 + (i * 0.03);
      var strokeColor = isMaroon ? 'rgba(194, 74, 91, ' + alpha + ')' : 'rgba(63, 185, 133, ' + alpha + ')';

      var freq = 0.0025 + i * 0.0012 + waveNoiseBoost * 0.003;
      var speed = (t * 0.0012) * (i % 2 === 0 ? 1 : -0.85);
      var amp = (35 + i * 16) * (1 + waveNoiseBoost * 0.4);

      ctx.beginPath();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2.0;

      for (var x = 0; x <= width; x += 15) {
        var chirp = 1 + (x / width) * 0.8;
        var y = baseY + Math.sin(x * freq * chirp + speed) * amp + (i - 2) * 45;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  // ------------------------------------------------------------------------
  // Mode 3: TECH "contour"
  // Topographic radar contour lines (noise-driven isolines) in muted green & maroon.
  // ------------------------------------------------------------------------
  function renderTechContour(t, dt) {
    ctx.fillStyle = '#0E0F11';
    ctx.fillRect(0, 0, width, height);

    var count = 6;
    var cx = width * 0.5;
    var cy = height * 0.55;

    for (var c = 1; c <= count; c++) {
      var baseR = c * 70;
      var isGreen = c % 2 !== 0;
      ctx.strokeStyle = isGreen ? 'rgba(63, 185, 133, 0.16)' : 'rgba(158, 53, 68, 0.13)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();

      var points = 60;
      for (var p = 0; p <= points; p++) {
        var theta = (p / points) * Math.PI * 2;
        var morph = Math.sin(theta * 3 + t * 0.0006 + c) * 16 + Math.cos(theta * 5 - t * 0.0004) * 12;
        var r = baseR + morph;
        var px = cx + Math.cos(theta) * r;
        var py = cy + Math.sin(theta) * (r * 0.7); // slight elliptical squish
        if (p === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }

  // ------------------------------------------------------------------------
  // Mode 4: WORKING "flow"
  // Soft curved ribbons flowing left to right: maroon and green merging to white.
  // ------------------------------------------------------------------------
  function renderWorkingFlow(t, dt) {
    ctx.fillStyle = '#0E0F11';
    ctx.fillRect(0, 0, width, height);

    var progress = (t * 0.0004) % 1;
    var startY1 = height * 0.35;
    var startY2 = height * 0.65;
    var midY = height * 0.5;

    // Strand 1: Maroon (24G)
    ctx.beginPath();
    ctx.moveTo(0, startY1);
    ctx.bezierCurveTo(width * 0.3, startY1 + Math.sin(t * 0.001) * 20, width * 0.45, midY, width * 0.55, midY);
    ctx.strokeStyle = 'rgba(194, 74, 91, 0.26)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Strand 2: Green (60G)
    ctx.beginPath();
    ctx.moveTo(0, startY2);
    ctx.bezierCurveTo(width * 0.3, startY2 - Math.sin(t * 0.001) * 20, width * 0.45, midY, width * 0.55, midY);
    ctx.strokeStyle = 'rgba(63, 185, 133, 0.26)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Merged strand: Fused Soft White
    ctx.beginPath();
    ctx.moveTo(width * 0.55, midY);
    ctx.bezierCurveTo(width * 0.7, midY, width * 0.85, midY + Math.sin(t * 0.0008) * 15, width, midY);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)';
    ctx.lineWidth = 3.5;
    ctx.stroke();
  }

  // ------------------------------------------------------------------------
  // Mode 5: UPGRADES "grid-depth"
  // Dotted grid in perspective with faint floating geometric nodes.
  // ------------------------------------------------------------------------
  function renderUpgradesGridDepth(t, dt) {
    ctx.fillStyle = '#0E0F11';
    ctx.fillRect(0, 0, width, height);

    var drift = (t * 0.015) % 40;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.075)';

    var step = 45;
    for (var x = 0; x < width; x += step) {
      for (var y = drift; y < height; y += step) {
        ctx.beginPath();
        ctx.arc(x, y, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Faint floating node rings
    var shapes = [
      { x: width * 0.2, y: height * 0.35 + Math.sin(t * 0.0005) * 15, r: 38, col: 'rgba(158, 53, 68, 0.18)' },
      { x: width * 0.8, y: height * 0.65 + Math.cos(t * 0.0006) * 20, r: 52, col: 'rgba(63, 185, 133, 0.18)' },
      { x: width * 0.6, y: height * 0.25 + Math.sin(t * 0.0004) * 12, r: 28, col: 'rgba(255, 255, 255, 0.15)' }
    ];

    shapes.forEach(function (s) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.strokeStyle = s.col;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
  }

  // ------------------------------------------------------------------------
  // Mode 6: ROADMAP "horizon"
  // Soft horizontal sunrise gradient (maroon to green) with rising fine particles.
  // ------------------------------------------------------------------------
  var particles = [];
  for (var p = 0; p < 40; p++) {
    particles.push({
      x: Math.random(),
      y: Math.random(),
      vy: 0.00008 + Math.random() * 0.0001,
      r: 1.5 + Math.random() * 1.5,
      alpha: 0.18 + Math.random() * 0.20
    });
  }

  function renderRoadmapHorizon(t, dt) {
    ctx.fillStyle = '#0E0F11';
    ctx.fillRect(0, 0, width, height);

    // Subtle horizon band
    var horizonY = height * 0.7;
    var grad = ctx.createLinearGradient(0, horizonY - 120, width, horizonY + 120);
    grad.addColorStop(0, 'rgba(158, 53, 68, 0.18)');
    grad.addColorStop(0.5, 'rgba(63, 185, 133, 0.18)');
    grad.addColorStop(1, 'rgba(14, 15, 17, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, horizonY - 150, width, 300);

    // Rising particles
    for (var i = 0; i < particles.length; i++) {
      var pt = particles[i];
      if (!reducedMotion) {
        pt.y -= pt.vy * dt;
        if (pt.y < 0) pt.y = 1;
      }
      ctx.fillStyle = 'rgba(255, 255, 255, ' + pt.alpha + ')';
      ctx.beginPath();
      ctx.arc(pt.x * width, pt.y * height, pt.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ------------------------------------------------------------------------
  // Mode 7: THANKS "settle"
  // Rings slowly contract to center and settle; ripple repeats every ~6s.
  // ------------------------------------------------------------------------
  function renderThanksSettle(t, dt) {
    ctx.fillStyle = '#0E0F11';
    ctx.fillRect(0, 0, width, height);

    var cx = width * 0.5;
    var cy = height * 0.45;

    // Expanding 6s ripple
    var period = 6000;
    var phase = (t % period) / period; // 0 to 1
    var rippleR = phase * Math.min(width, height) * 0.55;
    var rippleAlpha = (1 - phase) * 0.26;

    ctx.beginPath();
    ctx.arc(cx, cy, rippleR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(63, 185, 133, ' + rippleAlpha.toFixed(3) + ')';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Secondary maroon ripple offset by 3s
    var phase2 = ((t + 3000) % period) / period;
    var rippleR2 = phase2 * Math.min(width, height) * 0.55;
    var rippleAlpha2 = (1 - phase2) * 0.22;

    ctx.beginPath();
    ctx.arc(cx, cy, rippleR2, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(194, 74, 91, ' + rippleAlpha2.toFixed(3) + ')';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Central settled node with dual halo
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(194, 74, 91, 0.55)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(63, 185, 133, 0.55)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  // ------------------------------------------------------------------------
  // Mode 8: ML "tensor" (ml.html)
  // Subtle interconnected synaptic nodes in maroon and muted green with faint pulses.
  // ------------------------------------------------------------------------
  var tensorNodes = [];
  for (var tn = 0; tn < 28; tn++) {
    tensorNodes.push({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.00012,
      vy: (Math.random() - 0.5) * 0.00012,
      isMaroon: tn % 2 === 0
    });
  }

  function renderTensorMesh(t, dt) {
    ctx.fillStyle = '#0E0F11';
    ctx.fillRect(0, 0, width, height);

    // Update positions
    for (var i = 0; i < tensorNodes.length; i++) {
      var n = tensorNodes[i];
      if (!reducedMotion) {
        n.x += n.vx * dt;
        n.y += n.vy * dt;
        if (n.x < 0 || n.x > 1) n.vx *= -1;
        if (n.y < 0 || n.y > 1) n.vy *= -1;
      }
    }

    // Draw synaptic lines between close nodes
    ctx.lineWidth = 1.2;
    for (var i = 0; i < tensorNodes.length; i++) {
      var na = tensorNodes[i];
      for (var j = i + 1; j < tensorNodes.length; j++) {
        var nb = tensorNodes[j];
        var dx = (na.x - nb.x) * width;
        var dy = (na.y - nb.y) * height;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 200) {
          var alpha = (1 - dist / 200) * 0.14;
          ctx.strokeStyle = na.isMaroon ? 'rgba(158, 53, 68, ' + alpha.toFixed(3) + ')' : 'rgba(63, 185, 133, ' + alpha.toFixed(3) + ')';
          ctx.beginPath();
          ctx.moveTo(na.x * width, na.y * height);
          ctx.lineTo(nb.x * width, nb.y * height);
          ctx.stroke();
        }
      }
    }

    // Draw soft nodes
    for (var i = 0; i < tensorNodes.length; i++) {
      var n = tensorNodes[i];
      ctx.beginPath();
      ctx.arc(n.x * width, n.y * height, 3.0, 0, Math.PI * 2);
      ctx.fillStyle = n.isMaroon ? 'rgba(194, 74, 91, 0.38)' : 'rgba(99, 212, 163, 0.38)';
      ctx.fill();
    }
  }

  // ------------------------------------------------------------------------
  // Shared Animation Loop
  // ------------------------------------------------------------------------
  function loop(now) {
    var dt = now - lastTime;
    lastTime = now;

    // Dynamic FPS throttle & degrade
    frameCount++;
    fpsTimer += dt;
    if (fpsTimer >= 2000) {
      var fps = (frameCount / fpsTimer) * 1000;
      if (fps < 45 && qualityScale > 0.75) {
        qualityScale = 0.75;
        resize();
      }
      frameCount = 0;
      fpsTimer = 0;
    }

    if (!isPaused) {
      if (mode === 'waves') renderSimulationWaves(now, dt);
      else if (mode === 'contour') renderTechContour(now, dt);
      else if (mode === 'flow') renderWorkingFlow(now, dt);
      else if (mode === 'grid-depth') renderUpgradesGridDepth(now, dt);
      else if (mode === 'horizon') renderRoadmapHorizon(now, dt);
      else if (mode === 'settle') renderThanksSettle(now, dt);
      else if (mode === 'tensor') renderTensorMesh(now, dt);
      else renderAuroraMesh(now, dt);
    }

    if (!reducedMotion) {
      requestAnimationFrame(loop);
    }
  }

  // Start loop (or single frame if reduced motion)
  if (reducedMotion) {
    loop(performance.now());
  } else {
    requestAnimationFrame(loop);
  }
})();

