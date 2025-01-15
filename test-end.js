function endTest() {
    isScoring = true; //Set isScoring
    clearInterval(timerInterval);
    zoomOut(false)

    uiCtx.fillStyle = "white";
    uiCtx.fillRect(0, 0, W+UI_WIDTH, H);
    uiCtx.fillStyle = "black";
    uiCtx.font = 'normal 500 60px Times New Roman';
    uiCtx.fillText("Loading...", (W+UI_WIDTH)/2, H/2-30);   

    if (IS_TEST) {
        setTimeout(scoreFigure, 40);
    } else {
        location.href = "index.html";
        return;
    }
}

function scoreFigure() {
    drawCanvas.width = SCORE_AREA_SIZE; 
    drawCanvas.height = SCORE_AREA_SIZE;
    let drawToScoreScale = SCORE_AREA_SIZE/FIGURE_SCALE*0.5; //Sets size of outline relative to the score area

    drawCanvas.style.display = "none";

    //Drawing strokes using one continuous line
    drawCtx.strokeStyle = "red";
    drawCtx.lineCap = "round";
    drawCtx.lineJoin = "round";

    strokes.forEach(stroke => {
        if (stroke.strokeColor == DRAW_COLOR) {
            drawCtx.globalCompositeOperation = "source-over";
        } else {
            drawCtx.globalCompositeOperation = "destination-out";
        }
        drawCtx.lineWidth = stroke.brushSize*2*drawToScoreScale;
        drawCtx.beginPath();
        drawCtx.moveTo(stroke.x[0]*drawToScoreScale+SCORE_AREA_SIZE/2, stroke.y[0]*drawToScoreScale+SCORE_AREA_SIZE/2)
        for (let i = 0; i < stroke.x.length; i++) {
            drawCtx.lineTo(stroke.x[i]*drawToScoreScale+SCORE_AREA_SIZE/2, stroke.y[i]*drawToScoreScale+SCORE_AREA_SIZE/2);
        }
        drawCtx.stroke();
    });

    let scoreInc = 0;
    imgData = drawCtx.getImageData(0, 0, SCORE_AREA_SIZE, SCORE_AREA_SIZE);
    for (let i = 0; i < imgData.data.length; i += 4) {
        if (imgData.data[i] != 0) {
            let x = (i / 4) % SCORE_AREA_SIZE - SCORE_AREA_SIZE/2;
            let y = Math.floor((i / 4) / SCORE_AREA_SIZE) - SCORE_AREA_SIZE/2;
            let theta = -Math.atan2(y, x);
            let r = Math.hypot(x, y);
            let figureR = SELECTED_FIGURE.calcRad(theta)*FIGURE_SCALE*drawToScoreScale;
            if (r <= figureR) {
                scoreInc++;
            } else {
                scoreInc--;
            }
        }
    }

    let scoreStr = Math.round(scoreInc/SELECTED_FIGURE.maxScore*100*100000)/100000
    sessionStorage.scoreObject = JSON.stringify(scoreStr+"%"); //Stores drawing score in the session storages

    location.href = "password-end.html";
}