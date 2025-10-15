function promptSessionEnd() {
    if (IS_TEST) {
        activatePrompt(endTestEarly);
    } else {
        activatePrompt(endPracticeEarly);
    }
}

function endTest() {
    zoomOut(false)

    if (!SCORE_DEBUG && !FIND_MAX_SCORE) activatePrompt(loading);

    if (ENABLE_SCORING) {
        isFinalScoring = true;
        setTimeout(scoreFigure, 500);
    } else {
        location.href = "index.html";
    }
}

var isFinalScoring = false;
var scoreInc = 0;
var drawToScoreScale;
var innerPath = new Path2D();
var outerPath = new Path2D();

function computeScoringConstants() {
    //Resize the drawing canvas to be SCORE_AREA_SIZE, but reduce the CSS size to fit on screen so it can be seen while debugging
    scoreCanvas.style.width = `${H*3}px`;
    scoreCanvas.style.height = `${H*3}px`;
    scoreCanvas.width = SCORE_AREA_SIZE; 
    scoreCanvas.height = SCORE_AREA_SIZE;

    //Calculate the nessecary scaling factors
    let yScale = (SCORE_AREA_SIZE/2-500)/(SELECTED_FIGURE.maxY-AVG_Y);
    let xScale = (SCORE_AREA_SIZE/2-500)/(SELECTED_FIGURE.width/2);
    let figureScale = Math.min(xScale, yScale); //Scale of figure in scoring mode
    drawToScoreScale = figureScale/SCALE; //Realtive size of scoring figure compared to drawing figure

    //Create the inner and outer paths of the figure at scoring scale
    let minAngle = SELECTED_FIGURE.minTheta;
    let maxAngle = SELECTED_FIGURE.maxTheta;
    let thetaInc = (maxAngle-minAngle)/THETA_RESOLUTION_HIGH_LOD*1;

    let coords = getCoordsFromFigure(minAngle, figureScale, SCORE_AREA_SIZE/2, SCORE_AREA_SIZE/2);
    innerPath.moveTo(coords.innerX, coords.innerY);
    outerPath.moveTo(coords.outerX, coords.outerY);

    for (let theta = minAngle+thetaInc; theta < maxAngle; theta += thetaInc) {
        coords = getCoordsFromFigure(theta, figureScale, SCORE_AREA_SIZE/2, SCORE_AREA_SIZE/2);
        innerPath.lineTo(coords.innerX, coords.innerY);
        outerPath.lineTo(coords.outerX, coords.outerY);
    }

    coords = getCoordsFromFigure(maxAngle, figureScale, SCORE_AREA_SIZE/2, SCORE_AREA_SIZE/2);
    innerPath.lineTo(coords.innerX, coords.innerY);
    outerPath.lineTo(coords.outerX, coords.outerY);
}

function scoreFigure() {
    scoreInc = 0;
    console.log("Scoring...");

    if (isFinalScoring && SCORE_DEBUG) scoreCanvas.style.display = ""; //Show canvas for the score debug

    scoreCtx.clearRect(0, 0, SCORE_AREA_SIZE, SCORE_AREA_SIZE); //Clear canvas before we start

    //Render scaled strokes to scoring canvas
    scoreCtx.strokeStyle = "red";
    scoreCtx.fillStyle = "red";
    scoreCtx.lineCap = "round";
    scoreCtx.lineJoin = "round";

    //If were looking to find the maximum score, fill entire screen with "stroke"
    if (FIND_MAX_SCORE) scoreCtx.fillRect(0, 0, SCORE_AREA_SIZE, SCORE_AREA_SIZE);

    strokes.forEach(stroke => {
        if (stroke.strokeColor == DRAW_COLOR) {
            scoreCtx.globalCompositeOperation = "source-over";
        } else {
            scoreCtx.globalCompositeOperation = "destination-out";
        }
        scoreCtx.lineWidth = stroke.brushSize*2*drawToScoreScale;

        if (stroke.x.length == 1 || Math.hypot(stroke.x[0]-stroke.x[stroke.x.length-1], stroke.y[0]-stroke.y[stroke.x.length-1]) == 0) { //Render single length strokes as circles since iOS doesn't render lines that end at the same point they start
            circle(Math.round(stroke.x[0]*drawToScoreScale+SCORE_AREA_SIZE/2), Math.round(stroke.y[0]*drawToScoreScale+SCORE_AREA_SIZE/2), stroke.brushSize*drawToScoreScale, true, scoreCtx);
            return;
        }

        scoreCtx.beginPath();
        scoreCtx.moveTo(Math.round(stroke.x[0]*drawToScoreScale+SCORE_AREA_SIZE/2), Math.round(stroke.y[0]*drawToScoreScale+SCORE_AREA_SIZE/2))
        // for (let i = 0; i < stroke.x.length; i++) {
        for (let i = 1; i < stroke.x.length; i++) {
            scoreCtx.lineTo(Math.round(stroke.x[i]*drawToScoreScale+SCORE_AREA_SIZE/2), Math.round(stroke.y[i]*drawToScoreScale+SCORE_AREA_SIZE/2));
            scoreCtx.stroke();
        }
    });

    let debugImgData = scoreCtx.createImageData(SCORE_AREA_SIZE, SCORE_AREA_SIZE);

    //Grab the image data of the strokes before masking takes place
    let preMaskImgData = scoreCtx.getImageData(0, 0, SCORE_AREA_SIZE, SCORE_AREA_SIZE);

    //Mask only the figure
    scoreCtx.globalCompositeOperation = "source-in";
    scoreCtx.fill(outerPath);
    scoreCtx.globalCompositeOperation = "destination-out";
    scoreCtx.fill(innerPath);
        
    //For each drawn pixel inside the figure remaining after masking, count it to the score and remove the respective pixel from the pre-masked image data
    let imgData = scoreCtx.getImageData(0, 0, SCORE_AREA_SIZE, SCORE_AREA_SIZE);
    for (let i = 0; i < imgData.data.length; i += 4) {
        if (imgData.data[i] != 0) {
            scoreInc++;
            if (isFinalScoring && SCORE_DEBUG) {
                debugImgData.data[i+1] = 255;
                debugImgData.data[i+3] = 255;
            }
            preMaskImgData.data[i] = 0;
        }
    }

    //At this point, only positive scoring has taken place
    if (FIND_MAX_SCORE) {
        console.log("Maximum possible score: " + scoreInc);
        return;
    }

    //The pre-mask image data is now reverse masked by the figure, meaning all remaing pixels are blank or outside of the figure
    for (let i = 0; i < preMaskImgData.data.length; i += 4) {
        if (preMaskImgData.data[i] != 0) {
            scoreInc--;
            if (isFinalScoring && SCORE_DEBUG) {
                debugImgData.data[i] = 255;
                debugImgData.data[i+3] = 255;
            }
        }
    }

    //Show color coded debug rendering if its enabled
    if (isFinalScoring && SCORE_DEBUG) {
        scoreCtx.putImageData(debugImgData, 0, 0);
        scoreCtx.globalCompositeOperation = "destination-over";
        scoreCtx.strokeStyle = "black";
        scoreCtx.lineWidth = 3;
        scoreCtx.stroke(innerPath);
        scoreCtx.stroke(outerPath);
    }

    console.log(scoreInc);

    if (LIVE_SCORING) liveScoreDisplay.innerHTML = "INC: " + scoreInc + " | Percent Score: " + Math.round(scoreInc/SELECTED_FIGURE.maxScore*100*10000)/10000;

    if (isFinalScoring && !FIND_MAX_SCORE && !SCORE_DEBUG) {
        saveScore();
    }
}

function saveScore() {
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

    if (IS_TEST) {
        location.href = "testEnd_auth.html";
    } else {
        location.href = "testPracticeEnd.html";
    }
}