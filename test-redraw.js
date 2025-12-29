//Drawing the content of the grid canvas-----------------------------------------------------------
function gridCtxRedraw() {
    gridCtx.clearRect(0, 0, W, H);
    if (!RENDER_GRID) {
        return;
    }

    //Drawing only the gridlines that are visible on screen
    let subGridSize = dynamicGridSize/4;
    xStart = -offsetX/dynamicGridSize;
    yStart = -offsetY/dynamicGridSize;

    let i = 0;
    for (var x = Math.floor(xStart)*dynamicGridSize; x < W+Math.ceil(xStart)*dynamicGridSize; x += subGridSize) {
        if (i%4 == 0) {
            gridCtx.lineWidth = 1;
        } else {
            gridCtx.lineWidth = 0.5;
        }
        gridCtx.beginPath();
        gridCtx.moveTo(x+offsetX, 0);
        gridCtx.lineTo(x+offsetX, H);
        gridCtx.stroke();
        i++;
    }
    i = 0;
    for (var y = Math.floor(yStart)*dynamicGridSize; y < H+Math.ceil(yStart)*dynamicGridSize; y += subGridSize) {
        if (i%4 == 0) {
            gridCtx.lineWidth = 1;
        } else {
            gridCtx.lineWidth = 0.5;
        }
        gridCtx.beginPath();
        gridCtx.moveTo(0, y+offsetY);
        gridCtx.lineTo(W, y+offsetY);
        gridCtx.stroke();
        i++;
    }

    if (DEBUG_VIEW) updateDebugView();
}

//Drawing the content of the draw canvas-----------------------------------------------------------
function drawCtxRedraw() {
    drawCtx.clearRect(0, 0, W, H);

    drawCtx.setTransform(scale*zoom, 0, 0, scale*zoom, offsetX*scale, offsetY*scale);

    //Drawing strokes using one continuous line
    for(let i = 0; i < strokes.length; i++) {
        let stroke = strokes[i];
        drawCtx.globalCompositeOperation = stroke.strokeColor == DRAW_COLOR ? "source-over" : "destination-out";

        if (Math.round(stroke.x[0]) == Math.round(stroke.x[stroke.x.length-1]) && Math.round(stroke.y[0]) == Math.round(stroke.y[stroke.y.length-1])) { //Render single length strokes as circles since iOS doesn't render lines that end at the same point they start
            drawCtx.setTransform(scale, 0, 0, scale, 0, 0);

            drawCtx.fillStyle = stroke.strokeColor;
            circle(stroke.x[0]*zoom+offsetX, stroke.y[0]*zoom+offsetY, stroke.brushSize*zoom, true, drawCtx);
            drawCtx.setTransform(scale*zoom, 0, 0, scale*zoom, offsetX*scale, offsetY*scale);
            continue;
        }

        drawCtx.strokeStyle = stroke.strokeColor;
        drawCtx.lineWidth = stroke.brushSize*2;
        
        drawCtx.beginPath();
        drawCtx.moveTo(stroke.x[0], stroke.y[0])
        for (let i = 1; i < stroke.x.length; i++) {
            drawCtx.lineTo(stroke.x[i], stroke.y[i]);
        }
        drawCtx.stroke();
    };

    drawCtx.setTransform(scale, 0, 0, scale, 0, 0);

    drawCtx.globalCompositeOperation = "source-over";
}

//Drawing the content of the figure canvas---------------------------------------------------------
function figureCtxRedraw () {
    figureCtx.clearRect(0, 0, W, H);
    let resolution = THETA_RESOLUTION_HIGH_LOD;

    let minAngle = SELECTED_FIGURE.minTheta;
    let maxAngle = SELECTED_FIGURE.maxTheta;
    
    //Drawing the visible part of the figure outline
    if (SELECTED_FIGURE.maxTheta-TAU != SELECTED_FIGURE.minTheta) {
        maxAngle = Math.min(maxAngle, SELECTED_FIGURE.maxTheta);
        minAngle = Math.max(minAngle, SELECTED_FIGURE.minTheta);
    }
    let thetaInc = (maxAngle-minAngle)/resolution;

    let innerPath = new Path2D();
    let outerPath = new Path2D();

    rads = getCoordsFromFigure(minAngle, SCALE*zoom, offsetX, offsetY);
    innerPath.moveTo(rads.innerX, rads.innerY);
    outerPath.moveTo(rads.outerX, rads.outerY);

    for (let theta = minAngle+thetaInc; theta <= maxAngle; theta += thetaInc) {
        rads = getCoordsFromFigure(theta, SCALE*zoom, offsetX, offsetY);
        innerPath.lineTo(rads.innerX, rads.innerY);
        outerPath.lineTo(rads.outerX, rads.outerY);
    }

    rads = getCoordsFromFigure(maxAngle, SCALE*zoom, offsetX, offsetY);
    innerPath.lineTo(rads.innerX, rads.innerY);
    outerPath.lineTo(rads.outerX, rads.outerY); 

    figureCtx.stroke(innerPath);
    figureCtx.stroke(outerPath);
}
