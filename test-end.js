const s = _liveScale;
const drawToScoreScale = (figureScale / SCALE) * s;

cx.lineCap = "round";
cx.lineJoin = "round";

for (const st of strokes) {
  cx.globalCompositeOperation = (st.strokeColor === DRAW_COLOR) ? "source-over" : "destination-out";
  cx.strokeStyle = "red";
  cx.fillStyle = "red";
  cx.lineWidth = st.brushSize * 2 * drawToScoreScale;

  if (st.x.length === 1) {
    // single point = circle (same as final)
    circle(
      Math.round(st.x[0] * drawToScoreScale + LIVE_SIZE/2),
      Math.round(st.y[0] * drawToScoreScale + LIVE_SIZE/2),
      st.brushSize * drawToScoreScale,
      true,
      cx
    );
    continue;
  }

  cx.beginPath();
  cx.moveTo(
    Math.round(st.x[0] * drawToScoreScale + LIVE_SIZE/2),
    Math.round(st.y[0] * drawToScoreScale + LIVE_SIZE/2)
  );
  // IMPORTANT: stroke each segment, like the final scorer does
  for (let i = 0; i < st.x.length; i++) {
    cx.lineTo(
      Math.round(st.x[i] * drawToScoreScale + LIVE_SIZE/2),
      Math.round(st.y[i] * drawToScoreScale + LIVE_SIZE/2)
    );
    cx.stroke();
  }
}
