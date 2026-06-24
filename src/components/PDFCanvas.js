import React, { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

function PDFCanvas({ pdfBytes }) {
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
  const [scale, setScale] = useState(1.5);

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

        // Extract text items with positions
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
        if (error?.name === "RenderingCancelledException") {
          return;
        }
        if (String(error?.message || "").includes("Rendering cancelled")) {
          return;
        }
        throw error;
      }
    };

    renderPage();

    return () => {
      isActive = false;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch (e) {
          // Ignore cancellation errors during cleanup
        }
      }
    };
  }, [pdfDoc_js, currentPage, scale]);

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Find clicked text item
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
      setEditPosition({ x: clicked.x, y: clicked.y });
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

    // Redraw canvas with modification
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

    const formData = new FormData();
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    formData.append("pdf", blob, "input.pdf");

    // Send all modifications one by one
    let currentPdfBytes = pdfBytes;

    for (const [key, newText] of Object.entries(modifications)) {
      const [pageNum, x, y] = key.split("-").map(Number);
      const originalItem = textItems.find(
        (item) => item.x === x && item.y === y
      );

      if (!originalItem) continue;

      const formData = new FormData();
      const blob = new Blob([currentPdfBytes], { type: "application/pdf" });
      formData.append("pdf", blob, "input.pdf");
      formData.append("search", originalItem.str);
      formData.append("replace", newText);

      const response = await fetch("http://localhost:5000/replace-text", {
        method: "POST",
        body: formData,
      });

      currentPdfBytes = new Uint8Array(await response.arrayBuffer());
    }

    // Download final PDF
    const finalBlob = new Blob([currentPdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(finalBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "edited.pdf";
    a.click();
  };

  return (
    <div className="pdf-canvas-container">
      <div className="toolbar">
        <button
          disabled={currentPage <= 1}
          onClick={() => setCurrentPage((p) => p - 1)}
        >
          Previous
        </button>
        <span>
          Page {currentPage} of {totalPages}
        </span>
        <button
          disabled={currentPage >= totalPages}
          onClick={() => setCurrentPage((p) => p + 1)}
        >
          Next
        </button>
        <button onClick={handleReplaceAndDownload}>Download PDF</button>
      </div>

      <p style={{ color: "#666", fontSize: "14px" }}>
        Click on any text in the PDF to edit it
      </p>

      <div style={{ position: "relative", display: "inline-block" }}>
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          style={{ border: "1px solid #ccc", cursor: "text" }}
        />

        {selectedItem && (
          <div
            style={{
              position: "absolute",
              left: editPosition.x,
              top: editPosition.y,
              zIndex: 10,
              background: "white",
              border: "2px solid blue",
              padding: "4px",
              borderRadius: "4px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            }}
          >
            <input
              autoFocus
              value={editValue}
              onChange={handleEditChange}
              style={{
                fontSize: `${selectedItem.height}px`,
                border: "none",
                outline: "none",
                minWidth: "100px",
              }}
            />
            <div style={{ marginTop: "4px", display: "flex", gap: "4px" }}>
              <button onClick={handleEditConfirm}>✓ Save</button>
              <button onClick={() => setSelectedItem(null)}>✗ Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PDFCanvas;