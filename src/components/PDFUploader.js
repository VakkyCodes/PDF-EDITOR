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
    <div className="uploader">
      <h2>Upload your PDF</h2>
      <input type="file" accept="application/pdf" onChange={handleFileChange} />
    </div>
  );
}

export default PDFUploader;