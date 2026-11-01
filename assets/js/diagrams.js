/* ==========================================================================
   RADAR FUSION — INTERACTIVE DIAGRAMS ENGINE
   FMCW chirps, wavelength generator, GPIO crossbar, 6-step fusion stepper,
   Life of One Frame timeline scrubber, TFT touch mock, Kalman before/after.
   ========================================================================== */

(function () {
  'use strict';

  var RFO = window.RFO || {};

  // ------------------------------------------------------------------------
  // 1. FMCW Chirp & Beat Frequency Interactive Diagram (tech.html)
  // ------------------------------------------------------------------------
  RFO.initFMCWDiagram = function (canvasId) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w, h;

    function resize() {
      var rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }
    window.addEventListener('resize', resize);
    resize();

    var t = 0;
    function draw() {
      ctx.clearRect(0, 0, w, h);
      t += 0.8;

      var originX = 50;
      var originY = h - 35;
      var plotW = w - 70;
      var plotH = h - 60;

      // Axes
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(originX, 20); ctx.lineTo(originX, originY); ctx.lineTo(w - 20, originY);
      ctx.stroke();

      ctx.fillStyle = '#6E737B';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText('Frequency (f)', 10, 18);
      ctx.fillText('Time (t)', w - 45, originY + 16);

      // Sawtooth FMCW Chirp parameters
      var chirpPeriod = 120;
      var delay = 22; // round-trip delay tau = 2R/c

      // TX Chirp (Maroon)
      ctx.beginPath();
      ctx.strokeStyle = '#9E3544';
      ctx.lineWidth = 2;
      for (var x = 0; x < plotW; x++) {
        var phase = (x + t) % chirpPeriod;
        var f = originY - (phase / chirpPeriod) * plotH;
        if (x === 0 || phase === 0) ctx.moveTo(originX + x, f);
        else ctx.lineTo(originX + x, f);
      }
      ctx.stroke();

      // RX Delayed Chirp (Green)
      ctx.beginPath();
      ctx.strokeStyle = '#3FB985';
      ctx.lineWidth = 2;
      for (var x = delay; x < plotW; x++) {
        var phase = (x - delay + t) % chirpPeriod;
        var f = originY - (phase / chirpPeriod) * plotH;
        if (x === delay || phase === 0) ctx.moveTo(originX + x, f);
        else ctx.lineTo(originX + x, f);
      }
      ctx.stroke();

      // Beat Frequency fb bracket
      var midX = originX + 70;
      var phaseTX = (70 + t) % chirpPeriod;
      var phaseRX = (70 - delay + t) % chirpPeriod;
      var yTX = originY - (phaseTX / chirpPeriod) * plotH;
      var yRX = originY - (phaseRX / chirpPeriod) * plotH;

      if (yTX < originY && yRX < originY && Math.abs(yTX - yRX) > 5) {
        ctx.beginPath();
        ctx.moveTo(midX, yTX);
        ctx.lineTo(midX, yRX);
        ctx.strokeStyle = '#FFFFFF';
        ctx.setLineDash([2, 2]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '600 11px "JetBrains Mono", monospace';
        ctx.fillText('fb (Beat Freq)', midX + 8, (yTX + yRX) / 2 + 4);
      }

      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  };

  // ------------------------------------------------------------------------
  // 2. Wavelength Relative Simulator (24 GHz vs 60 GHz) (index.html, tech.html)
  // ------------------------------------------------------------------------
  RFO.initWavelengthDiagram = function (canvasId) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w, h;

    function resize() {
      var rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }
    window.addEventListener('resize', resize);
    resize();

    var t = 0;
    function draw() {
      ctx.clearRect(0, 0, w, h);
      t += 0.03;

      var mid1 = h * 0.3;
      var mid2 = h * 0.72;

      // 24 GHz Wave (lambda = 12.5 mm, longer wave)
      ctx.beginPath();
      ctx.strokeStyle = '#9E3544';
      ctx.lineWidth = 2.2;
      var lambda24 = 65; // pixels
      for (var x = 0; x < w; x++) {
        var y = mid1 + Math.sin((x / lambda24) * Math.PI * 2 - t) * 22;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // 60 GHz Wave (lambda = 5.0 mm, exactly 2.5x tighter frequency)
      ctx.beginPath();
      ctx.strokeStyle = '#3FB985';
      ctx.lineWidth = 2.2;
      var lambda60 = lambda24 / 2.5; // 26 pixels
      for (var x = 0; x < w; x++) {
        var y = mid2 + Math.sin((x / lambda60) * Math.PI * 2 - t * 2.5) * 18;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Labels and Wavelength Callouts
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillStyle = '#C24A5B';
      ctx.fillText('24 GHz FMCW  (λ ≈ 12.5 mm) — Wide-angle Wall & Fabric Penetration', 16, mid1 - 32);

      ctx.fillStyle = '#63D4A3';
      ctx.fillText('60 GHz FMCW  (λ ≈ 5.0 mm) — 2.5x Resolution, Micro-Doppler Breathing', 16, mid2 - 28);

      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  };

  // ------------------------------------------------------------------------
  // 3. ESP32 GPIO Interactive Matrix Diagram (index.html, tech.html)
  // ------------------------------------------------------------------------
  RFO.initGPIOMatrix = function () {
    var chips = document.querySelectorAll('.chip-selector');
    var rows = document.querySelectorAll('.gpio-row');
    var noteBox = document.getElementById('gpio-note');

    var pinNotes = {
      'ld2452': 'HLK-LD2452 uses real Hardware UART1 on GPIO16 (RX) and GPIO17 (TX) @ 256,000 bps. Penetrates clothing and drywall.',
      'ld6003d': 'HLK-LD6003D uses hardware remapped UART0 pins on GPIO25 (RX) and GPIO26 (TX) @ 115,200 bps via ESP32 GPIO Matrix. (Never SoftwareSerial).',
      'tft': 'ILI9488 3.5" (480x320) LCD on shared VSPI: MOSI=23, SCK=18, MISO=19. Dedicated CS=GPIO15, DC=GPIO2, RST=GPIO4, Backlight=GPIO27.',
      'touch': 'XPT2046 Resistive Touch Controller shares VSPI bus lines (MOSI 23, SCK 18, MISO 19) with dedicated Touch CS=GPIO21 and IRQ=GPIO22.',
      'buzzer': 'Optional piezo acoustic transducer on GPIO32 for intrusion alert audio feedback.',
      'forbidden': 'CRITICAL SAFETY: GPIO 9 and 10 are internally wired to SPI Flash memory. NEVER connect or route to them, or ESP32 enters a boot crash loop.'
    };

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        chips.forEach(function (c) { c.classList.remove('active'); });
        chip.classList.add('active');
        var targetGroup = chip.getAttribute('data-chip');

        rows.forEach(function (row) {
          if (targetGroup === 'all' || row.getAttribute('data-group') === targetGroup) {
            row.style.opacity = '1';
            row.style.background = 'rgba(255, 255, 255, 0.05)';
          } else {
            row.style.opacity = '0.3';
            row.style.background = 'transparent';
          }
        });

        if (noteBox && pinNotes[targetGroup]) {
          noteBox.textContent = pinNotes[targetGroup];
        }
      });
    });
  };

  // ------------------------------------------------------------------------
  // 4. 6-Step Interactive Fusion Pipeline Stepper (tech.html)
  // ------------------------------------------------------------------------
  RFO.initFusionStepper = function () {
    var steps = [
      {
        num: '01',
        title: 'Concurrent Frame Ingestion',
        desc: 'UART1 (24G @ 256,000 baud) and UART0 (60G @ 115,200 baud) are read into non-blocking FreeRTOS ring-buffers every 100 ms.',
        matrix: 'Frame Sync: LD2452 30-byte [AA FF 03 00 ... 55 CC] | LD6003D [53 59 ... 54 43]'
      },
      {
        num: '02',
        title: 'Euclidean Distance Matrix Calculation',
        desc: 'Computes spatial Euclidean separation between all detected 24G targets and 60G point cloud clusters: d = √((X24 - X60)² + (Y24 - Y60)²).',
        matrix: 'Dist Matrix (m): Target 1 vs Cluster A = 0.34 m | Target 1 vs Cluster B = 2.15 m'
      },
      {
        num: '03',
        title: 'Association Gating (Threshold ≤ 0.50 m)',
        desc: 'One-to-one greedy nearest-neighbor matching isolates paired tracks that fall within the physical 0.50 m human torso envelope.',
        matrix: 'Gating Result: Pair (T1, CA) locked (d = 0.34m ≤ 0.50m threshold). Spurious multipath rejected.'
      },
      {
        num: '04',
        title: 'Asymmetric Weighted Coordinate Fusion',
        desc: 'Combines X and Y coordinates using calibrated weights: X_fused = 0.45*X24 + 0.55*X60, Y_fused = 0.50*Y24 + 0.50*Y60.',
        matrix: 'X_fused = 0.45*(+0.12) + 0.55*(+0.16) = +0.14 m | Y_fused = 0.50*(3.40) + 0.50*(3.44) = 3.42 m'
      },
      {
        num: '05',
        title: 'Confidence Scoring & Anti-Flicker Latch',
        desc: 'Dual-verified targets elevate to 99% confidence. Single-sensor candidates remain at 75%. If 60G briefly occludes, 24G maintains a 5.0 s latch.',
        matrix: 'Track State: ID #01 CONFIRMED_LOCKED (99.4% confidence, Latch Hold: 5.000s)'
      },
      {
        num: '06',
        title: 'Unified Telemetry Dispatch',
        desc: 'Merged coordinate vector dispatches simultaneously to local 480x320 SPI TFT display and WebSocket client dashboards @ 10 Hz.',
        matrix: 'Output: SPI LCD Frame Refresh + WebSocket JSON payload broadcast (Port 80 / SoftAP)'
      }
    ];

    var currentStep = 0;
    var elNum = document.getElementById('fusion-step-num');
    var elTitle = document.getElementById('fusion-step-title');
    var elDesc = document.getElementById('fusion-step-desc');
    var elMatrix = document.getElementById('fusion-step-matrix');
    var prevBtn = document.getElementById('fusion-step-prev');
    var nextBtn = document.getElementById('fusion-step-next');

    function updateStep() {
      var s = steps[currentStep];
      if (elNum) elNum.textContent = 'STEP ' + s.num;
      if (elTitle) elTitle.textContent = s.title;
      if (elDesc) elDesc.textContent = s.desc;
      if (elMatrix) elMatrix.textContent = s.matrix;

      // Update pill buttons
      document.querySelectorAll('.fusion-step-pill').forEach(function (pill, idx) {
        if (idx === currentStep) pill.classList.add('active');
        else pill.classList.remove('active');
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        if (currentStep > 0) { currentStep--; updateStep(); }
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        if (currentStep < steps.length - 1) { currentStep++; updateStep(); }
      });
    }

    document.querySelectorAll('.fusion-step-pill').forEach(function (pill, idx) {
      pill.addEventListener('click', function () {
        currentStep = idx;
        updateStep();
      });
    });

    updateStep();
  };

  // ------------------------------------------------------------------------
  // 5. Life of One Frame Timeline Scrubber (working.html)
  // ------------------------------------------------------------------------
  RFO.initLifeOfFrame = function () {
    var scrubber = document.getElementById('frame-scrubber');
    var readoutTime = document.getElementById('frame-time');
    var readoutStage = document.getElementById('frame-stage');
    var readoutDesc = document.getElementById('frame-desc');

    if (!scrubber) return;

    var stages = [
      { t: 0, stage: 'FMCW Chirp Emission', desc: 'Synthesizer ramps 24 GHz (12.5mm) and 60 GHz (5mm) RF waves across target area.' },
      { t: 15, stage: 'Torso Echo & Baseband Beat', desc: 'Reflected chirp strikes human occupant; receiver extracts beat frequency fb.' },
      { t: 35, stage: 'UART Stream Ingestion', desc: 'LD2452 emits 30-byte frame @ 256k baud; LD6003D sends SY packet @ 115k baud.' },
      { t: 50, stage: 'RingBuffer Parsing & Gating', desc: 'Core 0 validates sync header AA FF 03 00 and tail 55 CC, extracting millimeter X/Y/Speed.' },
      { t: 70, stage: 'Spatial Fusion (d ≤ 0.50m)', desc: 'Core 1 computes Euclidean distance; matches targets, calculates weighted center.' },
      { t: 85, stage: '3.5" TFT SPI Render', desc: 'VSPI bus drives ILI9488 480x320 landscape polar display with target blips and buttons.' },
      { t: 100, stage: 'WebSocket JSON Broadcast', desc: 'AsyncTCP dispatches WebSocket frame to browser dashboard and SoftAP clients.' }
    ];

    function update(val) {
      var ms = parseInt(val, 10);
      if (readoutTime) readoutTime.textContent = ms + ' ms';

      var matched = stages[0];
      for (var i = 0; i < stages.length; i++) {
        if (ms >= stages[i].t) matched = stages[i];
      }
      if (readoutStage) readoutStage.textContent = matched.stage;
      if (readoutDesc) readoutDesc.textContent = matched.desc;
    }

    scrubber.addEventListener('input', function (e) {
      update(e.target.value);
    });
    update(0);
  };

  // ------------------------------------------------------------------------
  // 6. TFT Touch UI Mock Interactivity (working.html)
  // ------------------------------------------------------------------------
  RFO.initTFTMock = function () {
    var screenMsg = document.getElementById('tft-screen-msg');
    var zoomLabel = document.getElementById('tft-zoom-label');
    var currentZoom = 6;

    document.querySelectorAll('[data-tft-btn]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var action = btn.getAttribute('data-tft-btn');

        if (action === 'zoom') {
          var zooms = [2, 4, 6, 8];
          var nextIdx = (zooms.indexOf(currentZoom) + 1) % zooms.length;
          currentZoom = zooms[nextIdx];
          if (zoomLabel) zoomLabel.textContent = 'ZOOM ' + currentZoom + 'm';
          if (screenMsg) screenMsg.textContent = 'Display Scale set to ' + currentZoom + ' meters.';
        } else if (action === 'mode') {
          var mode = btn.textContent.trim();
          if (screenMsg) screenMsg.textContent = 'Sensor Mode switched to: ' + mode;
        } else if (action === 'hex') {
          if (screenMsg) screenMsg.textContent = 'RAW HEX: AA FF 03 00 00 8C 0D 50 00 00 55 CC';
        } else if (action === 'zone') {
          if (screenMsg) screenMsg.textContent = 'Geofence Zone: ACTIVE (Threshold: 2.5m - 4.5m)';
        }
      });
    });
  };

  // ------------------------------------------------------------------------
  // 7. Research Upgrade: Kalman Before/After Comparison Canvas (upgrades.html)
  // ------------------------------------------------------------------------
  RFO.initKalmanComparison = function (canvasId) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w, h;
    var showKalman = true;

    function resize() {
      var rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }
    window.addEventListener('resize', resize);
    resize();

    // Toggle button listener
    var toggleBtn = document.getElementById('kalman-toggle-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', function () {
        showKalman = !showKalman;
        toggleBtn.textContent = showKalman ? 'Filter: Kalman Smoothed (Active)' : 'Filter: Raw Unfiltered Jitter';
        toggleBtn.classList.toggle('active', showKalman);
      });
    }

    // Historical trail
    var rawTrail = [];
    var kalmanTrail = [];
    var kalmanState = { x: 0, y: 0 };
    var t = 0;

    function draw() {
      ctx.clearRect(0, 0, w, h);
      t += 0.02;

      // Ground truth walking trajectory
      var trueX = (w * 0.5) + Math.sin(t) * (w * 0.32);
      var trueY = (h * 0.5) + Math.cos(t * 1.5) * (h * 0.28);

      // Raw observation with sensor jitter noise
      var rawX = trueX + (Math.random() - 0.5) * 28;
      var rawY = trueY + (Math.random() - 0.5) * 28;

      // Kalman filter estimate update (1D alpha-beta / simplified gain)
      var kg = 0.14; // Kalman gain
      kalmanState.x += (rawX - kalmanState.x) * kg;
      kalmanState.y += (rawY - kalmanState.y) * kg;

      rawTrail.push({ x: rawX, y: rawY });
      kalmanTrail.push({ x: kalmanState.x, y: kalmanState.y });
      if (rawTrail.length > 90) { rawTrail.shift(); kalmanTrail.shift(); }

      // Draw Raw Jittery Path (Red/Maroon dots)
      if (!showKalman) {
        ctx.strokeStyle = 'rgba(194, 74, 91, 0.4)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (var i = 0; i < rawTrail.length; i++) {
          if (i === 0) ctx.moveTo(rawTrail[i].x, rawTrail[i].y);
          else ctx.lineTo(rawTrail[i].x, rawTrail[i].y);
        }
        ctx.stroke();

        // Raw point
        ctx.beginPath();
        ctx.arc(rawX, rawY, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#9E3544';
        ctx.fill();
      } else {
        // Draw Kalman Smooth Trajectory (Green/White clean spline)
        ctx.strokeStyle = 'rgba(63, 185, 133, 0.7)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (var i = 0; i < kalmanTrail.length; i++) {
          if (i === 0) ctx.moveTo(kalmanTrail[i].x, kalmanTrail[i].y);
          else ctx.lineTo(kalmanTrail[i].x, kalmanTrail[i].y);
        }
        ctx.stroke();

        // Kalman point
        ctx.beginPath();
        ctx.arc(kalmanState.x, kalmanState.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(kalmanState.x, kalmanState.y, 11, 0, Math.PI * 2);
        ctx.strokeStyle = '#3FB985';
        ctx.stroke();
      }

      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  };

  // ------------------------------------------------------------------------
  // 8. Micro-Doppler STFT Spectrogram Visualizer (ml.html)
  // ------------------------------------------------------------------------
  RFO.initMicroDopplerSpectrogram = function (canvasId) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w, h;
    var activeClass = 'walking'; // 'walking', 'breathing', 'fall', 'fan'

    function resize() {
      var rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }
    window.addEventListener('resize', resize);
    resize();

    // Spectrogram column buffer (history of 90 time bins)
    var timeBins = 90;
    var freqBins = 48;
    var history = [];
    for (var i = 0; i < timeBins; i++) {
      var col = new Float32Array(freqBins);
      history.push(col);
    }

    // Class selection buttons
    document.querySelectorAll('[data-spectrogram-class]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('[data-spectrogram-class]').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        activeClass = btn.getAttribute('data-spectrogram-class');
      });
    });

    var t = 0;
    function draw() {
      t += 0.08;

      // Generate new vertical column of Doppler energy
      var newCol = new Float32Array(freqBins);
      var mid = freqBins / 2;

      for (var f = 0; f < freqBins; f++) {
        var val = 0;
        var diff = f - mid;

        if (activeClass === 'walking') {
          // Torso base motion + leg/arm swing harmonics
          var torso = Math.sin(t * 0.3) * 6;
          var limb = Math.sin(t * 1.2) * 14;
          if (Math.abs(diff - torso) < 3) val += 0.9;
          if (Math.abs(diff - limb) < 4) val += 0.65;
          if (Math.abs(diff + limb * 0.8) < 3.5) val += 0.55;
        } else if (activeClass === 'breathing') {
          // Narrow low-frequency sinusoidal chest wall displacement
          var breath = Math.sin(t * 0.25) * 2;
          if (Math.abs(diff - breath) < 2) val += 0.95;
        } else if (activeClass === 'fall') {
          // Sudden high-velocity spike followed by cessation of motion
          var cycle = (t * 0.4) % 10;
          if (cycle > 4 && cycle < 5.2) {
            if (diff > 4 && diff < 20) val += 1.0; // Rapid downward velocity
          } else {
            if (Math.abs(diff) < 2) val += 0.3; // Still post-impact
          }
        } else if (activeClass === 'fan') {
          // Rigid stationary harmonics at fixed frequency offsets
          if (Math.abs(diff - 12) < 1.5 || Math.abs(diff + 12) < 1.5) val += 0.9;
          if (Math.abs(diff - 20) < 1.2 || Math.abs(diff + 20) < 1.2) val += 0.6;
        }

        // Add subtle sensor thermal noise
        val += Math.random() * 0.08;
        newCol[f] = Math.min(1.0, val);
      }

      history.shift();
      history.push(newCol);

      // Render Heatmap on Canvas
      ctx.clearRect(0, 0, w, h);
      var cellW = w / timeBins;
      var cellH = h / freqBins;

      for (var x = 0; x < timeBins; x++) {
        var c = history[x];
        for (var y = 0; y < freqBins; y++) {
          var energy = c[y];
          if (energy > 0.12) {
            // Muted Maroon to Green palette mapping
            if (energy > 0.65) {
              // High energy: Fused soft white-green
              ctx.fillStyle = 'rgba(255, 255, 255, ' + (energy * 0.9).toFixed(2) + ')';
            } else if (energy > 0.35) {
              // Mid energy: Muted green
              ctx.fillStyle = 'rgba(63, 185, 133, ' + (energy * 0.8).toFixed(2) + ')';
            } else {
              // Low energy: Deep maroon
              ctx.fillStyle = 'rgba(158, 53, 68, ' + (energy * 0.7).toFixed(2) + ')';
            }
            ctx.fillRect(x * cellW, y * cellH, cellW + 0.5, cellH + 0.5);
          }
        }
      }

      // Center zero-velocity line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#A6ABB2';
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillText('+2.5 m/s', 8, 14);
      ctx.fillText('0.0 m/s (Zero-Doppler)', 8, h / 2 - 4);
      ctx.fillText('-2.5 m/s', 8, h - 8);

      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  };

  // ------------------------------------------------------------------------
  // 9. Neural Network Forward & Backprop Visualizer (ml.html)
  // ------------------------------------------------------------------------
  RFO.initNeuralNetworkVisualizer = function (canvasId) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w, h;

    function resize() {
      var rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }
    window.addEventListener('resize', resize);
    resize();

    // Layer specifications: Input (6) -> Conv1D (8) -> GRU (6) -> Softmax (4)
    var layers = [
      { name: 'STFT Input (128x64)', count: 6, nodes: [] },
      { name: '1D Depthwise Conv', count: 8, nodes: [] },
      { name: 'GRU Recurrent (H=48)', count: 6, nodes: [] },
      { name: 'Softmax Output (4)', count: 4, nodes: [] }
    ];

    var t = 0;
    function draw() {
      ctx.clearRect(0, 0, w, h);
      t += 0.04;

      // Position nodes
      var layerSpacing = w / (layers.length + 1);
      for (var l = 0; l < layers.length; l++) {
        var layer = layers[l];
        var lx = layerSpacing * (l + 1);
        layer.nodes = [];
        var nodeSpacing = (h - 70) / (layer.count + 1);
        for (var n = 0; n < layer.count; n++) {
          var ny = 40 + nodeSpacing * (n + 1);
          layer.nodes.push({ x: lx, y: ny });
        }
      }

      // Draw Synapses & Flowing Weight Packets
      var cyclePhase = (t * 0.4) % (layers.length + 1); // 0 to 4: forward, 4 to 8: backprop
      var isForward = (t * 0.4) % (layers.length * 2) < layers.length;

      for (var l = 0; l < layers.length - 1; l++) {
        var srcNodes = layers[l].nodes;
        var dstNodes = layers[l + 1].nodes;

        for (var s = 0; s < srcNodes.length; s++) {
          for (var d = 0; d < dstNodes.length; d++) {
            var n1 = srcNodes[s];
            var n2 = dstNodes[d];

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(n1.x, n1.y);
            ctx.lineTo(n2.x, n2.y);
            ctx.stroke();

            // Animated Signal Packet
            var packetProg = (t * 0.8 + s * 0.1 + d * 0.05) % 1;
            var px, py;
            if (isForward) {
              px = n1.x + (n2.x - n1.x) * packetProg;
              py = n1.y + (n2.y - n1.y) * packetProg;
              ctx.fillStyle = '#3FB985'; // Green forward activation
            } else {
              px = n2.x - (n2.x - n1.x) * packetProg;
              py = n2.y - (n2.y - n1.y) * packetProg;
              ctx.fillStyle = '#C24A5B'; // Maroon gradient backpropagation
            }

            if ((s + d) % 3 === 0) {
              ctx.beginPath();
              ctx.arc(px, py, 1.8, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }

      // Draw Nodes
      for (var l = 0; l < layers.length; l++) {
        var layer = layers[l];
        for (var n = 0; n < layer.nodes.length; n++) {
          var pt = layer.nodes[n];

          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
          ctx.fillStyle = l === 3 ? '#FFFFFF' : (l === 0 ? '#9E3544' : '#3FB985');
          ctx.fill();

          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 11, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Layer Title
        ctx.fillStyle = '#A6ABB2';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(layer.name, layer.nodes[0].x, 24);
      }

      // Direction Status Badge
      ctx.textAlign = 'left';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillStyle = isForward ? '#3FB985' : '#C24A5B';
      ctx.fillText(isForward ? 'FLOW: FORWARD INFERENCE (ACTIVATIONS)' : 'FLOW: BACKPROPAGATION (CHAIN RULE GRADIENTS)', 16, h - 14);

      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  };

  // ------------------------------------------------------------------------
  // 10. Training Loss & Regularization Workbench (ml.html)
  // ------------------------------------------------------------------------
  RFO.initTrainingWorkbench = function () {
    var lossCanvas = document.getElementById('loss-curve-canvas');
    if (!lossCanvas) return;
    var ctx = lossCanvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w, h;

    function resize() {
      var rect = lossCanvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      lossCanvas.width = Math.floor(w * dpr);
      lossCanvas.height = Math.floor(h * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      draw();
    }
    window.addEventListener('resize', resize);

    var sliderL1 = document.getElementById('slider-l1');
    var sliderL2 = document.getElementById('slider-l2');
    var sliderLR = document.getElementById('slider-lr');
    var valL1 = document.getElementById('val-l1');
    var valL2 = document.getElementById('val-l2');
    var valLR = document.getElementById('val-lr');
    var valPsnr = document.getElementById('val-psnr');
    var valSparsity = document.getElementById('val-sparsity');

    var l1 = 0.0001;
    var l2 = 0.0001;
    var lr = 0.001;

    function updateParams() {
      if (sliderL1) l1 = parseFloat(sliderL1.value);
      if (sliderL2) l2 = parseFloat(sliderL2.value);
      if (sliderLR) lr = parseFloat(sliderLR.value);

      if (valL1) valL1.textContent = l1.toFixed(5);
      if (valL2) valL2.textContent = l2.toFixed(5);
      if (valLR) valLR.textContent = lr.toFixed(4);

      // Theoretical Sparsity from L1 penalty (higher L1 = higher pruning)
      var sparsity = Math.min(48.0, 12.0 + l1 * 140000);
      if (valSparsity) valSparsity.textContent = sparsity.toFixed(1) + '%';

      // PSNR calculation from autoencoder reconstruction quality
      var psnr = Math.max(22.0, 31.5 - (l1 * 20000) - (l2 * 10000));
      if (valPsnr) valPsnr.textContent = psnr.toFixed(2) + ' dB';

      draw();
    }

    if (sliderL1) sliderL1.addEventListener('input', updateParams);
    if (sliderL2) sliderL2.addEventListener('input', updateParams);
    if (sliderLR) sliderLR.addEventListener('input', updateParams);

    function draw() {
      if (!w || !h) return;
      ctx.clearRect(0, 0, w, h);

      var epochs = 120;
      var marginL = 40;
      var marginB = 30;
      var plotW = w - marginL - 20;
      var plotH = h - marginB - 20;

      // Axes
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(marginL, 20); ctx.lineTo(marginL, h - marginB); ctx.lineTo(w - 20, h - marginB);
      ctx.stroke();

      ctx.fillStyle = '#6E737B';
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillText('Loss', 8, 18);
      ctx.fillText('Epochs (1 - 120)', w - 85, h - 8);

      // Training Loss Curve (Maroon)
      ctx.beginPath();
      ctx.strokeStyle = '#9E3544';
      ctx.lineWidth = 2;
      for (var ep = 1; ep <= epochs; ep++) {
        var base = Math.exp(-ep * (lr * 40)) * 1.8 + 0.08 + l1 * 150 + l2 * 80;
        var noise = Math.sin(ep * 0.4) * 0.015;
        var yLoss = Math.max(0.02, base + noise);
        var px = marginL + (ep / epochs) * plotW;
        var py = (h - marginB) - (yLoss / 2.0) * plotH;
        if (ep === 1) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Validation Loss Curve (Green)
      ctx.beginPath();
      ctx.strokeStyle = '#3FB985';
      ctx.lineWidth = 2;
      for (var ep = 1; ep <= epochs; ep++) {
        var base = Math.exp(-ep * (lr * 35)) * 1.9 + 0.12 + (l1 > 0.0003 ? (ep * 0.001) : 0);
        var noise = Math.cos(ep * 0.3) * 0.02;
        var yValLoss = Math.max(0.04, base + noise);
        var px = marginL + (ep / epochs) * plotW;
        var py = (h - marginB) - (yValLoss / 2.0) * plotH;
        if (ep === 1) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Legend
      ctx.fillStyle = '#C24A5B';
      ctx.fillText('&bull; Training Loss', marginL + 20, 32);
      ctx.fillStyle = '#63D4A3';
      ctx.fillText('&bull; Validation Loss', marginL + 130, 32);
    }

    resize();
    updateParams();
  };

  // ------------------------------------------------------------------------
  // 11. State-Space Kalman Filter Interactive Visualizer (tech.html)
  // ------------------------------------------------------------------------
  RFO.initKalmanFilterVisualizer = function (canvasId) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w, h;

    function resize() {
      var rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }
    window.addEventListener('resize', resize);
    resize();

    // Kalman Filter Matrices & State
    // State Vector: x = [px, py, vx, vy]^T
    var state = { px: 0, py: 0, vx: 0.18, vy: 0.08 };
    // Covariance P: 4x4 diagonal
    var P = { pxx: 1.0, pyy: 1.0, pvx: 0.5, pvy: 0.5 };
    var stepCount = 0;

    // DOM Display for Live Kalman Matrix Values
    var elState = document.getElementById('kf-state-vec');
    var elGain = document.getElementById('kf-gain-val');
    var elCov = document.getElementById('kf-cov-val');

    var t = 0;
    function draw() {
      t += 0.03;
      stepCount++;

      ctx.clearRect(0, 0, w, h);

      var cx = w * 0.5;
      var cy = h * 0.5;

      // Ground truth true motion
      var trueX = cx + Math.sin(t * 0.8) * (w * 0.35);
      var trueY = cy + Math.cos(t * 1.1) * (h * 0.32);

      // Noisy 24G measurement (larger noise R_24)
      var z24X = trueX + (Math.random() - 0.5) * 45;
      var z24Y = trueY + (Math.random() - 0.5) * 45;

      // Noisy 60G measurement (smaller noise R_60)
      var z60X = trueX + (Math.random() - 0.5) * 18;
      var z60Y = trueY + (Math.random() - 0.5) * 18;

      // Kalman Prediction Step:
      // F = [[1, 0, dt, 0], [0, 1, 0, dt], ...]
      var dt = 0.1;
      var predX = (state.px || trueX) + state.vx * dt * 50;
      var predY = (state.py || trueY) + state.vy * dt * 50;
      P.pxx += 0.02; // + Q process noise
      P.pyy += 0.02;

      // Measurement Update Step:
      // Weighted fusion of 24G (R=45) and 60G (R=18)
      var zFusedX = 0.35 * z24X + 0.65 * z60X;
      var zFusedY = 0.35 * z24Y + 0.65 * z60Y;
      var R_fused = 15;

      // Kalman Gain K = P / (P + R)
      var Kx = P.pxx / (P.pxx + R_fused);
      var Ky = P.pyy / (P.pyy + R_fused);

      // State Update
      state.px = predX + Kx * (zFusedX - predX);
      state.py = predY + Ky * (zFusedY - predY);
      state.vx = (trueX - predX) * 0.05;
      state.vy = (trueY - predY) * 0.05;

      // Covariance Update P = (1 - K) * P
      P.pxx = (1 - Kx) * P.pxx;
      P.pyy = (1 - Ky) * P.pyy;

      // Draw Grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      for (var gx = 0; gx < w; gx += 40) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
      }
      for (var gy = 0; gy < h; gy += 40) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
      }

      // 1. Draw 24G Measurement & Covariance Ellipse (Maroon)
      ctx.beginPath();
      ctx.ellipse(z24X, z24Y, 32, 22, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(158, 53, 68, 0.35)';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(z24X, z24Y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#9E3544';
      ctx.fill();

      // 2. Draw 60G Measurement & Covariance Ellipse (Green)
      ctx.beginPath();
      ctx.ellipse(z60X, z60Y, 16, 12, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(63, 185, 133, 0.35)';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(z60X, z60Y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#3FB985';
      ctx.fill();

      // 3. Draw Predicted State (dashed crosshair)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.setLineDash([2, 3]);
      ctx.strokeRect(predX - 6, predY - 6, 12, 12);
      ctx.setLineDash([]);

      // 4. Draw Optimal Kalman Fused State (White dot with tight dual ring)
      ctx.beginPath();
      ctx.arc(state.px, state.py, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(state.px, state.py, 10, 8, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#3FB985';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Update DOM values if present
      if (elState && stepCount % 6 === 0) {
        elState.textContent = '[X: ' + ((state.px - cx) / 50).toFixed(2) + 'm, Y: ' + ((cy - state.py) / 50).toFixed(2) + 'm, Vx: ' + state.vx.toFixed(2) + ', Vy: ' + state.vy.toFixed(2) + ']';
      }
      if (elGain && stepCount % 6 === 0) {
        elGain.textContent = 'K = ' + Kx.toFixed(3);
      }
      if (elCov && stepCount % 6 === 0) {
        elCov.textContent = 'Tr(P) = ' + (P.pxx + P.pyy).toFixed(3);
      }

      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  };

  // ------------------------------------------------------------------------
  // 12. Wave Material Penetration & Surface Scattering Visualizer (index.html)
  // ------------------------------------------------------------------------
  RFO.initWavePenetrationDiagram = function (canvasId) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w, h;

    function resize() {
      var rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }
    window.addEventListener('resize', resize);
    resize();

    var thicknessSlider = document.getElementById('wall-thickness-slider');
    var materialSelect = document.getElementById('wall-material-select');
    var attenReadout = document.getElementById('wall-atten-db');
    var transReadout = document.getElementById('wall-trans-pct');

    var wallThickness = 12; // cm
    var material = 'drywall';

    var materialData = {
      drywall: { name: 'Drywall Partition', atten24: 0.8, atten60: 9.4, eps: 2.8 },
      wood: { name: 'Plywood Board', atten24: 1.6, atten60: 14.2, eps: 2.1 },
      concrete: { name: 'Reinforced Concrete', atten24: 8.5, atten60: 42.0, eps: 6.5 },
      clothing: { name: 'Winter Fabric Layer', atten24: 0.2, atten60: 1.8, eps: 1.4 }
    };

    if (thicknessSlider) {
      thicknessSlider.addEventListener('input', function () {
        wallThickness = parseFloat(thicknessSlider.value) || 12;
        updateReadouts();
      });
    }
    if (materialSelect) {
      materialSelect.addEventListener('change', function () {
        material = materialSelect.value || 'drywall';
        updateReadouts();
      });
    }

    function updateReadouts() {
      var m = materialData[material] || materialData.drywall;
      var totalLoss24 = (m.atten24 * (wallThickness / 10)).toFixed(1);
      var totalLoss60 = (m.atten60 * (wallThickness / 10)).toFixed(1);
      var trans24 = Math.max(2, Math.round(100 * Math.pow(10, -totalLoss24 / 10)));
      var trans60 = Math.max(1, Math.round(100 * Math.pow(10, -totalLoss60 / 10)));

      if (attenReadout) attenReadout.textContent = '24G: -' + totalLoss24 + 'dB | 60G: -' + totalLoss60 + 'dB';
      if (transReadout) transReadout.textContent = '24G: ' + trans24 + '% pass | 60G: ' + trans60 + '% pass';
    }
    updateReadouts();

    var t = 0;
    function draw() {
      t += 0.05;
      ctx.clearRect(0, 0, w, h);

      var wallX = w * 0.42;
      var wallW = Math.max(16, wallThickness * 2.6);
      var humanX = w * 0.82;

      // Grid Lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      for (var y = 20; y < h; y += 30) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      // Radar Housing (Left)
      ctx.fillStyle = 'rgba(21, 22, 24, 0.9)';
      ctx.fillRect(18, h * 0.2, 52, h * 0.6);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.strokeRect(18, h * 0.2, 52, h * 0.6);

      // Antennas
      ctx.fillStyle = '#9E3544';
      ctx.fillRect(66, h * 0.32, 6, 22);
      ctx.fillStyle = '#3FB985';
      ctx.fillRect(66, h * 0.56, 6, 22);

      ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillStyle = '#A6ABB2';
      ctx.fillText('24G', 28, h * 0.35);
      ctx.fillText('60G', 28, h * 0.59);

      // Wall Barrier
      ctx.fillStyle = 'rgba(40, 42, 48, 0.75)';
      ctx.fillRect(wallX, 20, wallW, h - 40);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.strokeRect(wallX, 20, wallW, h - 40);

      // Hatches
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      for (var hy = 30; hy < h - 40; hy += 16) {
        ctx.beginPath();
        ctx.moveTo(wallX, hy);
        ctx.lineTo(wallX + wallW, hy + 12);
        ctx.stroke();
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'center';
      var matObj = materialData[material] || materialData.drywall;
      ctx.fillText(matObj.name + ' (' + wallThickness + 'cm)', wallX + wallW / 2, 16);

      // Human Target on Right
      ctx.fillStyle = 'rgba(255, 255, 255, 0.09)';
      ctx.beginPath();
      ctx.arc(humanX, h * 0.35, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(humanX - 16, h * 0.44, 32, 65);
      ctx.fillStyle = '#A6ABB2';
      ctx.fillText('Human Target', humanX, h * 0.85);

      // 24 GHz Wave (Maroon, penetrates barrier easily)
      var transRatio24 = Math.max(0.18, Math.pow(10, -(matObj.atten24 * (wallThickness / 10)) / 10));
      var transRatio60 = Math.max(0.03, Math.pow(10, -(matObj.atten60 * (wallThickness / 10)) / 10));

      ctx.lineWidth = 2;
      ctx.beginPath();
      var y24 = h * 0.36;
      for (var x = 74; x < humanX; x += 2) {
        var amp = 14;
        if (x >= wallX && x <= wallX + wallW) {
          amp = 14 * Math.sqrt(transRatio24);
        } else if (x > wallX + wallW) {
          amp = 14 * transRatio24;
        }
        var waveY = y24 + Math.sin((x - t * 40) * 0.08) * amp;
        if (x === 74) ctx.moveTo(x, waveY);
        else ctx.lineTo(x, waveY);
      }
      ctx.strokeStyle = '#9E3544';
      ctx.stroke();

      // Return echo 24G
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      for (var rx = humanX; rx >= 74; rx -= 3) {
        var rAmp = 9 * transRatio24;
        var rY = y24 + 18 + Math.sin((rx + t * 40) * 0.08) * rAmp;
        if (rx === humanX) ctx.moveTo(rx, rY);
        else ctx.lineTo(rx, rY);
      }
      ctx.strokeStyle = 'rgba(158, 53, 68, 0.65)';
      ctx.stroke();
      ctx.setLineDash([]);

      // 60 GHz Wave (Green, highly absorbed in wall)
      ctx.lineWidth = 2;
      ctx.beginPath();
      var y60 = h * 0.64;
      for (var x6 = 74; x6 < humanX; x6 += 2) {
        var amp6 = 14;
        if (x6 >= wallX && x6 <= wallX + wallW) {
          amp6 = 14 * Math.sqrt(transRatio60);
        } else if (x6 > wallX + wallW) {
          amp6 = 14 * transRatio60;
        }
        var waveY6 = y60 + Math.sin((x6 - t * 65) * 0.22) * amp6;
        if (x6 === 74) ctx.moveTo(x6, waveY6);
        else ctx.lineTo(x6, waveY6);
      }
      ctx.strokeStyle = '#3FB985';
      ctx.stroke();

      // 60G reflection from wall face
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (var wx = wallX; wx >= 74; wx -= 2) {
        var wallReflectAmp = 10 * (1 - transRatio60);
        var wrY = y60 + 16 + Math.sin((wx + t * 50) * 0.22) * wallReflectAmp;
        if (wx === wallX) ctx.moveTo(wx, wrY);
        else ctx.lineTo(wx, wrY);
      }
      ctx.strokeStyle = 'rgba(63, 185, 133, 0.45)';
      ctx.stroke();

      // Annotations
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillStyle = '#9E3544';
      ctx.textAlign = 'left';
      ctx.fillText('&lambda;=12.5mm Penetrates Interior Partition', 80, y24 - 18);

      ctx.fillStyle = '#3FB985';
      ctx.fillText('&lambda;=5.0mm Attenuates in Barrier (Eliminates Exterior Ghosts)', 80, y60 - 18);

      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  };

  // ------------------------------------------------------------------------
  // 13. Advanced FMCW Chirp & Beat Frequency Physics Wave Engine (upgrades.html)
  // ------------------------------------------------------------------------
  RFO.initFMCWWavePhysics = function (canvasId) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w, h;

    function resize() {
      var rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }
    window.addEventListener('resize', resize);
    resize();

    var distSlider = document.getElementById('fmcw-dist-slider');
    var bwSlider = document.getElementById('fmcw-bw-slider');
    var velSlider = document.getElementById('fmcw-vel-slider');

    var elTau = document.getElementById('fmcw-tau-val');
    var elFb = document.getElementById('fmcw-fb-val');
    var elRes = document.getElementById('fmcw-res-val');

    var targetDist = 3.6; // meters
    var chirpBW = 4.0; // GHz
    var targetVel = 0.4; // m/s

    if (distSlider) {
      distSlider.addEventListener('input', function () {
        targetDist = parseFloat(distSlider.value) || 3.6;
        updateFMCWValues();
      });
    }
    if (bwSlider) {
      bwSlider.addEventListener('input', function () {
        chirpBW = parseFloat(bwSlider.value) || 4.0;
        updateFMCWValues();
      });
    }
    if (velSlider) {
      velSlider.addEventListener('input', function () {
        targetVel = parseFloat(velSlider.value) || 0.4;
        updateFMCWValues();
      });
    }

    function updateFMCWValues() {
      // c = 3e8 m/s
      // tau = 2R / c
      var c = 3.0e8;
      var tauNs = ((2 * targetDist) / c) * 1e9; // nanoseconds
      // Chirp slope S = B / Tc; let Tc = 50 us
      var Tc = 50e-6;
      var S = (chirpBW * 1e9) / Tc;
      var fbKhz = (S * ((2 * targetDist) / c) + (2 * targetVel / (0.005))) / 1000;
      var resCm = (c / (2 * chirpBW * 1e9)) * 100;

      if (elTau) elTau.textContent = tauNs.toFixed(1) + ' ns';
      if (elFb) elFb.textContent = fbKhz.toFixed(1) + ' kHz';
      if (elRes) elRes.textContent = resCm.toFixed(2) + ' cm';
    }
    updateFMCWValues();

    var t = 0;
    function draw() {
      t += 0.04;
      ctx.clearRect(0, 0, w, h);

      // Section 1: Top 50% = Sawtooth Chirp Frequency vs Time
      // Section 2: Bottom 50% = Beat Frequency Mixer Signal & Range-FFT
      var splitY = h * 0.48;

      // Divider line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, splitY);
      ctx.lineTo(w, splitY);
      ctx.stroke();

      // 1. TOP SUBPLOT: Frequency Ramp f(t) Sawtooth
      ctx.font = '11px JetBrains Mono, monospace';
      ctx.fillStyle = '#A6ABB2';
      ctx.textAlign = 'left';
      ctx.fillText('STAGE 1: FMCW SAWTOOTH CHIRP SWEEP [B = ' + chirpBW.toFixed(1) + ' GHz, Tc = 50 &mu;s]', 24, 20);

      var rampW = w - 48;
      var rampH = splitY - 50;
      var period = 200;
      var tauPixels = Math.min(60, targetDist * 8.5);

      // Draw Grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      for (var gx = 24; gx < w - 24; gx += 50) {
        ctx.beginPath(); ctx.moveTo(gx, 30); ctx.lineTo(gx, splitY - 10); ctx.stroke();
      }

      // Draw TX Ramp (Green)
      ctx.strokeStyle = '#3FB985';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (var rx = 24; rx < w - 24; rx += 2) {
        var cyclePos = (rx - 24 + t * 40) % period;
        var fNorm = cyclePos / period;
        var ry = splitY - 15 - fNorm * rampH;
        if (cyclePos <= 2) ctx.moveTo(rx, ry);
        else ctx.lineTo(rx, ry);
      }
      ctx.stroke();

      // Draw RX Echo Ramp (Maroon, delayed by tau)
      ctx.strokeStyle = '#9E3544';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 2]);
      ctx.beginPath();
      for (var ex = 24; ex < w - 24; ex += 2) {
        var rxCyclePos = (ex - 24 + t * 40 - tauPixels) % period;
        if (rxCyclePos < 0) rxCyclePos += period;
        var rfNorm = rxCyclePos / period;
        var ey = splitY - 15 - rfNorm * rampH;
        if (rxCyclePos <= 2) ctx.moveTo(ex, ey);
        else ctx.lineTo(ex, ey);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Vertical Beat Frequency Differential Bracket (fb)
      var bracketX = w * 0.45;
      var bY1 = splitY - 15 - 0.55 * rampH;
      var bY2 = bY1 + tauPixels * (rampH / period);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(bracketX, bY1);
      ctx.lineTo(bracketX, bY2);
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillText('&Delta;f = fb = ' + (targetDist * 32.4).toFixed(0) + ' kHz', bracketX + 8, (bY1 + bY2) / 2 + 3);

      // Legend
      ctx.fillStyle = '#3FB985';
      ctx.fillRect(w - 180, 12, 10, 10);
      ctx.fillText('Tx Chirp f(t)', w - 164, 20);
      ctx.fillStyle = '#9E3544';
      ctx.fillRect(w - 90, 12, 10, 10);
      ctx.fillText('Rx Echo', w - 74, 20);

      // 2. BOTTOM LEFT SUBPLOT: Homodyne IF Beat Frequency Mixer Waveform
      var halfW = w * 0.52;
      ctx.fillStyle = '#A6ABB2';
      ctx.fillText('STAGE 2: IF MIXER BEAT WAVE: cos(2&pi; fb t)', 24, splitY + 24);

      var beatFreq = Math.max(0.04, targetDist * 0.025);
      var midWaveY = splitY + (h - splitY) * 0.55;

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (var bx = 24; bx < halfW - 16; bx += 2) {
        var bWave = midWaveY + Math.sin((bx - 24) * beatFreq - t * 4) * 26;
        if (bx === 24) ctx.moveTo(bx, bWave);
        else ctx.lineTo(bx, bWave);
      }
      ctx.stroke();

      // Zero-crossing dashed axis
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.setLineDash([2, 4]);
      ctx.beginPath(); ctx.moveTo(24, midWaveY); ctx.lineTo(halfW - 16, midWaveY); ctx.stroke();
      ctx.setLineDash([]);

      // 3. BOTTOM RIGHT SUBPLOT: Range-FFT Frequency Peak
      var fftStartX = halfW + 16;
      ctx.fillStyle = '#A6ABB2';
      ctx.fillText('STAGE 3: RANGE-FFT PEAK [R = ' + targetDist.toFixed(2) + ' m]', fftStartX, splitY + 24);

      // Spectrum Axis
      var fftBaseY = h - 25;
      var fftMaxH = (h - splitY) * 0.65;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath();
      ctx.moveTo(fftStartX, fftBaseY);
      ctx.lineTo(w - 24, fftBaseY);
      ctx.stroke();

      // Draw Noise Floor
      ctx.strokeStyle = 'rgba(166, 171, 178, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (var fx = fftStartX; fx < w - 24; fx += 3) {
        var noise = Math.sin(fx * 0.3 + t) * 3 + Math.random() * 2;
        var ny = fftBaseY - noise;
        if (fx === fftStartX) ctx.moveTo(fx, ny);
        else ctx.lineTo(fx, ny);
      }
      ctx.stroke();

      // Draw Main Target Peak
      var peakNorm = targetDist / 6.0; // 0 to 1
      var peakX = fftStartX + peakNorm * (w - 24 - fftStartX);

      ctx.fillStyle = 'rgba(63, 185, 133, 0.25)';
      ctx.beginPath();
      ctx.moveTo(peakX - 18, fftBaseY);
      ctx.lineTo(peakX, fftBaseY - fftMaxH);
      ctx.lineTo(peakX + 18, fftBaseY);
      ctx.fill();

      ctx.strokeStyle = '#3FB985';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(peakX - 18, fftBaseY);
      ctx.lineTo(peakX, fftBaseY - fftMaxH);
      ctx.lineTo(peakX + 18, fftBaseY);
      ctx.stroke();

      // Peak Dot & Marker
      ctx.beginPath();
      ctx.arc(peakX, fftBaseY - fftMaxH, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();

      ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillStyle = '#3FB985';
      ctx.textAlign = 'center';
      ctx.fillText(targetDist.toFixed(2) + 'm Lock', peakX, fftBaseY - fftMaxH - 8);

      // Range Resolution callout
      ctx.fillStyle = '#A6ABB2';
      ctx.textAlign = 'right';
      ctx.fillText('&Delta;R = ' + (30 / (2 * chirpBW)).toFixed(2) + ' cm', w - 24, h - 8);

      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  };

  // ------------------------------------------------------------------------
  // 14. 8-Channel Bus Timing Logic Analyzer Visualizer (working.html)
  // ------------------------------------------------------------------------
  RFO.initLogicAnalyzer = function (canvasId) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w, h;

    function resize() {
      var rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }
    window.addEventListener('resize', resize);
    resize();

    var btnPause = document.getElementById('btn-la-pause');
    var isPaused = false;
    if (btnPause) {
      btnPause.addEventListener('click', function () {
        isPaused = !isPaused;
        btnPause.textContent = isPaused ? '▶ Resume Scope' : '⏸ Pause Scope';
      });
    }

    var channels = [
      { name: 'CH0: UART1_RX (GPIO16 - 256k LD2452)', color: '#9E3544', period: 80, pulseW: 24 },
      { name: 'CH1: UART0_RX (GPIO25 - 115.2k LD6003)', color: '#3FB985', period: 95, pulseW: 32 },
      { name: 'CH2: VSPI_SCK (GPIO18 - 40MHz Display)', color: '#63D4A3', period: 30, pulseW: 14 },
      { name: 'CH3: VSPI_MOSI (GPIO23 - TFT FrameBuffer)', color: '#FFFFFF', period: 20, pulseW: 8 },
      { name: 'CH4: TFT_CS (GPIO15 - Active Low Draw)', color: '#A6ABB2', period: 160, pulseW: 110, inverted: true },
      { name: 'CH5: TOUCH_CS (GPIO21 - 50Hz Poll)', color: '#C24A5B', period: 140, pulseW: 18, inverted: true },
      { name: 'CH6: TOUCH_IRQ (GPIO22 - Touch Pen IRQ)', color: '#F2F3F4', period: 220, pulseW: 8, inverted: true },
      { name: 'CH7: BUZZER_PWM (GPIO32 - 2.7kHz Tone)', color: '#E06C75', period: 50, pulseW: 25 }
    ];

    var t = 0;
    function draw() {
      if (!isPaused) t += 1.8;
      ctx.clearRect(0, 0, w, h);

      var labelW = 240;
      var traceAreaW = w - labelW - 20;
      var numCh = channels.length;
      var rowH = (h - 30) / numCh;

      // Header Bar
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillStyle = '#6F7378';
      ctx.textAlign = 'left';
      ctx.fillText('CHANNEL PROBE & SIGNAL ASSIGNMENT', 16, 18);
      ctx.textAlign = 'right';
      ctx.fillText('TIMEBASE: 10 &mu;s / div &bull; SAMPLING: 80 MS/s &bull; HARDWARE DMA', w - 16, 18);

      // Grid Lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      for (var gx = labelW; gx < w - 10; gx += 45) {
        ctx.beginPath(); ctx.moveTo(gx, 25); ctx.lineTo(gx, h - 5); ctx.stroke();
      }

      // Render Each Channel
      for (var i = 0; i < numCh; i++) {
        var ch = channels[i];
        var baseY = 28 + (i + 1) * rowH - 6;
        var highY = baseY - (rowH - 12);

        // Background alternate row
        if (i % 2 === 0) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
          ctx.fillRect(0, 28 + i * rowH, w, rowH);
        }

        // Channel Label
        ctx.font = '10px JetBrains Mono, monospace';
        ctx.fillStyle = ch.color;
        ctx.textAlign = 'left';
        ctx.fillText(ch.name, 16, baseY - 6);

        // Digital Trace
        ctx.strokeStyle = ch.color;
        ctx.lineWidth = 1.6;
        ctx.beginPath();

        var prevVal = 0;
        for (var tx = 0; tx < traceAreaW; tx += 2) {
          var screenX = labelW + tx;
          var phase = (tx + t + i * 28) % ch.period;
          var isHigh = phase < ch.pulseW ? 1 : 0;
          if (ch.inverted) isHigh = 1 - isHigh;

          var curY = isHigh ? highY : baseY;

          if (tx === 0) {
            ctx.moveTo(screenX, curY);
          } else {
            if (isHigh !== prevVal) {
              ctx.lineTo(screenX, isHigh ? baseY : highY); // vertical transition edge
              ctx.lineTo(screenX, curY);
            } else {
              ctx.lineTo(screenX, curY);
            }
          }
          prevVal = isHigh;
        }
        ctx.stroke();
      }

      // Moving Scope Cursor Line
      var cursorX = labelW + ((t * 2) % traceAreaW);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(cursorX, 25);
      ctx.lineTo(cursorX, h - 5);
      ctx.stroke();
      ctx.setLineDash([]);

      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  };

  // ------------------------------------------------------------------------
  // 15. 3D Extended Kalman Filter (EKF) Spatial Covariance Visualizer (upgrades.html)
  // ------------------------------------------------------------------------
  RFO.initEKF3DVisualizer = function (canvasId) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w, h;

    function resize() {
      var rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }
    window.addEventListener('resize', resize);
    resize();

    var btnMode = document.getElementById('btn-ekf-mode-toggle');
    var mode = 'ekf_hungarian'; // 'ekf_hungarian' vs 'raw_greedy'
    if (btnMode) {
      btnMode.addEventListener('click', function () {
        if (mode === 'ekf_hungarian') {
          mode = 'raw_greedy';
          btnMode.textContent = 'Mode: Raw Jitter (Click to Switch EKF)';
          btnMode.classList.remove('btn-green');
          btnMode.classList.add('btn-secondary');
        } else {
          mode = 'ekf_hungarian';
          btnMode.textContent = 'Mode: 9-State EKF + Hungarian (Active)';
          btnMode.classList.remove('btn-secondary');
          btnMode.classList.add('btn-green');
        }
      });
    }

    var t = 0;
    function draw() {
      t += 0.025;
      ctx.clearRect(0, 0, w, h);

      // Isometric Radar Grid Plane (Center)
      var cx = w * 0.5;
      var cy = h * 0.58;

      // Draw Isometric Grid Lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      for (var r = 60; r <= 240; r += 60) {
        ctx.beginPath();
        ctx.ellipse(cx, cy, r, r * 0.45, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(cx - 260, cy); ctx.lineTo(cx + 260, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - 120); ctx.lineTo(cx, cy + 120); ctx.stroke();

      // Two Simulated Targets Crossing Paths (X-Crossing)
      // Target A: moves left-to-right
      var axTrue = cx - 180 + ((t * 40) % 360);
      var ayTrue = cy - 40 + Math.sin(t * 1.2) * 20;

      // Target B: moves right-to-left
      var bxTrue = cx + 180 - ((t * 40) % 360);
      var byTrue = cy + 20 + Math.cos(t * 1.2) * 20;

      if (mode === 'raw_greedy') {
        // Raw Scatter & Jitter - ID Swapping
        var noiseA1 = (Math.random() - 0.5) * 35;
        var noiseA2 = (Math.random() - 0.5) * 25;
        var noiseB1 = (Math.random() - 0.5) * 35;
        var noiseB2 = (Math.random() - 0.5) * 25;

        // Draw Noisy Points
        ctx.fillStyle = '#9E3544';
        ctx.beginPath(); ctx.arc(axTrue + noiseA1, ayTrue + noiseA2, 5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(bxTrue + noiseB1, byTrue + noiseB2, 5, 0, Math.PI * 2); ctx.fill();

        ctx.font = '10px JetBrains Mono, monospace';
        ctx.fillStyle = '#C24A5B';
        ctx.fillText('Raw Jitter & Potential Track Swap', cx, 30);
      } else {
        // 9-State EKF + Hungarian Matching:
        // Contraction of Covariance Ellipses
        ctx.font = '11px JetBrains Mono, monospace';
        ctx.fillStyle = '#3FB985';
        ctx.textAlign = 'center';
        ctx.fillText('9-STATE EXTENDED KALMAN FILTER WITH HUNGARIAN GLOBAL OPTIMIZATION', cx, 24);

        // Covariance Ellipsoids around Target A
        ctx.strokeStyle = 'rgba(63, 185, 133, 0.35)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(axTrue, ayTrue, 32, 14, 0.2, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.ellipse(axTrue, ayTrue, 14, 7, 0.2, 0, Math.PI * 2);
        ctx.stroke();

        // Target A Core State
        ctx.beginPath();
        ctx.arc(axTrue, ayTrue, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();

        // Velocity Vector Arrow
        ctx.strokeStyle = '#3FB985';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(axTrue, ayTrue);
        ctx.lineTo(axTrue + 22, ayTrue - 4);
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '10px JetBrains Mono, monospace';
        ctx.fillText('Target 01 (Locked &sigma;<1.2cm)', axTrue, ayTrue - 20);

        // Covariance Ellipsoids around Target B
        ctx.strokeStyle = 'rgba(158, 53, 68, 0.35)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(bxTrue, byTrue, 32, 14, -0.2, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.ellipse(bxTrue, byTrue, 14, 7, -0.2, 0, Math.PI * 2);
        ctx.stroke();

        // Target B Core State
        ctx.beginPath();
        ctx.arc(bxTrue, byTrue, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();

        // Velocity Vector Arrow
        ctx.strokeStyle = '#9E3544';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bxTrue, byTrue);
        ctx.lineTo(bxTrue - 22, byTrue + 4);
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('Target 02 (Locked &sigma;<1.2cm)', bxTrue, byTrue + 28);
      }

      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  };

  window.RFO = RFO;
})();

