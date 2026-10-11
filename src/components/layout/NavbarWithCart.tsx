'use client'

import React, { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Navbar } from '@/components/layout/Navbar'

const CartDrawer = dynamic(
  () => import('@/components/booking/CartDrawer').then((m) => m.CartDrawer),
  { ssr: false }
)

/**
 * Wrapper client component giữ trạng thái giỏ hàng và drawer
 * để homepage có thể là Server Component
 */
export function NavbarWithCart() {
  const [isCartOpen, setIsCartOpen] = useState(false)
  const openCart = useCallback(() => setIsCartOpen(true), [])
  const closeCart = useCallback(() => setIsCartOpen(false), [])

  return (
    <>
      <Navbar onOpenCart={openCart} />
      {isCartOpen && <CartDrawer isOpen onClose={closeCart} />}
    </>
  )
}
