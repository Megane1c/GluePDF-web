import React, { useState, useRef } from 'react';
import '../styles/PDFSigner.css';

// Import PDF.js for rendering
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfjsWorkerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Import background removal utility
import { BackgroundRemover, BackgroundRemovalOptions } from '../services/backgroundRemover';

// Import color changer utility
import { SignatureColorChanger } from '../services/sigColorChanger';


GlobalWorkerOptions.workerSrc = pdfjsWorkerSrc;

const PDFSigner: React.FC = () => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [originalSignatureUrl, setOriginalSignatureUrl] = useState<string | null>(null); // Store original
  const [currentSignatureColor, setCurrentSignatureColor] = useState<string>(SignatureColorChanger.SIGNATURE_COLORS.BLACK);
  const [sigPos, setSigPos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [dragging, setDragging] = useState(false);
  const [pageCanvases, setPageCanvases] = useState<Array<HTMLCanvasElement | null>>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [sigSize, setSigSize] = useState<number>(120);
  const [placing, setPlacing] = useState(false);
  const [dragOverPage, setDragOverPage] = useState<number | null>(null);
  const [pdfDragOver, setPdfDragOver] = useState(false);
  const [isHover, setIsHover] = useState(false);
  const [changingColor, setChangingColor] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sigImgRef = useRef<HTMLImageElement>(null);
  const pdfDocRef = useRef<any>(null);
  const [sigRotation, setSigRotation] = useState<number>(0);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // Background removal options
  const [bgRemovalOptions] = useState<BackgroundRemovalOptions>({
    threshold: 240,
    tolerance: 15,
    edgeSmoothing: true
  });

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

  React.useEffect(() => {
    const scrollContainer = document.querySelector('.pdf-viewer');
    if (!scrollContainer) return;

    const handleScroll = () => {
      const pageContainers = document.querySelectorAll('[data-canvas-container]');
      if (pageContainers.length === 0) return;

      const scrollRect = scrollContainer.getBoundingClientRect();
      let mostVisiblePage = -1;
      let maxVisibility = 0;

      pageContainers.forEach((page, index) => {
        const pageRect = page.getBoundingClientRect();
        const visibleHeight = Math.max(0, Math.min(pageRect.bottom, scrollRect.bottom) - Math.max(pageRect.top, scrollRect.top));
        const visibility = visibleHeight / pageRect.height;

        if (visibility > maxVisibility) {
          maxVisibility = visibility;
          mostVisiblePage = index + 1;
        }
      });

      if (mostVisiblePage !== -1 && mostVisiblePage !== currentPageRef.current) {
        setCurrentPage(mostVisiblePage);
      }
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
    };
  }, [pageCanvases]);

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

  const processSignatureImage = async (file: File): Promise<string> => {
    try {
      // Remove background from the signature
      const processedImageUrl = await BackgroundRemover.removeBackground(file, bgRemovalOptions);
      
      return processedImageUrl;
    } catch (error) {
      console.error('Error processing signature:', error);
      // Fallback to original image if processing fails
      return URL.createObjectURL(file);
    }
  };

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;

    const processedUrl = await processSignatureImage(file);
    setOriginalSignatureUrl(processedUrl); // Store the original processed image
    setSignatureUrl(processedUrl); // Set as current signature
    setCurrentSignatureColor(SignatureColorChanger.SIGNATURE_COLORS.BLACK); // Reset to black

    // Center the signature in the visible area of the current page
    setTimeout(() => {
      const scrollContainer = document.querySelector('.pdf-viewer');
      const pageContainers = document.querySelectorAll('[data-canvas-container]');
      const currentPageIdx = currentPageRef.current - 1;
      const pageContainer = pageContainers[currentPageIdx] as HTMLElement | undefined;

      if (!scrollContainer || !pageContainer) return;

      const scrollRect = scrollContainer.getBoundingClientRect();
      const pageRect = pageContainer.getBoundingClientRect();

      const visibleTop = Math.max(scrollRect.top, pageRect.top);
      const visibleBottom = Math.min(scrollRect.bottom, pageRect.bottom);
      const visibleLeft = Math.max(scrollRect.left, pageRect.left);
      const visibleRight = Math.min(scrollRect.right, pageRect.right);

      const centerX = (visibleLeft + visibleRight) / 2 - pageRect.left;
      const centerY = (visibleTop + visibleBottom) / 2 - pageRect.top;

      const size = sigSizeRef.current || 120;
      const newX = Math.max(0, Math.min(pageRect.width - size, centerX - size / 2));
      const newY = Math.max(0, Math.min(pageRect.height - size, centerY - size / 2));

      setSigPos({ x: newX, y: newY });
    }, 0);
  };

  // Handle signature color change
  const handleColorChange = async (newColor: string) => {
    if (!originalSignatureUrl) return;
    
    try {
      setChangingColor(true);
      const coloredSignatureUrl = await SignatureColorChanger.changeSignatureColor(
        originalSignatureUrl, 
        newColor,
        { preserveAlpha: true, threshold: 50 }
      );
      setSignatureUrl(coloredSignatureUrl);
      setCurrentSignatureColor(newColor);
    } catch (error) {
      console.error('Error changing signature color:', error);
    } finally {
      setChangingColor(false);
    }
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

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverPage(null);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        const processedUrl = await processSignatureImage(file);
        setOriginalSignatureUrl(processedUrl);
        setSignatureUrl(processedUrl);
        setCurrentSignatureColor(SignatureColorChanger.SIGNATURE_COLORS.BLACK);
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
    
    const scrollContainer = document.querySelector('.pdf-viewer');
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
        
        const sigImg = sigImgRef.current;
        if (!sigImg) return;

        const aspectRatio = sigImg.naturalHeight / sigImg.naturalWidth;
        const sigHeight = sigSize * aspectRatio;

        const newX = Math.max(0, Math.min(pageRect.width - sigSize, localX));
        const newY = Math.max(0, Math.min(height - sigHeight, localY));
        
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
    setOriginalSignatureUrl(null);
    setSigPos({ x: 50, y: 50 });
    setSigRotation(0);
    setSigSize(120);
    setCurrentSignatureColor(SignatureColorChanger.SIGNATURE_COLORS.BLACK);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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

  // Get color options for the UI
  const colorOptions = SignatureColorChanger.getColorOptions();

  return (
    <div className="signer-container">
      
      {!pdfUrl && (
        <div className="signer-steps">
          <h1 className="title">Sign PDF</h1>
          <p>Sign PDF securely in your browser with automatic background removal and color options.</p>
          <ol>
            <li><strong>Select PDF</strong> (drag & drop or click)</li>
            <li><strong>Upload Signature</strong> (white background auto-removed)</li>
            <li><strong>Choose Color</strong> (black, blue, red, etc.)</li>
            <li><strong>Sign & Download</strong> (instant client-side processing)</li>
          </ol>
        </div>
      )}
      
      {/* PDF Upload Dropzone - only show if no PDF loaded */}
      {!pdfUrl && (
        <div className="pdf-dropzone-container">
          <div
            onClick={handlePdfDropzoneClick}
            onDragOver={handlePdfDragOver}
            onDragLeave={handlePdfDragLeave}
            onDrop={handlePdfDrop}
            onMouseEnter={() => setIsHover(true)}  
            onMouseLeave={() => setIsHover(false)}
            className={`pdf-dropzone ${pdfDragOver || isHover ? 'drag-over' : ''}`}
          >
            <div className={`pdf-dropzone-icon ${pdfDragOver ? 'drag-over' : ''}`}>
              📄
            </div>
            <div className="pdf-dropzone-text">
              Drag and drop your PDF file here, or click to browse
            </div>
          </div>
          
          {pdfError && (
            <div className="pdf-error">
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
        className="hidden-file-input"
      />
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleSignatureUpload}
        className="hidden-file-input"
      />

      {/* PDF Loading Indicator */}
      {pdfUrl && pageCanvases.length === 0 && (
        <div className="pdf-loading-indicator">
          <div className="spinner"></div>
          <div className="loading-text">
            Loading PDF...
          </div>
          <div className="loading-subtext">
            Please wait
          </div>
        </div>
      )}

      {/* PDF Viewer with integrated signature upload */}
      {pdfUrl && pageCanvases.length > 0 && (
      <>
        {/* Change PDF Button - appears after PDF is successfully rendered */}
        <div className="change-pdf-button-container">
          <button
            className="change-pdf-button"
            onClick={resetPdf}
          >
            📄 Change PDF
          </button>
        </div>

        <div className="signer-layout">
          
          {/* PDF Viewer */}
          <div 
            className="pdf-viewer"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={handlePdfClick}
          >
            {pageCanvases.map((canvas, idx) => (
              <div
                key={idx}
                className={`page-container ${!signatureUrl ? 'droppable' : ''} ${dragOverPage === idx ? 'drag-over-page' : ''}`}
                onClick={(e) => handlePageChange(idx + 1, e)}
                onMouseEnter={() => handlePageMouseEnter(idx)}
                onMouseLeave={handlePageMouseLeave}
              >
                {canvas && (
                  <div
                    data-canvas-container
                    className="canvas-wrapper"
                    ref={el => {
                      if (el && !el.contains(canvas)) {
                        el.innerHTML = '';
                        el.appendChild(canvas);
                      }
                    }}
                  />
                )}

                {/* Drop hint and signature overlay are kept as-is */}
                {dragOverPage === idx && !signatureUrl && (
                  <div className="drop-hint">
                    📝 Drop signature on page {idx + 1}<br />
                    <span className="drop-hint-subtext">
                      or click to browse (background auto-removed)
                    </span>
                  </div>
                )}

                {signatureUrl && idx === currentPage - 1 && (
                  <div
                    data-overlay
                    className={`signature-overlay ${dragging ? 'dragging' : ''}`}
                    style={{
                      left: sigPos.x,
                      top: sigPos.y,
                      width: sigSize,
                      transform: `rotate(${sigRotation}deg)`,
                    }}
                    onMouseDown={handleMouseDown}
                  >
                    <img
                      ref={sigImgRef}
                      src={signatureUrl}
                      alt="Signature"
                      className="signature-image"
                      draggable={false}
                    />
                    {/* Resize & rotate handles */}
                    <div
                      data-handle="resize"
                      className="resize-handle"
                      onMouseDown={handleOverlayResize}
                    />
                    <div
                      data-handle="rotate"
                      className="rotate-handle"
                      onMouseDown={handleOverlayRotate}
                    >
                      <svg className="rotate-icon" viewBox="0 0 14 14">
                        <path d="M7 2a5 5 0 1 1-4.33 2.5" />
                        <polyline points="7,0 7,4 11,4" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Signature Color Panel with Action Buttons (only shown when signature is loaded) */}
          {signatureUrl && (
            <div className="signature-panel">
              <div className="signature-panel-header">
                📝 Signature Color Options
              </div>
              <div className="color-options">
                {colorOptions.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => handleColorChange(color.value)}
                    disabled={changingColor}
                    className={`color-button ${currentSignatureColor === color.value ? 'active' : ''}`}
                    title={`Change signature to ${color.name.toLowerCase()}`}
                  >
                    <span className="color-icon">{color.icon}</span>
                    {color.name}
                  </button>
                ))}
              </div>
              
              {/* Action buttons moved here */}
              <div className="action-buttons">
                <button
                  className="action-button place-button"
                  onClick={handlePlaceSignature}
                  disabled={placing}
                >
                  {placing ? 'Exporting...' : 'Place Signature & Export PDF'}
                </button>
                <button
                  className="action-button change-sig-button"
                  onClick={resetSignature}
                >
                  Change Signature
                </button>
              </div>
            </div>
          )}
        </div>
      </>
    )}
    </div>
  );
};

export default PDFSigner;
