this.onmessage = function(event){
    let preMaskImgData = event.data[0];
    let imgData = event.data[1];
    let score = 0;

    let ref = Date.now();

    for (let i = 0; i < imgData.data.length; i += 4) {
        if (imgData.data[i] != 0) {
            score++;
            preMaskImgData.data[i] = 0;
        }
    }

    //The pre-mask image data is now reverse masked by the figure, meaning all remaing pixels are blank or outside of the figure
    for (let i = 0; i < preMaskImgData.data.length; i += 4) {
        if (preMaskImgData.data[i] != 0) {
            if (!false) score--;
        }
    }

    console.log(Date.now()-ref);
    postMessage(score);
}; 