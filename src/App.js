import React, { useState } from "react";
import PDFUploader from "./components/PDFUploader";
import PDFCanvas from "./components/PDFCanvas";
import "./App.css";

function App() {
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfBytes, setPdfBytes] = useState(null);

  return (
    <div className="app">
      <h1>PDF Editor</h1>
      <PDFUploader setPdfFile={setPdfFile} setPdfBytes={setPdfBytes} />
      {pdfFile && (
        <PDFCanvas pdfBytes={pdfBytes} />
      )}
    </div>
  );
}

export default App;