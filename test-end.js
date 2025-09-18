// test-end.js

// assumes the following globals already exist in your app:
// SCORE_AREA_SIZE, SELECTED_FIGURE, AVG_Y, SCALE, THETA_RESOLUTION_HIGH_LOD,
// strokes, DRAW_COLOR, drawCanvas, drawCtx, IS_TEST, SCORE_DEBUG,
// activatePrompt, endTestEarly, endPracticeEarly, loading, zoomOut,
// getCoordsFromFigure, circle

// helpers
const TAU = 2 * Math.PI;
function unwrapSpan(a, b) {
  let span = ((b - a) % TAU + TAU) % TAU;
  if (span === 0) span = TAU;
  return span;
}

// corrected analytic area
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

// corrected mask aligned with drawing center
function buildFigureMask(figureScale) {
  const W = SCORE_AREA_SIZE, H = SCORE_AREA_SIZE;
  const data = new Uint8ClampedArray(W * H * 4);

  const a = SELECTED_FIGURE.minTheta;
  const b = SELECTED_FIGURE.maxTheta;
  const span = unwrapSpan(a, b);

  const xC = W / 2;
  const yC = H / 2;
  const tol = 0.5;

  let p = 0;
  for (let y = 0; y < H; y++) {
    const yy = y - yC;
    for (let x = 0; x < W; x++) {
      const xx = x - xC;

      let theta = -Math.atan2(yy, xx);
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

  if (typeof ENABLE_SCORING === "undefined" || ENABLE_SCORING) {
    setTimeout(scoreFigure, 500);
  } else {
    location.href = "index.html";
  }
}

var scoreInc = 0;

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
  let drawToScoreScale = figureScale/SCALE;

  if (!SCORE_DEBUG) { drawCanvas.style.display = "none"; }
  else {
    let minAngle = SELECTED_FIGURE.minTheta;
    let maxAngle = SELECTED_FIGURE.maxTheta;

    drawCtx.strokeStyle = "black";
    let thetaInc = (maxAngle - minAngle)/THETA_RESOLUTION_HIGH_LOD;

    let innerPath = new Path2D();
    let outerPath = new Path2D();

    let rads = getCoordsFromFigure(minAngle, figureScale, SCORE_AREA_SIZE/2, SCORE_AREA_SIZE/2);
    innerPath.moveTo(rads.innerX, rads.innerY);
    outerPath.moveTo(rads.outerX, rads.outerY);

    for (let theta = minAngle + thetaInc; theta <= maxAngle + 0.01; theta += thetaInc) {
      let rads2 = getCoordsFromFigure(theta, figureScale, SCORE_AREA_SIZE/2, SCORE_AREA_SIZE/2);
      innerPath.lineTo(rads2.innerX, rads2.innerY);
      outerPath.lineTo(rads2.outerX, rads2.outerY);
    }

    drawCtx.stroke(innerPath);
    drawCtx.stroke(outerPath);
  }

  drawCtx.strokeStyle = "red";
  drawCtx.fillStyle = "red";
  drawCtx.lineCap = "round";
  drawCtx.lineJoin = "round";

  strokes.forEach(stroke => {
    if (stroke.strokeColor == DRAW_COLOR) {
      drawCtx.globalCompositeOperation = "source-over";
    } else {
      drawCtx.globalCompositeOperation = "destination-out";
    }
    drawCtx.lineWidth = stroke.brushSize*2*drawToScoreScale;

    if (stroke.x.length == 1) {
      circle(
        Math.round(stroke.x[0]*drawToScoreScale+SCORE_AREA_SIZE/2),
        Math.round(stroke.y[0]*drawToScoreScale+SCORE_AREA_SIZE/2),
        stroke.brushSize*drawToScoreScale,
        true,
        drawCtx
      );
      return;
    }

    drawCtx.beginPath();
    drawCtx.moveTo(
      Math.round(stroke.x[0]*drawToScoreScale+SCORE_AREA_SIZE/2),
      Math.round(stroke.y[0]*drawToScoreScale+SCORE_AREA_SIZE/2)
    );
    for (let i = 0; i < stroke.x.length; i++) {
      drawCtx.lineTo(
        Math.round(stroke.x[i]*drawToScoreScale+SCORE_AREA_SIZE/2),
        Math.round(stroke.y[i]*drawToScoreScale+SCORE_AREA_SIZE/2)
      );
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

  const denom = (typeof window._figureAreaExact === "number" && window._figureAreaExact > 0)
    ? window._figureAreaExact
    : 1;

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
