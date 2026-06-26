import React, { useState, useRef } from "react";
import PDFUploader from "./components/PDFUploader";
import PDFCanvas from "./components/PDFCanvas";
import NotesPanel from "./components/NotesPanel";
import "./App.css";

function App() {
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfBytes, setPdfBytes] = useState(null);
  const notesCanvasRef = useRef(null);
  const [activeFeature, setActiveFeature] = useState("viewer");

  const featureTabs = [
    { id: "viewer", label: "PDF Viewer", helper: "Preview pages" },
    { id: "editing", label: "PDF Editing", helper: "Replace text" },
    { id: "notes", label: "Notes", helper: "Annotate" },
    { id: "proofreading", label: "Proofreading", helper: "Coming soon", muted: true },
    { id: "compare", label: "Compare PDF", helper: "Coming soon", muted: true },
  ];

  const showPdfCanvas = activeFeature === "viewer" || activeFeature === "editing";
  const showNotesPanel = activeFeature === "viewer" || activeFeature === "notes";

  return (
    <div className="app-shell">
      <div className="background-glow background-glow-one" />
      <div className="background-glow background-glow-two" />

      <main className="app-layout">
        <header className="app-bar panel">
          <div className="app-brand">
            <div className="brand-mark">PDF</div>
            <div>
              <h1>PDF Editor</h1>
              <p>Viewer, editing, and notes in one workspace</p>
            </div>
          </div>

          <div className="app-bar-actions">
            <span className="status-chip">Local</span>
            <span className="status-chip">Light UI</span>
          </div>
        </header>

        <section className="panel feature-rail">
          <div className="feature-rail-label">Workspace</div>
          <div className="feature-tabs">
            {featureTabs.map((feature) => (
              <button
                key={feature.id}
                type="button"
                className={`feature-tab ${activeFeature === feature.id ? "active" : ""} ${feature.muted ? "muted" : ""}`}
                onClick={() => setActiveFeature(feature.id)}
              >
                <span>{feature.label}</span>
                <small>{feature.helper}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="panel panel-upload">
          <PDFUploader setPdfFile={setPdfFile} setPdfBytes={setPdfBytes} />
        </section>

        <section className="panel panel-workspace">
          {pdfFile ? (
            <div className={`workspace-split workspace-split--${activeFeature}`}>
              {showPdfCanvas && (
                <div className="workspace-pane workspace-canvas-pane">
                  <PDFCanvas
                    pdfBytes={pdfBytes}
                    notesCanvasRef={notesCanvasRef}
                  />
                </div>
              )}

              {showNotesPanel && (
                <div className="workspace-pane workspace-notes-pane">
                  <NotesPanel canvasRef={notesCanvasRef} />
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-badge">Ready</div>
              <h2>Upload a PDF to open viewer, editing, and notes</h2>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;