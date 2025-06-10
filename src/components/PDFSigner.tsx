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
  const [pageCanvases, setPageCanvases] = useState<Array<HTMLCanvasElement | null>>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [sigSize, setSigSize] = useState<number>(120); // width in px
  const [placing, setPlacing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sigImgRef = useRef<HTMLImageElement>(null);
  const pdfDocRef = useRef<any>(null);
  const [sigRotation, setSigRotation] = useState<number>(0);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Use refs to always access latest state in global handlers
  const draggingRef = useRef(dragging);
  const offsetRef = useRef(offset);
  const sigSizeRef = useRef(sigSize);
  const setSigPosRef = useRef(setSigPos);
  const setCurrentPageRef = useRef(setCurrentPage);
  const pageCanvasesRef = useRef(pageCanvases);
  const currentPageRef = useRef(currentPage);

  // Keep refs in sync
  React.useEffect(() => { draggingRef.current = dragging; }, [dragging]);
  React.useEffect(() => { offsetRef.current = offset; }, [offset]);
  React.useEffect(() => { sigSizeRef.current = sigSize; }, [sigSize]);
  React.useEffect(() => { setSigPosRef.current = setSigPos; }, [setSigPos]);
  React.useEffect(() => { setCurrentPageRef.current = setCurrentPage; }, [setCurrentPage]);
  React.useEffect(() => { pageCanvasesRef.current = pageCanvases; }, [pageCanvases]);
  React.useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);

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
    setCurrentPage(1);
    const loadingTask = getDocument(url);
    const pdf = await loadingTask.promise;
    pdfDocRef.current = pdf;
    // Render all pages and draw them into the actual DOM canvases
    const canvases: Array<HTMLCanvasElement | null> = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.5 });
      let domCanvas: HTMLCanvasElement | null = null;
      if (i === 1 && canvasRef.current) {
        domCanvas = canvasRef.current;
      } else {
        domCanvas = document.createElement('canvas');
      }
      domCanvas.width = viewport.width;
      domCanvas.height = viewport.height;
      const context = domCanvas.getContext('2d');
      if (context) {
        await page.render({ canvasContext: context, viewport }).promise;
      }
      // Attach the canvas to the DOM for display
      canvases.push(domCanvas);
    }
    setPageCanvases(canvases);
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    setSignatureUrl(URL.createObjectURL(file));
  };

  // Drag logic for signature overlay
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {    if ((e.target as HTMLElement).dataset.handle) return;
    setDragging(true);
    const overlayRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    // Always grab from the center of the signature
    setOffset({
      x: overlayRect.width / 2,
      y: overlayRect.height / 2
    });
    e.stopPropagation();
    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
  };
  const handleGlobalMouseMove = (e: MouseEvent) => {
    if (!draggingRef.current) return;
    
    // Get the scroll container (the container holding all PDF pages)
    const scrollContainer = document.querySelector('div[style*="overflow-y: auto"]');
    if (!scrollContainer) return;

    const scrollRect = scrollContainer.getBoundingClientRect();
    const offset = offsetRef.current;
    const sigSize = sigSizeRef.current;    // Calculate mouse position relative to the scroll container
    const relativeY = e.clientY - scrollRect.top + scrollContainer.scrollTop;

    // Find which page we're hovering over based on the relative Y position
    let currentY = 0;
    const pages = Array.from(document.querySelectorAll('[data-canvas-container]'));
    
    for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const height = page.getBoundingClientRect().height;
        
        if (relativeY >= currentY && relativeY < currentY + height) {
            // We found the page we're hovering over
            const pageRect = page.getBoundingClientRect();
            const localX = e.clientX - pageRect.left - offset.x;
            const localY = relativeY - currentY - offset.y;
            
            // Update current page
            if (currentPageRef.current !== i + 1) {
                setCurrentPageRef.current(i + 1);
            }
            
            // Clamp position within current page boundaries
            const newX = Math.max(0, Math.min(pageRect.width - sigSize, localX));
            const newY = Math.max(0, Math.min(height - sigSize, localY));
            
            setSigPosRef.current({ x: newX, y: newY });
            return;
        }
        
        currentY += height + 16; // Add page height plus margin
    }
};

  const handleGlobalMouseUp = () => {
    setDragging(false);
    window.removeEventListener('mousemove', handleGlobalMouseMove);
    window.removeEventListener('mouseup', handleGlobalMouseUp);
  };

  // Resize signature from overlay
  const handleOverlayResize = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startSize = sigSize;
    const move = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      setSigSize(Math.max(40, startSize + dx));
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  // Adjust rotation logic to ensure proper alignment
  const handleOverlayRotate = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    e.stopPropagation();
    e.preventDefault();
    const rect = e.currentTarget.parentElement?.getBoundingClientRect();
    if (!rect) return;

    // Calculate the center of the signature overlay
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const startAngle = sigRotation;
    const startMouseAngle = Math.atan2(
      e.clientY - centerY,
      e.clientX - centerX
    ) * (180 / Math.PI);

    const move = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - centerX;
      const dy = moveEvent.clientY - centerY;
      const currentMouseAngle = Math.atan2(dy, dx) * (180 / Math.PI);
      const deltaAngle = currentMouseAngle - startMouseAngle;

      // Update rotation while keeping it between 0 and 360 degrees
      let newRotation = (startAngle + deltaAngle) % 360;
      if (newRotation < 0) newRotation += 360;

      setSigRotation(newRotation);

      // Update the transform origin to ensure rotation is around the center
      const overlay = e.currentTarget.parentElement as HTMLElement;
      if (overlay) {
        overlay.style.transformOrigin = "center center";
      }
    };

    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };

    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  // Place signature and export PDF
  const handlePlaceSignature = async () => {
    if (!pdfDocRef.current || !signatureUrl) return;
    const { PDFDocument, degrees } = await import('pdf-lib');
    const pdfBytes = await fetch(pdfUrl!).then(r => r.arrayBuffer());
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const imgBytes = await fetch(signatureUrl).then(r => r.arrayBuffer());
    const img = await pdfDoc.embedPng(imgBytes).catch(async () => pdfDoc.embedJpg(imgBytes));
    
    // Get current page
    const page = pdfDoc.getPage(currentPage - 1);
    const { width: pdfWidth, height: pdfHeight } = page.getSize();
    
    // Get canvas for scaling calculation
    const canvas = pageCanvases[currentPage - 1];
    if (!canvas) return;

    // Calculate scaling factors
    const scaleX = pdfWidth / canvas.width;
    const scaleY = pdfHeight / canvas.height;

    // Calculate signature dimensions
    const signatureWidth = sigSize * scaleX;
    const signatureHeight = (sigSize * (img.height / img.width)) * scaleY;

    // Calculate top-left in PDF coordinates
    const pdfX = sigPos.x * scaleX;
    const pdfY = pdfHeight - (sigPos.y * scaleY) - signatureHeight;

    let drawX = pdfX;
    let drawY = pdfY;
    if (sigRotation !== 0) {
      // Move anchor to center, rotate, then move back
      const cx = pdfX + signatureWidth / 2;
      const cy = pdfY + signatureHeight / 2;
      const rad = (-sigRotation * Math.PI) / 180;
      drawX = cx + (-signatureWidth / 2) * Math.cos(rad) - (-signatureHeight / 2) * Math.sin(rad);
      drawY = cy + (-signatureWidth / 2) * Math.sin(rad) + (-signatureHeight / 2) * Math.cos(rad);
    }

    page.drawImage(img, {
      x: drawX,
      y: drawY,
      width: signatureWidth,
      height: signatureHeight,
      rotate: degrees(-sigRotation)
    });

    const out = await pdfDoc.saveAsBase64({ dataUri: true });
    const link = document.createElement('a');
    link.href = out;
    link.download = 'signed.pdf';
    link.click();
    setPlacing(false);
  };

  // Handle page changes
  const handlePageChange = (newPage: number, e?: React.MouseEvent) => {
    if (dragging || e?.defaultPrevented) return;
    setCurrentPage(newPage);
  };

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
      {pdfUrl && pageCanvases.length > 0 && (
        <div style={{ maxHeight: 600, overflowY: 'auto', border: '1px solid #eee', borderRadius: 8, padding: 8, margin: '0 auto', width: 'fit-content' }}>
          {pageCanvases.map((canvas, idx) => (
            <div
              key={idx}
              style={{ position: 'relative', marginBottom: 16, display: 'flex', justifyContent: 'center' }}
              onClick={(e) => handlePageChange(idx + 1, e)}
            >
              {canvas && (
                <div
                  data-canvas-container
                  style={{ position: 'relative', display: 'inline-block' }}
                  ref={el => {
                    if (el && !el.contains(canvas)) {
                      el.innerHTML = '';
                      el.appendChild(canvas);
                    }
                  }}
                />
              )}
              {signatureUrl && idx === currentPage - 1 && (
                <div
                  data-overlay
                  style={{
                    position: 'absolute',
                    left: sigPos.x,
                    top: sigPos.y,
                    width: sigSize,
                    height: 'auto',
                    transform: `rotate(${sigRotation}deg)`,
                    zIndex: 2,
                    cursor: dragging ? 'grabbing' : 'grab',
                    userSelect: 'none',
                  }}
                  onMouseDown={handleMouseDown}
                >
                  <img
                    ref={sigImgRef}
                    src={signatureUrl}
                    alt="Signature"
                    style={{
                      width: '100%',
                      height: 'auto',
                      display: 'block',
                    }}
                    draggable={false}
                  />
                  {/* Resize handle (bottom-right) as a simple circle */}
                  <div
                    data-handle="resize"
                    style={{
                      position: 'absolute',
                      right: -12,
                      bottom: -12,
                      width: 20,
                      height: 20,
                      background: '#2563eb',
                      borderRadius: '50%',
                      cursor: 'nwse-resize',
                      border: '2px solid #fff',
                      zIndex: 3,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    onMouseDown={handleOverlayResize}
                  />
                  {/* Rotate handle (top-center) */}
                  <div
                    data-handle="rotate"
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: -30,
                      transform: 'translateX(-50%)',
                      width: 20,
                      height: 20,
                      background: '#2563eb',
                      borderRadius: '50%',
                      cursor: 'grab',
                      border: '2px solid #fff',
                      zIndex: 3,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    onMouseDown={handleOverlayRotate}
                  >
                    {/* Circular arrow for rotate */}
                    <svg width="14" height="14" viewBox="0 0 14 14" style={{ display: 'block' }}>
                      <path d="M7 2a5 5 0 1 1-4.33 2.5" fill="none" stroke="#fff" strokeWidth="2" />
                      <polyline points="7,0 7,4 11,4" fill="none" stroke="#fff" strokeWidth="2" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {signatureUrl && (
        <button
          style={{ marginTop: 16, padding: '0.5rem 1.5rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
          onClick={handlePlaceSignature}
          disabled={placing}
        >
          Place Signature & Export PDF
        </button>
      )}
      {placing && (
        <div style={{ marginTop: 16, color: '#2563eb' }}>Exporting PDF...</div>
      )}
    </div>
  );
};

export default PDFSigner;
