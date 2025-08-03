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
            circle(Math.round(stroke.x[0]*drawToScoreScale+SCORE_AREA_SIZE/2), Math.round(stroke.y[0]*drawToScoreScale+SCORE_AREA_SIZE/2), stroke.brushSize*drawToScoreScale, true, drawCtx);
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
    let i = startingOffset;
    while (i < startingOffset+imgData.data.length/8) { //WARNING! This divisor MUST be a multiple of 4 to prevent erronous scoring
        if (imgData.data[i] == 0 && !FIND_MAX_SCORE) { //Skip blank pixels
            i += 4;
            continue;
        }

        let x = (i / 4) % SCORE_AREA_SIZE - SCORE_AREA_SIZE/2;
        let y = Math.floor((i / 4) / SCORE_AREA_SIZE) - SCORE_AREA_SIZE/2 - AVG_Y*figureScale;
        let theta = -Math.atan2(y, x);
        let pixelR = Math.hypot(x, y);
        let figureCoords = getCoordsFromFigure(theta, figureScale, 0, -AVG_Y*figureScale);
        let innerR = Math.hypot(figureCoords.innerX, -figureCoords.innerY);
        let outerR = Math.hypot(figureCoords.outerX, -figureCoords.outerY);

        if (pixelR >= innerR && pixelR <= outerR) {
            imgData.data[i+1] = 255;
            imgData.data[i+3] = 255;
            scoreInc++;
        } else if (!FIND_MAX_SCORE){
            imgData.data[i+2] = 255;
            imgData.data[i+3] = 255;
            scoreInc--;
        }
        if (pixelR < 30 && SCORE_DEBUG) { //Show 0,0
            imgData.data[i+2] = 255;
            imgData.data[i+3] = 255;
        }
        i += 4;
    }

    progressBar.value = i/imgData.data.length;

    if (i < imgData.data.length) {
        setTimeout(()=>{mainScoreLoop(i, imgData, figureScale, progressBar)}, 0);
    } else {
        saveScore(imgData);
    }
}

function saveScore(imgData) {
    drawCtx.putImageData(imgData, 0, 0);

    if (FIND_MAX_SCORE) { //Alert the max score
        alert(scoreInc);
    }
    
    //Publish score to sessionStorage
    let score = Math.round(scoreInc/SELECTED_FIGURE.maxScore*100*10000)/10000 //Round to 4 decimal places
    if (score < 0) {
        score = "NEGATIVE VALUE";
    } else {
        let scoreFormat = new Intl.NumberFormat('en-US', { 
            minimumIntegerDigits: 1, 
            minimumFractionDigits: 4 //Guaruntees 4 decimal places
        });
        score = scoreFormat.format(score)+"%";
    }
    sessionStorage.scoreObject = JSON.stringify(score); //Stores drawing score in the session storages

    if (SCORE_DEBUG) return;

    if (IS_TEST) {
        location.href = "testEnd_auth.html";
    } else {
        location.href = "testPracticeEnd.html";
    }
}