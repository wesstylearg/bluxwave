/**
 * color.js - Subtle dynamic ambient color extractor from album art
 * Optimized with memory cache to avoid redundant canvas operations
 */

const colorCache = new Map();
const MAX_CACHE_SIZE = 80;

export const ColorExtractor = {
  getDominantColor(imageUrl) {
    return new Promise((resolve) => {
      if (!imageUrl) {
        return resolve('rgba(255, 255, 255, 0.08)');
      }

      // Return from cache if already extracted
      if (colorCache.has(imageUrl)) {
        return resolve(colorCache.get(imageUrl));
      }

      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.src = imageUrl;

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          const size = 24; // 24x24 is 44% lighter than 32x32 and equally accurate for dominant ambient tint
          canvas.width = size;
          canvas.height = size;

          ctx.drawImage(img, 0, 0, size, size);
          const imageData = ctx.getImageData(0, 0, size, size).data;

          let r = 0, g = 0, b = 0, count = 0;

          for (let i = 0; i < imageData.length; i += 4) {
            const red = imageData[i];
            const green = imageData[i + 1];
            const blue = imageData[i + 2];

            // Ignore extreme darks and extreme brights to capture rich musical tone
            const brightness = (red * 299 + green * 587 + blue * 114) / 1000;
            if (brightness > 35 && brightness < 220) {
              r += red;
              g += green;
              b += blue;
              count++;
            }
          }

          let colorResult;
          if (count > 0) {
            r = Math.round(r / count);
            g = Math.round(g / count);
            b = Math.round(b / count);
            colorResult = `rgba(${r}, ${g}, ${b}, 0.22)`;
          } else {
            colorResult = 'rgba(255, 255, 255, 0.08)';
          }

          // Store in cache
          if (colorCache.size >= MAX_CACHE_SIZE) {
            const firstKey = colorCache.keys().next().value;
            colorCache.delete(firstKey);
          }
          colorCache.set(imageUrl, colorResult);

          resolve(colorResult);
        } catch {
          // Fallback if canvas is tainted by CORS
          resolve('rgba(255, 255, 255, 0.08)');
        }
      };

      img.onerror = () => {
        resolve('rgba(255, 255, 255, 0.08)');
      };
    });
  },

  applyAmbientColor(color) {
    const glowEl = document.getElementById('ambient-glow');
    if (glowEl) {
      glowEl.style.background = `radial-gradient(circle at 50% 30%, ${color}, transparent 65%)`;
      glowEl.style.opacity = '0.35';
    }

    const focusGlowEl = document.getElementById('focus-ambient-glow');
    if (focusGlowEl) {
      focusGlowEl.style.background = `radial-gradient(circle at 50% 35%, ${color}, transparent 65%)`;
      focusGlowEl.style.opacity = '0.45';
    }
  },

  getDominantColorHex(imageUrl) {
    if (!imageUrl) return '#6366f1';
    const cached = colorCache.get(imageUrl);
    if (cached && typeof cached === 'string') {
      const match = cached.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        const r = parseInt(match[1], 10).toString(16).padStart(2, '0');
        const g = parseInt(match[2], 10).toString(16).padStart(2, '0');
        const b = parseInt(match[3], 10).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
      }
    }
    return '#6366f1';
  }
};
