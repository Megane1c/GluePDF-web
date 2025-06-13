// signatureColorChanger.ts

export interface ColorChangeOptions {
  preserveAlpha?: boolean;
  targetColor?: string;
  threshold?: number;
}

export class SignatureColorChanger {
  /**
   * Changes the color of a signature image while preserving transparency
   * @param imageUrl - The URL of the signature image
   * @param newColor - The target color (hex format like #000000)
   * @param options - Additional options for color processing
   * @returns Promise<string> - Data URL of the recolored image
   */
  static async changeSignatureColor(
    imageUrl: string, 
    newColor: string, 
    options: ColorChangeOptions = {}
  ): Promise<string> {
    const { 
      preserveAlpha = true, 
      threshold = 50 
    } = options;

    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          canvas.width = img.width;
          canvas.height = img.height;

          // Draw the original image
          ctx.drawImage(img, 0, 0);
          
          // Get image data
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;

          // Convert hex color to RGB
          const targetRGB = SignatureColorChanger.hexToRgb(newColor);
          
          if (!targetRGB) {
            reject(new Error('Invalid color format'));
            return;
          }

          // Process each pixel
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            // Skip transparent pixels
            if (a === 0) continue;

            // Check if pixel is dark enough to be part of signature
            // (this helps preserve anti-aliasing and smooth edges)
            const brightness = (r + g + b) / 3;
            
            if (brightness < 255 - threshold) {
              // Replace with target color while preserving alpha
              data[i] = targetRGB.r;     // Red
              data[i + 1] = targetRGB.g; // Green  
              data[i + 2] = targetRGB.b; // Blue
              
              if (preserveAlpha) {
                // Keep original alpha for smooth edges
                data[i + 3] = a;
              } else {
                // Make opaque
                data[i + 3] = 255;
              }
            }
          }

          // Put the modified image data back
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
   * Converts hex color to RGB object
   * @param hex - Hex color string (e.g., "#FF0000" or "FF0000")
   * @returns RGB object or null if invalid
   */
  private static hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    // Remove # if present
    hex = hex.replace('#', '');
    
    // Validate hex format
    if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
      return null;
    }

    return {
      r: parseInt(hex.substring(0, 2), 16),
      g: parseInt(hex.substring(2, 4), 16),
      b: parseInt(hex.substring(4, 6), 16)
    };
  }

  /**
   * Predefined signature colors
   */
  static readonly SIGNATURE_COLORS = {
    BLACK: '#000000',
    BLUE: '#0066CC',
    DARK_BLUE: '#003399',
    RED: '#CC0000',
    DARK_RED: '#990000',
    GREEN: '#006600',
    PURPLE: '#660099'
  } as const;

  /**
   * Get color options for UI display
   */
  static getColorOptions() {
    return [
      { name: 'Black', value: SignatureColorChanger.SIGNATURE_COLORS.BLACK, icon: '⚫' },
      { name: 'Blue', value: SignatureColorChanger.SIGNATURE_COLORS.BLUE, icon: '🔵' },
      { name: 'Dark Blue', value: SignatureColorChanger.SIGNATURE_COLORS.DARK_BLUE, icon: '🔵' },
      { name: 'Red', value: SignatureColorChanger.SIGNATURE_COLORS.RED, icon: '🔴' },
      { name: 'Dark Red', value: SignatureColorChanger.SIGNATURE_COLORS.DARK_RED, icon: '🔴' },
      { name: 'Green', value: SignatureColorChanger.SIGNATURE_COLORS.GREEN, icon: '🟢' },
      { name: 'Purple', value: SignatureColorChanger.SIGNATURE_COLORS.PURPLE, icon: '🟣' }
    ];
  }
}