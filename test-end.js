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

function computeFigureScale() {
  const yScale = (SCORE_AREA_SIZE/2 - 500) / (SELECTED_FIGURE.maxY - AVG_Y);
  const xScale = (SCORE_AREA_SIZE/2 - 500) / (SELECTED_FIGURE.width / 2);
  return Math.min(xScale, yScale);
}

// ---- Live scoring (low-res) ----
const LIVE_SIZE = 4096;
let _liveMask = null;
let _liveScale = 1;

function _buildLiveMask(figureScale) {
  const c = document.createElement("canvas");
  c.width = c.height = LIVE_SIZE;
  const cx = c.getContext("2d");
  cx.imageSmoothingEnabled = false;

  const s = LIVE_SIZE / SCORE_AREA_SIZE;   // downscale factor
  _liveScale = s;

  const minT = SELECTED_FIGURE.minTheta;
  const maxT = SELECTED_FIGURE.maxTheta;
  const inc = (maxT - minT) / THETA_RESOLUTION_HIGH_LOD;

  const inner = new Path2D();
  const outer = new Path2D();

  let r = getCoordsFromFigure(minT, figureScale * s, LIVE_SIZE/2, LIVE_SIZE/2);
  inner.moveTo(r.innerX, r.innerY);
  outer.moveTo(r.outerX, r.outerY);
  for (let t = minT + inc; t <= maxT + 1e-3; t += inc) {
    r = getCoordsFromFigure(t, figureScale * s, LIVE_SIZE/2, LIVE_SIZE/2);
    inner.lineTo(r.innerX, r.innerY);
    outer.lineTo(r.outerX, r.outerY);
  }

  cx.fillStyle = "#fff";
  cx.globalCompositeOperation = "source-over"; cx.fill(outer);
  cx.globalCompositeOperation = "destination-out"; cx.fill(inner);

  _liveMask = cx.getImageData(0, 0, LIVE_SIZE, LIVE_SIZE).data;
}

function liveScoreThrottled(figureScale) {
  // throttle ~10 fps
  const now = performance.now();
  if (!liveScoreThrottled._last) liveScoreThrottled._last = 0;
  if (now - liveScoreThrottled._last < 100) return;
  liveScoreThrottled._last = now;

  if (!_liveMask) _buildLiveMask(figureScale);

  // redraw strokes into a low-res canvas
  const c = document.createElement("canvas");
  c.width = c.height = LIVE_SIZE;
  const cx = c.getContext("2d");
  cx.imageSmoothingEnabled = false;

  const s = _liveScale;
  const drawToScoreScale = (figureScale / SCALE) * s;

  cx.lineCap = "round";
  cx.lineJoin = "round";
  for (const st of strokes) {
    cx.globalCompositeOperation = (st.strokeColor === DRAW_COLOR) ? "source-over" : "destination-out";
    cx.strokeStyle = "red";
    cx.fillStyle = "red";
    cx.lineWidth = st.brushSize * 2 * drawToScoreScale;

    if (st.x.length === 1) {
      circle(
        Math.round(st.x[0] * drawToScoreScale + LIVE_SIZE/2),
        Math.round(st.y[0] * drawToScoreScale + LIVE_SIZE/2),
        st.brushSize * drawToScoreScale,
        true,
        cx
      );
      continue;
    }

    cx.beginPath();
    cx.moveTo(
      Math.round(st.x[0] * drawToScoreScale + LIVE_SIZE/2),
      Math.round(st.y[0] * drawToScoreScale + LIVE_SIZE/2)
    );
    for (let i = 1; i < st.x.length; i++) {
      cx.lineTo(
        Math.round(st.x[i] * drawToScoreScale + LIVE_SIZE/2),
        Math.round(st.y[i] * drawToScoreScale + LIVE_SIZE/2)
      );
    }
    cx.stroke();
  }

  const dr = cx.getImageData(0, 0, LIVE_SIZE, LIVE_SIZE).data;

  let Afig = 0, Ain = 0, Aout = 0;
  for (let i = 0; i < dr.length; i += 4) {
    const fig = _liveMask[i + 3] > 0;
    const drawn = dr[i + 3] > 0;
    if (fig) Afig++;
    if (drawn && fig) Ain++;
    if (drawn && !fig) Aout++;
  }
  const ratio = Afig > 0 ? (Ain - Aout) / Afig : 0;

  const el = document.getElementById("liveScore");
  if (!el) return;
  if (ratio < 0) {
    const fmt = new Intl.NumberFormat("en-US", { minimumIntegerDigits: 1, minimumFractionDigits: 4 })
                .format(Math.round(ratio * 100 * 10000) / 10000) + "%";
    el.innerHTML = "\n NEGATIVE VALUE \n" + fmt;
  } else {
    el.textContent = new Intl.NumberFormat("en-US", { minimumIntegerDigits: 1, minimumFractionDigits: 4 })
                      .format(Math.round(ratio * 100 * 10000) / 10000) + "%";
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
    // imgData already contains the rasterized user drawing
    const drawData = imgData.data;

    // build a clean figure mask at the same center and scale
    const figCanvas = document.createElement("canvas");
    figCanvas.width = SCORE_AREA_SIZE;
    figCanvas.height = SCORE_AREA_SIZE;
    const figCtx = figCanvas.getContext("2d", { willReadFrequently: false });
    figCtx.imageSmoothingEnabled = false;

    const minAngle = SELECTED_FIGURE.minTheta;
    const maxAngle = SELECTED_FIGURE.maxTheta;
    const thetaInc = (maxAngle - minAngle) / THETA_RESOLUTION_HIGH_LOD;

    const innerPath = new Path2D();
    const outerPath = new Path2D();

    let r = getCoordsFromFigure(minAngle, figureScale, SCORE_AREA_SIZE / 2, SCORE_AREA_SIZE / 2);
    innerPath.moveTo(r.innerX, r.innerY);
    outerPath.moveTo(r.outerX, r.outerY);

    for (let t = minAngle + thetaInc; t <= maxAngle + 1e-3; t += thetaInc) {
        r = getCoordsFromFigure(t, figureScale, SCORE_AREA_SIZE / 2, SCORE_AREA_SIZE / 2);
        innerPath.lineTo(r.innerX, r.innerY);
        outerPath.lineTo(r.outerX, r.outerY);
    }

    // fill outer ring then punch inner hole to create band
    figCtx.fillStyle = "#fff";
    figCtx.globalCompositeOperation = "source-over";
    figCtx.fill(outerPath);
    figCtx.globalCompositeOperation = "destination-out";
    figCtx.fill(innerPath);

    const figData = figCtx.getImageData(0, 0, SCORE_AREA_SIZE, SCORE_AREA_SIZE).data;

    let A_fig = 0;
    let A_in = 0;
    let A_out = 0;

    // count by alpha
    for (let i = 0; i < figData.length; i += 4) {
        const figOn = figData[i + 3] > 0;
        const drawn = drawData[i + 3] > 0;

        if (figOn) A_fig++;
        if (drawn && figOn) A_in++;
        if (drawn && !figOn) A_out++;
    }

    // publish for saveScore
    window._areaMode = true;
    window._figureArea = A_fig;
    scoreInc = A_in - A_out;

    if (progressBar) progressBar.value = 1;

    saveScore(imgData);
}

function saveScore(imgData) {
  drawCtx.putImageData(imgData, 0, 0);

  if (FIND_MAX_SCORE || SCORE_DEBUG) alert(scoreInc);

  let ratio;
  if (window._areaMode && window._figureArea > 0) ratio = scoreInc / window._figureArea;
  else ratio = scoreInc / SELECTED_FIGURE.maxScore;

  const percent = Math.round(ratio * 100 * 10000) / 10000;

  const fmt = new Intl.NumberFormat("en-US", {
    minimumIntegerDigits: 1,
    minimumFractionDigits: 4
  }).format(percent) + "%";

  // show two lines when negative
  const out = (percent < 0) ? ("NEGATIVE VALUE<br>" + fmt) : fmt;

  sessionStorage.scoreObject = JSON.stringify(out);

  if (SCORE_DEBUG) return;

  if (IS_TEST) location.href = "testEnd_auth.html";
  else location.href = "testPracticeEnd.html";
}
