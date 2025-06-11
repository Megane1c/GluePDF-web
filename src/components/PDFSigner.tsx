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
  const [sigSize, setSigSize] = useState<number>(120);
  const [placing, setPlacing] = useState(false);
  const [dragOverPage, setDragOverPage] = useState<number | null>(null);
  const [pdfDragOver, setPdfDragOver] = useState(false);
  const [isHover, setIsHover] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sigImgRef = useRef<HTMLImageElement>(null);
  const pdfDocRef = useRef<any>(null);
  const [sigRotation, setSigRotation] = useState<number>(0);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

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

  const handlePdfUpload = async (file: File) => {
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
    
    // Render all pages
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
      canvases.push(domCanvas);
    }
    setPageCanvases(canvases);
  };

  const handlePdfFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handlePdfUpload(file);
    }
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    setSignatureUrl(URL.createObjectURL(file));
  };

  // PDF dropzone handlers
  const handlePdfDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setPdfDragOver(true);
  };

  const handlePdfDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setPdfDragOver(false);
  };

  const handlePdfDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setPdfDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type === 'application/pdf') {
        await handlePdfUpload(file);
      } else {
        setPdfError('Please drop a valid PDF file.');
      }
    }
  };

  const handlePdfDropzoneClick = () => {
    pdfInputRef.current?.click();
  };

  // PDF container mouse events for signature upload
  const handlePageMouseEnter = (pageIndex: number) => {
    if (pdfUrl && !signatureUrl) {
      setDragOverPage(pageIndex);
    }
  };

  const handlePageMouseLeave = () => {
    setDragOverPage(null);
  };

  const handlePdfClick = () => {
    if (!signatureUrl && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Drag and drop for signature files
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverPage(null);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        setSignatureUrl(URL.createObjectURL(file));
      }
    }
  };

  // Existing signature drag logic
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if ((e.target as HTMLElement).dataset.handle) return;
    setDragging(true);
    const overlayRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
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
    
    const scrollContainer = document.querySelector('div[style*="overflow-y: auto"]');
    if (!scrollContainer) return;

    const scrollRect = scrollContainer.getBoundingClientRect();
    const offset = offsetRef.current;
    const sigSize = sigSizeRef.current;
    const relativeY = e.clientY - scrollRect.top + scrollContainer.scrollTop;

    let currentY = 0;
    const pages = Array.from(document.querySelectorAll('[data-canvas-container]'));
    
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const height = page.getBoundingClientRect().height;
      
      if (relativeY >= currentY && relativeY < currentY + height) {
        const pageRect = page.getBoundingClientRect();
        const localX = e.clientX - pageRect.left - offset.x;
        const localY = relativeY - currentY - offset.y;
        
        if (currentPageRef.current !== i + 1) {
          setCurrentPageRef.current(i + 1);
        }
        
        const newX = Math.max(0, Math.min(pageRect.width - sigSize, localX));
        const newY = Math.max(0, Math.min(height - sigSize, localY));
        
        setSigPosRef.current({ x: newX, y: newY });
        return;
      }
      
      currentY += height + 16;
    }
  };

  const handleGlobalMouseUp = () => {
    setDragging(false);
    window.removeEventListener('mousemove', handleGlobalMouseMove);
    window.removeEventListener('mouseup', handleGlobalMouseUp);
  };

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

  const handleOverlayRotate = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    e.stopPropagation();
    e.preventDefault();
    const rect = e.currentTarget.parentElement?.getBoundingClientRect();
    if (!rect) return;

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const startAngle = sigRotation;
    const startMouseAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);

    const move = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - centerX;
      const dy = moveEvent.clientY - centerY;
      const currentMouseAngle = Math.atan2(dy, dx) * (180 / Math.PI);
      const deltaAngle = currentMouseAngle - startMouseAngle;
      let newRotation = (startAngle + deltaAngle) % 360;
      if (newRotation < 0) newRotation += 360;
      setSigRotation(newRotation);
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

  const handlePlaceSignature = async () => {
    if (!pdfDocRef.current || !signatureUrl) return;
    setPlacing(true);
    
    const { PDFDocument, degrees } = await import('pdf-lib');
    const pdfBytes = await fetch(pdfUrl!).then(r => r.arrayBuffer());
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const imgBytes = await fetch(signatureUrl).then(r => r.arrayBuffer());
    const img = await pdfDoc.embedPng(imgBytes).catch(async () => pdfDoc.embedJpg(imgBytes));
    
    const page = pdfDoc.getPage(currentPage - 1);
    const { width: pdfWidth, height: pdfHeight } = page.getSize();
    const canvas = pageCanvases[currentPage - 1];
    if (!canvas) return;

    const scaleX = pdfWidth / canvas.width;
    const scaleY = pdfHeight / canvas.height;
    const signatureWidth = sigSize * scaleX;
    const signatureHeight = (sigSize * (img.height / img.width)) * scaleY;
    const pdfX = sigPos.x * scaleX;
    const pdfY = pdfHeight - (sigPos.y * scaleY) - signatureHeight;

    let drawX = pdfX;
    let drawY = pdfY;
    if (sigRotation !== 0) {
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

  const handlePageChange = (newPage: number, e?: React.MouseEvent) => {
    if (dragging || e?.defaultPrevented) return;
    setCurrentPage(newPage);
  };

  const resetSignature = () => {
    setSignatureUrl(null);
    setSigPos({ x: 50, y: 50 });
    setSigRotation(0);
    setSigSize(120);
  };

  const resetPdf = () => {
    setPdfUrl(null);
    setPdfError(null);
    setPageCanvases([]);
    setCurrentPage(1);
    resetSignature();
    if (pdfInputRef.current) {
      pdfInputRef.current.value = '';
    }
  };

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1 className="title">Sign PDF</h1>
      <p>Sign PDF securely in your browser.</p>
      {!pdfUrl && (
        <div className="merger-steps">
          <ol>
            <li><strong>Select PDF</strong> (drag & drop or click)</li>
            <li><strong>Sign & Download</strong> (instant client-side processing)</li>
          </ol>
        </div>
      )}
      {/* PDF Upload Dropzone - only show if no PDF loaded */}
      {!pdfUrl && (
        <div style={{ margin: '2rem 0' }}>
          <div
            onClick={handlePdfDropzoneClick}
            onDragOver={handlePdfDragOver}
            onDragLeave={handlePdfDragLeave}
            onDrop={handlePdfDrop}
            onMouseEnter={() => setIsHover(true)}  
            onMouseLeave={() => setIsHover(false)}
            style={{
              border: `2px dashed ${pdfDragOver || isHover ? 'rgba(88, 166, 255, 1)' : '#d1d5db'}`,
              borderRadius: '12px',
              padding: '3rem 2rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              backgroundColor: pdfDragOver ? 'rgba(88, 166, 255, 0.2)' : '#383838',
              maxWidth: '500px',
              margin: '0 auto',
              textAlign: 'center'
            }}
          >
            <div style={{ 
              fontSize: '2rem', 
              marginBottom: '1rem',
              color: pdfDragOver ? '#2563eb' : '#9ca3af'
            }}>
              📄
            </div>
            <div style={{ 
              fontSize: '1.1rem', 
              fontWeight: '600', 
              marginBottom: '0.5rem',
              color: pdfDragOver ? '#2563eb' : '#374151'
            }}>
              
            </div>
            <div style={{ 
              fontSize: '1rem', 
              color: '#fef2f2',
              marginBottom: '1.5rem'
            }}>
              Drag and drop your PDF file here, or click to browse
            </div>
          </div>
          
          {pdfError && (
            <div style={{ 
              color: '#dc2626', 
              marginTop: '1rem',
              padding: '0.75rem',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              fontSize: '0.9rem'
            }}>
              {pdfError}
            </div>
          )}
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf"
        onChange={handlePdfFileInput}
        style={{ display: 'none' }}
      />
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleSignatureUpload}
        style={{ display: 'none' }}
      />

      {/* Change PDF Button */}
      {pdfUrl && (
        <div style={{ marginBottom: '1rem' }}>
          <button
            style={{ 
              padding: '0.5rem 1rem', 
              background: '#6b7280', 
              color: '#fff', 
              border: 'none', 
              borderRadius: 6, 
              fontWeight: 600, 
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
            onClick={resetPdf}
          >
            📄 Change PDF
          </button>
        </div>
      )}

      {/* PDF Viewer with integrated signature upload */}
      {pdfUrl && pageCanvases.length > 0 && (
        <div 
          style={{ 
            maxHeight: 600, 
            overflowY: 'auto', 
            border: '1px solid #eee', 
            borderRadius: 8, 
            padding: 8, 
            margin: '0 auto', 
            width: 'fit-content',
            position: 'relative'
          }}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={handlePdfClick}
        >
    
          {pageCanvases.map((canvas, idx) => (
            <div
              key={idx}
              style={{ 
                position: 'relative', 
                marginBottom: 16, 
                display: 'flex', 
                justifyContent: 'center',
                opacity: dragOverPage === idx ? 0.8 : 1,
                transition: 'opacity 0.2s',
                cursor: 'pointer'
              }}
              onClick={(e) => handlePageChange(idx + 1, e)}
              onMouseEnter={() => handlePageMouseEnter(idx)}
              onMouseLeave={handlePageMouseLeave}
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

              {/* Page-specific drop hint */}
              {dragOverPage === idx && !signatureUrl && (
                <div
                  style={{
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    background: 'rgba(37, 99, 235, 0.9)',
                    color: 'white',
                    padding: '0.5rem 1rem',
                    borderRadius: 6,
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    pointerEvents: 'none',
                    zIndex: 5
                  }}
                >
                 📝 Drop signature on page {idx + 1}<br />
                <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                  or click to browse
                </span>
                </div>
              )}

              {/* Signature overlay */}
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
                  
                  {/* Resize handle */}
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
                    }}
                    onMouseDown={handleOverlayResize}
                  />
                  
                  {/* Rotate handle */}
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
                    <svg width="14" height="14" viewBox="0 0 14 14">
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

      {/* Action buttons */}
      {signatureUrl && (
        <div style={{ marginTop: 16, display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            style={{ 
              padding: '0.5rem 1.5rem', 
              background: '#2563eb', 
              color: '#fff', 
              border: 'none', 
              borderRadius: 6, 
              fontWeight: 600, 
              cursor: 'pointer' 
            }}
            onClick={handlePlaceSignature}
            disabled={placing}
          >
            {placing ? 'Exporting...' : 'Place Signature & Export PDF'}
          </button>
          <button
            style={{ 
              padding: '0.5rem 1.5rem', 
              background: '#6b7280', 
              color: '#fff', 
              border: 'none', 
              borderRadius: 6, 
              fontWeight: 600, 
              cursor: 'pointer' 
            }}
            onClick={resetSignature}
          >
            Change Signature
          </button>
        </div>
      )}
    </div>
  );
};

export default PDFSigner;