/* ==========================================================================
   RADAR FUSION — IN-BROWSER SIMULATION LAB ENGINE (PAGE 2)
   Virtual 24G & 60G sensors, polar noise, greedy fusion, geofence, hex viewer.
   ========================================================================== */

(function () {
  'use strict';

  var RFO = window.RFO || {};

  var canvas = document.getElementById('sim-radar-canvas');
  if (!canvas) return;

  var ctx = canvas.getContext('2d');
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var width, height;

  // Simulator State
  var mode = 'DUAL'; // '24G', '60G', 'DUAL'
  var zoomRange = 6.0; // 2, 4, 6, 8 meters
  var showGrid = true;
  var noiseFactor = 1.0;
  var thresholdDist = 0.50; // meters
  var dropoutRate = 0.05; // 5%
  var isRunning = true;
  var currentPreset = 'converge';

  // Geofence Rectangle (in meters: minX, maxX, minY, maxY)
  var geofence = { minX: -1.2, maxX: 1.2, minY: 2.2, maxY: 4.2, active: true };
  var isDrawingGeofence = false;
  var drawStart = null;

  // Ground Truth Targets (Array of up to 4 targets)
  var targets = [
    { id: 1, x: 0.2, y: 3.2, vx: 0.15, vy: 0.05, type: 'human', path: 'converge' }
  ];

  // Ghost false positives on 24G (simulating multipath / fan / curtain)
  var ghostTarget = { x: 1.8, y: 4.5, active: true };

  // Telemetry Metrics & Scoreboard
  var stats = {
    rmse24: 0.28,
    rmse60: 0.12,
    rmseFused: 0.06,
    fp24: 1,
    fp60: 0,
    fpFused: 0
  };

  // Strip Charts instances
  var chartDist = null;
  var chartVel = null;

  // DOM Elements
  var alertBanner = document.getElementById('sim-alert-banner');
  var telemetryTbody = document.getElementById('sim-telemetry-tbody');
  var hexContainer = document.getElementById('sim-hex-grid');
  var hexTooltip = document.getElementById('sim-hex-tooltip');
  var logList = document.getElementById('sim-log-list');

  // Resize handler
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

  // Initialize Strip Charts
  if (RFO.StripChart) {
    chartDist = new RFO.StripChart('chart-distance', { minVal: 0, maxVal: 6, unit: 'm', color: '#FFFFFF' });
    chartVel = new RFO.StripChart('chart-velocity', { minVal: -1.5, maxVal: 1.5, unit: 'm/s', color: '#3FB985' });
  }

  // Coordinate Conversion
  function toScreen(wx, wy) {
    var ox = width * 0.5;
    var oy = height * 0.88;
    var scale = (height * 0.8) / zoomRange;
    return { x: ox + wx * scale, y: oy - wy * scale };
  }

  function toWorld(sx, sy) {
    var ox = width * 0.5;
    var oy = height * 0.88;
    var scale = (height * 0.8) / zoomRange;
    return { x: (sx - ox) / scale, y: (oy - sy) / scale };
  }

  // ------------------------------------------------------------------------
  // Physics & Sensor Simulation Step (Runs at 10 Hz / 100ms cycle)
  // ------------------------------------------------------------------------
  var lastSimTick = performance.now();
  var simTime = 0;
  var logs = [];

  function addLog(msg) {
    var timeStr = new Date().toTimeString().split(' ')[0] + '.' + Math.floor((performance.now() % 1000));
    logs.unshift('[' + timeStr + '] ' + msg);
    if (logs.length > 25) logs.pop();
    if (logList) {
      logList.innerHTML = logs.map(function (l) { return '<div class="log-entry">' + l + '</div>'; }).join('');
    }
  }

  function simStep() {
    simTime += 0.1;

    // 1. Move Ground Truth Targets based on preset
    targets.forEach(function (tgt, i) {
      if (currentPreset === 'stand') {
        tgt.vx = 0; tgt.vy = 0;
      } else if (currentPreset === 'circle') {
        var ang = simTime * 0.4 + i * (Math.PI / 2);
        tgt.x = Math.sin(ang) * 1.8;
        tgt.y = 3.5 + Math.cos(ang) * 1.2;
      } else if (currentPreset === 'crossing') {
        if (i === 0) { tgt.x = Math.sin(simTime * 0.5) * 2.0; tgt.y = 3.2; }
        else if (i === 1) { tgt.x = -Math.sin(simTime * 0.5) * 2.0; tgt.y = 3.4; }
      } else if (currentPreset === 'ghost') {
        tgt.x = Math.sin(simTime * 0.3) * 0.8;
        tgt.y = 3.0;
        ghostTarget.active = true;
      } else {
        // Default random walk within 120 deg sector
        tgt.x += tgt.vx * 0.1;
        tgt.y += tgt.vy * 0.1;
        if (tgt.x < -2.2 || tgt.x > 2.2) tgt.vx *= -1;
        if (tgt.y < 1.2 || tgt.y > 5.5) tgt.vy *= -1;
      }
    });

    // 2. Generate Noisy Observations for 24G and 60G
    var obs24 = [];
    var obs60 = [];

    targets.forEach(function (tgt) {
      // 24 GHz Observation (Polar noise: sigma_r = 0.08, sigma_theta = 3.5 deg)
      if (Math.random() > dropoutRate) {
        var r = Math.sqrt(tgt.x * tgt.x + tgt.y * tgt.y);
        var theta = Math.atan2(tgt.x, tgt.y); // radians
        var noiseR = RFO.gaussianNoise(0, 0.08 * noiseFactor);
        var noiseTheta = RFO.gaussianNoise(0, (3.5 * Math.PI / 180) * noiseFactor);

        var r24 = Math.max(0.1, r + noiseR);
        var th24 = theta + noiseTheta;
        obs24.push({
          x: r24 * Math.sin(th24),
          y: r24 * Math.cos(th24),
          speed: (tgt.vy * 100) + RFO.gaussianNoise(0, 5) // cm/s
        });
      }

      // 60 GHz Observation (Polar noise: sigma_r = 0.03, sigma_theta = 1.0 deg)
      if (Math.random() > dropoutRate * 0.8) {
        var r = Math.sqrt(tgt.x * tgt.x + tgt.y * tgt.y);
        var theta = Math.atan2(tgt.x, tgt.y);
        var noiseR = RFO.gaussianNoise(0, 0.03 * noiseFactor);
        var noiseTheta = RFO.gaussianNoise(0, (1.0 * Math.PI / 180) * noiseFactor);

        var r60 = Math.max(0.1, r + noiseR);
        var th60 = theta + noiseTheta;
        obs60.push({
          x: r60 * Math.sin(th60),
          y: r60 * Math.cos(th60),
          speed: tgt.vy + RFO.gaussianNoise(0, 0.02) // m/s
        });
      }
    });

    // Add Ghost reflection to 24G if preset or toggled
    if (ghostTarget.active) {
      obs24.push({
        x: ghostTarget.x + RFO.gaussianNoise(0, 0.05),
        y: ghostTarget.y + RFO.gaussianNoise(0, 0.05),
        speed: RFO.gaussianNoise(0, 10),
        isGhost: true
      });
    }

    // 3. Greedy Nearest-Neighbor Fusion Algorithm
    var fusedTargets = [];
    var unassociated24 = [];
    var unassociated60 = obs60.slice();

    obs24.forEach(function (o24) {
      var bestMatch = null;
      var bestDist = Infinity;
      var bestIdx = -1;

      unassociated60.forEach(function (o60, idx) {
        var d = RFO.calcEuclidean(o24.x, o24.y, o60.x, o60.y);
        if (d < bestDist) {
          bestDist = d;
          bestMatch = o60;
          bestIdx = idx;
        }
      });

      if (bestDist <= thresholdDist && bestMatch) {
        // Confirmed Fused Pair!
        unassociated60.splice(bestIdx, 1);
        fusedTargets.push({
          x: 0.45 * o24.x + 0.55 * bestMatch.x,
          y: 0.50 * o24.y + 0.50 * bestMatch.y,
          speed: 0.5 * (o24.speed / 100) + 0.5 * bestMatch.speed,
          confidence: 99.4,
          status: 'FUSED_LOCK',
          distSeparation: bestDist
        });
      } else {
        // Single sensor candidate (rejected if ghost!)
        unassociated24.push(o24);
      }
    });

    // Single sensor targets keep 75% confidence
    unassociated24.forEach(function (u24) {
      if (!u24.isGhost) {
        fusedTargets.push({
          x: u24.x, y: u24.y, speed: u24.speed / 100, confidence: 75.0, status: '24G_SINGLE'
        });
      } else {
        // Ghost rejected by dual-frequency fusion!
        if (mode === 'DUAL') {
          // Suppressed!
        } else if (mode === '24G') {
          fusedTargets.push({
            x: u24.x, y: u24.y, speed: u24.speed / 100, confidence: 60.0, status: 'GHOST_REFLECTION'
          });
        }
      }
    });

    unassociated60.forEach(function (u60) {
      fusedTargets.push({
        x: u60.x, y: u60.y, speed: u60.speed, confidence: 75.0, status: '60G_SINGLE'
      });
    });

    // 4. Geofence Intrusion Evaluation
    var isBreached = false;
    var activeOutputTargets = mode === '24G' ? obs24 : (mode === '60G' ? obs60 : fusedTargets);

    activeOutputTargets.forEach(function (t) {
      if (geofence.active) {
        if (t.x >= geofence.minX && t.x <= geofence.maxX && t.y >= geofence.minY && t.y <= geofence.maxY) {
          isBreached = true;
        }
      }
    });

    if (alertBanner) {
      if (isBreached) {
        alertBanner.classList.add('active', 'alert-breach-pulse');
        alertBanner.innerHTML = '⚠️ INTRUSION ALERT // GEOFENCE BREACH DETECTED IN SECTOR A';
        if (RFO.playAlarmTone) RFO.playAlarmTone();
        if (RFO.events) RFO.events.emit('radar-alert', {});
      } else {
        alertBanner.classList.remove('active', 'alert-breach-pulse');
        alertBanner.innerHTML = 'STATUS: NORMAL // GEOFENCE SECURE';
      }
    }

    // 5. Update Telemetry Table & Strip Charts
    if (activeOutputTargets.length > 0) {
      var primary = activeOutputTargets[0];
      var rDist = Math.sqrt(primary.x * primary.x + primary.y * primary.y);
      if (chartDist) chartDist.push(rDist);
      if (chartVel) chartVel.push(primary.speed || 0);
      updateDopplerStream(primary.speed || 0);

      // Render Telemetry Table
      if (telemetryTbody) {
        telemetryTbody.innerHTML = activeOutputTargets.map(function (tgt, idx) {
          var rD = Math.sqrt(tgt.x * tgt.x + tgt.y * tgt.y);
          var conf = tgt.confidence || (mode === '24G' ? 75 : 85);
          var statusClass = conf > 90 ? 'badge-green' : (conf > 65 ? 'badge-maroon' : 'badge-alert');
          return '<tr>' +
            '<td class="font-mono">#0' + (idx + 1) + '</td>' +
            '<td class="font-mono">' + tgt.x.toFixed(2) + ' m</td>' +
            '<td class="font-mono">' + tgt.y.toFixed(2) + ' m</td>' +
            '<td class="font-mono">' + rD.toFixed(2) + ' m</td>' +
            '<td class="font-mono">' + (tgt.speed || 0).toFixed(2) + ' m/s</td>' +
            '<td><span class="badge ' + statusClass + '">' + conf.toFixed(1) + '%</span></td>' +
            '</tr>';
        }).join('');
      }
    }

    // 6. Update Synthetic 30-Byte LD2452 Frame Hex Viewer
    renderHexViewer(targets[0] || { x: 0, y: 0, vx: 0, vy: 0 });

    return { obs24: obs24, obs60: obs60, fused: fusedTargets };
  }

  // ------------------------------------------------------------------------
  // Hex Viewer Rendering
  // ------------------------------------------------------------------------
  function renderHexViewer(tgt) {
    if (!hexContainer) return;

    var x_mm = Math.round(tgt.x * 1000);
    var y_mm = Math.round(tgt.y * 1000);
    var sp_cms = Math.round((tgt.vy || 0) * 100);
    var d_mm = Math.round(Math.sqrt(tgt.x * tgt.x + tgt.y * tgt.y) * 1000);

    var bytes = [
      0xAA, 0xFF, 0x03, 0x00, // Header
      (x_mm & 0xFF), ((x_mm >> 8) & 0xFF),
      (y_mm & 0xFF), ((y_mm >> 8) & 0xFF),
      (sp_cms & 0xFF), ((sp_cms >> 8) & 0xFF),
      (d_mm & 0xFF), ((d_mm >> 8) & 0xFF),
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // Target 2 empty
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // Target 3 empty
      0x55, 0xCC // Tail
    ];

    hexContainer.innerHTML = bytes.map(function (b, idx) {
      var cls = 'hex-byte';
      if (idx <= 3) cls += ' header';
      else if (idx >= 4 && idx <= 11) cls += ' target';
      else if (idx >= 28) cls += ' tail';

      var hexStr = ('0' + b.toString(16).toUpperCase()).slice(-2);
      return '<div class="' + cls + '" data-idx="' + idx + '" data-hex="' + hexStr + '">' + hexStr + '</div>';
    }).join('');

    // Hover Tooltips on Bytes
    hexContainer.querySelectorAll('.hex-byte').forEach(function (el) {
      el.addEventListener('mouseenter', function (e) {
        var idx = parseInt(el.getAttribute('data-idx'), 10);
        var info = RFO.decodeLD2452Byte(idx);
        if (hexTooltip) {
          hexTooltip.innerHTML = '<strong>Byte [' + idx + '] (0x' + el.getAttribute('data-hex') + '): ' + info.field + '</strong><br>' + info.desc;
          hexTooltip.style.display = 'block';
        }
      });
      el.addEventListener('mouseleave', function () {
        if (hexTooltip) hexTooltip.style.display = 'none';
      });
    });
  }

  // ------------------------------------------------------------------------
  // Canvas Rendering Loop
  // ------------------------------------------------------------------------
  var lastSimData = { obs24: [], obs60: [], fused: [] };

  function render(now) {
    if (now - lastSimTick >= 100) {
      lastSimTick = now;
      if (isRunning) {
        lastSimData = simStep();
      }
    }

    ctx.clearRect(0, 0, width, height);

    var origin = toScreen(0, 0);
    var maxRadius = (height * 0.8);

    // 1. Sector Arc Grid (120 deg azimuth: -60 deg to +60 deg)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.arc(origin.x, origin.y, maxRadius, -Math.PI * 5 / 6, -Math.PI / 6);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.012)';
    ctx.fill();

    // Range Rings
    var ringStep = zoomRange <= 4 ? 1 : 2;
    for (var r = ringStep; r <= zoomRange; r += ringStep) {
      var rad = (r / zoomRange) * maxRadius;
      ctx.beginPath();
      ctx.arc(origin.x, origin.y, rad, -Math.PI * 5 / 6, -Math.PI / 6);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      if (showGrid) ctx.setLineDash([3, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#6E737B';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(r + '.0m', origin.x + 8, origin.y - rad + 4);
    }

    // Radial Spokes
    [-60, -30, 0, 30, 60].forEach(function (deg) {
      var rad = (-90 + deg) * (Math.PI / 180);
      var rx = origin.x + Math.cos(rad) * maxRadius;
      var ry = origin.y + Math.sin(rad) * maxRadius;
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(rx, ry);
      ctx.strokeStyle = deg === 0 ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)';
      ctx.stroke();
    });

    // 2. Geofence Box
    if (geofence.active) {
      var pMin = toScreen(geofence.minX, geofence.maxY);
      var pMax = toScreen(geofence.maxX, geofence.minY);
      var gw = pMax.x - pMin.x;
      var gh = pMax.y - pMin.y;

      ctx.fillStyle = 'rgba(214, 69, 93, 0.12)';
      ctx.fillRect(pMin.x, pMin.y, gw, gh);
      ctx.strokeStyle = '#D6455D';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(pMin.x, pMin.y, gw, gh);
      ctx.setLineDash([]);

      ctx.fillStyle = '#D6455D';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText('GEOFENCE ZONE A', pMin.x + 8, pMin.y + 16);
    }

    // 3. Render Targets based on Mode
    if (mode === '24G' || mode === 'DUAL') {
      lastSimData.obs24.forEach(function (o) {
        var pt = toScreen(o.x, o.y);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = o.isGhost ? 'rgba(158, 53, 68, 0.5)' : '#9E3544';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 14, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(194, 74, 91, 0.35)';
        ctx.stroke();

        ctx.fillStyle = '#C24A5B';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillText(o.isGhost ? '24G (Ghost)' : '24G Raw', pt.x + 10, pt.y - 2);
      });
    }

    if (mode === '60G' || mode === 'DUAL') {
      lastSimData.obs60.forEach(function (o) {
        var pt = toScreen(o.x, o.y);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#3FB985';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 11, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(99, 212, 163, 0.35)';
        ctx.stroke();

        ctx.fillStyle = '#63D4A3';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillText('60G Cloud', pt.x - 58, pt.y - 2);
      });
    }

    if (mode === 'DUAL') {
      lastSimData.fused.forEach(function (f) {
        if (f.status === 'FUSED_LOCK') {
          var pt = toScreen(f.x, f.y);

          // Crisp white dot
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 7, 0, Math.PI * 2);
          ctx.fillStyle = '#FFFFFF';
          ctx.fill();

          // Concentric dual rings
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 13, 0, Math.PI * 2);
          ctx.strokeStyle = '#9E3544';
          ctx.lineWidth = 1.4;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 18, 0, Math.PI * 2);
          ctx.strokeStyle = '#3FB985';
          ctx.lineWidth = 1.4;
          ctx.stroke();

          ctx.fillStyle = '#FFFFFF';
          ctx.font = '600 11px "JetBrains Mono", monospace';
          ctx.fillText('FUSED [' + f.confidence.toFixed(1) + '%]', pt.x + 22, pt.y + 4);
        }
      });
    }

    // Origin Node
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#F2F3F5';
    ctx.fill();

    ctx.restore();
    requestAnimationFrame(render);
  }

  // ------------------------------------------------------------------------
  // Interactivity: Drag Targets & Draw Geofence
  // ------------------------------------------------------------------------
  var draggedTarget = null;

  canvas.addEventListener('mousedown', function (e) {
    var rect = canvas.getBoundingClientRect();
    var mx = e.clientX - rect.left;
    var my = e.clientY - rect.top;
    var wPos = toWorld(mx, my);

    if (e.shiftKey) {
      // Shift+Drag to define Geofence
      isDrawingGeofence = true;
      drawStart = wPos;
      return;
    }

    // Check hit test on ground truth targets
    targets.forEach(function (tgt) {
      var scr = toScreen(tgt.x, tgt.y);
      var d = Math.sqrt((scr.x - mx) * (scr.x - mx) + (scr.y - my) * (scr.y - my));
      if (d < 24) {
        draggedTarget = tgt;
      }
    });
  });

  window.addEventListener('mousemove', function (e) {
    var rect = canvas.getBoundingClientRect();
    var mx = e.clientX - rect.left;
    var my = e.clientY - rect.top;
    var wPos = toWorld(mx, my);

    if (draggedTarget) {
      draggedTarget.x = wPos.x;
      draggedTarget.y = wPos.y;
    } else if (isDrawingGeofence && drawStart) {
      geofence.minX = Math.min(drawStart.x, wPos.x);
      geofence.maxX = Math.max(drawStart.x, wPos.x);
      geofence.minY = Math.min(drawStart.y, wPos.y);
      geofence.maxY = Math.max(drawStart.y, wPos.y);
      geofence.active = true;
    }
  });

  window.addEventListener('mouseup', function () {
    draggedTarget = null;
    isDrawingGeofence = false;
  });

  // Touch Support for mobile
  canvas.addEventListener('touchstart', function (e) {
    if (e.touches.length === 1) {
      var rect = canvas.getBoundingClientRect();
      var mx = e.touches[0].clientX - rect.left;
      var my = e.touches[0].clientY - rect.top;
      targets.forEach(function (tgt) {
        var scr = toScreen(tgt.x, tgt.y);
        var d = Math.sqrt((scr.x - mx) * (scr.x - mx) + (scr.y - my) * (scr.y - my));
        if (d < 30) draggedTarget = tgt;
      });
    }
  }, { passive: true });

  canvas.addEventListener('touchmove', function (e) {
    if (draggedTarget && e.touches.length === 1) {
      var rect = canvas.getBoundingClientRect();
      var mx = e.touches[0].clientX - rect.left;
      var my = e.touches[0].clientY - rect.top;
      var wPos = toWorld(mx, my);
      draggedTarget.x = wPos.x;
      draggedTarget.y = wPos.y;
    }
  }, { passive: true });

  window.addEventListener('touchend', function () {
    draggedTarget = null;
  });

  // ------------------------------------------------------------------------
  // UI Controls Wire-up
  // ------------------------------------------------------------------------
  // Mode Buttons
  document.querySelectorAll('[data-sim-mode]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('[data-sim-mode]').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      mode = btn.getAttribute('data-sim-mode');
      addLog('Mode switched to ' + mode);
    });
  });

  // Zoom Buttons
  document.querySelectorAll('[data-sim-zoom]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      zoomRange = parseFloat(btn.getAttribute('data-sim-zoom'));
      document.querySelectorAll('[data-sim-zoom]').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
    });
  });

  // Preset Buttons
  document.querySelectorAll('[data-sim-preset]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      currentPreset = btn.getAttribute('data-sim-preset');
      document.querySelectorAll('[data-sim-preset]').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');

      if (currentPreset === 'crossing') {
        targets = [
          { id: 1, x: -1.5, y: 3.2, vx: 0.2, vy: 0, type: 'human' },
          { id: 2, x: 1.5, y: 3.4, vx: -0.2, vy: 0, type: 'human' }
        ];
        ghostTarget.active = false;
      } else if (currentPreset === 'ghost') {
        targets = [{ id: 1, x: 0, y: 3.2, vx: 0.1, vy: 0.05, type: 'human' }];
        ghostTarget.active = true;
      } else {
        targets = [{ id: 1, x: 0.2, y: 3.2, vx: 0.15, vy: 0.05, type: 'human' }];
        ghostTarget.active = false;
      }
      addLog('Loaded Scenario: ' + btn.textContent.trim());
    });
  });

  // Threshold Slider
  var sliderThresh = document.getElementById('slider-threshold');
  var valThresh = document.getElementById('val-threshold');
  if (sliderThresh && valThresh) {
    sliderThresh.addEventListener('input', function (e) {
      thresholdDist = parseFloat(e.target.value);
      valThresh.textContent = thresholdDist.toFixed(2) + ' m';
    });
  }

  // Noise Slider
  var sliderNoise = document.getElementById('slider-noise');
  var valNoise = document.getElementById('val-noise');
  if (sliderNoise && valNoise) {
    sliderNoise.addEventListener('input', function (e) {
      noiseFactor = parseFloat(e.target.value);
      valNoise.textContent = noiseFactor.toFixed(1) + 'x';
    });
  }

  // Sound Enable Button
  var soundBtn = document.getElementById('btn-sound-toggle');
  if (soundBtn) {
    soundBtn.addEventListener('click', function () {
      RFO.enableAudio();
      soundBtn.textContent = '🔊 Sound On';
      soundBtn.classList.add('btn-green');
      addLog('Web Audio Synthesizer initialized.');
    });
  }

  // CSV Export Button
  var csvBtn = document.getElementById('btn-export-csv');
  if (csvBtn) {
    csvBtn.addEventListener('click', function () {
      var headers = ['Timestamp_ms', 'Target_ID', 'X_meters', 'Y_meters', 'Speed_mps', 'Confidence_pct', 'State'];
      var rows = targets.map(function (t, i) {
        return [performance.now().toFixed(0), t.id, t.x.toFixed(3), t.y.toFixed(3), (t.vy || 0).toFixed(2), 99.4, 'CONFIRMED'];
      });
      RFO.downloadCSV('radar_fusion_telemetry.csv', headers, rows);
      addLog('Exported telemetry log to CSV.');
    });
  }

  // Live Hardware WebSocket Bridge (Optional ws://<ip>/ws field)
  var wsInput = document.getElementById('ws-ip-input');
  var wsConnectBtn = document.getElementById('btn-ws-connect');
  var wsStatus = document.getElementById('ws-status-badge');

  if (wsConnectBtn && wsInput) {
    wsConnectBtn.addEventListener('click', function () {
      var ip = wsInput.value.trim();
      if (!ip) return;
      var url = ip.startsWith('ws://') ? ip : 'ws://' + ip + '/ws';
      addLog('Attempting WebSocket connection to: ' + url);

      try {
        var ws = new WebSocket(url);
        ws.onopen = function () {
          if (wsStatus) {
            wsStatus.textContent = 'ONLINE (ESP32 LIVE)';
            wsStatus.className = 'badge badge-green';
          }
          addLog('Connected to ESP32 Hardware Server!');
        };
        ws.onmessage = function (evt) {
          try {
            var pkt = JSON.parse(evt.data);
            if (pkt && pkt.targets) {
              targets = pkt.targets.map(function (pt, idx) {
                return { id: idx + 1, x: pt.x, y: pt.y, vx: pt.vx || 0, vy: pt.vy || 0 };
              });
            }
          } catch (err) {}
        };
        ws.onerror = function () {
          addLog('Hardware WebSocket unreachable. Fallback to browser simulation engine.');
          if (wsStatus) {
            wsStatus.textContent = 'SIMULATOR ACTIVE';
            wsStatus.className = 'badge badge-maroon';
          }
        };
      } catch (e) {
        addLog('WebSocket error: ' + e.message);
      }
    });
  }

  // Live Doppler Stream Visualizer
  var dopplerCanvas = document.getElementById('chart-doppler-stream');
  var dCtx = dopplerCanvas ? dopplerCanvas.getContext('2d') : null;
  var dopplerHistory = [];

  function updateDopplerStream(speed) {
    if (!dopplerCanvas || !dCtx) return;
    var dw = dopplerCanvas.width = Math.floor(dopplerCanvas.clientWidth || 300);
    var dh = dopplerCanvas.height = Math.floor(dopplerCanvas.clientHeight || 70);
    dopplerHistory.push(speed || 0);
    if (dopplerHistory.length > 80) dopplerHistory.shift();

    dCtx.clearRect(0, 0, dw, dh);
    var midY = dh * 0.5;
    dCtx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    dCtx.setLineDash([2, 3]);
    dCtx.beginPath(); dCtx.moveTo(0, midY); dCtx.lineTo(dw, midY); dCtx.stroke();
    dCtx.setLineDash([]);

    var step = dw / 80;
    dCtx.lineWidth = 1.8;
    for (var i = 0; i < dopplerHistory.length - 1; i++) {
      var s = dopplerHistory[i];
      var x1 = i * step;
      var y1 = midY - (s / 1.5) * (dh * 0.42);
      var x2 = (i + 1) * step;
      var y2 = midY - (dopplerHistory[i + 1] / 1.5) * (dh * 0.42);

      dCtx.strokeStyle = s > 0.04 ? '#3FB985' : (s < -0.04 ? '#9E3544' : '#FFFFFF');
      dCtx.beginPath();
      dCtx.moveTo(x1, y1);
      dCtx.lineTo(x2, y2);
      dCtx.stroke();
    }
  }

  // Multipath Ghost Reflection Toggle
  var toggleGhost = document.getElementById('toggle-ghost');
  if (toggleGhost) {
    toggleGhost.addEventListener('change', function () {
      if (toggleGhost.checked) {
        targets.push({ id: 99, x: 2.2, y: 3.5, vx: -0.05, vy: 0.1, isGhost: true });
        addLog('Multipath wall bounce enabled: Spurious 24G ghost return active.');
      } else {
        targets = targets.filter(function (t) { return !t.isGhost; });
        addLog('Multipath reflection disabled.');
      }
    });
  }

  // Target RCS Slider
  var sliderRCS = document.getElementById('slider-rcs');
  var valRCS = document.getElementById('val-rcs');
  if (sliderRCS && valRCS) {
    sliderRCS.addEventListener('input', function () {
      valRCS.textContent = parseFloat(sliderRCS.value).toFixed(1) + ' m²';
    });
  }

  requestAnimationFrame(render);
})();

