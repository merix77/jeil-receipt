import imageCompression from 'browser-image-compression';

export function compressReceiptImage(file) {
  return imageCompression(file, {
    maxSizeMB: 1.5,
    maxWidthOrHeight: 2000,
    useWebWorker: true,
  });
}
