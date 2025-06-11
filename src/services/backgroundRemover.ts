/**
 * Background Removal Utility
 * Automatically removes white/light backgrounds from signature images
 */

export interface BackgroundRemovalOptions {
  threshold?: number; // Color similarity threshold (0-255)
  tolerance?: number; // Alpha blending tolerance
  edgeSmoothing?: boolean; // Apply edge smoothing
}

export class BackgroundRemover {
  private static readonly DEFAULT_OPTIONS: Required<BackgroundRemovalOptions> = {
    threshold: 240, // Consider colors above this value as "white-ish"
    tolerance: 10, // Tolerance for color matching
    edgeSmoothing: true
  };

  /**
   * Removes white/light background from an image
   * @param imageFile The image file to process
   * @param options Background removal options
   * @returns Promise<string> Data URL of the processed image
   */
  static async removeBackground(
    imageFile: File, 
    options: BackgroundRemovalOptions = {}
  ): Promise<string> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Unable to get canvas context'));
            return;
          }

          canvas.width = img.width;
          canvas.height = img.height;
          
          // Draw the original image
          ctx.drawImage(img, 0, 0);
          
          // Get image data
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          
          // Process each pixel
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];
            
            // Skip if already transparent
            if (a === 0) continue;
            
            // Calculate if this pixel should be considered "background"
            const isBackground = this.isBackgroundPixel(r, g, b, opts);
            
            if (isBackground) {
              // Make pixel transparent
              data[i + 3] = 0;
            } else if (opts.edgeSmoothing) {
              // Apply edge smoothing for semi-transparent edges
              const edgeAlpha = this.calculateEdgeAlpha(r, g, b, opts);
              data[i + 3] = Math.min(a, edgeAlpha);
            }
          }
          
          // Put the modified data back
          ctx.putImageData(imageData, 0, 0);
          
          // Convert to data URL
          const dataUrl = canvas.toDataURL('image/png');
          resolve(dataUrl);
          
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      
      // Load the image
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      reader.readAsDataURL(imageFile);
    });
  }

  /**
   * Determines if a pixel should be considered background based on color values
   */
  private static isBackgroundPixel(
    r: number, 
    g: number, 
    b: number, 
    options: Required<BackgroundRemovalOptions>
  ): boolean {
    const { threshold, tolerance } = options;
    
    // Check if it's close to white
    const brightness = (r + g + b) / 3;
    const isWhiteish = brightness > threshold;
    
    // Check if colors are similar (not much variation = likely background)
    const colorVariation = Math.max(
      Math.abs(r - g),
      Math.abs(g - b),
      Math.abs(r - b)
    );
    const hasLowVariation = colorVariation < tolerance;
    
    // Consider it background if it's bright and has low color variation
    return isWhiteish && hasLowVariation;
  }

  /**
   * Calculates alpha value for edge smoothing
   */
  private static calculateEdgeAlpha(
    r: number, 
    g: number, 
    b: number, 
    options: Required<BackgroundRemovalOptions>
  ): number {
    const { threshold } = options;
    const brightness = (r + g + b) / 3;
    
    if (brightness < (threshold - 50)) {
      return 255; // Fully opaque for dark colors
    } else if (brightness > threshold) {
      return 0; // Fully transparent for light colors
    } else {
      // Gradual transparency for edge colors
      const ratio = (threshold - brightness) / 50;
      return Math.floor(255 * ratio);
    }
  }

  /**
   * Processes an image URL and returns a new URL with background removed
   * @param imageUrl The image URL to process
   * @param options Background removal options
   * @returns Promise<string> Data URL of the processed image
   */
  static async removeBackgroundFromUrl(
    imageUrl: string, 
    options: BackgroundRemovalOptions = {}
  ): Promise<string> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Unable to get canvas context'));
            return;
          }

          canvas.width = img.width;
          canvas.height = img.height;
          
          // Draw the original image
          ctx.drawImage(img, 0, 0);
          
          // Get image data
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          
          // Process each pixel
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];
            
            // Skip if already transparent
            if (a === 0) continue;
            
            // Calculate if this pixel should be considered "background"
            const isBackground = this.isBackgroundPixel(r, g, b, opts);
            
            if (isBackground) {
              // Make pixel transparent
              data[i + 3] = 0;
            } else if (opts.edgeSmoothing) {
              // Apply edge smoothing for semi-transparent edges
              const edgeAlpha = this.calculateEdgeAlpha(r, g, b, opts);
              data[i + 3] = Math.min(a, edgeAlpha);
            }
          }
          
          // Put the modified data back
          ctx.putImageData(imageData, 0, 0);
          
          // Convert to data URL
          const dataUrl = canvas.toDataURL('image/png');
          resolve(dataUrl);
          
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      
      img.src = imageUrl;
    });
  }

  /**
   * Batch process multiple images
   * @param imageFiles Array of image files to process
   * @param options Background removal options
   * @returns Promise<string[]> Array of processed image data URLs
   */
  static async removeBackgroundBatch(
    imageFiles: File[], 
    options: BackgroundRemovalOptions = {}
  ): Promise<string[]> {
    const promises = imageFiles.map(file => this.removeBackground(file, options));
    return Promise.all(promises);
  }
}