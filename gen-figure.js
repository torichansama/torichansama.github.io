//Define Figure object 
var figures = [];
function Figure (maxScore, calcRad) {
    this.maxScore = maxScore;
    this.calcRad = calcRad;

    figures.push(this);
}

//Add any new figures to settings
let figure1 = new Figure(4035620, (t) => {return (1-1/6*(Math.sin(4*t+PI/2))-1/200*Math.pow(Math.cos(30*t), 2)*Math.sin(t)*Math.tan(t/2))/Math.sqrt(Math.PI)});
let figure2 = new Figure(3141549, (t) => {return 0.5});