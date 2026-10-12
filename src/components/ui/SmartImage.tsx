'use client'

import React, { useState } from 'react'
import Image, { ImageProps } from 'next/image'

interface SmartImageProps extends Omit<ImageProps, 'onError'> {
  fallbackSrc?: string
}

const DEFAULT_FALLBACK =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23fce7f3"/><stop offset="100%" stop-color="%23fbcfe8"/></linearGradient></defs><rect width="600" height="800" fill="url(%23g)"/><text x="50%" y="48%" font-family="sans-serif" font-size="64" text-anchor="middle" fill="%23ec4899">🌸</text><text x="50%" y="54%" font-family="sans-serif" font-weight="bold" font-size="22" text-anchor="middle" fill="%23db2777">CosRent Studio</text><text x="50%" y="58%" font-family="sans-serif" font-size="14" text-anchor="middle" fill="%239d174d">Hình ảnh đang cập nhật</text></svg>'

export const SmartImage = React.forwardRef<HTMLImageElement, SmartImageProps>(
  function SmartImage({ src, alt, fallbackSrc = DEFAULT_FALLBACK, className, ...props }, ref) {
    const [imgSrc, setImgSrc] = useState<string | import('next/dist/shared/lib/get-img-props').StaticImport>(src || fallbackSrc)
    const [hasError, setHasError] = useState(false)

    return (
      <Image
        ref={ref}
        src={hasError ? fallbackSrc : imgSrc}
        alt={alt || 'CosRent image'}
        className={className}
        onError={() => {
          if (!hasError) {
            setHasError(true)
            setImgSrc(fallbackSrc)
          }
        }}
        {...props}
      />
    )
  }
)
