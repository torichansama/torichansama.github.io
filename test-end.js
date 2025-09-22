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
    console.log("Scoring...");

    // let progressBar = document.getElementById("progress");

    //Resize the drawing canvas to be SCORE_AREA_SIZE, but reduce the CSS size to fit on screen so it can be seen while debugging
    drawCanvas.style.width = `${H*3}px`;
    drawCanvas.style.height = `${H*3}px`;
    drawCanvas.width = SCORE_AREA_SIZE; 
    drawCanvas.height = SCORE_AREA_SIZE;
    
    drawCtx.clearRect(0, 0, SCORE_AREA_SIZE, SCORE_AREA_SIZE); //Should be wiped by canvas resize but cant be too safe
    
    //Calculate the nessecary scaling factors
    let yScale = (SCORE_AREA_SIZE/2-500)/(SELECTED_FIGURE.maxY-AVG_Y);
    let xScale = (SCORE_AREA_SIZE/2-500)/(SELECTED_FIGURE.width/2);
    let figureScale = Math.min(xScale, yScale); //Scale of figure in scoring mode
    let drawToScoreScale = figureScale/SCALE; //Realtive size of scoring figure compared to drawing figure
    
    //Create the inner and outer paths of the figure at scoring scale
    let minAngle = SELECTED_FIGURE.minTheta;
    let maxAngle = SELECTED_FIGURE.maxTheta;
    let thetaInc = (maxAngle-minAngle)/THETA_RESOLUTION_HIGH_LOD*1;
    
    drawCtx.strokeStyle = "black";

    let innerPath = new Path2D();
    let outerPath = new Path2D();

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

    //Drawing strokes using one continuous line
    drawCtx.strokeStyle = "red";
    drawCtx.fillStyle = "red";
    drawCtx.lineCap = "round";
    drawCtx.lineJoin = "round";

    //If were looking to find the maximum score, fill entire screen with "stroke"
    if (FIND_MAX_SCORE) drawCtx.fillRect(0, 0, SCORE_AREA_SIZE, SCORE_AREA_SIZE);

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

    let debugImgData = drawCtx.createImageData(SCORE_AREA_SIZE, SCORE_AREA_SIZE);

    //Grab the image data of the strokes before masking takes place
    let preMaskImgData = drawCtx.getImageData(0, 0, SCORE_AREA_SIZE, SCORE_AREA_SIZE);

    //Mask only the figure
    drawCtx.globalCompositeOperation = "source-in";
    drawCtx.fill(outerPath);
    drawCtx.globalCompositeOperation = "destination-out";
    drawCtx.fill(innerPath);
        
    //For each drawn pixel inside the figure remaining after masking, count it to the score and remove the respective pixel from the pre-masked image data
    let imgData = drawCtx.getImageData(0, 0, SCORE_AREA_SIZE, SCORE_AREA_SIZE);
    for (let i = 0; i < imgData.data.length; i += 4) {
        if (imgData.data[i] != 0) {
            scoreInc++;
            debugImgData.data[i+1] = 255;
            debugImgData.data[i+3] = 255;
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
            debugImgData.data[i] = 255;
            debugImgData.data[i+3] = 255;
        }
    }

    drawCtx.putImageData(debugImgData, 0, 0);
    drawCtx.globalCompositeOperation = "destination-over";
    drawCtx.strokeStyle = "black";
    drawCtx.lineWidth = 3;
    drawCtx.stroke(innerPath);
    drawCtx.stroke(outerPath);

    // drawCtx.putImageData(imgData, 0, 0);

    // progressBar.value = i/imgData.data.length;

    // if (i < imgData.data.length) {
    //     setTimeout(()=>{mainScoreLoop(i, imgData, figureScale, progressBar)}, 0);
    // } else {
        saveScore();
    // }
}

function saveScore() {
    if (FIND_MAX_SCORE || SCORE_DEBUG) { //Alert the max score
        // alert(scoreInc);
        console.log(scoreInc);
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