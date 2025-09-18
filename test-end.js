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
    // score by user marks, not pixels
    let inside = 0;
    let outside = 0;
    let total = 0;

    const drawToScoreScale = figureScale / SCALE;

    // count only drawn marks, ignore eraser strokes
    for (const stroke of strokes) {
        if (stroke.strokeColor !== DRAW_COLOR) continue;
        for (let k = 0; k < stroke.x.length; k++) {
            const x = stroke.x[k] * drawToScoreScale;                         // centered space, no half size added
            const y = stroke.y[k] * drawToScoreScale - AVG_Y * figureScale;   // match figure y offset

            const theta = -Math.atan2(y, x);
            const rUser = Math.hypot(x, y);

            const fc = getCoordsFromFigure(theta, figureScale, 0, -AVG_Y * figureScale);
            const innerR = Math.hypot(fc.innerX, -fc.innerY);
            const outerR = Math.hypot(fc.outerX, -fc.outerY);

            if (rUser >= innerR && rUser <= outerR) inside++;
            else outside++;

            total++;
        }
    }

    // preserve old global so saveScore still works
    scoreInc = inside - outside;

    // hand total to saveScore without touching other code
    window._strokeTotal = total;

    if (progressBar) progressBar.value = 1;

    saveScore(imgData);
}

function saveScore(imgData) {
    drawCtx.putImageData(imgData, 0, 0);

    if (FIND_MAX_SCORE || SCORE_DEBUG) {
        alert(scoreInc);
    }

    let score;
    if (typeof window._strokeTotal === "number" && window._strokeTotal > 0) {
        // stroke based normalization
        score = Math.round((scoreInc / window._strokeTotal) * 100 * 10000) / 10000;
    } else {
        // fallback to old normalization if needed
        score = Math.round(scoreInc / SELECTED_FIGURE.maxScore * 100 * 10000) / 10000;
    }

    if (score < 0) {
        score = "NEGATIVE VALUE";
    } else {
        const scoreFormat = new Intl.NumberFormat("en-US", {
            minimumIntegerDigits: 1,
            minimumFractionDigits: 4
        });
        score = scoreFormat.format(score) + "%";
    }

    sessionStorage.scoreObject = JSON.stringify(score);

    if (SCORE_DEBUG) return;

    if (IS_TEST) {
        location.href = "testEnd_auth.html";
    } else {
        location.href = "testPracticeEnd.html";
    }
}

