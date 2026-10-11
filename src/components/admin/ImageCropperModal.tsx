'use client'

import React, { useState, useCallback } from 'react'
import Cropper, { Area } from 'react-easy-crop'

interface ImageCropperModalProps {
  imageSrc: string
  aspectRatio?: number
  onComplete: (croppedAreaPixels: Area) => void
  onCancel: () => void
}

export function ImageCropperModal({
  imageSrc,
  aspectRatio = 3 / 4,
  onComplete,
  onCancel,
}: ImageCropperModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)

  const onCropChange = (newCrop: { x: number; y: number }) => {
    setCrop(newCrop)
  }

  const onZoomChange = (newZoom: number) => {
    setZoom(newZoom)
  }

  const onCropCompleteCallback = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels)
  }, [])

  const handleConfirm = () => {
    if (croppedAreaPixels) {
      onComplete(croppedAreaPixels)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onCancel}
    >
      <div
        className="bg-zinc-900 border-2 border-zinc-700 rounded-lg max-w-lg w-full flex flex-col overflow-hidden shadow-2xl h-[560px] max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/70">
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <span>✂️ Cắt chỉnh ảnh trang phục</span>
            </h3>
            <p className="text-[11px] text-zinc-400 font-semibold mt-0.5">
              Kéo di chuyển hoặc phóng to/thu nhỏ để căn chuẩn khung hình 3:4
            </p>
          </div>
          <button
            onClick={onCancel}
            className="w-7 h-7 rounded bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center font-black"
          >
            ✕
          </button>
        </div>

        {/* Cropper Viewport */}
        <div className="relative flex-1 bg-black">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspectRatio}
            onCropChange={onCropChange}
            onZoomChange={onZoomChange}
            onCropComplete={onCropCompleteCallback}
            classes={{
              containerClassName: 'relative w-full h-full',
            }}
          />
        </div>

        {/* Controls & Footer */}
        <div className="p-4 bg-zinc-950/90 border-t border-zinc-800 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-zinc-400">🔍 Thu phóng:</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-purple-600 cursor-pointer h-1.5 bg-zinc-700 rounded-lg"
            />
            <span className="text-xs font-mono font-bold text-zinc-300 w-10 text-right">
              {zoom.toFixed(1)}x
            </span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="py-2 px-4 rounded border border-zinc-700 hover:bg-zinc-800 text-zinc-300 font-black text-xs transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="py-2 px-5 rounded bg-purple-600 hover:bg-purple-700 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-purple-600/30 transition-all flex items-center gap-1.5"
            >
              <span>✓ Lưu ảnh đã cắt</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
