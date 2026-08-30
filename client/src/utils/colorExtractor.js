/**
 * Canvas pixel sampling helper to extract dominant accent color & background aura from album cover art
 */
export function extractCoverPalette(imgUrl) {
  return new Promise((resolve) => {
    if (!imgUrl) {
      resolve({
        accentHex: '#38bdf8',
        bgGradient: 'radial-gradient(circle at 50% 25%, rgba(56, 189, 248, 0.25) 0%, rgba(10, 14, 23, 0.98) 75%)',
        glowRgb: '56, 189, 248'
      });
      return;
    }

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imgUrl;

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 64;
        canvas.height = 64;

        ctx.drawImage(img, 0, 0, 64, 64);
        const imgData = ctx.getImageData(0, 0, 64, 64).data;

        let rSum = 0, gSum = 0, bSum = 0, count = 0;
        let maxSaturation = -1;
        let dominantR = 56, dominantG = 189, dominantB = 248;

        for (let i = 0; i < imgData.length; i += 16) {
          const r = imgData[i];
          const g = imgData[i + 1];
          const b = imgData[i + 2];
          const a = imgData[i + 3];

          if (a < 128) continue; // Skip transparent pixels

          // Filter out near-black or near-white for vibrant accent color
          const maxVal = Math.max(r, g, b);
          const minVal = Math.min(r, g, b);
          const saturation = maxVal > 0 ? (maxVal - minVal) / maxVal : 0;
          const brightness = (r + g + b) / 3;

          rSum += r;
          gSum += g;
          bSum += b;
          count++;

          if (saturation > maxSaturation && brightness > 40 && brightness < 220) {
            maxSaturation = saturation;
            dominantR = r;
            dominantG = g;
            dominantB = b;
          }
        }

        if (count > 0 && maxSaturation === -1) {
          dominantR = Math.round(rSum / count);
          dominantG = Math.round(gSum / count);
          dominantB = Math.round(bSum / count);
        }

        // Boost saturation slightly for vibrant glow
        const accentHex = `#${((1 << 24) + (dominantR << 16) + (dominantG << 8) + dominantB).toString(16).slice(1)}`;
        const bgGradient = `radial-gradient(circle at 50% 25%, rgba(${dominantR}, ${dominantG}, ${dominantB}, 0.35) 0%, rgba(10, 14, 23, 0.98) 75%)`;
        const glowRgb = `${dominantR}, ${dominantG}, ${dominantB}`;

        resolve({ accentHex, bgGradient, glowRgb });
      } catch (e) {
        resolve({
          accentHex: '#38bdf8',
          bgGradient: 'radial-gradient(circle at 50% 25%, rgba(56, 189, 248, 0.25) 0%, rgba(10, 14, 23, 0.98) 75%)',
          glowRgb: '56, 189, 248'
        });
      }
    };

    img.onerror = () => {
      resolve({
        accentHex: '#38bdf8',
        bgGradient: 'radial-gradient(circle at 50% 25%, rgba(56, 189, 248, 0.25) 0%, rgba(10, 14, 23, 0.98) 75%)',
        glowRgb: '56, 189, 248'
      });
    };
  });
}
