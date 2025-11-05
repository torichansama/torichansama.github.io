//Define Figure object 
var figures = [];
function Figure (displayName, maxScore, minY, maxY, width, minTheta, maxTheta, calcRad) {
    this.displayName = displayName;
    this.maxScore = maxScore;
    this.minY = minY;
    this.maxY = maxY;
    this.width = width;
    this.minTheta = minTheta;
    this.maxTheta = maxTheta;
    this.calcRad = calcRad;

    figures.push(this);
}
function EquationPair (inner, outer) {
    this.inner = inner;
    this.outer = outer;
}
function coordPair(innerX, innerY, outerX, outerY) {
    this.innerX = innerX; this.innerY = innerY;
    this.outerX = outerX; this.outerY = outerY;
}

//NOTE: This is the only place new figures need be added, figures take form: inner equation, outer equation
//   1067094 - Old Max score
//  14576407 - Tested Value with Tiling      
//  17073504 - Expected value based off scale increase
//  17011848 - Current max score
new Figure("The Shubi", 17012751, 0, 1.4, 2.4, 0, Math.PI, (t) => {
    if (t == PI/2) t -= 0.000000001; //Handle discontinuity at PI/2

    let a = 3/900*sqr(cos(7*(t+PI/2)))*sin(22*(t+PI/2))*tan((t+PI/2)/2);
    let b = 1/500*sqr(cos(7*(t+PI/2-.16)))*sin(22*(t+PI/2-0.16))*tan((t+PI/2-.16)/2);
    let c = 1/500*sqr(cos(7*(t+PI/2+.16)))*sin(22*(t+PI/2+0.16))*tan((t+PI/2+.16)/2);
    
    let p = floor((1+(-t+PI+.1)/(abs(-t+PI)+.1))/2);
    let n = floor((1+(t+.1)/(abs(t)+.1))/2);

    return new EquationPair(
        n*p*(2/(sqrt(PI)*(1.000096616+0.05*sqr(sin(t))))),
        n*p*(2-2/6*sin(t+PI)+3/60*sqr(sin(10*t+PI))-a-b-c)/sqrt(PI),
    );
});

//Shorthand for easier writing of new figures
let sin = Math.sin;
let cos = Math.cos;
let tan = Math.tan;
let sqrt = Math.sqrt;
let abs = Math.abs;
let ceil = Math.ceil;
let floor = Math.floor;
function sqr(x) {return Math.pow(x, 2);}