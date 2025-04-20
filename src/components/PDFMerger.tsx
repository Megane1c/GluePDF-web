import { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { DndContext, DragEndEvent, closestCenter, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { FiUpload, FiTrash2, FiLoader, FiDownload } from 'react-icons/fi';
import { pdfService, PDFFile } from '../services/pdf';
import PDFList from './PDFList';

const PDFMerger = () => {
    const [files, setFiles] = useState<PDFFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [fileProcessing, setFileProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isDragActive, setIsDragActive] = useState(false);

    const sensors = useSensors(
        useSensor(MouseSensor),
        useSensor(TouchSensor)
    );

    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => {
                setError(null);
            }, 5000); // auto-clear after 5 seconds
    
            return () => clearTimeout(timer); // cleanup if component unmounts early
        }
    }, [error]);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (acceptedFiles.length === 0) return;
        
        setFileProcessing(true); // Start file processing loading state
        setError('');
        try {
            const pdfFiles = await Promise.all(
                acceptedFiles.map(file => pdfService.addFile(file))
            );
            setFiles(prev => [...prev, ...pdfFiles]);
        } catch (err) {
            setError('Failed to process one or more files. Make sure all files are valid PDFs.');
        } finally {
            setFileProcessing(false); // End file processing loading state
        }
    }, []);

    const { getRootProps, getInputProps } = useDropzone({
        onDrop,
        accept: { 'application/pdf': ['.pdf'] },
        onDragEnter: () => setIsDragActive(true),
        onDragLeave: () => setIsDragActive(false),
        onDropAccepted: () => setIsDragActive(false),
        onDropRejected: () => setIsDragActive(false),
        disabled: fileProcessing, // Disable dropzone while processing files
    });

    const handleRemoveFile = (id: string) => {
        pdfService.removeFile(id);
        setFiles(prev => prev.filter(file => file.id !== id));
    };

    const handleReorder = (newFiles: PDFFile[]) => {
        setFiles(newFiles);
        pdfService.setFiles(newFiles);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        
        if (over && active.id !== over.id) {
            const oldIndex = files.findIndex(file => file.id === active.id);
            const newIndex = files.findIndex(file => file.id === over.id);
            
            if (oldIndex !== -1 && newIndex !== -1) {
                const newFiles = arrayMove(files, oldIndex, newIndex);
                handleReorder(newFiles);
            }
        }
    };

    const handleMergeAndDownload = async () => {
        if (files.length < 2) {
            setError('Please upload at least 2 files to merge');
            return;
        }
        setLoading(true);
        setError('');
        try {
            // Merge PDFs using pdf-lib
            const mergedPdfBuffer = await pdfService.mergePDFs(files.map(file => file.id));
            
            // Create a Blob from the ArrayBuffer
            const blob = new Blob([mergedPdfBuffer], { type: 'application/pdf' });
            
            // Create a URL for the Blob
            const url = URL.createObjectURL(blob);
            
            // Create a temporary anchor element and trigger download
            const link = document.createElement('a');
            link.href = url;
            link.download = 'glued-doc.pdf';
            
            // Append to body, click, and remove
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Clean up the URL object
            URL.revokeObjectURL(url);
        } catch (err) {
            setError('Failed to merge files');
            console.error(err);
        }
        setLoading(false);
    };

    const handleClearAll = () => {
        // Clear files
        files.forEach(file => pdfService.removeFile(file.id));
        setFiles([]);
    };

    return (
        <div className="layout-container">
            {error && (
                <div className="error-message">
                    <div className="error-message__content">
                        <span>{error}</span>
                    </div>
                </div>
            )}

            <div className="pdf-merger-container">
                <div className="pdf-box">
                    <div className="header-section">
                        <div className="header-content">
                            <h1 className="title">Glue PDF</h1>
                            <p>Merge PDFs securely in your browser — no server, no uploads.</p>
                            {files.length === 0 && (
                                <div className="merger-steps">
                                    <ol>
                                        <li><strong>Select PDFs</strong> (drag & drop or click)</li>
                                        <li><strong>Reorder</strong> (<i>optional</i> — drag files to change order)</li>
                                        <li><strong>Merge & Download</strong> (instant client-side processing)</li>
                                    </ol>
                                </div>
                            )}
                            {files.length > 0 && (
                                <button
                                    onClick={handleClearAll}
                                    disabled={files.length < 2 || fileProcessing || loading}
                                    className="clear-button"
                                >
                                    <FiTrash2 className="remove-all-button" />
                                    Clear All
                                </button>
                            )}
                        </div>
                    </div>
    
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <div className="dropzone-section">
                            {/* Display files */}
                            {files.length > 0 && (
                                <div className="existing-files-container">
                                    <PDFList 
                                        files={files} 
                                        onReorder={handleReorder}
                                        onRemove={handleRemoveFile}
                                    />
                                </div>
                            )}
                            
                            {/* Dropzone area */}
                            <div 
                                {...getRootProps()} 
                                className={`dropzone-area ${isDragActive ? 'drag-active' : ''} ${fileProcessing ? 'processing' : ''}`}
                            >
                                <input {...getInputProps()} />
                                {fileProcessing ? (
                                    <div className="dropzone-loading">
                                        <FiLoader className="loading-icon" />
                                        <p className="loading-text">Processing files...</p>
                                    </div>
                                ) : files.length > 0 ? (
                                    <div className={`dropzone-content ${isDragActive ? 'drag-active' : ''}`}>
                                        <p className="dropzone-hint">
                                            <FiUpload className="upload-icon-small" />
                                            Drop more files here or click to browse
                                        </p>
                                    </div>
                                ) : (
                                    <div className="dropzone-empty">
                                        <FiUpload className="upload-icon-small" />
                                        <p className="upload-text">Drag and drop PDFs here, or click to browse</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </DndContext>
    
                    {files.length > 0 && (
                        <div className="action-section">
                            <div className="merge-download">
                                <button
                                    onClick={handleMergeAndDownload}
                                    disabled={files.length < 2 || loading || fileProcessing}
                                    className="merge-button"
                                >
                                    <FiDownload className="button-icon" />
                                    {loading ? 'Processing...' : 'Merge PDFs'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PDFMerger;