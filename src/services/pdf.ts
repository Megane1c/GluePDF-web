import { PDFDocument } from 'pdf-lib';

export interface PDFFile {
  id: string;
  name: string;
  size: number;
  data: ArrayBuffer;
}

export class PDFService {
  private files: Map<string, PDFFile>;
  
  constructor() {
    this.files = new Map();
  }

  async addFile(file: File): Promise<PDFFile> {
    // Generate a unique ID for the file
    const id = crypto.randomUUID();
    
    // Read the file as ArrayBuffer
    const data = await file.arrayBuffer();
    
    // Ensure it's a valid PDF
    try {
      await PDFDocument.load(data);
    } catch (error) {
      throw new Error('Invalid PDF file');
    }
    
    // Create the PDFFile object
    const pdfFile: PDFFile = {
      id,
      name: file.name,
      size: file.size,
      data
    };
    
    // Store in the map
    this.files.set(id, pdfFile);
    
    return pdfFile;
  }
  
  removeFile(id: string): void {
    this.files.delete(id);
  }
  
  getFiles(): PDFFile[] {
    return Array.from(this.files.values());
  }
  
  setFiles(files: PDFFile[]): void {
    this.files.clear();
    files.forEach(file => {
      this.files.set(file.id, file);
    });
  }
  
  async mergePDFs(fileIds: string[]): Promise<ArrayBuffer> {
    if (fileIds.length < 2) {
      throw new Error('At least 2 PDFs are required for merging');
    }
    
    // Create a new PDF document
    const mergedPdf = await PDFDocument.create();
    
    // Process each PDF file in order
    for (const id of fileIds) {
      const file = this.files.get(id);
      if (!file) {
        throw new Error(`File with ID ${id} not found`);
      }
      
      // Load the PDF document
      const pdfDoc = await PDFDocument.load(file.data);
      
      // Copy all pages from the source document to the merged document
      const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
      copiedPages.forEach(page => {
        mergedPdf.addPage(page);
      });
    }
    
    // Save the merged PDF as Uint8Array
    const mergedPdfBytes = await mergedPdf.save();
    
    // Convert to ArrayBuffer
    return mergedPdfBytes.buffer;
  }
}

// Create and export a singleton instance
export const pdfService = new PDFService();