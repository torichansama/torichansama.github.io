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
  return s * h; // pixel squared in the scoring canvas
}

function buildFigureMask(figureScale, thetaRes) {
  const c = document.createElement("canvas");
  c.width = SCORE_AREA_SIZE;
  c.height = SCORE_AREA_SIZE;
  const ctx = c.getContext("2d", { willReadFrequently: false });
  ctx.imageSmoothingEnabled = false;

  const a = SELECTED_FIGURE.minTheta;
  const b = SELECTED_FIGURE.maxTheta;
  const dt = (b - a) / thetaRes;

  const inner = new Path2D();
  const outer = new Path2D();

  let r = getCoordsFromFigure(a, figureScale, SCORE_AREA_SIZE / 2, SCORE_AREA_SIZE / 2);
  inner.moveTo(r.innerX, r.innerY);
  outer.moveTo(r.outerX, r.outerY);

  for (let t = a + dt; t <= b + 1e-6; t += dt) {
    r = getCoordsFromFigure(t, figureScale, SCORE_AREA_SIZE / 2, SCORE_AREA_SIZE / 2);
    inner.lineTo(r.innerX, r.innerY);
    outer.lineTo(r.outerX, r.outerY);
  }

  ctx.fillStyle = "#fff";
  ctx.globalCompositeOperation = "source-over";
  ctx.fill(outer);
  ctx.globalCompositeOperation = "destination-out";
  ctx.fill(inner);

  return ctx.getImageData(0, 0, SCORE_AREA_SIZE, SCORE_AREA_SIZE).data;
}


function promptSessionEnd() {
    if (IS_TEST) {
        activatePrompt(endTestEarly);
    } else {
        activatePrompt(endPracticeEarly);
    }
}

function endTest() {
    zoomOut(false)

    if (!SCORE_DEBUG) activatePrompt(loading);

    if (ENABLE_SCORING) {
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

    drawCtx.clearRect(0, 0, SCORE_AREA_SIZE, SCORE_AREA_SIZE); //Should be wiped by canvas resize but cant be too safe

    let yScale = (SCORE_AREA_SIZE/2-500)/(SELECTED_FIGURE.maxY-AVG_Y);
    let xScale = (SCORE_AREA_SIZE/2-500)/(SELECTED_FIGURE.width/2);
    let figureScale = Math.min(xScale, yScale); //Scale of figure in scoring mode
    let drawToScoreScale = figureScale/SCALE; //Realtive size of scoring figure compared to drawing figure

    if (!SCORE_DEBUG) {drawCanvas.style.display = "none";}
    else {
        let minAngle = SELECTED_FIGURE.minTheta;
        let maxAngle = SELECTED_FIGURE.maxTheta;

        drawCtx.strokeStyle = "black";
        
        let thetaInc = (maxAngle-minAngle)/THETA_RESOLUTION_HIGH_LOD;

        let innerPath = new Path2D();
        let outerPath = new Path2D();

        let rads = getCoordsFromFigure(minAngle, figureScale, SCORE_AREA_SIZE/2, SCORE_AREA_SIZE/2);
        innerPath.moveTo(rads.innerX, rads.innerY);
        outerPath.moveTo(rads.outerX, rads.outerY);

        for (let theta = minAngle+thetaInc; theta <= maxAngle+0.01; theta += thetaInc) {
            let rads = getCoordsFromFigure(theta, figureScale, SCORE_AREA_SIZE/2, SCORE_AREA_SIZE/2);
            innerPath.lineTo(rads.innerX, rads.innerY);
            outerPath.lineTo(rads.outerX, rads.outerY);
        }

        drawCtx.stroke(innerPath);
        drawCtx.stroke(outerPath);
    }

    //Drawing strokes using one continuous line
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

        if (stroke.x.length == 1) { //Render single length strokes as circles since iOS doesn't render lines that end at the same point they start
            console.log(stroke.brushSize*drawToScoreScale);
            circle(Math.round(stroke.x[0]*drawToScoreScale+SCORE_AREA_SIZE/2), Math.round(stroke.y[0]*drawToScoreScale+SCORE_AREA_SIZE/2), stroke.brushSize*drawToScoreScale, true, drawCtx);
            // circle(Math.round(stroke.x[0]*drawToScoreScale+SCORE_AREA_SIZE/2), Math.round(stroke.y[0]*drawToScoreScale+SCORE_AREA_SIZE/2), 100, true, drawCtx);
            return;
        }

        drawCtx.beginPath();
        drawCtx.moveTo(Math.round(stroke.x[0]*drawToScoreScale+SCORE_AREA_SIZE/2), Math.round(stroke.y[0]*drawToScoreScale+SCORE_AREA_SIZE/2))
        for (let i = 0; i < stroke.x.length; i++) {
            drawCtx.lineTo(Math.round(stroke.x[i]*drawToScoreScale+SCORE_AREA_SIZE/2), Math.round(stroke.y[i]*drawToScoreScale+SCORE_AREA_SIZE/2));
            drawCtx.stroke();
        }
    });

    //Score strokes against figure 
    let imgData = drawCtx.getImageData(0, 0, SCORE_AREA_SIZE, SCORE_AREA_SIZE);
    mainScoreLoop(0, imgData, figureScale, progressBar);
}

function mainScoreLoop(startingOffset, imgData, figureScale, progressBar) {
  const data = imgData.data;
  const W = SCORE_AREA_SIZE, H = SCORE_AREA_SIZE;

  // center that cancels the internal AVG_Y shift in getCoordsFromFigure
  const xCenter = W / 2;
  const yCenter = H / 2 - AVG_Y * figureScale;

  // exact figure area by integration
  const a = SELECTED_FIGURE.minTheta, b = SELECTED_FIGURE.maxTheta;
  const n = 4096;                 // even
  const h = (b - a) / n;
  let accum = 0;
  for (let i = 0; i <= n; i++) {
    const t = a + i * h;
    const eq = SELECTED_FIGURE.calcRad(t);
    const ro = eq.outer * figureScale, ri = eq.inner * figureScale;
    const band = 0.5 * (ro*ro - ri*ri);
    accum += (i === 0 || i === n) ? band : (i % 2 === 0 ? 2*band : 4*band);
  }
  const A_fig_exact = accum * h;

  // fractional area counts only where the user actually drew
  let A_in = 0, A_out = 0;
  for (let y = 0; y < H; y++) {
    const yy = y - yCenter;
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;
      const d = data[idx + 3] / 255;   // drawn coverage
      if (d === 0) continue;

      const xx = x - xCenter;
      const theta = -Math.atan2(yy, xx);
      if (theta < a || theta > b) { A_out += d; continue; }

      const r = Math.hypot(xx, yy);
      const eq = SELECTED_FIGURE.calcRad(theta);
      const innerR = eq.inner * figureScale;
      const outerR = eq.outer * figureScale;

      if (r >= innerR && r <= outerR) A_in += d;
      else A_out += d;
    }
  }

  scoreInc = A_in - A_out;
  window._figureAreaExact = A_fig_exact;

  if (progressBar) progressBar.value = 1;
  saveScore(imgData);
}


function saveScore(imgData) {
  drawCtx.putImageData(imgData, 0, 0);

  const ratio = (typeof window._figureAreaExact === "number" && window._figureAreaExact > 0)
    ? scoreInc / window._figureAreaExact
    : 0;

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
