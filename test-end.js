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

// Compute the figure scale exactly once (shared by live + final scoring)
function computeFigureScale() {
    const yScale = (SCORE_AREA_SIZE / 2 - 500) / (SELECTED_FIGURE.maxY - AVG_Y);
    const xScale = (SCORE_AREA_SIZE / 2 - 500) / (SELECTED_FIGURE.width / 2);
    return Math.min(xScale, yScale);
}

/* ================================================================================================
   Live scoring helper (offscreen canvas)
   - Styling for the badge is in test_style.css (#liveScore)
   - Uses segment-by-segment stroking to match final rasterization closely
   - Hides badge by toggling the .hidden class when LIVE_SCORING is false
================================================================================================ */

// For exact parity, keep this equal to SCORE_AREA_SIZE (4096). Lower for perf if needed.
const LIVE_SIZE = SCORE_AREA_SIZE;

// Throttle: how often liveScoreThrottled is allowed to run during drawing (ms)
const LIVE_THROTTLE_MS = 100;

let _liveMask = null;
let _liveScale = 1;
let _liveLastScale = null;
let _liveFigureKey = null;

function _figureKey() {
    // Stable identity for current figure + dimensions that affect the band
    return `${SELECTED_FIGURE.minTheta}|${SELECTED_FIGURE.maxTheta}|${SELECTED_FIGURE.width}|${SELECTED_FIGURE.minY}|${SELECTED_FIGURE.maxY}`;
}

function _buildLiveMask(figureScale) {
    const c = document.createElement("canvas");
    c.width = c.height = LIVE_SIZE;
    const cx = c.getContext("2d");
    cx.imageSmoothingEnabled = false;

    _liveScale = LIVE_SIZE / SCORE_AREA_SIZE; // 1.0 when LIVE_SIZE == SCORE_AREA_SIZE

    const minT = SELECTED_FIGURE.minTheta;
    const maxT = SELECTED_FIGURE.maxTheta;
    const inc  = (maxT - minT) / THETA_RESOLUTION_HIGH_LOD;

    const inner = new Path2D();
    const outer = new Path2D();

    let r = getCoordsFromFigure(minT, figureScale * _liveScale, LIVE_SIZE / 2, LIVE_SIZE / 2);
    inner.moveTo(r.innerX, r.innerY);
    outer.moveTo(r.outerX, r.outerY);

    for (let t = minT + inc; t <= maxT + 1e-3; t += inc) {
        r = getCoordsFromFigure(t, figureScale * _liveScale, LIVE_SIZE / 2, LIVE_SIZE / 2);
        inner.lineTo(r.innerX, r.innerY);
        outer.lineTo(r.outerX, r.outerY);
    }

    // Create band mask (outer filled, inner punched out)
    cx.fillStyle = "#fff";
    cx.globalCompositeOperation = "source-over";   cx.fill(outer);
    cx.globalCompositeOperation = "destination-out"; cx.fill(inner);

    _liveMask = cx.getImageData(0, 0, LIVE_SIZE, LIVE_SIZE).data;
    _liveLastScale = figureScale;
    _liveFigureKey = _figureKey();
}

// Call this after draw updates (or with {force:true} for taps/boot)
function liveScoreThrottled(figureScale, { force = false } = {}) {
    const badge = document.getElementById("liveScore");
    if (!badge) return;

    // Hide/show badge via CSS only (no inline styles)
    if (typeof LIVE_SCORING !== "undefined" && !LIVE_SCORING) {
        badge.classList.add("hidden");
        return;
    } else {
        badge.classList.remove("hidden");
    }

    // Throttle guard
    const now = performance.now();
    if (!liveScoreThrottled._last) liveScoreThrottled._last = 0;
    if (!force && (now - liveScoreThrottled._last < LIVE_THROTTLE_MS)) return;
    liveScoreThrottled._last = now;

    // Rebuild mask if figure/scale changed
    if (!_liveMask || _liveLastScale !== figureScale || _liveFigureKey !== _figureKey()) {
        _buildLiveMask(figureScale);
    }

    // Offscreen canvas for user drawing
    const c = document.createElement("canvas");
    c.width = c.height = LIVE_SIZE;
    const cx = c.getContext("2d");
    cx.imageSmoothingEnabled = false;

    const drawToScoreScale = (figureScale / SCALE) * _liveScale;

    // Match final line rasterization settings
    cx.lineCap = "round";
    cx.lineJoin = "round";

    // Draw strokes — PER-SEGMENT stroked (parity with final)
    for (const st of strokes) {
        cx.globalCompositeOperation = (st.strokeColor === DRAW_COLOR) ? "source-over" : "destination-out";
        cx.strokeStyle = "red";
        cx.fillStyle   = "red";
        cx.lineWidth   = st.brushSize * 2 * drawToScoreScale;

        if (st.x.length === 1) {
            // Single tap → circle (as in final)
            circle(
                Math.round(st.x[0] * drawToScoreScale + LIVE_SIZE / 2),
                Math.round(st.y[0] * drawToScoreScale + LIVE_SIZE / 2),
                st.brushSize * drawToScoreScale,
                true,
                cx
            );
            continue;
        }

        cx.beginPath();
        cx.moveTo(
            Math.round(st.x[0] * drawToScoreScale + LIVE_SIZE / 2),
            Math.round(st.y[0] * drawToScoreScale + LIVE_SIZE / 2)
        );
        for (let i = 1; i < st.x.length; i++) {
            cx.lineTo(
                Math.round(st.x[i] * drawToScoreScale + LIVE_SIZE / 2),
                Math.round(st.y[i] * drawToScoreScale + LIVE_SIZE / 2)
            );
            cx.stroke(); // stroke each segment (parity)
        }
    }

    // Count coverage vs band
    const dr = cx.getImageData(0, 0, LIVE_SIZE, LIVE_SIZE).data;

    let Afig = 0, Ain = 0, Aout = 0;
    for (let i = 0; i < dr.length; i += 4) {
        const fig   = _liveMask[i + 3] > 0;
        const drawn = dr[i + 3] > 0;
        if (fig) Afig++;
        if (drawn && fig) Ain++;
        if (drawn && !fig) Aout++;
    }
    const ratio = Afig > 0 ? (Ain - Aout) / Afig : 0;

    // Update badge text
    const pct = Math.round(ratio * 100 * 10000) / 10000;
    if (pct < 0) {
        const fmt = new Intl.NumberFormat("en-US", { minimumIntegerDigits: 1, minimumFractionDigits: 4 })
            .format(pct) + "%";
        // two lines: NEGATIVE VALUE, then the number
        badge.innerHTML = "NEGATIVE VALUE<br>" + fmt;
    } else {
        badge.textContent = new Intl.NumberFormat("en-US", { minimumIntegerDigits: 1, minimumFractionDigits: 4 })
            .format(pct) + "%";
    }
}

/* ================================================================================================
   Final scoring (authoritative)
================================================================================================ */

var scoreInc = 0;

function scoreFigure() {
    let progressBar = document.getElementById("progress");

    // Prepare a 4096x4096 scoring canvas
    drawCanvas.style.width = `${SCORE_AREA_SIZE}px`;
    drawCanvas.style.height = `${SCORE_AREA_SIZE}px`;
    drawCanvas.width = SCORE_AREA_SIZE;
    drawCanvas.height = SCORE_AREA_SIZE;

    // Should be wiped by resize; clear anyway
    drawCtx.clearRect(0, 0, SCORE_AREA_SIZE, SCORE_AREA_SIZE);

    const figureScale = computeFigureScale();
    const drawToScoreScale = figureScale / SCALE;

    if (!SCORE_DEBUG) {
        drawCanvas.style.display = "none";
    } else {
        // Optional outline preview (debug only)
        const minAngle = SELECTED_FIGURE.minTheta;
        const maxAngle = SELECTED_FIGURE.maxTheta;
        drawCtx.strokeStyle = "black";

        const thetaInc = (maxAngle - minAngle) / THETA_RESOLUTION_HIGH_LOD;

        const innerPath = new Path2D();
        const outerPath = new Path2D();

        let rads = getCoordsFromFigure(minAngle, figureScale, SCORE_AREA_SIZE / 2, SCORE_AREA_SIZE / 2);
        innerPath.moveTo(rads.innerX, rads.innerY);
        outerPath.moveTo(rads.outerX, rads.outerY);

        for (let theta = minAngle + thetaInc; theta <= maxAngle + 0.01; theta += thetaInc) {
            rads = getCoordsFromFigure(theta, figureScale, SCORE_AREA_SIZE / 2, SCORE_AREA_SIZE / 2);
            innerPath.lineTo(rads.innerX, rads.innerY);
            outerPath.lineTo(rads.outerX, rads.outerY);
        }

        drawCtx.stroke(innerPath);
        drawCtx.stroke(outerPath);
    }

    // Rasterize user strokes onto scoring canvas (segment-by-segment)
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
        drawCtx.lineWidth = stroke.brushSize * 2 * drawToScoreScale;

        if (stroke.x.length == 1) {
            // iOS doesn’t render zero-length lines → draw a circle
            circle(
                Math.round(stroke.x[0] * drawToScoreScale + SCORE_AREA_SIZE / 2),
                Math.round(stroke.y[0] * drawToScoreScale + SCORE_AREA_SIZE / 2),
                stroke.brushSize * drawToScoreScale,
                true,
                drawCtx
            );
            return;
        }

        drawCtx.beginPath();
        drawCtx.moveTo(
            Math.round(stroke.x[0] * drawToScoreScale + SCORE_AREA_SIZE / 2),
            Math.round(stroke.y[0] * drawToScoreScale + SCORE_AREA_SIZE / 2)
        );
        for (let i = 0; i < stroke.x.length; i++) {
            drawCtx.lineTo(
                Math.round(stroke.x[i] * drawToScoreScale + SCORE_AREA_SIZE / 2),
                Math.round(stroke.y[i] * drawToScoreScale + SCORE_AREA_SIZE / 2)
            );
            drawCtx.stroke(); // per-segment, like live (and like before)
        }
    });

    // Score strokes against the figure band
    const imgData = drawCtx.getImageData(0, 0, SCORE_AREA_SIZE, SCORE_AREA_SIZE);
    mainScoreLoop(0, imgData, figureScale, progressBar);
}

function mainScoreLoop(startingOffset, imgData, figureScale, progressBar) {
    // imgData already contains the rasterized user drawing
    const drawData = imgData.data;

    // Build a clean figure mask at the same center and scale
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

    // Fill outer ring then punch inner hole to create band
    figCtx.fillStyle = "#fff";
    figCtx.globalCompositeOperation = "source-over";
    figCtx.fill(outerPath);
    figCtx.globalCompositeOperation = "destination-out";
    figCtx.fill(innerPath);

    const figData = figCtx.getImageData(0, 0, SCORE_AREA_SIZE, SCORE_AREA_SIZE).data;

    let A_fig = 0;
    let A_in = 0;
    let A_out = 0;

    // Count by alpha
    for (let i = 0; i < figData.length; i += 4) {
        const figOn = figData[i + 3] > 0;
        const drawn = drawData[i + 3] > 0;

        if (figOn) A_fig++;
        if (drawn && figOn) A_in++;
        if (drawn && !figOn) A_out++;
    }

    // Publish for saveScore
    window._areaMode = true;
    window._figureArea = A_fig;
    scoreInc = A_in - A_out;

    if (progressBar) progressBar.value = 1;

    saveScore(imgData);
}

function saveScore(imgData) {
    // Restore draw canvas
    drawCtx.putImageData(imgData, 0, 0);

    if (FIND_MAX_SCORE || SCORE_DEBUG) {
        alert(scoreInc);
    }

    // Normalize to the figure area when available (authoritative)
    let ratio;
    if (window._areaMode && typeof window._figureArea === "number" && window._figureArea > 0) {
        ratio = scoreInc / window._figureArea;
    } else {
        ratio = scoreInc / SELECTED_FIGURE.maxScore; // legacy fallback
    }

    const percent = Math.round(ratio * 100 * 10000) / 10000;
    const fmt = new Intl.NumberFormat("en-US", {
        minimumIntegerDigits: 1,
        minimumFractionDigits: 4
    }).format(percent) + "%";

    // Two lines when negative (plain \n so it’s safe if the end page shows text)
    const out = (percent < 0) ? ("NEGATIVE VALUE\n" + fmt) : fmt;

    sessionStorage.scoreObject = JSON.stringify(out);

    if (SCORE_DEBUG) return;

    if (IS_TEST) {
        location.href = "testEnd_auth.html";
    } else {
        location.href = "testPracticeEnd.html";
    }
}
