'use client'

import React, { useState, useMemo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import type { Costume } from '@/types/database'
import { ProductCard } from '@/components/products/ProductCard'

const ProductQuickModal = dynamic(
  () => import('@/components/products/ProductQuickModal').then((m) => m.ProductQuickModal),
  { ssr: false }
)

interface CatalogClientProps {
  costumes: Costume[]
  seriesList: string[]
}

export function CatalogClient({ costumes, seriesList }: CatalogClientProps) {
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCostume, setActiveCostume] = useState<Costume | null>(null)

  // Build search index once
  const searchableList = useMemo(
    () =>
      costumes.map((c) => ({
        costume: c,
        searchText: `${c.character} ${c.series} ${c.name}`.toLocaleLowerCase('vi'),
      })),
    [costumes]
  )


  // Đếm số lượng trang phục cho từng series
  const seriesCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    costumes.forEach((c) => {
      counts[c.series] = (counts[c.series] || 0) + 1
    })
    return counts
  }, [costumes])

  // Lấy top series có nhiều trang phục nhất (hot nhất)
  const hotSeries = useMemo(() => {
    return [...seriesList]
      .sort((a, b) => (seriesCounts[b] || 0) - (seriesCounts[a] || 0))
      .slice(0, 5)
  }, [seriesList, seriesCounts])

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [modalSearch, setModalSearch] = useState('')

  const modalFilteredSeries = useMemo(() => {
    if (!modalSearch.trim()) return seriesList
    const q = modalSearch.toLowerCase()
    return seriesList.filter((s) => s.toLowerCase().includes(q))
  }, [seriesList, modalSearch])

  // Check xem category hiện tại có nằm ngoài top hot không
  const isSelectedOutOfTop = selectedCategory !== 'all' && !hotSeries.includes(selectedCategory)

  const normalizedQuery = searchQuery.trim().toLocaleLowerCase('vi')

  const filtered = useMemo(
    () =>
      searchableList
        .filter(({ costume, searchText }) => {
          const matchCat = selectedCategory === 'all' || costume.series === selectedCategory
          return matchCat && (!normalizedQuery || searchText.includes(normalizedQuery))
        })
        .map(({ costume }) => costume),
    [searchableList, selectedCategory, normalizedQuery]
  )

  const selectCostume = useCallback((c: Costume) => setActiveCostume(c), [])
  const closeBooking = useCallback(() => setActiveCostume(null), [])

  return (
    <>

      {/* Search Bar */}
      <section className="space-y-3">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-pink-400">
            🔍
          </span>
          <input
            id="search-input"
            type="text"
            placeholder="Tìm kiếm nhân vật, anime, game (ví dụ: Raiden, Frieren, Hu Tao, Kimetsu)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white dark:bg-[#1f1a27] border-2 border-rose-200 dark:border-pink-900/60 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-300/40 shadow-sm font-semibold transition-all"
          />
        </div>

        {/* Category Filter Chips & View All Popup Button */}
        <div className="flex items-center gap-2">
          {/* Scrollable chip container with hidden scrollbar */}
          <div className="flex-1 flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
            {/* Tất cả */}
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-black whitespace-nowrap transition-all shrink-0 ${
                selectedCategory === 'all'
                  ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-md shadow-pink-500/25 scale-105'
                  : 'bg-white dark:bg-[#1f1a27] text-zinc-700 dark:text-zinc-300 border-2 border-rose-200/90 dark:border-pink-900/50 hover:border-pink-400 hover:text-pink-600'
              }`}
            >
              🌸 Tất cả
            </button>

            {/* Hot Series Chips */}
            {hotSeries.map((series) => (
              <button
                key={series}
                onClick={() => setSelectedCategory(series)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-black whitespace-nowrap transition-all shrink-0 ${
                  selectedCategory === series
                    ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-md shadow-pink-500/25 scale-105'
                    : 'bg-white dark:bg-[#1f1a27] text-zinc-700 dark:text-zinc-300 border-2 border-rose-200/90 dark:border-pink-900/50 hover:border-pink-400 hover:text-pink-600'
                }`}
              >
                🔥 {series}
                {seriesCounts[series] ? (
                  <span className="ml-1 text-[10px] opacity-75">({seriesCounts[series]})</span>
                ) : null}
              </button>
            ))}

            {/* If currently selected series is not in top hot, show it explicitly */}
            {isSelectedOutOfTop && (
              <button
                onClick={() => setSelectedCategory(selectedCategory)}
                className="px-3.5 py-1.5 rounded-full text-xs font-black whitespace-nowrap bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-md shadow-pink-500/25 scale-105 shrink-0"
              >
                ✨ {selectedCategory}
              </button>
            )}
          </div>

          {/* Button to open Category Popup Modal */}
          <button
            onClick={() => {
              setModalSearch('')
              setIsCategoryModalOpen(true)
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black whitespace-nowrap shrink-0 bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 border-2 border-dashed border-pink-300 dark:border-pink-700/60 hover:bg-pink-100 hover:scale-105 transition-all shadow-xs"
            title="Xem tất cả danh mục"
          >
            <span>📂 Danh mục</span>
            <span className="bg-pink-200/80 dark:bg-pink-900/80 px-1.5 py-0.2 rounded-full text-[10px]">
              {seriesList.length}
            </span>
          </button>
        </div>
      </section>

      {/* Category Modal / Popup */}
      {isCategoryModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setIsCategoryModalOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-[#1f1a24] rounded-3xl border-2 border-rose-200 dark:border-pink-900/80 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-rose-100 dark:border-pink-900/40 flex items-center justify-between bg-gradient-to-r from-pink-50/60 to-purple-50/60 dark:from-pink-950/20 dark:to-purple-950/20">
              <div className="flex items-center gap-2">
                <span className="text-xl">🌸</span>
                <div>
                  <h3 className="font-serif font-black text-base sm:text-lg text-zinc-900 dark:text-zinc-100">
                    Chọn Danh Mục / Series
                  </h3>
                  <p className="text-[11px] text-zinc-500 font-semibold">
                    Tổng cộng {seriesList.length} bộ anime, game có sẵn
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="w-8 h-8 rounded-full bg-rose-100/70 dark:bg-pink-950 text-zinc-600 dark:text-zinc-300 hover:bg-rose-200 flex items-center justify-center font-black transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Quick Filter Search in Modal */}
            <div className="p-4 border-b border-rose-100 dark:border-pink-900/40 bg-zinc-50/50 dark:bg-zinc-900/30">
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-pink-400 text-xs">
                  🔍
                </span>
                <input
                  type="text"
                  placeholder="Tìm tên series anime / game..."
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-white dark:bg-[#141118] border border-rose-200 dark:border-pink-900/60 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-pink-500 font-semibold"
                />
              </div>
            </div>

            {/* Category Grid */}
            <div className="p-4 overflow-y-auto space-y-4 max-h-[55vh] scrollbar-none">
              {/* Tất cả option */}
              <div>
                <button
                  onClick={() => {
                    setSelectedCategory('all')
                    setIsCategoryModalOpen(false)
                  }}
                  className={`w-full text-left p-3 rounded-2xl flex items-center justify-between border-2 transition-all ${
                    selectedCategory === 'all'
                      ? 'border-pink-500 bg-pink-50 dark:bg-pink-950/40 shadow-xs'
                      : 'border-rose-100 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 hover:border-pink-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">🌸</span>
                    <span className="text-xs sm:text-sm font-black text-zinc-800 dark:text-zinc-200">
                      Tất cả trang phục
                    </span>
                  </div>
                  <span className="text-xs font-bold text-pink-500">
                    {costumes.length} bộ
                  </span>
                </button>
              </div>

              {/* Grid of Series */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  Danh sách Series ({modalFilteredSeries.length})
                </p>
                {modalFilteredSeries.length === 0 ? (
                  <div className="text-center py-6 text-xs text-zinc-400 font-medium">
                    Không tìm thấy series nào phù hợp với &quot;{modalSearch}&quot;
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {modalFilteredSeries.map((series) => {
                      const isSelected = selectedCategory === series
                      const isHot = hotSeries.includes(series)
                      const count = seriesCounts[series] || 0
                      return (
                        <button
                          key={series}
                          onClick={() => {
                            setSelectedCategory(series)
                            setIsCategoryModalOpen(false)
                          }}
                          className={`p-2.5 rounded-xl text-left border transition-all flex items-center justify-between group ${
                            isSelected
                              ? 'border-pink-500 bg-gradient-to-r from-pink-500/10 to-purple-500/10 dark:bg-pink-950/40 font-black shadow-xs'
                              : 'border-rose-100 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 hover:border-pink-300 hover:bg-pink-50/50 dark:hover:bg-zinc-800/50 font-semibold'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0 pr-2">
                            <span className="text-xs shrink-0">
                              {isHot ? '🔥' : '✨'}
                            </span>
                            <span className="text-xs text-zinc-800 dark:text-zinc-200 truncate group-hover:text-pink-600 transition-colors">
                              {series}
                            </span>
                          </div>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold shrink-0 ${
                              isSelected
                                ? 'bg-pink-500 text-white'
                                : 'bg-rose-100/60 dark:bg-zinc-800 text-zinc-500 group-hover:text-pink-500'
                            }`}
                          >
                            {count}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-rose-100 dark:border-pink-900/40 flex justify-end bg-zinc-50/50 dark:bg-zinc-900/30">
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-black bg-pink-500 hover:bg-pink-600 text-white shadow-md shadow-pink-500/20 transition-all"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Grid */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-lg sm:text-xl font-black text-zinc-900 dark:text-zinc-100">
            Trang phục sẵn sàng thuê ({filtered.length})
          </h2>
          <span className="text-xs text-zinc-500 font-semibold">Bấm để chọn ngày & xem giá</span>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded border-2 border-zinc-200 dark:border-zinc-800">
            <span className="text-4xl block mb-2">🔍</span>
            <p className="text-sm font-black text-zinc-700 dark:text-zinc-300">
              Không tìm thấy trang phục phù hợp
            </p>
            <p className="text-xs text-zinc-500 mt-1 font-semibold">
              Hãy thử tìm kiếm với từ khóa khác hoặc xóa bộ lọc series.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-5">
            {filtered.map((costume) => (
              <ProductCard key={costume.id} costume={costume} onSelect={selectCostume} />
            ))}
          </div>
        )}
      </section>

      {/* Quick View Modal */}
      {activeCostume && (
        <ProductQuickModal
          costume={activeCostume}
          onClose={closeBooking}
        />
      )}
    </>
  )
}
