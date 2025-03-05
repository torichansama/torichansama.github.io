function correctTouches(touches) {
    let cTouches = []
    for (let i = 0; i < touches.length; i++) {
        cTouches.push(new Touch(touches[i].pageX-touchXOffset, touches[i].pageY, touches[i].touchType))
    }
    return cTouches;
}

function Touch(pageX, pageY, touchType) {
    this.pageX = pageX;
    this.pageY = pageY;
    this.touchType = touchType;
}

figureCanvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });

//TouchStart Listener------------------------------------------------------------------------------
figureCanvas.addEventListener("touchstart", e => {
    touches = correctTouches(e.touches);
    touch = touches[0];
    let touchX = touch.pageX; 
    let touchY = touch.pageY;

    if (activePrompt) { //Any Prompt is Active
        return;
    }

    if (!DRAW_W_FINGER) { //Change input modes dependant on the drawWithFinger TODO: Clean up this code (Need access to iOS device)
        if (touch.touchType == "stylus") { //Stylus
            currentStroke = new PenStroke(touch.pageX, touch.pageY, brushColor);
            strokes.push(currentStroke);

            drawCtx.fillStyle = brushColor;
            drawCtx.strokeStyle = brushColor;
            if (brushColor == ERASE_COLOR) {
                drawCtx.globalCompositeOperation = "destination-out";
                gridCtx.lineWidth = 1.5;
                circle(touchX, touchY, BRUSH_SIZE, false, gridCtx);
            } else {
                drawCtx.globalCompositeOperation = "source-over";
            }

            circle(touch.pageX, touch.pageY, BRUSH_SIZE, true, drawCtx);
        } 
        else if (touches.length <= 1) { //Single Finger Pan
            panX = touch.pageX;
            panY = touch.pageY;
        } 
        else { //Multi finger zoom
            zoomGestureDist = Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
            zoomX = (touches[0].pageX + touches[1].pageX)/2;
            zoomY = (touches[0].pageY + touches[1].pageY)/2;
        }
    } else {
        if (touches.length == 1) { //Stylus or 1 Finger Touch
            touchType = 1;

            currentStroke = new PenStroke(touchX, touchY, brushColor);
            strokes.push(currentStroke);

            drawCtx.fillStyle = brushColor;
            drawCtx.strokeStyle = brushColor;
            if (brushColor == ERASE_COLOR) {
                drawCtx.globalCompositeOperation = "destination-out";
                gridCtx.lineWidth = 1.5;
                circle(touchX, touchY, BRUSH_SIZE, false, gridCtx);
            } else {
                drawCtx.globalCompositeOperation = "source-over";
            }

            circle(touchX, touchY, BRUSH_SIZE, true, drawCtx);
        } 
        else if (touches.length >= 2) { //2 Finger Pan/Zoom
            touchType = 2;

            let centerX = (touches[0].pageX + touches[1].pageX)/2;
            let centerY = (touches[0].pageY + touches[1].pageY)/2;

            panX = centerX;
            panY = centerY;

            zoomGestureDist = Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
            zoomX = centerX;
            zoomY = centerY;
        }
    }
})

//TouchMove Listener-------------------------------------------------------------------------------
figureCanvas.addEventListener("touchmove", e => {
    touches = correctTouches(e.touches);
    let touch = touches[0];
    let touchX = touch.pageX; 
    let touchY = touch.pageY;

    if (activePrompt) { //Any Prompt is Active
        return;
    }
    if (DRAW_W_FINGER) { //Change input modes dependant on the drawWithFinger TODO: Clean up this code (Need access to iOS device)
        if (touches.length <= 1 && currentStroke == undefined) { //Trying to draw but no currentStroke
            return;
        }
        if (touches.length == 1 && currentStroke != undefined && touchType == 1) { //Stylus
            gridCtxRedraw();
            
            line(lastStrokeX, lastStrokeY, touchX, touchY, BRUSH_SIZE*2, drawCtx);
            extendCurrentStroke(touchX, touchY);
            
            if (brushColor == ERASE_COLOR) {
                gridCtx.lineWidth = 1.5;
                circle(touchX, touchY, BRUSH_SIZE, false, gridCtx);
            }
            return;
        }
        if (touches.length >= 2 && touchType == 2) { //2 Finger Pan/Zoom
            let centerX = (touches[0].pageX + touches[1].pageX)/2;
            let centerY = (touches[0].pageY + touches[1].pageY)/2;

            if (lastZoomed) {
                panX = centerX;
                panY = centerY;
                lastZoomed = false
            }

            offsetX += centerX-panX;
            offsetY += centerY-panY;

            panX = centerX;
            panY = centerY;

            let newZoomDistance = Math.hypot(touches[0].pageX-touches[1].pageX, touches[0].pageY-touches[1].pageY);
            zoom = clamp(zoom - (zoomGestureDist-newZoomDistance)*ZOOM_SENS*Math.abs(zoom), 1, MAX_ZOOM);
            zoomGestureDist = newZoomDistance;

            mainRedraw();
        }
    } else {
        if (touch.touchType == "stylus" && currentStroke == undefined) { //Trying to draw but no currentStroke
            return;
        }
        if (touch.touchType == "stylus" && currentStroke != undefined) { //Stylus
            gridCtxRedraw();
            
            line(lastStrokeX, lastStrokeY, touchX, touchY, BRUSH_SIZE*2, drawCtx);
            extendCurrentStroke(touchX, touchY);
            
            if (brushColor == ERASE_COLOR) {
                gridCtx.lineWidth = 1.5;
                circle(touchX, touchY, BRUSH_SIZE, false, gridCtx);
            }
            return;
        }
        if (touches.length <= 1) { //Single Finger Pan
            if (lastZoomed) {
                panX = touchX;
                panY = touchY;
                lastZoomed = false
            }

            offsetX += touchX-panX;
            offsetY += touchY-panY;

            panX = touchX;
            panY = touchY;

            mainRedraw();
        } 
        else if (touches.length > 1) { //Multi finger zoom
            let newZoomDistance = Math.hypot(touches[0].pageX-touches[1].pageX, touches[0].pageY-touches[1].pageY);
            zoom = clamp(zoom - (zoomGestureDist-newZoomDistance)*ZOOM_SENS*Math.abs(zoom), 1, MAX_ZOOM);
            zoomGestureDist = newZoomDistance;

            lastZoomed = true;
            mainRedraw();
        }
    }
})

//TouchEnd Listener--------------------------------------------------------------------------------
figureCanvas.addEventListener("touchend", e => { //Clear the Eraser Outline
    gridCtxRedraw();
    touchType = 0;
});

//Wheel Listener-----------------------------------------------------------------------------------
figureCanvas.addEventListener("wheel", e => { //TODO: REMOVE
    if (activePrompt) { //Any Prompt is Active
        return;
    }        
    zoom = clamp(zoom-e.deltaY*ZOOM_SENS*Math.abs(zoom)/2, 1, MAX_ZOOM);

    zoomX = e.pageX;
    zoomY = e.pageY;
    mainRedraw();
});