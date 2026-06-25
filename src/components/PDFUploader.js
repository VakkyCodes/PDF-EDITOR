import React from "react";

function PDFUploader({ setPdfFile, setPdfBytes }) {
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || file.type !== "application/pdf") {
      alert("Please upload a valid PDF file");
      return;
    }

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Set bytes first, then preview URL
    setPdfBytes(bytes);
    setPdfFile(URL.createObjectURL(file));
  };

  return (
    <div className="uploader-card">
      <div className="uploader-copy">
        <div className="section-tag">Step 1</div>
        <h2>Upload your PDF</h2>
        <p>
          Drop in a document to unlock page controls, inline text editing, and instant local export.
        </p>
      </div>

      <label className="file-dropzone">
        <input type="file" accept="application/pdf" onChange={handleFileChange} />
        <span className="dropzone-icon">↑</span>
        <span className="dropzone-title">Choose PDF file</span>
        <span className="dropzone-subtitle">Click to browse or drag a file into the browser</span>
      </label>
    </div>
  );
}

export default PDFUploader;