import React, { useState } from "react";
import PDFUploader from "./components/PDFUploader";
import PDFCanvas from "./components/PDFCanvas";
import "./App.css";

function App() {
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfBytes, setPdfBytes] = useState(null);

  return (
    <div className="app-shell">
      <div className="background-orb background-orb-one" />
      <div className="background-orb background-orb-two" />

      <main className="app-layout">
        <section className="hero-panel">
          <div className="eyebrow">Local-first PDF editing studio</div>
          <h1>Turn static PDFs into editable documents with a cleaner, faster workflow.</h1>
          <p className="hero-copy">
            A polished browser-based editor for precise text replacement, instant canvas preview,
            and local downloads without cloud friction.
          </p>

          <div className="hero-pills">
            <span>Privacy-first</span>
            <span>Fast canvas preview</span>
            <span>Backend-powered replacement</span>
          </div>

          <div className="hero-stats">
            <article>
              <strong>1</strong>
              <span>Upload your PDF</span>
            </article>
            <article>
              <strong>2</strong>
              <span>Edit text inline</span>
            </article>
            <article>
              <strong>3</strong>
              <span>Download locally</span>
            </article>
          </div>
        </section>

        <section className="workspace-grid">
          <div className="panel panel-upload">
            <PDFUploader setPdfFile={setPdfFile} setPdfBytes={setPdfBytes} />
          </div>

          <div className="panel panel-editor">
            {pdfFile ? (
              <PDFCanvas pdfBytes={pdfBytes} />
            ) : (
              <div className="empty-state">
                <div className="empty-state-badge">Editor ready</div>
                <h2>Upload a PDF to open the workspace</h2>
                <p>
                  You’ll get a refined editing surface with page controls, inline text editing,
                  and a download action once a document is loaded.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;