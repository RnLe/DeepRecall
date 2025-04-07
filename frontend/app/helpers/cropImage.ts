// cropImage.ts
// This function crops an image from a file or URL and returns it as a File object.

export default function getCroppedImg(
    fileOrUrl: File | string,
    pixelCrop: { x: number; y: number; width: number; height: number }
  ): Promise<File> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      // If the source is a URL, set crossOrigin to avoid tainting the canvas.
      if (!(fileOrUrl instanceof File)) {
        image.crossOrigin = "anonymous";
      }
      if (fileOrUrl instanceof File) {
        image.src = URL.createObjectURL(fileOrUrl);
      } else {
        image.src = fileOrUrl;
      }
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = pixelCrop.width;
        canvas.height = pixelCrop.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Canvas context not available'));
        }
        ctx.drawImage(
          image,
          pixelCrop.x,
          pixelCrop.y,
          pixelCrop.width,
          pixelCrop.height,
          0,
          0,
          pixelCrop.width,
          pixelCrop.height
        );
        canvas.toBlob((blob) => {
          if (!blob) {
            return reject(new Error('Canvas is empty.'));
          }
          const croppedFile = new File(
            [blob],
            typeof fileOrUrl === 'string' ? 'cropped.png' : (fileOrUrl as File).name,
            { type: blob.type }
          );
          resolve(croppedFile);
        }, typeof fileOrUrl === 'string' ? 'image/png' : (fileOrUrl as File).type);
      };
      image.onerror = () => {
        reject(new Error('Failed to load image'));
      };
    });
  }
