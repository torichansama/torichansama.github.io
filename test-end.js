function promptSessionEnd() {
    if (IS_TEST) {
        activatePrompt(endTestEarly);
    } else {
        activatePrompt(endPracticeEarly);
    }
}

function endTest() {
    zoomOut(false)

    if (!SCORE_DEBUG && !findMaxScore) activatePrompt(loading);

    if (ENABLE_SCORING) {
        isFinalScoring = true;
        setTimeout(scoreFigure, 500);
    } else {
        location.href = "index.html";
    }
}

const SCORE_AREA_TILE_SIZE = 4096; //CANNOT EXCEED 4096px by 4096px DUE TO iOS/SAFARI LIMITATIONS
const SCORE_CANVAS_TILES_W = 5; //□□□□
                                //□□□□
                                //□□□□
                                //□□□□

var isFinalScoring = false;
var scoreInc = 0;
var drawToScoreScale;
var innerPath = new Path2D();
var outerPath = new Path2D();
var scoreCtx;
var score_area_total_size;
var score_area_midpoint;
var findMaxScore;

function computeScoringConstants(maxScoreOnly) {
    //Create canvas tile
    let canvas = document.createElement("canvas");
    canvas.id = "scoreCanvas";

    canvas.width = SCORE_AREA_TILE_SIZE; 
    canvas.height = SCORE_AREA_TILE_SIZE;

    // canvas.style.width = `${H}px`; //Resize the drawing canvas to be SCORE_AREA_TILE_SIZE, but reduce the CSS size to fit on screen so it can be seen while debugging
    // canvas.style.height = `${H}px`;
    canvas.style.display = "none";

    document.body.appendChild(canvas);
    scoreCtx = canvas.getContext("2d", { willReadFrequently: false, aplha: false });

    score_area_total_size = SCORE_AREA_TILE_SIZE*SCORE_CANVAS_TILES_W;
    score_area_midpoint = score_area_total_size/2;

    //Calculate the nessecary scaling factors
    let xScale = (score_area_midpoint-500*SCORE_CANVAS_TILES_W)/(SELECTED_FIGURE.width/2);
    let yScale = (score_area_midpoint-500*SCORE_CANVAS_TILES_W)/(SELECTED_FIGURE.maxY-AVG_Y);
    let figureScale = Math.min(xScale, yScale); //Scale of figure in scoring mode
    if (!maxScoreOnly) {
        drawToScoreScale = figureScale/SCALE; //Realtive size of scoring figure compared to drawing figure
    }

    //Create the inner and outer paths of the figure at scoring scale
    let minAngle = SELECTED_FIGURE.minTheta;
    let maxAngle = SELECTED_FIGURE.maxTheta;
    let thetaInc = (maxAngle-minAngle)/THETA_RESOLUTION_HIGH_LOD;

    let coords = getCoordsFromFigure(minAngle, figureScale, score_area_midpoint, score_area_midpoint);
    innerPath.moveTo(coords.innerX, coords.innerY);
    outerPath.moveTo(coords.outerX, coords.outerY);

    for (let theta = minAngle+thetaInc; theta < maxAngle; theta += thetaInc) {
        coords = getCoordsFromFigure(theta, figureScale, score_area_midpoint, score_area_midpoint);
        innerPath.lineTo(coords.innerX, coords.innerY);
        outerPath.lineTo(coords.outerX, coords.outerY);
    }

    coords = getCoordsFromFigure(maxAngle, figureScale, score_area_midpoint, score_area_midpoint);
    innerPath.lineTo(coords.innerX, coords.innerY);
    outerPath.lineTo(coords.outerX, coords.outerY);
}

function scoreFigure() {
    scoreInc = 0;
    console.log("Scoring...");
    let DEBUG_minRad = 999;
    let DEBUG_lastX = 0;
    let DEBUG_lastRounded = "false";
    let DEBUG_lastY = 0;

    for (let x = 0; x < SCORE_CANVAS_TILES_W; x++) { //Iterate through scoring tiles and set the context each time
        for (let y = 0; y < SCORE_CANVAS_TILES_W; y++) {
            tilingOffsetX = SCORE_AREA_TILE_SIZE*x;
            tilingOffsetY = SCORE_AREA_TILE_SIZE*y;

            let displayDebugInfoForCanvas = isFinalScoring && SCORE_DEBUG && x == SCORE_CANVAS_TILES_W-1 && y == SCORE_CANVAS_TILES_W-1;

            scoreCtx.clearRect(0, 0, SCORE_AREA_TILE_SIZE, SCORE_AREA_TILE_SIZE); //Clear canvas before we start

            //Render scaled strokes to scoring canvas
            scoreCtx.strokeStyle = "red";
            scoreCtx.fillStyle = "red";
            scoreCtx.lineCap = "round";
            scoreCtx.lineJoin = "round";
            scoreCtx.globalCompositeOperation = "source-over";
            
            //If were looking to find the maximum score, fill entire screen with "stroke"
            if (findMaxScore) {scoreCtx.fillRect(0, 0, SCORE_AREA_TILE_SIZE, SCORE_AREA_TILE_SIZE);}
            else {
                scoreCtx.translate(-tilingOffsetX, -tilingOffsetY);
                strokes.forEach(stroke => { //Draw the strokes to canavs
                    if (stroke.strokeColor == DRAW_COLOR) {
                        scoreCtx.globalCompositeOperation = "source-over";
                    } else {
                        scoreCtx.globalCompositeOperation = "destination-out";
                    }
                    scoreCtx.lineWidth = stroke.brushSize*2*drawToScoreScale;
            
                    DEBUG_lastX = Math.round(stroke.x[0]*drawToScoreScale+score_area_midpoint);
                    DEBUG_lastY = Math.round(stroke.y[0]*drawToScoreScale+score_area_midpoint);
                    
                    //Render single length strokes as circles since iOS doesn't render lines that end at the same point they start
                    // if (stroke.x.length == 1 || Math.hypot(stroke.x[0]-stroke.x[stroke.x.length-1], stroke.y[0]-stroke.y[stroke.x.length-1]) < 4) { 
                    if (stroke.x.length == 1 || 
                        (Math.round(stroke.x[0]*drawToScoreScale+score_area_midpoint) == Math.round(stroke.x[stroke.x.length-1]*drawToScoreScale+score_area_midpoint) &&  
                        Math.round(stroke.y[0]*drawToScoreScale+score_area_midpoint) == Math.round(stroke.y[stroke.y.length-1]*drawToScoreScale+score_area_midpoint))) { 
                        // console.log(stroke.brushSize*drawToScoreScale);
                        DEBUG_lastRounded = "true";
                        DEBUG_minRad = Math.min(DEBUG_minRad, stroke.brushSize*drawToScoreScale);
                        circle(Math.round(stroke.x[0]*drawToScoreScale+score_area_midpoint), Math.round(stroke.y[0]*drawToScoreScale+score_area_midpoint), stroke.brushSize*drawToScoreScale, true, scoreCtx);
                        return;
                    }
            
                    scoreCtx.beginPath();
                    scoreCtx.moveTo(Math.round(stroke.x[0]*drawToScoreScale+score_area_midpoint), Math.round(stroke.y[0]*drawToScoreScale+score_area_midpoint))
                    for (let i = 1; i < stroke.x.length; i++) {
                        scoreCtx.lineTo(Math.round(stroke.x[i]*drawToScoreScale+score_area_midpoint), Math.round(stroke.y[i]*drawToScoreScale+score_area_midpoint));
                    }
                    scoreCtx.stroke();
                });
                scoreCtx.translate(tilingOffsetX, tilingOffsetY);
            }

            //Create an empty image data that will be used to show a debug rendering
            let debugImgData;
            if (displayDebugInfoForCanvas) {debugImgData = scoreCtx.createImageData(SCORE_AREA_TILE_SIZE, SCORE_AREA_TILE_SIZE);}

            //Grab the image data of the strokes before masking takes place
            let preMaskImgData = scoreCtx.getImageData(0, 0, SCORE_AREA_TILE_SIZE, SCORE_AREA_TILE_SIZE);

            scoreCtx.translate(-tilingOffsetX, -tilingOffsetY);
            //Mask only the figure
            scoreCtx.globalCompositeOperation = "source-in";
            scoreCtx.fill(outerPath);
            scoreCtx.globalCompositeOperation = "destination-out";
            scoreCtx.fill(innerPath);
            scoreCtx.translate(tilingOffsetX, tilingOffsetY);

            //For each drawn pixel inside the figure remaining after masking, count it to the score and remove the respective pixel from the pre-masked image data
            let imgData = scoreCtx.getImageData(0, 0, SCORE_AREA_TILE_SIZE, SCORE_AREA_TILE_SIZE);
            for (let i = 0; i < imgData.data.length; i += 4) {
                if (imgData.data[i] != 0) {
                    scoreInc++;
                    if (displayDebugInfoForCanvas) {
                        debugImgData.data[i+1] = 255;
                        debugImgData.data[i+3] = 255;
                    }
                    preMaskImgData.data[i] = 0;
                }
            }

            //The pre-mask image data is now reverse masked by the figure, meaning all remaing pixels are blank or outside of the figure
            for (let i = 0; i < preMaskImgData.data.length; i += 4) {
                if (preMaskImgData.data[i] != 0) {
                    if (!findMaxScore) scoreInc--;
                    if (displayDebugInfoForCanvas) {
                        debugImgData.data[i] = 255;
                        debugImgData.data[i+3] = 255;
                    }
                }
            }

            //Show color coded debug rendering if its enabled
            if (displayDebugInfoForCanvas) {
                document.getElementById("scoreCanvas").style.display = ""; //Show selected canvas for the score debug
                scoreCtx.putImageData(debugImgData, 0, 0);
                scoreCtx.globalCompositeOperation = "destination-over";
                scoreCtx.strokeStyle = "black";
                scoreCtx.lineWidth = 10;
                scoreCtx.translate(-tilingOffsetX, -tilingOffsetY);
                scoreCtx.stroke(innerPath);
                scoreCtx.stroke(outerPath);
                scoreCtx.translate(tilingOffsetX, tilingOffsetY);
            }

            imgData = null;
            preMaskImgData = null;
            debugImgData = null;
        }
    }

    // setDebugInfo("LastRounded", DEBUG_lastRounded);
    // setDebugInfo("MinScoreRad", Math.round(DEBUG_minRad*100)/100);
    // setDebugInfo("LastScoreX", DEBUG_lastX);
    // setDebugInfo("LastScoreY", DEBUG_lastY);
    
    if (findMaxScore) {
        console.log("Maximum possible score: " + scoreInc);
        localStorage["maxScoreValue"] = JSON.stringify(scoreInc);
        console.log("Saved to local storage");
        // setDebugInfo("TILING: ", SCORE_CANVAS_TILES_W);
        // setDebugInfo("MAXSCORE: ", scoreInc);
        cancelPrompt();
        return;
    }

    console.log("Score: " + scoreInc);

    if (LIVE_SCORING) liveScoreDisplay.innerHTML = "INC: " + scoreInc + " | Percent Score: " + Math.round(scoreInc/SELECTED_FIGURE.maxScore*100*1000000)/1000000;

    if (isFinalScoring && !findMaxScore && !SCORE_DEBUG) {
        saveScore();
    }
}

function saveScore() {
    //Publish score to sessionStorage
    let maxScore = JSON.parse(localStorage["maxScoreValue"]);
    let score = Math.round(scoreInc/maxScore*100*10000)/10000 //Round to 4 decimal places
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