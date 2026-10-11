import { z } from 'zod'

// -----------------------------------------------------------
// Booking form validation
// -----------------------------------------------------------
export const createBookingSchema = z
  .object({
    costume_id: z.string().uuid('Sản phẩm không hợp lệ'),
    start_date: z.string().min(1, 'Vui lòng chọn ngày nhận'),
    end_date: z.string().min(1, 'Vui lòng chọn ngày trả'),
    shipping_method: z.enum(['self_pickup', 'shop_delivery', 'third_party_courier'], {
      error: 'Vui lòng chọn phương thức vận chuyển',
    }),
    shipping_address: z.string().optional(),
  })
  .refine(
    (data) => {
      const start = new Date(data.start_date)
      const end = new Date(data.end_date)
      return end > start
    },
    { message: 'Ngày trả phải sau ngày nhận', path: ['end_date'] }
  )
  .refine(
    (data) => {
      const start = new Date(data.start_date)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      return start >= today
    },
    { message: 'Ngày nhận không thể ở quá khứ', path: ['start_date'] }
  )
  .refine(
    (data) => {
      if (data.shipping_method !== 'self_pickup' && !data.shipping_address) {
        return false
      }
      return true
    },
    { message: 'Vui lòng nhập địa chỉ giao hàng', path: ['shipping_address'] }
  )

// -----------------------------------------------------------
// KYC upload validation
// -----------------------------------------------------------
export const kycUploadSchema = z.object({
  full_name: z.string().min(2, 'Họ tên phải có ít nhất 2 ký tự'),
  phone: z
    .string()
    .regex(/^(0|\+84)[0-9]{9}$/, 'Số điện thoại không hợp lệ'),
  cccd_image_url: z.string().min(1, 'Vui lòng upload ảnh CCCD/Passport'),
})

import { PASSWORD_MIN_LENGTH } from './password'

// -----------------------------------------------------------
// Password security validation schema
// -----------------------------------------------------------
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Mật khẩu phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự`)
  .regex(/[A-Z]/, 'Mật khẩu phải chứa ít nhất 1 chữ cái in hoa (A-Z)')
  .regex(/[a-z]/, 'Mật khẩu phải chứa ít nhất 1 chữ cái in thường (a-z)')
  .regex(/[0-9]/, 'Mật khẩu phải chứa ít nhất 1 chữ số (0-9)')

// -----------------------------------------------------------
// Auth forms
// -----------------------------------------------------------
export const loginSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
})

export const registerSchema = z
  .object({
    email: z.string().email('Email không hợp lệ'),
    password: passwordSchema,
    confirmPassword: z.string(),
    full_name: z.string().min(2, 'Họ tên phải có ít nhất 2 ký tự'),
    phone: z.string().regex(/^(0|\+84)[0-9]{9}$/, 'Số điện thoại không hợp lệ'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  })

// -----------------------------------------------------------
// Admin: costume management
// -----------------------------------------------------------
export const costumeSchema = z.object({
  name: z.string().min(1, 'Tên trang phục là bắt buộc'),
  series: z.string().min(1, 'Series là bắt buộc'),
  character: z.string().min(1, 'Tên nhân vật là bắt buộc'),
  brand: z.string().optional(),
  description: z.string().optional(),
  rent_price_per_day: z.number().positive('Giá thuê test phải lớn hơn 0'),
  rent_price_fes: z.number().positive('Giá thuê fes phải lớn hơn 0').optional(),
  deposit_price: z.number().positive('Tiền cọc phải lớn hơn 0'),
  quantity: z.number().int().min(1, 'Số lượng phải ít nhất 1').default(1),
  buffer_days: z.number().int().min(0).default(1),
  late_fee_multiplier: z.number().min(1).default(1.5),
  weight_kg: z.number().positive().optional(),
})

export type CreateBookingInput = z.infer<typeof createBookingSchema>
export type KycUploadInput = z.infer<typeof kycUploadSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type CostumeInput = z.infer<typeof costumeSchema>
