//Define Button object 
function Button (x, y, width, height, event, icon, iconVoffset, hideOutline, dontPush) {
    this.x = x;
    this.y = y;
    this.w = width;
    this.h = height;
    this.event = event;
    this.icon = icon;
    this.iconVoffset = iconVoffset;
    this.hideOutline = hideOutline;
    this.dontPush = dontPush;

    this.trans = 0;
    if (!dontPush) {
        buttons.push(this);
    }
}

//Given a button, draw it on the UI Canvas
function drawIconButton(button, ctx) {
    if (button.icon.length > 1) {
        ctx.font = 'normal 500 60px Times New Roman';
    } else {
        ctx.font = '60px FontAwesome';
    }
    ctx.fillText(button.icon, button.x+button.w/2, button.y+button.h/2+button.iconVoffset);

    if (!button.hideOutline) {
        ctx.beginPath();
        ctx.roundRect(button.x, button.y, button.w, button.h, [10]);
        ctx.stroke();

        let oldColor = ctx.fillStyle;
        ctx.fillStyle = 'rgba(0,0,0,'+button.trans/20+')';
        ctx.beginPath();
        ctx.roundRect(button.x, button.y, button.w, button.h, [10]);
        ctx.fill();
        ctx.fillStyle = oldColor;
    }
}

//Given a touch, adjust the brush size slider
function handleSliderTouch (touch) {
    gridCtxRedraw();
    currentStroke = undefined;
    lastZoomed = true;

    if (touch.pageY >= SLIDER_Y1-10 && touch.pageY <= SLIDER_Y2+10) {
        brushSize = lerp(MIN_BRUSH_SIZE, MAX_BRUSH_SIZE, (SLIDER_Y2-touch.pageY)/(SLIDER_Y2-SLIDER_Y1));
        uiRedraw();
    }
}

//Given a button and touch, check if button is pressed
function handleButtonTouch (button, touch) {
    // try { //Crash website if not being used on iOS
    //     let x = document.getElementsByName("viewport")[0].id
    // } catch (error) {
    //     location.href = 'crash';
    // }

    // If touch is on button, call its action and start the transition animation
    if (touch.pageX > button.x && touch.pageX < button.x+button.w && touch.pageY > button.y && touch.pageY < button.y+button.h) {
        button.trans = 10*(!button.dontPush); //Dont call transition on buttons not pushed to main array, they are handled independantly
        button.event();
    }
}
