export interface PixelCrop {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Creates an image element from a URL or object URL
 */
const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    image.setAttribute('crossOrigin', 'anonymous')
    image.src = url
  })

/**
 * Returns a Blob representing the cropped area of an image
 */
export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: PixelCrop,
  outputType: string = 'image/webp',
  quality: number = 0.92
): Promise<Blob> {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('Canvas 2D context is not available')
  }

  canvas.width = Math.round(pixelCrop.width)
  canvas.height = Math.round(pixelCrop.height)

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
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to generate image blob from canvas'))
          return
        }
        resolve(blob)
      },
      outputType,
      quality
    )
  })
}
