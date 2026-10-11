import { create } from 'zustand'
import { Costume, ShippingMethod } from '@/types/database'

export interface CartItem {
  costume: Costume
  startDate: string
  endDate: string
  rentalDays: number
  rentalType?: 'test' | 'fes'
  totalRentFee: number
  depositFee: number
  shippingMethod: ShippingMethod
  shippingFee: number
}

interface CartState {
  currentUserId: string | null
  items: CartItem[]
  setCurrentUser: (userId: string | null, opts?: { resetGuestCart?: boolean }) => void
  clearGuestCart: () => void
  addItem: (item: CartItem) => void
  updateItem: (costumeId: string, partial: Partial<CartItem>) => void
  removeItem: (costumeId: string) => void
  clearCart: () => void
  getTotalRent: () => number
  getTotalDeposit: () => number
  getTotalAmount: () => number
}

const GUEST_STORAGE_KEY = 'cosplay-cart-storage-guest'
const getUserStorageKey = (userId: string) => `cosplay-cart-storage-${userId}`

const loadItemsFromStorage = (userId: string | null): CartItem[] => {
  if (typeof window === 'undefined') return []
  try {
    // Với Guest: chỉ lưu trong sessionStorage để tự động reset theo phiên
    // Với User đã đăng nhập: lưu vĩnh viễn trong localStorage
    const raw = userId
      ? localStorage.getItem(getUserStorageKey(userId))
      : sessionStorage.getItem(GUEST_STORAGE_KEY)

    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed?.items) ? parsed.items : []
  } catch {
    return []
  }
}

const saveItemsToStorage = (userId: string | null, items: CartItem[]) => {
  if (typeof window === 'undefined') return
  try {
    if (userId) {
      localStorage.setItem(getUserStorageKey(userId), JSON.stringify({ items }))
    } else {
      sessionStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify({ items }))
    }
  } catch (err) {
    console.error('Failed to save cart to storage:', err)
  }
}

export const useCartStore = create<CartState>()((set, get) => ({
  currentUserId: null,
  items: [],
  setCurrentUser: (userId: string | null, opts?: { resetGuestCart?: boolean }) => {
    if (opts?.resetGuestCart) {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(GUEST_STORAGE_KEY)
        localStorage.removeItem(GUEST_STORAGE_KEY)
      }
      set({ currentUserId: null, items: [] })
      return
    }

    // Nếu chuyển đổi tài khoản, load lại danh sách item tương ứng của tài khoản đó
    const loadedItems = loadItemsFromStorage(userId)
    set({ currentUserId: userId, items: loadedItems })
  },
  clearGuestCart: () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(GUEST_STORAGE_KEY)
      localStorage.removeItem(GUEST_STORAGE_KEY)
    }
    if (!get().currentUserId) {
      set({ items: [] })
    }
  },
  addItem: (item) => {
    set((state) => {
      const existing = state.items.filter((i) => i.costume.id !== item.costume.id)
      const newItems = [...existing, item]
      saveItemsToStorage(state.currentUserId, newItems)
      return { items: newItems }
    })
  },
  updateItem: (costumeId, partial) => {
    set((state) => {
      const newItems = state.items.map((i) =>
        i.costume.id === costumeId ? { ...i, ...partial } : i
      )
      saveItemsToStorage(state.currentUserId, newItems)
      return { items: newItems }
    })
  },
  removeItem: (costumeId) => {
    set((state) => {
      const newItems = state.items.filter((i) => i.costume.id !== costumeId)
      saveItemsToStorage(state.currentUserId, newItems)
      return { items: newItems }
    })
  },
  clearCart: () => {
    set((state) => {
      saveItemsToStorage(state.currentUserId, [])
      return { items: [] }
    })
  },
  getTotalRent: () => {
    return get().items.reduce((sum, item) => sum + item.totalRentFee, 0)
  },
  getTotalDeposit: () => {
    return get().items.reduce((sum, item) => sum + item.depositFee, 0)
  },
  getTotalAmount: () => {
    return get().items.reduce(
      (sum, item) => sum + item.totalRentFee + item.depositFee + item.shippingFee,
      0
    )
  },
}))
