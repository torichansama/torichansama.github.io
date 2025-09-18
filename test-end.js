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
    let insideCount = 0;
    let outsideCount = 0;
    let totalCount = 0;

    // Adjust scaling and centering for your project
    let figureScale = ...; // Set this appropriately
    let centerX = ...; // Typically drawCanvas.width / 2
    let centerY = ...; // Typically drawCanvas.height / 2

    for (let stroke of strokes) {
        for (let i = 0; i < stroke.x.length; i++) {
            let x = stroke.x[i];
            let y = stroke.y[i];

            // Apply centering/scaling if needed
            let relX = x - centerX;
            let relY = y - centerY;

            let r = Math.hypot(relX, relY);
            let theta = Math.atan2(relY, relX);

            let figureCoords = getCoordsFromFigure(theta, figureScale, 0, 0);
            let innerR = Math.hypot(figureCoords.innerX, figureCoords.innerY);
            let outerR = Math.hypot(figureCoords.outerX, figureCoords.outerY);

            if (r >= innerR && r <= outerR) {
                insideCount++;
            } else {
                outsideCount++;
            }
            totalCount++;
        }
    }

    let score = 0;
    if (totalCount > 0) {
        score = (insideCount - outsideCount) / totalCount;
    }

    // Save or display score as percentage, 4 decimal places
    let scorePercent = (score * 100).toFixed(4) + "%";
    sessionStorage.scoreObject = JSON.stringify(scorePercent);

    // Route to next page as before
    if (IS_TEST) {
        location.href = "testEnd_auth.html";
    } else {
        location.href = "testPracticeEnd.html";
    }
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

    if (FIND_MAX_SCORE || SCORE_DEBUG) { //Alert the max score
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
