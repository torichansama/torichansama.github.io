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

    if (FIND_MAX_SCORE || SCORE_DEBUG) {
        alert(scoreInc);
    }

    let ratio;
    if (window._areaMode && typeof window._figureArea === "number" && window._figureArea > 0) {
        // strict area normalization
        ratio = scoreInc / window._figureArea;
    } else {
        // legacy fallback if area mode not set
        ratio = scoreInc / SELECTED_FIGURE.maxScore;
    }

    // allow true negatives if outside area exceeds inside
    const percent = Math.round(ratio * 100 * 10000) / 10000;
    const formatted = new Intl.NumberFormat("en-US", {
        minimumIntegerDigits: 1,
        minimumFractionDigits: 4
    }).format(percent) + "%";

    sessionStorage.scoreObject = JSON.stringify(formatted);

    if (SCORE_DEBUG) return;

    if (IS_TEST) {
        location.href = "testEnd_auth.html";
    } else {
        location.href = "testPracticeEnd.html";
    }
}
