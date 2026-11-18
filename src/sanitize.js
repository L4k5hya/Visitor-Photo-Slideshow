const sharp = require('sharp');

const MAX_SIDE = 1920;
const MAX_INPUT_PIXELS = 50_000_000; // blocks decompression bombs

// Decodes and re-encodes the image. Throws if it is not a valid, readable image.
// sharp removes all metadata (EXIF/GPS) by default; rotate() applies orientation first.
async function sanitizeImage(buffer, type) {
  let img = sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS })
    .rotate()
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true });

  if (type.ext === 'jpg') img = img.jpeg({ quality: 85 });
  else if (type.ext === 'png') img = img.png();
  else img = img.webp({ quality: 85 });

  return img.toBuffer();
}

module.exports = { sanitizeImage };