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
}

//Drawing the content of the draw canvas-----------------------------------------------------------
function drawCtxRedraw() {
    drawCtx.clearRect(0, 0, W, H);

    //Drawing strokes using one continuous line
    strokes.forEach(stroke => {
        if (stroke.strokeColor == DRAW_COLOR) {
            drawCtx.globalCompositeOperation = "source-over";
        } else {
            drawCtx.globalCompositeOperation = "destination-out";
        }
        drawCtx.strokeStyle = stroke.strokeColor;
        drawCtx.lineWidth = stroke.brushSize*zoom*2;
        drawCtx.beginPath();
        drawCtx.moveTo(stroke.x[0]*zoom+offsetX, stroke.y[0]*zoom+offsetY)
        for (let i = 0; i < stroke.x.length; i++) {
            drawCtx.lineTo(stroke.x[i]*zoom+offsetX, stroke.y[i]*zoom+offsetY);
        }
        drawCtx.stroke();
    });
}

//Drawing the content of the figure canvas---------------------------------------------------------
function figureCtxRedraw () {
    figureCtx.clearRect(0, 0, W, H);

    //Get the theta range of the part of the outline visible on screen
    let minAngle = PI;
    let maxAngle = -PI;
    if (offsetX > 0 && (offsetX-W)*zoom < 0 && offsetY > 0 && (offsetY-H)*zoom < 0) { //If center of figure is visible set visible angle to -PI->PI
        minAngle = -PI;
        maxAngle = PI;
    } else {
        let cornerAngles = [ //Otherwise find the theta values that point to each corner of the screen
            Math.atan2(-offsetY*zoom, -offsetX*zoom),
            Math.atan2((-offsetY+H)*zoom, -offsetX*zoom),
            Math.atan2((-offsetY+H)*zoom, (-offsetX+W)*zoom),
            Math.atan2(-offsetY*zoom, (-offsetX+W)*zoom)
        ];
        for (let i = 0; i < 4; i++) { //Find the corners with the min and max theta values
            minAngle = Math.min(minAngle, -cornerAngles[i]);
            maxAngle = Math.max(maxAngle, -cornerAngles[i]);
        }
        if (offsetX > 0 && Math.sign(minAngle) != Math.sign(maxAngle)) { //Handle the -180->180 discontinuity
            maxAngle = -cornerAngles[2]+TAU;
            minAngle = -cornerAngles[3]; 
        }
    }
    
    //Drawing the visible part of the figure outline
    figureCtx.lineWidth = 2;
    figureCtx.beginPath();

    let r = SELECTED_FIGURE.calcRad(minAngle)*FIGURE_SCALE;
    figureCtx.lineTo(offsetX+r*Math.cos(minAngle)*zoom, offsetY-r*Math.sin(minAngle)*zoom);

    for (let theta = minAngle; theta <= maxAngle; theta += (maxAngle-minAngle)/THETA_RESOLUTION) {
        r = SELECTED_FIGURE.calcRad(theta)*FIGURE_SCALE;

        figureCtx.lineTo(offsetX+r*Math.cos(theta)*zoom, offsetY-r*Math.sin(theta)*zoom);
    }
    figureCtx.stroke();

    //Add a line on the right side of canvas to seperate UI Bar
    line(W, 0, W, H, 5, figureCtx);
}


//Drawing the content of the UI canvas-------------------------------------------------------------
function uiRedraw () {
    //Clear the canvas every redraw
    uiCtx.clearRect(0, 0, W+UI_WIDTH, H);

    // Draw Timer
    if (IS_TEST) {
        uiCtx.fillStyle = "white";
        uiCtx.strokeStyle = "black";
        uiCtx.lineWidth = 2;
        uiCtx.beginPath();
        uiCtx.roundRect(W/2-85, -2, 170, 57, [0, 0, 10, 10]);
        uiCtx.fill();
        uiCtx.stroke();

        let mins = "" + Math.floor(timerSeconds/60);
        if (mins.length <= 1) {
            mins = "0"+mins;
        }
        let secs = "" + timerSeconds%60;
        if (secs.length <= 1) {
            secs = "0"+secs;
        }
        uiCtx.fillStyle = "black";
        uiCtx.font = "normal 500 60px Times New Roman";
        uiCtx.fillText(mins+":"+secs, W/2, 27);
    }

    //Draw brush size slider
    let sliderHeight = SLIDER_Y2-(brushSize-MIN_BRUSH_SIZE)/(MAX_BRUSH_SIZE-MIN_BRUSH_SIZE)*(SLIDER_Y2-SLIDER_Y1);

    line(UI_CENTER, SLIDER_Y1, UI_CENTER, SLIDER_Y2, 10, uiCtx)
    uiCtx.strokeStyle = "#d6d6d6";
    line(UI_CENTER, SLIDER_Y1, UI_CENTER, SLIDER_Y2, 6, uiCtx)
    uiCtx.strokeStyle = "#a1a1a1";
    line(UI_CENTER, sliderHeight, UI_CENTER, SLIDER_Y2, 6, uiCtx)

    //Draw current brush size
    uiCtx.strokeStyle = "black";
    uiCtx.lineWidth = 2;
    if (brushColor == ERASE_COLOR) {
        uiCtx.fillStyle = "#f2f2f2";
    } else {
        uiCtx.fillStyle = DRAW_COLOR;
    }
    circle(UI_CENTER, sliderHeight, brushSize/MAX_BRUSH_SIZE*UI_BRUSH_RAD+5, true, uiCtx);
    uiCtx.stroke();

    //Draw icon buttons
    uiCtx.lineWidth = 1.5;
    uiCtx.fillStyle = "#4F3564";
    let recurse = false;
    buttons.forEach(button => {
        drawIconButton(button, uiCtx);
        if (button.trans-- > 0) {
            recurse = true;
        }
    });
    if (recurse) {
        requestAnimationFrame(uiRedraw);
    }

    //Draw end test button
    uiCtx.fillStyle = "#f2f2f2";
    uiCtx.lineWidth = 4;
    uiCtx.beginPath();
    uiCtx.roundRect(10, H-80, 70, 70, [10]);
    uiCtx.stroke();
    uiCtx.fill();

    uiCtx.font = 'normal 500 30px Times New Roman';
    uiCtx.fillStyle = "#6b0000";
    uiCtx.fillText("End", 45, H-59.5);
    uiCtx.fillText("Test", 45, H-29.5);

    //Draw Eraser/Pencil Toggle
    uiCtx.fillStyle = 'rgba(0,0,0,0.1)';
    uiCtx.beginPath();
    uiCtx.roundRect(pencil.x, pencil.y, pencil.w, pencil.h, [10, 10, 0, 0]);
    if (brushColor == DRAW_COLOR) {
        uiCtx.lineWidth = 3;
    } else {
        uiCtx.lineWidth = 1.5;
        uiCtx.fill();
    }
    uiCtx.stroke();

    uiCtx.beginPath();
    uiCtx.roundRect(eraser.x, eraser.y, eraser.w, eraser.h, [0, 0, 10, 10]);
    if (brushColor == ERASE_COLOR) {
        uiCtx.lineWidth = 3;
    } else {
        uiCtx.fill();
        uiCtx.lineWidth = 1.5;
    }
    uiCtx.stroke();
}