/* ==========================================================================
   RADAR FUSION — CORE UTILITIES & EVENT BUS
   Namespace: window.RFO
   Classic vanilla JS (no modules, no imports, file:// compatible)
   ========================================================================== */

(function () {
  'use strict';

  var RFO = window.RFO || {};

  // Simple PubSub Event Bus
  var events = {};
  RFO.events = {
    on: function (name, handler) {
      if (!events[name]) events[name] = [];
      events[name].push(handler);
    },
    off: function (name, handler) {
      if (!events[name]) return;
      events[name] = events[name].filter(function (h) { return h !== handler; });
    },
    emit: function (name, data) {
      if (!events[name]) return;
      events[name].forEach(function (h) {
        try { h(data); } catch (e) { console.error('RFO Event error:', e); }
      });
    }
  };

  // Math & Geometry Utilities
  RFO.calcEuclidean = function (x1, y1, x2, y2) {
    var dx = x1 - x2;
    var dy = y1 - y2;
    return Math.sqrt(dx * dx + dy * dy);
  };

  RFO.clamp = function (val, min, max) {
    return Math.max(min, Math.min(max, val));
  };

  // Seeded Random Number Generator (PRNG) for repeatable simulations
  RFO.createPRNG = function (seed) {
    var s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function () {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  };

  // Gaussian noise generator using Box-Muller transform
  RFO.gaussianNoise = function (mean, stdDev, prng) {
    var u1 = prng ? prng() : Math.random();
    var u2 = prng ? prng() : Math.random();
    while (u1 <= 1e-15) u1 = Math.random();
    var z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return z0 * stdDev + mean;
  };

  // Audio Alarm Synthesizer via Web Audio API
  var audioCtx = null;
  RFO.soundEnabled = false;

  RFO.enableAudio = function () {
    try {
      if (!audioCtx) {
        var AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) audioCtx = new AudioContextClass();
      }
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      RFO.soundEnabled = true;
      return true;
    } catch (e) {
      console.warn('AudioContext init error:', e);
      return false;
    }
  };

  RFO.playAlarmTone = function () {
    if (!RFO.soundEnabled || !audioCtx) return;
    try {
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.22);
    } catch (e) {
      // Audio autoplay policy catch
    }
  };

  // LD2452 30-Byte Hex Packet Decoding Helper
  // Spec: AA FF 03 00 [Target 1: X(2) Y(2) Speed(2) Dist(2)] [Target 2] [Target 3] 55 CC
  RFO.decodeLD2452Byte = function (index) {
    if (index >= 0 && index <= 3) {
      return { field: 'Header', desc: 'Sync Header (0xAA 0xFF 0x03 0x00) marks start of 30-byte frame' };
    }
    if (index >= 4 && index <= 11) {
      var sub = index - 4;
      if (sub < 2) return { field: 'Target 1 X', desc: 'Signed 16-bit integer X-coordinate in mm (Bit 15 = sign)' };
      if (sub < 4) return { field: 'Target 1 Y', desc: 'Signed 16-bit integer Y-coordinate in mm' };
      if (sub < 6) return { field: 'Target 1 Speed', desc: 'Signed 16-bit integer radial velocity in cm/s' };
      return { field: 'Target 1 Range Gate', desc: 'Unsigned 16-bit range distance gate in mm' };
    }
    if (index >= 12 && index <= 19) {
      var sub = index - 12;
      if (sub < 2) return { field: 'Target 2 X', desc: 'Target 2 X-coordinate (int16 mm)' };
      if (sub < 4) return { field: 'Target 2 Y', desc: 'Target 2 Y-coordinate (int16 mm)' };
      if (sub < 6) return { field: 'Target 2 Speed', desc: 'Target 2 Radial speed (int16 cm/s)' };
      return { field: 'Target 2 Range Gate', desc: 'Target 2 Distance gate (uint16 mm)' };
    }
    if (index >= 20 && index <= 27) {
      var sub = index - 20;
      if (sub < 2) return { field: 'Target 3 X', desc: 'Target 3 X-coordinate (int16 mm)' };
      if (sub < 4) return { field: 'Target 3 Y', desc: 'Target 3 Y-coordinate (int16 mm)' };
      if (sub < 6) return { field: 'Target 3 Speed', desc: 'Target 3 Radial speed (int16 cm/s)' };
      return { field: 'Target 3 Range Gate', desc: 'Target 3 Distance gate (uint16 mm)' };
    }
    if (index === 28 || index === 29) {
      return { field: 'Tail', desc: 'Frame End Delimiter (0x55 0xCC) for checksum validation' };
    }
    return { field: 'Reserved', desc: 'Reserved byte' };
  };

  // CSV Exporter Utility
  RFO.downloadCSV = function (filename, headers, rows) {
    var csvContent = 'data:text/csv;charset=utf-8,' + headers.join(',') + '\n';
    rows.forEach(function (row) {
      csvContent += row.join(',') + '\n';
    });
    var encodedUri = encodeURI(csvContent);
    var link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  window.RFO = RFO;
})();

