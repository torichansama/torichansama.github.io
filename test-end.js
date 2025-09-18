// helpers
const TAU = 2 * Math.PI;
function unwrapSpan(a, b) {
  let span = ((b - a) % TAU + TAU) % TAU;
  if (span === 0) span = TAU;
  return span;
}

// corrected analytic area using unwrapped span and positive h
function figureAreaAnalytic(figureScale) {
  const a = SELECTED_FIGURE.minTheta;
  const b = SELECTED_FIGURE.maxTheta;
  const span = unwrapSpan(a, b);

  const n = 4096; // even
  const h = span / n;

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
  return Math.abs(s * h);
}

// corrected mask aligned to drawing center and same unwrap
function buildFigureMask(figureScale) {
  const W = SCORE_AREA_SIZE, H = SCORE_AREA_SIZE;
  const data = new Uint8ClampedArray(W * H * 4);

  const a = SELECTED_FIGURE.minTheta;
  const b = SELECTED_FIGURE.maxTheta;
  const span = unwrapSpan(a, b);

  const xC = W / 2;
  const yC = H / 2;              // align with drawing center
  const tol = 0.5;

  let p = 0;
  for (let y = 0; y < H; y++) {
    const yy = y - yC;
    for (let x = 0; x < W; x++) {
      const xx = x - xC;

      // drawing uses -atan2(yy, xx)
      let theta = -Math.atan2(yy, xx);

      // unwrap into [a, a + span]
      const rel = ((theta - a) % TAU + TAU) % TAU;
      if (rel <= span) {
        const r = Math.hypot(xx, yy);
        const eq = SELECTED_FIGURE.calcRad(a + rel);
        const innerR = eq.inner * figureScale;
        const outerR = eq.outer * figureScale;

        if (r >= innerR - tol && r <= outerR + tol) {
          data[p + 3] = 255;
        }
      }
      p += 4;
    }
  }
  return data;
}

// unchanged draw logic, but kept here for clarity of center alignment
function scoreFigure() {
  let progressBar = document.getElementById("progress");

  drawCanvas.style.width = `${SCORE_AREA_SIZE}px`;
  drawCanvas.style.height = `${SCORE_AREA_SIZE}px`;
  drawCanvas.width = SCORE_AREA_SIZE;
  drawCanvas.height = SCORE_AREA_SIZE;

  drawCtx.clearRect(0, 0, SCORE_AREA_SIZE, SCORE_AREA_SIZE);

  let yScale = (SCORE_AREA_SIZE/2-500)/(SELECTED_FIGURE.maxY-AVG_Y);
  let xScale = (SCORE_AREA_SIZE/2-500)/(SELECTED_FIGURE.width/2);
  let figureScale = Math.min(xScale, yScale);
  let drawToScoreScale = figureScale / SCALE;

  if (!SCORE_DEBUG) { drawCanvas.style.display = "none"; }
  else {
    let minAngle = SELECTED_FIGURE.minTheta;
    let maxAngle = SELECTED_FIGURE.maxTheta;
    drawCtx.strokeStyle = "black";
    let thetaInc = (unwrapSpan(minAngle, maxAngle))/THETA_RESOLUTION_HIGH_LOD;

    let innerPath = new Path2D();
    let outerPath = new Path2D();

    let rads0 = getCoordsFromFigure(minAngle, figureScale, SCORE_AREA_SIZE/2, SCORE_AREA_SIZE/2);
    innerPath.moveTo(rads0.innerX, rads0.innerY);
    outerPath.moveTo(rads0.outerX, rads0.outerY);

    for (let theta = minAngle + thetaInc; theta <= minAngle + unwrapSpan(minAngle, maxAngle) + 1e-2; theta += thetaInc) {
      let rads = getCoordsFromFigure(theta, figureScale, SCORE_AREA_SIZE/2, SCORE_AREA_SIZE/2);
      innerPath.lineTo(rads.innerX, rads.innerY);
      outerPath.lineTo(rads.outerX, rads.outerY);
    }

    drawCtx.stroke(innerPath);
    drawCtx.stroke(outerPath);
  }

  drawCtx.strokeStyle = "red";
  drawCtx.fillStyle = "red";
  drawCtx.lineCap = "round";
  drawCtx.lineJoin = "round";

  strokes.forEach(stroke => {
    drawCtx.globalCompositeOperation = (stroke.strokeColor == DRAW_COLOR) ? "source-over" : "destination-out";
    drawCtx.lineWidth = stroke.brushSize * 2 * drawToScoreScale;

    if (stroke.x.length == 1) {
      circle(Math.round(stroke.x[0]*drawToScoreScale+SCORE_AREA_SIZE/2),
             Math.round(stroke.y[0]*drawToScoreScale+SCORE_AREA_SIZE/2),
             stroke.brushSize*drawToScoreScale, true, drawCtx);
      return;
    }

    drawCtx.beginPath();
    drawCtx.moveTo(Math.round(stroke.x[0]*drawToScoreScale+SCORE_AREA_SIZE/2),
                   Math.round(stroke.y[0]*drawToScoreScale+SCORE_AREA_SIZE/2));
    for (let i = 0; i < stroke.x.length; i++) {
      drawCtx.lineTo(Math.round(stroke.x[i]*drawToScoreScale+SCORE_AREA_SIZE/2),
                     Math.round(stroke.y[i]*drawToScoreScale+SCORE_AREA_SIZE/2));
      drawCtx.stroke();
    }
  });

  let imgData = drawCtx.getImageData(0, 0, SCORE_AREA_SIZE, SCORE_AREA_SIZE);
  mainScoreLoop(0, imgData, figureScale, progressBar);
}

function mainScoreLoop(startingOffset, imgData, figureScale, progressBar) {
  const drawData = imgData.data;

  const figData = buildFigureMask(figureScale);
  const A_fig_exact = figureAreaAnalytic(figureScale);

  let A_in = 0;
  let A_out = 0;

  for (let i = 0; i < figData.length; i += 4) {
    const f = figData[i + 3] / 255;
    const d = drawData[i + 3] / 255;
    if (d === 0) continue;

    A_in  += d * f;
    A_out += d * (1 - f);
  }

  scoreInc = A_in - A_out;
  window._figureAreaExact = A_fig_exact;

  if (progressBar) progressBar.value = 1;
  saveScore(imgData);
}

function saveScore(imgData) {
  drawCtx.putImageData(imgData, 0, 0);

  let denom = Number.isFinite(window._figureAreaExact) && window._figureAreaExact > 0
    ? window._figureAreaExact
    : 1; // guard

  const ratio = scoreInc / denom;
  const percent = ratio * 100;

  const formatted = new Intl.NumberFormat("en-US", {
    minimumIntegerDigits: 1,
    minimumFractionDigits: 5
  }).format(percent) + "%";

  sessionStorage.scoreObject = JSON.stringify(formatted);

  if (SCORE_DEBUG) return;
  if (IS_TEST) location.href = "testEnd_auth.html";
  else location.href = "testPracticeEnd.html";
}
