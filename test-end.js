// -----------------------------
// Scoring utilities
// -----------------------------

// Analytic band area (exact denominator) using Simpson's rule
function figureAreaAnalytic(figureScale) {
  const a = SELECTED_FIGURE.minTheta;
  const b = SELECTED_FIGURE.maxTheta;
  const n = 4096; // even
  const h = (b - a) / n;
  let s = 0;
  for (let i = 0; i <= n; i++) {
    const t = a + i * h;
    const eq = SELECTED_FIGURE.calcRad(t);
    const ro = eq.outer * figureScale;
    const ri = eq.inner * figureScale;
    const f = 0.5 * (ro * ro - ri * ri);
    const w = (i === 0 || i === n) ? 1 : (i % 2 === 0 ? 2 : 4);
    s += w * f;
  }
  return s * h; // pixel^2 in scoring canvas space
}

// Simple circle helper used when a stroke has a single point
function circle(x, y, r, fill, ctx) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 2 * Math.PI);
  if (fill) ctx.fill();
  else ctx.stroke();
}

// -----------------------------
// Prompt + End flow (unchanged)
// -----------------------------

function promptSessionEnd() {
  if (IS_TEST) {
    activatePrompt(endTestEarly);
  } else {
    activatePrompt(endPracticeEarly);
  }
}

function endTest() {
  zoomOut(false);
  if (!SCORE_DEBUG) activatePrompt(loading);

  if (ENABLE_SCORING) {
    setTimeout(scoreFigure, 500);
  } else {
    location.href = "index.html";
  }
}

// -----------------------------
// Scoring entrypoint & drawing
// -----------------------------

var scoreInc = 0;

function scoreFigure() {
  let progressBar = document.getElementById("progress");

  // Set up scoring canvas at fixed size
  drawCanvas.style.width = `${SCORE_AREA_SIZE}px`;
  drawCanvas.style.height = `${SCORE_AREA_SIZE}px`;
  drawCanvas.width = SCORE_AREA_SIZE;
  drawCanvas.height = SCORE_AREA_SIZE;

  drawCtx.clearRect(0, 0, SCORE_AREA_SIZE, SCORE_AREA_SIZE);

  // Figure scale for scoring space
  let yScale = (SCORE_AREA_SIZE/2 - 500) / (SELECTED_FIGURE.maxY - AVG_Y);
  let xScale = (SCORE_AREA_SIZE/2 - 500) / (SELECTED_FIGURE.width/2);
  let figureScale = Math.min(xScale, yScale);
  let drawToScoreScale = figureScale / SCALE; // draw space -> score space

  if (!SCORE_DEBUG) {
    drawCanvas.style.display = "none";
  } else {
    // Optional: draw band for visual debug
    const minAngle = SELECTED_FIGURE.minTheta;
    const maxAngle = SELECTED_FIGURE.maxTheta;
    const thetaInc = (maxAngle - minAngle) / THETA_RESOLUTION_HIGH_LOD;

    drawCtx.strokeStyle = "black";
    const innerPath = new Path2D();
    const outerPath = new Path2D();

    let rads = getCoordsFromFigure(minAngle, figureScale, SCORE_AREA_SIZE/2, SCORE_AREA_SIZE/2);
    innerPath.moveTo(rads.innerX, rads.innerY);
    outerPath.moveTo(rads.outerX, rads.outerY);

    for (let theta = minAngle + thetaInc; theta <= maxAngle + 0.01; theta += thetaInc) {
      rads = getCoordsFromFigure(theta, figureScale, SCORE_AREA_SIZE/2, SCORE_AREA_SIZE/2);
      innerPath.lineTo(rads.innerX, rads.innerY);
      outerPath.lineTo(rads.outerX, rads.outerY);
    }
    drawCtx.stroke(innerPath);
    drawCtx.stroke(outerPath);
  }

  // Re-rasterize all strokes into scoring canvas
  drawCtx.strokeStyle = "red";
  drawCtx.fillStyle = "red";
  drawCtx.lineCap = "round";
  drawCtx.lineJoin = "round";

  strokes.forEach(stroke => {
    drawCtx.globalCompositeOperation =
      (stroke.strokeColor === DRAW_COLOR) ? "source-over" : "destination-out";

    drawCtx.lineWidth = stroke.brushSize * 2 * drawToScoreScale;

    if (stroke.x.length === 1) {
      // Render single taps as disks (iOS bug workaround)
      circle(
        Math.round(stroke.x[0] * drawToScoreScale + SCORE_AREA_SIZE/2),
        Math.round(stroke.y[0] * drawToScoreScale + SCORE_AREA_SIZE/2),
        stroke.brushSize * drawToScoreScale,
        true,
        drawCtx
      );
      return;
    }

    drawCtx.beginPath();
    drawCtx.moveTo(
      Math.round(stroke.x[0] * drawToScoreScale + SCORE_AREA_SIZE/2),
      Math.round(stroke.y[0] * drawToScoreScale + SCORE_AREA_SIZE/2)
    );
    for (let i = 0; i < stroke.x.length; i++) {
      drawCtx.lineTo(
        Math.round(stroke.x[i] * drawToScoreScale + SCORE_AREA_SIZE/2),
        Math.round(stroke.y[i] * drawToScoreScale + SCORE_AREA_SIZE/2)
      );
      drawCtx.stroke();
    }
  });

  // Get raster and score
  let imgData = drawCtx.getImageData(0, 0, SCORE_AREA_SIZE, SCORE_AREA_SIZE);
  mainScoreLoop(0, imgData, figureScale, progressBar);
}

// -----------------------------
// Robust scoring with auto-alignment
// -----------------------------

function mainScoreLoop(startingOffset, imgData, figureScale, progressBar) {
  const data = imgData.data;
  const W = SCORE_AREA_SIZE, H = SCORE_AREA_SIZE;

  // Exact denominator
  const A_fig_exact = figureAreaAnalytic(figureScale);

  // Collect drawn pixels once (fractional alpha)
  const drawn = [];
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] / 255;
    if (a === 0) continue;
    const px = (i / 4) % W;
    const py = Math.floor((i / 4) / W);
    drawn.push({ px, py, a });
  }

  if (drawn.length === 0) {
    scoreInc = 0;
    window._figureAreaExact = A_fig_exact;
    if (progressBar) progressBar.value = 1;
    return saveScore(imgData);
  }

  // Expected vertical shift from original scorer
  const baseY = AVG_Y * figureScale;

  // Search small XY offsets to align frames (cancels any residual misplacement)
  const search = { dxMin: -6, dxMax: 6, dyMin: -12, dyMax: 12, step: 1 };

  function scoreWithOffset(dx, dy) {
    let Ain = 0, Aout = 0;

    for (let k = 0; k < drawn.length; k++) {
      const a = drawn[k].a;

      // Center at canvas middle and apply test offsets
      const x = drawn[k].px - W / 2 - dx;
      const y = drawn[k].py - H / 2 - (baseY + dy);

      let theta = -Math.atan2(y, x);
      if (theta < SELECTED_FIGURE.minTheta || theta > SELECTED_FIGURE.maxTheta) {
        Aout += a;
        continue;
      }

      const r = Math.hypot(x, y);
      const eq = SELECTED_FIGURE.calcRad(theta);
      const rIn = eq.inner * figureScale;
      const rOut = eq.outer * figureScale;

      if (r >= rIn && r <= rOut) Ain += a; else Aout += a;
    }

    return { Ain, Aout, score: Ain - Aout };
  }

  // Coarse grid search
  let best = { dx: 0, dy: 0, Ain: 0, Aout: 0, score: -Infinity };
  for (let dy = search.dyMin; dy <= search.dyMax; dy += search.step) {
    for (let dx = search.dxMin; dx <= search.dxMax; dx += search.step) {
      const s = scoreWithOffset(dx, dy);
      if (s.score > best.score) best = { dx, dy, Ain: s.Ain, Aout: s.Aout, score: s.score };
    }
  }

  // Fine search around best
  for (let dy = best.dy - 1; dy <= best.dy + 1; dy += 0.25) {
    for (let dx = best.dx - 1; dx <= best.dx + 1; dx += 0.25) {
      const s = scoreWithOffset(dx, dy);
      if (s.score > best.score) best = { dx, dy, Ain: s.Ain, Aout: s.Aout, score: s.score };
    }
  }

  scoreInc = best.Ain - best.Aout;
  window._figureAreaExact = A_fig_exact;

  if (progressBar) progressBar.value = 1;
  saveScore(imgData);
}

// -----------------------------
// Save + navigate (kept compatible)
// -----------------------------

function saveScore(imgData) {
  drawCtx.putImageData(imgData, 0, 0);

  if (FIND_MAX_SCORE || SCORE_DEBUG) {
    alert(scoreInc);
  }

  const denom = (typeof window._figureAreaExact === "number" && window._figureAreaExact > 0)
    ? window._figureAreaExact
    : SELECTED_FIGURE.maxScore;

  // (area inside − area outside) / figure area
  const ratio = scoreInc / denom;
  const percent = ratio * 100;

  const formatted = new Intl.NumberFormat("en-US", {
    minimumIntegerDigits: 1,
    minimumFractionDigits: 5
  }).format(percent) + "%";

  sessionStorage.scoreObject = JSON.stringify(formatted);

  if (SCORE_DEBUG) return;

  if (IS_TEST) {
    location.href = "testEnd_auth.html";
  } else {
    location.href = "testPracticeEnd.html";
  }
}
