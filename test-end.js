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
var scoringTileContexts;
var score_area_total_size;
var score_area_midpoint;
var canvasToDisplay = "1|1";
// var workers;
// var workersNeedingResponse = 0;

function computeScoringConstants() {
    scoringTileContexts = Array.from({ length: SCORE_CANVAS_TILES_W }, () => new Array(SCORE_CANVAS_TILES_W));
    workers = Array.from({ length: SCORE_CANVAS_TILES_W }, () => new Array(SCORE_CANVAS_TILES_W));

    //Create canvas tiles
    for (let x = 0; x < SCORE_CANVAS_TILES_W; x++) {
        for (let y = 0; y < SCORE_CANVAS_TILES_W; y++) {
            let canvas = document.createElement("canvas");
            canvas.id = x+"|"+y;

            canvas.width = SCORE_AREA_TILE_SIZE; 
            canvas.height = SCORE_AREA_TILE_SIZE;

            canvas.style.width = `${H}px`; //Resize the drawing canvas to be SCORE_AREA_TILE_SIZE, but reduce the CSS size to fit on screen so it can be seen while debugging
            canvas.style.height = `${H}px`;
            canvas.style.display = "none";

            document.body.appendChild(canvas);
            scoringTileContexts[x][y] = canvas.getContext("2d", { willReadFrequently: true, aplha: false });
        }
    }

    score_area_total_size = SCORE_AREA_TILE_SIZE*SCORE_CANVAS_TILES_W;
    score_area_midpoint = score_area_total_size/2;

    //Calculate the nessecary scaling factors
    let xScale = (score_area_midpoint-500*SCORE_CANVAS_TILES_W)/(SELECTED_FIGURE.width/2);
    let yScale = (score_area_midpoint-500*SCORE_CANVAS_TILES_W)/(SELECTED_FIGURE.maxY-AVG_Y);
    let figureScale = Math.min(xScale, yScale); //Scale of figure in scoring mode
    drawToScoreScale = figureScale/SCALE; //Realtive size of scoring figure compared to drawing figure

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
    console.log("Begin Scoring - " + Date.now());

    let strokePaths = [];
    for (let i = 0; i < strokes.length; i++) {
        let stroke = strokes[i];
        let path = new Path2D();

        //Render single length strokes as circles since iOS doesn't render lines that end at the same point they start
        //TODO: Removoe this hypot computation - probably unnessecary
        if (stroke.x.length == 1 || Math.hypot(stroke.x[0]-stroke.x[stroke.x.length-1], stroke.y[0]-stroke.y[stroke.x.length-1]) == 0) { 
            console.log(stroke.brushSize*drawToScoreScale);
            path.arc(Math.round(stroke.x[0]*drawToScoreScale+score_area_midpoint), Math.round(stroke.y[0]*drawToScoreScale+score_area_midpoint), stroke.brushSize*drawToScoreScale, 0, TAU, false);
        } else {
            path.moveTo(Math.round(stroke.x[0]*drawToScoreScale+score_area_midpoint), Math.round(stroke.y[0]*drawToScoreScale+score_area_midpoint))
            for (let i = 1; i < stroke.x.length; i++) {
                path.lineTo(Math.round(stroke.x[i]*drawToScoreScale+score_area_midpoint), Math.round(stroke.y[i]*drawToScoreScale+score_area_midpoint));
            }
        }
        strokePaths[i] = path;
    };

    console.log("Paths Created - " + Date.now());
    for (let x = 0; x < SCORE_CANVAS_TILES_W; x++) { //Iterate through scoring tiles and set the context each time
        for (let y = 0; y < SCORE_CANVAS_TILES_W; y++) {
            scoreCtx = scoringTileContexts[x][y];
            tilingOffsetX = SCORE_AREA_TILE_SIZE*x;
            tilingOffsetY = SCORE_AREA_TILE_SIZE*y;

            scoreCtx.clearRect(0, 0, score_area_total_size, score_area_total_size); //Clear canvas before we start

            //Render scaled strokes to scoring canvas
            scoreCtx.strokeStyle = "red";
            scoreCtx.fillStyle = "red";
            scoreCtx.lineCap = "round";
            scoreCtx.lineJoin = "round";
            
            //If were looking to find the maximum score, fill entire screen with "stroke"
            if (FIND_MAX_SCORE) {scoreCtx.fillRect(0, 0, score_area_total_size, score_area_total_size);}
            else {
                scoreCtx.translate(-tilingOffsetX, -tilingOffsetY);
                for (let i = 0; i < strokes.length; i++) {
                    let stroke = strokes[i];
                    if (stroke.strokeColor == DRAW_COLOR) {
                        scoreCtx.globalCompositeOperation = "source-over";
                    } else {
                        scoreCtx.globalCompositeOperation = "destination-out";
                    }
                    scoreCtx.lineWidth = stroke.brushSize*2*drawToScoreScale;
            
                    //Render single length strokes as circles since iOS doesn't render lines that end at the same point they start
                    //TODO: Removoe this hypot computation - probably unnessecary
                    if (stroke.x.length == 1 || Math.hypot(stroke.x[0]-stroke.x[stroke.x.length-1], stroke.y[0]-stroke.y[stroke.x.length-1]) == 0) { 
                        scoreCtx.fill(strokePaths[i]);
                    } else {
                        scoreCtx.stroke(strokePaths[i]);
                    }
                }
                scoreCtx.translate(tilingOffsetX, tilingOffsetY);
            }


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
                    preMaskImgData.data[i] = 0;
                }
            }
        
            //The pre-mask image data is now reverse masked by the figure, meaning all remaing pixels are blank or outside of the figure
            for (let i = 0; i < preMaskImgData.data.length; i += 4) {
                if (preMaskImgData.data[i] != 0) {
                    if (!FIND_MAX_SCORE) scoreInc--;
                }
            }
        }
    }
    
    if (FIND_MAX_SCORE) {
        console.log("Maximum possible score: " + scoreInc);
        return;
    }

    console.log("Finished Scoring - " + Date.now());
    console.log("Score: " + scoreInc);

    if (LIVE_SCORING) liveScoreDisplay.innerHTML = "INC: " + scoreInc + " | Percent Score: " + Math.round(scoreInc/SELECTED_FIGURE.maxScore*100*1000000)/1000000;

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