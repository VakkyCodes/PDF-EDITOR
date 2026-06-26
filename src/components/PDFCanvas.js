import React, { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

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
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

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

  const renderPageToImageBytes = async (pageNum) => {
    const page = await pdfDoc_js.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2 });

    const offscreen = document.createElement("canvas");
    offscreen.width = viewport.width;
    offscreen.height = viewport.height;
    const ctx = offscreen.getContext("2d");

    await page.render({ canvasContext: ctx, viewport }).promise;

    const dataUrl = offscreen.toDataURL("image/png");
    const base64 = dataUrl.split(",")[1];
    return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
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

      // Step 2 — reload edited PDF into pdfjs for rendering
      const editedPdfDoc_js = await pdfjsLib.getDocument({
        data: new Uint8Array(currentPdfBytes),
      }).promise;

      // Step 3 — get notes canvas image
      const notesCanvas = notesCanvasRef?.current;
      let notesImageBytes = null;
      if (notesCanvas) {
        const notesDataUrl = notesCanvas.toDataURL("image/png");
        const notesBase64 = notesDataUrl.split(",")[1];
        notesImageBytes = Uint8Array.from(atob(notesBase64), (c) => c.charCodeAt(0));
      }

      // Step 4 — build final side-by-side PDF
      const finalDoc = await PDFDocument.create();
      const font = await finalDoc.embedFont(StandardFonts.HelveticaBold);
      const pageCount = editedPdfDoc_js.numPages;

      for (let i = 0; i < pageCount; i++) {
        // Render this PDF page to an image
        const pdfPage = await editedPdfDoc_js.getPage(i + 1);
        const viewport = pdfPage.getViewport({ scale: 2 });

        const offscreen = document.createElement("canvas");
        offscreen.width = viewport.width;
        offscreen.height = viewport.height;
        const ctx = offscreen.getContext("2d");
        await pdfPage.render({ canvasContext: ctx, viewport }).promise;

        const pdfPageDataUrl = offscreen.toDataURL("image/png");
        const pdfPageBase64 = pdfPageDataUrl.split(",")[1];
        const pdfPageImageBytes = Uint8Array.from(
          atob(pdfPageBase64),
          (c) => c.charCodeAt(0)
        );

        const pdfPageImage = await finalDoc.embedPng(pdfPageImageBytes);

        // Page dimensions — double width for side by side
        const pageW = viewport.width;
        const pageH = viewport.height;
        const combinedPage = finalDoc.addPage([pageW * 2, pageH]);

        // White background
        combinedPage.drawRectangle({
          x: 0,
          y: 0,
          width: pageW * 2,
          height: pageH,
          color: rgb(1, 1, 1),
        });

        // Draw PDF page on LEFT half
        combinedPage.drawImage(pdfPageImage, {
          x: 0,
          y: 0,
          width: pageW,
          height: pageH,
        });

        // Draw divider line between left and right
        combinedPage.drawLine({
          start: { x: pageW, y: 0 },
          end: { x: pageW, y: pageH },
          thickness: 1,
          color: rgb(0.8, 0.8, 0.8),
        });

        // Draw notes label on RIGHT half
        combinedPage.drawText(`Notes — Page ${i + 1}`, {
          x: pageW + 20,
          y: pageH - 30,
          size: 12,
          font,
          color: rgb(0.4, 0.4, 0.4),
        });

        // Draw notes image on RIGHT half
        if (notesImageBytes) {
          const notesImage = await finalDoc.embedPng(notesImageBytes);
          combinedPage.drawImage(notesImage, {
            x: pageW + 20,
            y: 20,
            width: pageW - 40,
            height: pageH - 60,
          });
        } else {
          // If no notes, show placeholder text
          combinedPage.drawText("No notes added for this page.", {
            x: pageW + 20,
            y: pageH / 2,
            size: 11,
            font,
            color: rgb(0.7, 0.7, 0.7),
          });
        }
      }

      const finalBytes = await finalDoc.save();
      const finalBlob = new Blob([finalBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(finalBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "edited-with-notes.pdf";
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