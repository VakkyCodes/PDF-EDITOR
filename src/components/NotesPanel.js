import React, { useState, useEffect } from "react";

function NotesPanel({ canvasRef }) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState("#000000");
  const [penSize, setPenSize] = useState(3);
  const lastPos = React.useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      const saved = localStorage.getItem("pdf-notes");
      if (saved) {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
        img.src = saved;
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [canvasRef]);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    if (e.touches) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    lastPos.current = getPos(e, canvasRef.current);
    setIsDrawing(true);
  };

  const draw = (e) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e, canvas);

    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);

    if (tool === "highlight") {
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = color;
      ctx.lineWidth = penSize * 6;
    } else {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = color;
      ctx.lineWidth = penSize;
    }

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();

    lastPos.current = pos;
  };

  const stopDrawing = (e) => {
    e?.preventDefault();
    setIsDrawing(false);
    lastPos.current = null;
    const canvas = canvasRef.current;
    if (canvas) {
      localStorage.setItem("pdf-notes", canvas.toDataURL());
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    localStorage.removeItem("pdf-notes");
  };

  const exportNotes = () => {
    const canvas = canvasRef.current;
    const link = document.createElement("a");
    link.download = "notes.png";
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <div className="notes-panel">
      <div className="notes-header">
        <div className="section-tag">Notes</div>
        <h2>Study Notes</h2>
      </div>

      <div className="notes-toolbar">
        <div className="tool-group">
          <button
            type="button"
            className={`tool-btn ${tool === "pen" ? "active" : ""}`}
            onClick={() => setTool("pen")}
            title="Pen"
          >✏️</button>
          <button
            type="button"
            className={`tool-btn ${tool === "highlight" ? "active" : ""}`}
            onClick={() => setTool("highlight")}
            title="Highlight"
          >🖊️</button>
        </div>

        <div className="tool-group">
          {["#000000", "#e53e3e", "#3182ce"].map((c) => (
            <button
              key={c}
              type="button"
              className={`color-btn ${color === c ? "active" : ""}`}
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>

        <div className="tool-group">
          <label className="tool-label">Size</label>
          <input
            type="range"
            min="1"
            max="20"
            value={penSize}
            onChange={(e) => setPenSize(Number(e.target.value))}
            className="size-slider"
          />
          <span className="tool-label">{penSize}px</span>
        </div>

        <div className="tool-group">
          <button type="button" className="toolbar-button secondary small" onClick={clearCanvas}>
            Clear
          </button>
          <button type="button" className="toolbar-button primary small" onClick={exportNotes}>
            Export Notes
          </button>
        </div>
      </div>

      <div className="notes-canvas-wrapper">
        <canvas
          ref={canvasRef}
          className="notes-canvas"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          style={{ cursor: tool === "highlight" ? "cell" : "crosshair" }}
        />
      </div>
    </div>
  );
}

export default NotesPanel;