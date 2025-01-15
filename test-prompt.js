//Prompt to begin test when ready, shows at start of test
function beginTestPrompt() {
    uiCtx.fillStyle = 'rgba(0,0,0,0.3)'; //Gray out background
    uiCtx.fillRect(0, 0, W+UI_WIDTH, H);

    uiCtx.fillStyle = 'white'; //Draw background box
    uiCtx.strokeStyle = 'black';
    uiCtx.lineWidth = 3;
    uiCtx.beginPath();
    uiCtx.roundRect((W+UI_WIDTH)/2-180, H/2-190, 360, 170, [10]);
    uiCtx.fill();
    uiCtx.stroke();

    uiCtx.font = 'normal 500 30px Times New Roman'; //Draw text
    uiCtx.fillStyle = "black";
    uiCtx.fillText("Begin Test When Ready", (W+UI_WIDTH)/2, H/2-150);

    uiCtx.lineWidth = 2; //Draw startTest button
    uiCtx.fillStyle = "Green";
    drawIconButton(startTest, uiCtx);
}

//Prompt to end test early, shows when user presses "end test" button
function endTestPrompt() {
    activePrompt = "endEarly";

    uiCtx.fillStyle = 'rgba(0,0,0,0.3)'; //Gray out background
    uiCtx.fillRect(0, 0, W+UI_WIDTH, H);

    uiCtx.fillStyle = 'white'; //Draw background box (change width depending on text content)
    uiCtx.strokeStyle = 'black';
    uiCtx.lineWidth = 3;
    uiCtx.beginPath();
    if (IS_TEST) {
        uiCtx.roundRect((W+UI_WIDTH)/2-220, H/2-190, 440, 170, [10]);
    } else {
        uiCtx.roundRect((W+UI_WIDTH)/2-180, H/2-190, 360, 170, [10]);
    }
    uiCtx.fill();
    uiCtx.stroke();

    uiCtx.font = 'normal 500 30px Times New Roman'; //Draw text (change text depending on IS_TEST?)
    uiCtx.fillStyle = "black";
    if (IS_TEST) {
        uiCtx.fillText("End Test Before Timer Expires?", (W+UI_WIDTH)/2, H/2-150);
    } else {
        uiCtx.fillText("End Practice Session?", (W+UI_WIDTH)/2, H/2-150);
    }

    uiCtx.lineWidth = 2; //Draw yes and no buttons
    uiCtx.fillStyle = "Green";
    drawIconButton(yesEndTest, uiCtx);
    uiCtx.fillStyle = "#6b0000";
    drawIconButton(noEndTest, uiCtx);
}

//Prompt to proceed to scoring, shows when timer expires
function timerExpiredPrompt() {
    activePrompt = "timerExpired";

    uiCtx.fillStyle = 'rgba(0,0,0,0.3)'; //Gray out background
    uiCtx.fillRect(0, 0, W+UI_WIDTH, H);

    uiCtx.fillStyle = 'white'; //Draw background box
    uiCtx.strokeStyle = 'black';
    uiCtx.lineWidth = 3;
    uiCtx.beginPath();
    uiCtx.roundRect((W+UI_WIDTH)/2-140, H/2-190, 280, 170, [10]);
    uiCtx.fill();
    uiCtx.stroke();

    uiCtx.font = 'normal 500 30px Times New Roman'; //Draw text 
    uiCtx.fillStyle = "black";
    uiCtx.fillText("Timer Expired", (W+UI_WIDTH)/2, H/2-150);

    uiCtx.lineWidth = 2; //Draw ok button
    uiCtx.fillStyle = "Green";
    drawIconButton(expiredOk, uiCtx);
}