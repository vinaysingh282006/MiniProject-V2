/* ==========================================================================
   RADAR FUSION — REAL-TIME STRIP CHARTS
   High-performance canvas-based scrolling time-series for distance and velocity.
   ========================================================================== */

(function () {
  'use strict';

  var StripChart = function (canvasId, options) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.options = options || {};
    this.minVal = this.options.minVal !== undefined ? this.options.minVal : 0;
    this.maxVal = this.options.maxVal !== undefined ? this.options.maxVal : 6;
    this.unit = this.options.unit || 'm';
    this.label = this.options.label || 'Metric';
    this.strokeColor = this.options.color || '#3FB985';

    this.maxPoints = 80;
    this.data = [];
    for (var i = 0; i < this.maxPoints; i++) this.data.push(this.minVal);

    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.resize();
    var self = this;
    window.addEventListener('resize', function () { self.resize(); });
  };

  StripChart.prototype.resize = function () {
    var rect = this.canvas.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.dpr, this.dpr);
    this.draw();
  };

  StripChart.prototype.push = function (value) {
    this.data.push(value);
    if (this.data.length > this.maxPoints) {
      this.data.shift();
    }
    this.draw();
  };

  StripChart.prototype.draw = function () {
    var ctx = this.ctx;
    var w = this.width;
    var h = this.height;
    if (!w || !h) return;

    ctx.clearRect(0, 0, w, h);

    // Background horizontal grid lines
    var steps = 3;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.fillStyle = '#6E737B';

    for (var s = 0; s <= steps; s++) {
      var yVal = this.minVal + (s / steps) * (this.maxVal - this.minVal);
      var py = h - ((yVal - this.minVal) / (this.maxVal - this.minVal)) * (h - 16) - 8;
      ctx.beginPath();
      ctx.moveTo(32, py);
      ctx.lineTo(w, py);
      ctx.stroke();
      ctx.fillText(yVal.toFixed(1) + this.unit, 4, py + 3);
    }

    // Plot Data Line
    var startX = 36;
    var plotW = w - startX;
    var stepX = plotW / (this.maxPoints - 1);

    ctx.beginPath();
    ctx.strokeStyle = this.strokeColor;
    ctx.lineWidth = 1.8;

    for (var i = 0; i < this.data.length; i++) {
      var val = this.data[i];
      var normalized = (val - this.minVal) / (this.maxVal - this.minVal);
      normalized = Math.max(0, Math.min(1, normalized));
      var px = startX + i * stepX;
      var py = h - normalized * (h - 16) - 8;

      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Latest value dot
    if (this.data.length > 0) {
      var lastVal = this.data[this.data.length - 1];
      var normLast = Math.max(0, Math.min(1, (lastVal - this.minVal) / (this.maxVal - this.minVal)));
      var lastPx = startX + (this.data.length - 1) * stepX;
      var lastPy = h - normLast * (h - 16) - 8;

      ctx.beginPath();
      ctx.arc(lastPx, lastPy, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
    }
  };

  window.RFO = window.RFO || {};
  window.RFO.StripChart = StripChart;
})();

