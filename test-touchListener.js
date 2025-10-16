function correctTouches(touches) {
    let cTouches = []
    for (let i = 0; i < touches.length; i++) {
        cTouches.push(new Touch(touches[i].pageX-touchXOffset, touches[i].pageY, touches[i].touchType))
    }
    if (debugShiftKey && cTouches.length == 1) {
        cTouches.push(cTouches[0]);
    }
    return cTouches;
}

var debugShiftKey = false;
document.addEventListener('keydown', function(event) {
    if (currentStroke == undefined) debugShiftKey = event.shiftKey;
});
document.addEventListener('keyup', function(event) {
    if (currentStroke == undefined) debugShiftKey = event.shiftKey;
});

function Touch(pageX, pageY, touchType) {
    this.pageX = pageX;
    this.pageY = pageY;
    this.touchType = touchType;
}

figureCanvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false }); //Supress double tap to magnify
let lastZoomed = false;

//TouchStart Listener------------------------------------------------------------------------------
figureCanvas.addEventListener("touchstart", e => {
    touches = correctTouches(e.touches);
    touch = touches[0];

    if (activePrompt) return; //Any Prompt is Active

    if ((DRAW_W_FINGER && touches.length == 1) || touch.touchType == "stylus") { //Single finger/stylus draw
        currentStroke = new PenStroke(touch.pageX, touch.pageY, brushColor, zoom); //Creates a stroke in limbo
        
        drawCtx.fillStyle = brushColor;
        drawCtx.strokeStyle = brushColor;

        if (brushColor == ERASE_COLOR) {
            drawCtx.globalCompositeOperation = "destination-out";
            gridCtx.lineWidth = 1.5;
            circle(touch.pageX, touch.pageY, BRUSH_SIZE, false, gridCtx);
        } else {
            drawCtx.globalCompositeOperation = "source-over";
        }
    } else if ((touches.length == 1 && !DRAW_W_FINGER)) { //Single Finger Pan
        panX = touch.pageX;
        panY = touch.pageY;
    } else if (touches.length >= 2) { //2 Finger Pan/Zoom
        let centerX = (touches[0].pageX + touches[1].pageX)/2;
        let centerY = (touches[0].pageY + touches[1].pageY)/2;

        panX = centerX;
        panY = centerY;

        zoomGestureDist = Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
        zoomX = centerX;
        zoomY = centerY;
    }
})

//TouchMove Listener-------------------------------------------------------------------------------
figureCanvas.addEventListener("touchmove", e => {

    touches = correctTouches(e.touches);
    let touch = touches[0];
    let touchX = touch.pageX; 
    let touchY = touch.pageY;

    if (activePrompt) return; //Any Prompt is Active

    if ((DRAW_W_FINGER && touches.length == 1) || touch.touchType == "stylus") { //Single finger/stylus draw
        if (currentStroke == undefined) return; //Trying to draw but no currentStroke
        if (!strokes.includes(currentStroke)) {
            strokes.push(currentStroke); //Store currentStroke if its still in limbo
            circle(lastStrokeX, lastStrokeY, BRUSH_SIZE, true, drawCtx);
        }
            
        gridCtxRedraw();
        
        line(lastStrokeX, lastStrokeY, touchX, touchY, BRUSH_SIZE*2, drawCtx);
        extendCurrentStroke(touchX, touchY, zoom);
        
        if (brushColor == ERASE_COLOR) {
            gridCtx.lineWidth = 1.5;
            circle(touchX, touchY, BRUSH_SIZE, false, gridCtx);
        }
    } else if ((touches.length == 1 && !DRAW_W_FINGER)) { //Single Finger Pan
        if (!lastZoomed) {
            offsetX += touchX-panX;
            offsetY += touchY-panY;
        }
        lastZoomed = false;

        panX = touchX;
        panY = touchY;

        mainRedraw();
    } else if (touches.length >= 2) { //2 Finger Pan/Zoom
        currentStroke = undefined;
        lastZoomed = true;

        let centerX = (touches[0].pageX + touches[1].pageX)/2;
        let centerY = (touches[0].pageY + touches[1].pageY)/2;

        offsetX += centerX-panX;
        offsetY += centerY-panY;

        panX = centerX;
        panY = centerY;

        let newZoomDistance = Math.hypot(touches[0].pageX-touches[1].pageX, touches[0].pageY-touches[1].pageY);
        zoom = clamp(zoom - (zoomGestureDist-newZoomDistance)*ZOOM_SENS*Math.abs(zoom), 1, MAX_ZOOM);
        zoomGestureDist = newZoomDistance;

        mainRedraw();
    }
})

//TouchEnd Listener--------------------------------------------------------------------------------
figureCanvas.addEventListener("touchend", e => { //Clear the Eraser Outline
    gridCtxRedraw();
    if (!strokes.includes(currentStroke) && currentStroke != undefined) {
        strokes.push(currentStroke); //Store currentStroke if its still in limbo
        circle(lastStrokeX, lastStrokeY, BRUSH_SIZE, true, drawCtx);
    }
    if (currentStroke != undefined) {
        currentStroke = undefined;
        if (LIVE_SCORING) scoreFigure();
    }
});

//Wheel Listener-----------------------------------------------------------------------------------
figureCanvas.addEventListener("wheel", e => { //This is just for desktop testing
    if (activePrompt) return; //Any Prompt is Active
        
    zoom = clamp(zoom-e.deltaY*ZOOM_SENS*Math.abs(zoom)/2, 1, MAX_ZOOM);

    zoomX = e.pageX;
    zoomY = e.pageY;
    mainRedraw();
});