/* ==========================================================================
   RADAR FUSION — HERO RADAR INTERACTIVE CANVAS (PAGE 1)
   120° Azimuth Sector, 24G maroon + 60G green converging to white fused lock.
   ========================================================================== */

(function () {
  'use strict';

  var canvas = document.getElementById('hero-radar-canvas');
  if (!canvas) return;

  var ctx = canvas.getContext('2d');
  var isPlaying = true;
  var currentScenario = 'converge'; // 'converge', 'crossing', 'still', 'occlusion'
  var animTime = 0;

  // DOM Readout Elements
  var elDist = document.getElementById('hero-dist');
  var elConf = document.getElementById('hero-conf');
  var elVel = document.getElementById('hero-vel');
  var elLat = document.getElementById('hero-lat');

  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var width = 0;
  var height = 0;

  function resize() {
    var rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
  }
  window.addEventListener('resize', resize);
  resize();

  // Scenario Coordinates calculation
  function getPositions(t) {
    var p24 = { x: 0, y: 3.4 };
    var p60 = { x: 0, y: 3.4 };
    var confidence = 99.4;
    var stateLabel = 'FUSED_LOCK';

    if (currentScenario === 'converge') {
      // Drift together and merge
      var cycle = (t * 0.0008) % (Math.PI * 2);
      var sep = Math.sin(cycle) * 0.45;
      p24 = { x: -sep, y: 3.2 + Math.cos(cycle * 0.5) * 0.3 };
      p60 = { x: sep * 0.8, y: 3.25 + Math.cos(cycle * 0.5) * 0.28 };
    } else if (currentScenario === 'crossing') {
      var cx = Math.sin(t * 0.001) * 1.5;
      p24 = { x: cx, y: 3.0 };
      p60 = { x: -cx * 0.9, y: 3.2 };
    } else if (currentScenario === 'still') {
      // Stationary person with micro-motion breathing (~0.2 Hz)
      var breath = Math.sin(t * 0.002) * 0.03;
      p24 = { x: 0.15, y: 2.8 + breath * 0.5 };
      p60 = { x: 0.16, y: 2.8 + breath };
    } else if (currentScenario === 'occlusion') {
      var occCycle = (t * 0.001) % 8;
      p24 = { x: -0.2, y: 3.6 };
      if (occCycle > 4 && occCycle < 6.5) {
        // 60G occluded
        p60 = null;
        confidence = 75.0;
        stateLabel = '24G_HOLD_LATCH';
      } else {
        p60 = { x: -0.18, y: 3.58 };
      }
    }

    var dist = 0;
    var isFused = false;
    var fusedPos = null;

    if (p60) {
      dist = window.RFO.calcEuclidean(p24.x, p24.y, p60.x, p60.y);
      if (dist <= 0.50) {
        isFused = true;
        confidence = 99.4;
        fusedPos = {
          x: 0.45 * p24.x + 0.55 * p60.x,
          y: 0.50 * p24.y + 0.50 * p60.y
        };
      } else {
        confidence = 75.0;
        stateLabel = 'UNASSOCIATED';
      }
    } else {
      dist = 0;
    }

    return {
      p24: p24,
      p60: p60,
      fused: fusedPos,
      isFused: isFused,
      confidence: confidence,
      state: stateLabel
    };
  }

  // World to Canvas coordinate mapping (Origin at bottom center, range 0 to 6 meters)
  function toScreen(wx, wy) {
    var maxRange = 6.0;
    var ox = width * 0.5;
    var oy = height * 0.88;
    var scale = (height * 0.78) / maxRange;

    return {
      x: ox + wx * scale,
      y: oy - wy * scale
    };
  }

  // Render Loop
  var lastNow = performance.now();
  function render(now) {
    var dt = now - lastNow;
    lastNow = now;
    if (isPlaying) animTime += dt;

    ctx.clearRect(0, 0, width, height);

    var origin = toScreen(0, 0);
    var maxRange = 6.0;
    var maxRadius = (height * 0.78);

    // 1. Sector Arc Background Gradients (120 deg azimuth: -60 deg to +60 deg)
    var angleLeft = -Math.PI / 2 - Math.PI / 3;  // -150 deg in screen coords
    var angleRight = -Math.PI / 2 + Math.PI / 3; // -30 deg in screen coords

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.arc(origin.x, origin.y, maxRadius, -Math.PI * 5 / 6, -Math.PI / 6);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
    ctx.fill();

    // Subtle 24G maroon glow fill
    var grad24 = ctx.createRadialGradient(origin.x, origin.y, 0, origin.x, origin.y, maxRadius);
    grad24.addColorStop(0, 'rgba(158, 53, 68, 0.12)');
    grad24.addColorStop(1, 'rgba(158, 53, 68, 0.0)');
    ctx.fillStyle = grad24;
    ctx.fill();

    // Concentric Range Rings (2m, 4m, 6m)
    for (var m = 2; m <= 6; m += 2) {
      var r = (m / maxRange) * maxRadius;
      ctx.beginPath();
      ctx.arc(origin.x, origin.y, r, -Math.PI * 5 / 6, -Math.PI / 6);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
      ctx.setLineDash([3, 4]);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);

      // Label
      ctx.fillStyle = '#6E737B';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(m + '.0m', origin.x + 8, origin.y - r + 4);
    }

    // Radial Guidelines (-60, -30, 0, +30, +60)
    var angles = [-60, -30, 0, 30, 60];
    angles.forEach(function (deg) {
      var rad = (-90 + deg) * (Math.PI / 180);
      var rx = origin.x + Math.cos(rad) * maxRadius;
      var ry = origin.y + Math.sin(rad) * maxRadius;
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(rx, ry);
      ctx.strokeStyle = deg === 0 ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)';
      ctx.stroke();

      // Outer azimuth label
      if (deg !== 0) {
        ctx.fillStyle = '#6E737B';
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(deg + '°', rx, ry - 6);
      }
    });

    // Sensor Rig Origin Dot
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#F2F3F5';
    ctx.fill();
    ctx.restore();

    // 2. Compute Current Scenario Targets
    var data = getPositions(animTime);
    var s24 = toScreen(data.p24.x, data.p24.y);
    var s60 = data.p60 ? toScreen(data.p60.x, data.p60.y) : null;

    // 24G Sensor Target Dot (Maroon)
    ctx.save();
    ctx.beginPath();
    ctx.arc(s24.x, s24.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#9E3544';
    ctx.fill();
    // Halo ring
    ctx.beginPath();
    ctx.arc(s24.x, s24.y, 14, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(194, 74, 91, 0.4)';
    ctx.setLineDash([2, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#C24A5B';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText('24G Raw', s24.x + 12, s24.y - 4);
    ctx.restore();

    // 60G Sensor Target Dot (Green)
    if (s60) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(s60.x, s60.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#3FB985';
      ctx.fill();
      // Halo ring
      ctx.beginPath();
      ctx.arc(s60.x, s60.y, 12, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(99, 212, 163, 0.4)';
      ctx.setLineDash([2, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#63D4A3';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText('60G Cloud', s60.x - 62, s60.y - 4);

      // Distance dashed connecting link
      ctx.beginPath();
      ctx.moveTo(s24.x, s24.y);
      ctx.lineTo(s60.x, s60.y);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.setLineDash([2, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // 3. Fused Target Badge (Pure White with Dual Concentric Ring)
    if (data.isFused && data.fused) {
      var sf = toScreen(data.fused.x, data.fused.y);
      ctx.save();

      // White solid dot
      ctx.beginPath();
      ctx.arc(sf.x, sf.y, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();

      // Dual concentric ring (maroon inner, green outer)
      ctx.beginPath();
      ctx.arc(sf.x, sf.y, 13, 0, Math.PI * 2);
      ctx.strokeStyle = '#9E3544';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(sf.x, sf.y, 18, 0, Math.PI * 2);
      ctx.strokeStyle = '#3FB985';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // Callout Reticle
      ctx.beginPath();
      ctx.moveTo(sf.x, sf.y - 18);
      ctx.lineTo(sf.x, sf.y - 32);
      ctx.lineTo(sf.x + 40, sf.y - 32);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.fillText('TGT #01 [FUSED]', sf.x + 46, sf.y - 28);
      ctx.restore();
    }

    // 4. Update Readout Elements in DOM
    var radialDist = Math.sqrt(data.p24.x * data.p24.x + data.p24.y * data.p24.y);
    if (elDist) elDist.textContent = radialDist.toFixed(2) + ' m';
    if (elConf) elConf.textContent = data.confidence.toFixed(1) + ' %';
    if (elVel) {
      var vel = Math.sin(animTime * 0.001) * 0.18;
      elVel.textContent = (vel >= 0 ? '+' : '') + vel.toFixed(2) + ' m/s';
    }
    if (elLat) elLat.textContent = '14 ms';

    requestAnimationFrame(render);
  }

  // Setup scenario switch buttons
  document.querySelectorAll('[data-hero-scenario]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('[data-hero-scenario]').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      currentScenario = btn.getAttribute('data-hero-scenario');
      animTime = 0;
    });
  });

  // Play/pause button
  var playBtn = document.getElementById('hero-play-toggle');
  if (playBtn) {
    playBtn.addEventListener('click', function () {
      isPlaying = !isPlaying;
      playBtn.textContent = isPlaying ? 'Pause' : 'Play';
    });
  }

  requestAnimationFrame(render);
})();

