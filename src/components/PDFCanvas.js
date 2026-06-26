import React, { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

function PDFCanvas({ pdfBytes, notesCanvasRef }) {
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);
  const [pdfDoc_js, setPdfDoc_js] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [textItems, setTextItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [editPosition, setEditPosition] = useState({ x: 0, y: 0 });
  const [modifications, setModifications] = useState({});
  const [scale] = useState(1.5);
  const [isDownloading, setIsDownloading] = useState(false);

  // Load PDF
  useEffect(() => {
    if (!pdfBytes) return;
    const loadPDF = async () => {
      const pdfBytesCopy = new Uint8Array(pdfBytes);
      const doc = await pdfjsLib.getDocument({ data: pdfBytesCopy }).promise;
      setPdfDoc_js(doc);
      setTotalPages(doc.numPages);
      setCurrentPage(1);
    };
    loadPDF();
  }, [pdfBytes]);

  // Render page
  useEffect(() => {
    if (!pdfDoc_js) return;
    let isActive = true;

    const renderPage = async () => {
      try {
        const page = await pdfDoc_js.getPage(currentPage);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;

        if (!canvas || !isActive) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");

        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        renderTaskRef.current = page.render({ canvasContext: ctx, viewport });
        await renderTaskRef.current.promise;

        if (!isActive) return;

        const textContent = await page.getTextContent();
        if (!isActive) return;

        const items = textContent.items.map((item) => {
          const tx = item.transform[4] * scale;
          const ty = viewport.height - item.transform[5] * scale;
          return {
            str: item.str,
            x: tx,
            y: ty - item.height * scale,
            width: item.width * scale,
            height: item.height * scale,
            originalItem: item,
          };
        });
        setTextItems(items);
        setSelectedItem(null);
      } catch (error) {
        if (error?.name === "RenderingCancelledException") return;
        if (String(error?.message || "").includes("Rendering cancelled")) return;
        throw error;
      }
    };

    renderPage();

    return () => {
      isActive = false;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch (e) {}
      }
    };
  }, [pdfDoc_js, currentPage, scale]);

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const displayX = x / scaleX;
    const displayY = y / scaleY;

    const clicked = textItems.find(
      (item) =>
        x >= item.x &&
        x <= item.x + item.width &&
        y >= item.y &&
        y <= item.y + item.height + 5
    );

    if (clicked && clicked.str.trim() !== "") {
      setSelectedItem(clicked);
      const key = `${currentPage}-${clicked.x}-${clicked.y}`;
      setEditValue(modifications[key] || clicked.str);
      setEditPosition({ x: displayX, y: displayY });
    } else {
      setSelectedItem(null);
    }
  };

  const handleEditChange = (e) => {
    setEditValue(e.target.value);
  };

  const handleEditConfirm = () => {
    if (!selectedItem) return;
    const key = `${currentPage}-${selectedItem.x}-${selectedItem.y}`;
    setModifications((prev) => ({ ...prev, [key]: editValue }));
    setSelectedItem(null);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(
      selectedItem.x,
      selectedItem.y,
      selectedItem.width + 20,
      selectedItem.height + 2
    );
    ctx.fillStyle = "black";
    ctx.font = `${selectedItem.height}px Arial`;
    ctx.fillText(editValue, selectedItem.x, selectedItem.y + selectedItem.height);
  };

  const handleReplaceAndDownload = async () => {
    if (Object.keys(modifications).length === 0) {
      alert("No edits made yet. Click on text to edit it first.");
      return;
    }

    setIsDownloading(true);

    try {
      let currentPdfBytes = pdfBytes;

      // Step 1 — apply all text replacements via backend
      for (const [key, newText] of Object.entries(modifications)) {
        const [, x, y] = key.split("-").map(Number);
        const originalItem = textItems.find(
          (item) => item.x === x && item.y === y
        );
        if (!originalItem) continue;

        const formData = new FormData();
        const blob = new Blob([currentPdfBytes], { type: "application/pdf" });
        formData.append("pdf", blob, "input.pdf");
        formData.append("search", originalItem.str);
        formData.append("replace", newText);

        const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:5000";
        const response = await fetch(`${apiBaseUrl}/replace-text`, {
          method: "POST",
          body: formData,
        });
        currentPdfBytes = new Uint8Array(await response.arrayBuffer());
      }

      const finalBlob = new Blob([currentPdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(finalBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "edited.pdf";
      a.click();

    } catch (error) {
      console.error("Download error:", error);
      alert("Something went wrong. Check the console for details.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="pdf-canvas-container">
      <div className="canvas-header">
        <div>
          <div className="section-tag">Step 2</div>
          <h2>Canvas editor</h2>
        </div>

        <div className="toolbar">
          <button
            type="button"
            className="toolbar-button secondary"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => p - 1)}
          >
            Previous
          </button>
          <span className="page-indicator">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            className="toolbar-button secondary"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
          >
            Next
          </button>
          <button
            type="button"
            className="toolbar-button primary"
            onClick={handleReplaceAndDownload}
            disabled={isDownloading}
          >
            {isDownloading ? "Processing..." : "Download PDF"}
          </button>
        </div>
      </div>

      <div className="canvas-stage">
        <canvas
          className="pdf-canvas"
          ref={canvasRef}
          onClick={handleCanvasClick}
        />

        {selectedItem && (
          <div
            className="edit-popover"
            style={{ left: editPosition.x, top: editPosition.y }}
          >
            <input
              className="edit-input"
              autoFocus
              value={editValue}
              onChange={handleEditChange}
            />
            <div className="edit-actions">
              <button
                className="toolbar-button primary small"
                onClick={handleEditConfirm}
              >
                Save
              </button>
              <button
                className="toolbar-button secondary small"
                onClick={() => setSelectedItem(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PDFCanvas;