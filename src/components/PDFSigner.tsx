import React, { useState, useRef } from 'react';

// Import PDF.js for rendering
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfjsWorkerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url';

GlobalWorkerOptions.workerSrc = pdfjsWorkerSrc;

const PDFSigner: React.FC = () => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [sigPos, setSigPos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sigImgRef = useRef<HTMLImageElement>(null);

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setPdfError('Please upload a valid PDF file.');
      return;
    }
    setPdfError(null);
    const url = URL.createObjectURL(file);
    setPdfUrl(url);
    // Render the first page
    const loadingTask = getDocument(url);
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext('2d');
      if (context) {
        await page.render({ canvasContext: context, viewport }).promise;
      }
    }
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    setSignatureUrl(URL.createObjectURL(file));
  };

  // Drag logic for signature overlay
  const handleMouseDown = (e: React.MouseEvent<HTMLImageElement, MouseEvent>) => {
    setDragging(true);
    const rect = e.currentTarget.getBoundingClientRect();
    setOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (!dragging) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    setSigPos({
      x: e.clientX - rect.left - offset.x,
      y: e.clientY - rect.top - offset.y,
    });
  };
  const handleMouseUp = () => setDragging(false);

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h2>Sign PDF</h2>
      <div style={{ margin: '1.5rem 0' }}>
        <input type="file" accept="application/pdf" onChange={handlePdfUpload} />
        {pdfError && <div style={{ color: 'red', marginTop: 8 }}>{pdfError}</div>}
      </div>
      <div style={{ margin: '1.5rem 0' }}>
        <input type="file" accept="image/*" onChange={handleSignatureUpload} />
        <div style={{ fontSize: 13, color: '#666' }}>Upload signature image (PNG/JPG, transparent preferred)</div>
      </div>
      {pdfUrl && (
        <div
          style={{ display: 'flex', justifyContent: 'center', position: 'relative', width: 'fit-content', margin: '0 auto' }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <canvas ref={canvasRef} style={{ border: '1px solid #ccc', borderRadius: 8, display: 'block' }} />
          {signatureUrl ? (
            <img
              ref={sigImgRef}
              src={signatureUrl}
              alt="Signature"
              style={{
                position: 'absolute',
                left: sigPos.x,
                top: sigPos.y,
                width: 120,
                height: 'auto',
                cursor: dragging ? 'grabbing' : 'grab',
                userSelect: 'none',
                pointerEvents: 'auto',
                zIndex: 2,
              }}
              draggable={false}
              onMouseDown={handleMouseDown}
            />
          ) : null}
        </div>
      )}
    </div>
  );
};

export default PDFSigner;
