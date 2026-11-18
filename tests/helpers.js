const sharp = require('sharp');

const base = (w = 16, h = 16) =>
  sharp({ create: { width: w, height: h, channels: 3, background: { r: 200, g: 30, b: 30 } } });

module.exports = {
  realJpeg: (w, h) => base(w, h).jpeg().toBuffer(),
  realPng: (w, h) => base(w, h).png().toBuffer(),
  realWebp: (w, h) => base(w, h).webp().toBuffer(),
  // A JPEG carrying a recognisable EXIF string, to prove we strip it
  jpegWithExif: () =>
    base().jpeg()
      .withMetadata({ exif: { IFD0: { ImageDescription: 'SECRET-LOCATION' } } })
      .toBuffer(),
};