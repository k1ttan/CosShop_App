/**
 * Tiện ích nén ảnh phía Client (Client-side Image Compression)
 * Tự động chuyển đổi sang chuẩn WebP, giới hạn cạnh dài 1920px, chất lượng 82%.
 * Giảm > 80% dung lượng tệp nhưng vẫn giữ nguyên độ sắc nét chi tiết trang phục cosplay.
 */

export interface CompressionOptions {
  maxDimension?: number // Mặc định 1920px
  quality?: number      // Mặc định 0.82
}

/**
 * Nén file hình ảnh thành WebP Blob
 */
export async function compressImageToWebP(
  file: File,
  options: CompressionOptions = {}
): Promise<Blob> {
  const { maxDimension = 1920, quality = 0.82 } = options

  // Nếu file không phải ảnh, trả về nguyên bản
  if (!file.type.startsWith('image/')) {
    return file
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Không thể đọc tệp hình ảnh'))

    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Lỗi tải hình ảnh vào bộ nhớ'))

      img.onload = () => {
        try {
          let { width, height } = img

          // Tính toán tỉ lệ co giãn nếu kích thước vượt quá maxDimension
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width)
              width = maxDimension
            } else {
              width = Math.round((width * maxDimension) / height)
              height = maxDimension
            }
          }

          // Vẽ lên canvas HTML5
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height

          const ctx = canvas.getContext('2d')
          if (!ctx) {
            return resolve(file) // Fallback nếu không lấy được context
          }

          // Làm mịn ảnh khi scale down
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'
          ctx.drawImage(img, 0, 0, width, height)

          // Xuất sang định dạng WebP
          canvas.toBlob(
            (blob) => {
              if (blob) {
                // Tạo tên file mới có đuôi .webp
                resolve(blob)
              } else {
                resolve(file) // Fallback nếu trình duyệt không hỗ trợ toBlob
              }
            },
            'image/webp',
            quality
          )
        } catch (err) {
          reject(err)
        }
      }

      img.src = reader.result as string
    }

    reader.readAsDataURL(file)
  })
}

/**
 * Định dạng dung lượng tệp thân thiện cho người dùng (Bytes -> KB / MB)
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}
