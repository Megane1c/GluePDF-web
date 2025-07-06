import React, { useRef, useState, useEffect } from 'react';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfjsWorkerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import '../styles/PDFEditor.css';

GlobalWorkerOptions.workerSrc = pdfjsWorkerSrc;

interface TextBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize: number;
  fontFamily: string;
  page: number;
}

const defaultFont = 'Arial';

const PDFEditor: React.FC = () => {
  const [textBoxes, setTextBoxes] = useState<TextBox[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState<number>(16);
  const [fontFamily, setFontFamily] = useState<string>(defaultFont);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pageCanvases, setPageCanvases] = useState<HTMLCanvasElement[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const pdfViewerRef = useRef<HTMLDivElement>(null);

  // Dropzone state
  const [pdfDragOver, setPdfDragOver] = useState(false);
  const [isHover, setIsHover] = useState(false);

  // Add text box to current page
  const [placing, setPlacing] = useState(false);

  const addTextBox = (x: number, y: number) => {
    const newBox: TextBox = {
      id: Math.random().toString(36).substr(2, 9),
      x,
      y,
      width: 150,
      height: 50,
      text: 'Edit me',
      fontSize,
      fontFamily,
      page: currentPage,
    };
    setTextBoxes([...textBoxes, newBox]);
    setSelectedId(newBox.id);
    setPlacing(false);
  };

  const removeTextBox = (id: string) => {
    setTextBoxes(textBoxes.filter(box => box.id !== id));
    setSelectedId(null);
  };

  const handleTextChange = (id: string, value: string) => {
    setTextBoxes(textBoxes.map(box =>
      box.id === id ? { ...box, text: value } : box
    ));
  };

  const handleFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSize = Number(e.target.value);
    setFontSize(newSize);
    if (selectedId) {
      setTextBoxes(textBoxes.map(box =>
        box.id === selectedId ? { ...box, fontSize: newSize } : box
      ));
    }
  };

  const handleFontFamilyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newFont = e.target.value;
    setFontFamily(newFont);
    if (selectedId) {
      setTextBoxes(textBoxes.map(box =>
        box.id === selectedId ? { ...box, fontFamily: newFont } : box
      ));
    }
  };

  const handlePdfUpload = async (file: File) => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setPdfError('Please upload a valid PDF file.');
      return;
    }
    setPdfError(null);
    setLoading(true);
    const url = URL.createObjectURL(file);
    setPdfUrl(url);
    setCurrentPage(1);
    const loadingTask = getDocument(url);
    const pdf = await loadingTask.promise;
    const canvases: HTMLCanvasElement[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.5 });
      const domCanvas = document.createElement('canvas');
      domCanvas.width = viewport.width;
      domCanvas.height = viewport.height;
      const context = domCanvas.getContext('2d');
      if (context) {
        await page.render({ canvasContext: context, viewport }).promise;
      }
      canvases.push(domCanvas);
    }
    setPageCanvases(canvases);
    setLoading(false);
  };

  const handlePdfFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handlePdfUpload(file);
    }
  };

  const handlePdfDropzoneClick = () => {
    pdfInputRef.current?.click();
  };

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
      await handlePdfUpload(file);
    }
  };

  const handlePageClick = (e: React.MouseEvent<HTMLDivElement, MouseEvent>, page: number) => {
    if (placing) {
        const target = e.target as HTMLElement;
        if (target.classList.contains('canvas-wrapper') || target.tagName === 'CANVAS') {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            addTextBox(x, y);
        }
    }
    setCurrentPage(page);
  };

  const resetPdf = () => {
    setPdfUrl(null);
    setPdfError(null);
    setPageCanvases([]);
    setCurrentPage(1);
    setTextBoxes([]);
    if (pdfInputRef.current) {
      pdfInputRef.current.value = '';
    }
  };

  // Drag and Resize Logic
  const dragInfo = useRef<{ id: string; type: 'drag' | 'resize'; startX: number; startY: number; origX: number; origY: number; origW: number; origH: number } | null>(null);

  const onMouseDown = (e: React.MouseEvent, id: string, type: 'drag' | 'resize') => {
    e.stopPropagation();
    setSelectedId(id);
    const box = textBoxes.find(b => b.id === id);
    if (!box) return;

    dragInfo.current = {
      id,
      type,
      startX: e.clientX,
      startY: e.clientY,
      origX: box.x,
      origY: box.y,
      origW: box.width,
      origH: box.height,
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!dragInfo.current) return;
    const { id, type, startX, startY, origX, origY, origW, origH } = dragInfo.current;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    setTextBoxes(textBoxes.map(box => {
      if (box.id === id) {
        if (type === 'drag') {
          return { ...box, x: origX + dx, y: origY + dy };
        } else {
          return { ...box, width: Math.max(50, origW + dx), height: Math.max(30, origH + dy) };
        }
      }
      return box;
    }));
  };

  const onMouseUp = () => {
    dragInfo.current = null;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };

  useEffect(() => {
    const handleScroll = () => {
        if (!pdfViewerRef.current) return;
        const viewer = pdfViewerRef.current;
        const pageNodes = Array.from(viewer.querySelectorAll('.page-container'));
        let mostVisiblePage = 1;
        let maxVisibility = 0;

        pageNodes.forEach((pageNode, index) => {
            const pageRect = pageNode.getBoundingClientRect();
            const viewerRect = viewer.getBoundingClientRect();
            const visibleHeight = Math.max(0, Math.min(pageRect.bottom, viewerRect.bottom) - Math.max(pageRect.top, viewerRect.top));
            const visibility = visibleHeight / pageRect.height;
            if (visibility > maxVisibility) {
                maxVisibility = visibility;
                mostVisiblePage = index + 1;
            }
        });
        setCurrentPage(mostVisiblePage);
    };

    const viewer = pdfViewerRef.current;
    viewer?.addEventListener('scroll', handleScroll);
    return () => viewer?.removeEventListener('scroll', handleScroll);
  }, [pageCanvases]);


  const exportEditedPdf = async () => {
    if (!pdfUrl || pageCanvases.length === 0) return;
    const pdfBytes = await fetch(pdfUrl).then(r => r.arrayBuffer());
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // Embed fonts
    const fontCache: Record<string, any> = {};
    const getFont = async (fontFamily: string) => {
      if (fontCache[fontFamily]) return fontCache[fontFamily];
      let font;
      switch (fontFamily) {
        case 'Times New Roman':
          font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
          break;
        case 'Courier New':
          font = await pdfDoc.embedFont(StandardFonts.Courier);
          break;
        case 'Verdana':
          font = await pdfDoc.embedFont(StandardFonts.Helvetica);
          break;
        default:
          font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      }
      fontCache[fontFamily] = font;
      return font;
    };

    for (let i = 0; i < pageCanvases.length; i++) {
      const page = pdfDoc.getPage(i);
      const { width: pdfWidth, height: pdfHeight } = page.getSize();
      const canvas = pageCanvases[i];
      const scaleX = pdfWidth / canvas.width;
      const scaleY = pdfHeight / canvas.height;
      const boxes = textBoxes.filter(box => box.page === i + 1);
      for (const box of boxes) {
        const font = await getFont(box.fontFamily);
        const fontSize = box.fontSize * scaleY;
        const x = box.x * scaleX;
        // Align text baseline to the TOP of the box, matching the editor
        const y = pdfHeight - (box.y * scaleY) - fontSize;
        const text = box.text;
        page.drawText(text, {
          x,
          y,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
          maxWidth: box.width * scaleX,
          lineHeight: fontSize * 1.2,
        });
      }
    }
    const out = await pdfDoc.saveAsBase64({ dataUri: true });
    const link = document.createElement('a');
    link.href = out;
    link.download = 'edited.pdf';
    link.click();
  };

  return (
    <div className="editor-container">
      {!pdfUrl && (
        <div className="editor-steps">
          <h1 className="title">Edit PDF</h1>
          <p>Edit your PDF by adding text boxes to any page. Drag, resize, and style your text.</p>
          <ol>
            <li><strong>Select PDF</strong> (drag & drop or click)</li>
            <li><strong>Add Text</strong> (move, resize, style)</li>
            <li><strong>Download/Export</strong> (coming soon)</li>
          </ol>
        </div>
      )}
      {!pdfUrl && (
        <div className="pdf-dropzone-container">
          <div
            onClick={handlePdfDropzoneClick}
            onDragOver={handlePdfDragOver}
            onDragLeave={handlePdfDragLeave}
            onDrop={handlePdfDrop}
            onMouseEnter={() => setIsHover(true)}
            onMouseLeave={() => setIsHover(false)}
            className={`pdf-dropzone${pdfDragOver || isHover ? ' drag-over' : ''}`}
          >
            <div className={`pdf-dropzone-icon${pdfDragOver ? ' drag-over' : ''}`}>📄</div>
            <div className="pdf-dropzone-text">
              Drag and drop your PDF file here, or click to browse
            </div>
          </div>
          {pdfError && <div className="pdf-error">{pdfError}</div>}
        </div>
      )}
      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf"
        onChange={handlePdfFileInput}
        className="hidden-file-input"
      />
      {loading && (
        <div className="pdf-loading-indicator">
          <div className="spinner"></div>
          <div className="loading-text">Loading PDF...</div>
          <div className="loading-subtext">Please wait</div>
        </div>
      )}
      {pdfUrl && pageCanvases.length > 0 && !loading && (
        <>
          <div className="change-pdf-button-container">
            <button className="change-pdf-button" onClick={resetPdf}>
                📄 Change PDF
            </button>
          </div>
          <div className="editor-layout">
            <div className="pdf-viewer" ref={pdfViewerRef} onClick={() => setSelectedId(null)}>
              {pageCanvases.map((canvas, idx) => (
                <div
                  key={idx}
                  className={`page-container${idx + 1 === currentPage ? ' active' : ''}`}
                  onClick={(e) => {
                    // Prevent clearing selection if clicking a text box
                    if ((e.target as HTMLElement).classList.contains('text-box-overlay') || (e.target as HTMLElement).classList.contains('text-box-textarea')) return;
                    handlePageClick(e, idx + 1);
                  }}
                >
                  <div className="canvas-wrapper" ref={el => {
                    if (el && canvas && !el.contains(canvas)) {
                      el.innerHTML = '';
                      el.appendChild(canvas);
                    }
                  }} />
                  {textBoxes.filter(box => box.page === idx + 1).map(box => (
                    <div
                      key={box.id}
                      className={`text-box-overlay${box.id === selectedId ? ' selected' : ''}`}
                      style={{
                        left: box.x,
                        top: box.y,
                        width: box.width,
                        height: box.height,
                        fontFamily: box.fontFamily,
                        fontSize: box.fontSize,
                      }}
                      onMouseDown={(e) => onMouseDown(e, box.id, 'drag')}
                      onClick={(e) => { e.stopPropagation(); setSelectedId(box.id); }}
                    >
                      <textarea
                        value={box.text}
                        onChange={e => handleTextChange(box.id, e.target.value)}
                        className="text-box-textarea"
                        style={{
                            fontFamily: box.fontFamily,
                            fontSize: box.fontSize,
                        }}
                        onClick={e => e.stopPropagation()}
                      />
                      <div className="resize-handle" onMouseDown={(e) => onMouseDown(e, box.id, 'resize')} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="editor-panel">
                <div className="editor-panel-header">✏️ Text Options</div>
                <div className="control-group">
                    <button className="action-button add-button" onClick={() => setPlacing(true)} disabled={placing}>
                        {placing ? 'Click on the page to add' : 'Add Text Box'}
                    </button>
                </div>
                {selectedId && (
                    <div className="control-group">
                        <button className="action-button danger-button" onClick={() => removeTextBox(selectedId)}>Remove Text Box</button>
                    </div>
                )}
                {textBoxes.length > 0 && (
                  <div className="control-group">
                      <button className="action-button" onClick={exportEditedPdf} disabled={!pdfUrl || loading || pageCanvases.length === 0}>
                          Export PDF
                      </button>
                  </div>
                )}
                <div className="control-group">
                    <label>Font Size:</label>
                    <input type="number" min={8} max={72} value={fontSize} onChange={handleFontSizeChange} />
                </div>
                <div className="control-group">
                    <label>Font Family:</label>
                    <select value={fontFamily} onChange={handleFontFamilyChange}>
                        <option value="Arial">Arial</option>
                        <option value="Times New Roman">Times New Roman</option>
                        <option value="Courier New">Courier New</option>
                        <option value="Verdana">Verdana</option>
                    </select>
                </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PDFEditor;
