import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

/**
 * VNPay IPN webhook handler
 * Luôn verify HMAC signature trước khi xử lý (ANTI-PATTERN nếu bỏ qua)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { vnp_SecureHash, ...params } = body

    // 1. Verify HMAC signature
    const isValid = verifyVNPaySignature(params, vnp_SecureHash)
    if (!isValid) {
      return NextResponse.json(
        { RspCode: '97', Message: 'Invalid signature' },
        { status: 400 }
      )
    }

    const transactionStatus = params.vnp_TransactionStatus
    const bookingId = params.vnp_OrderInfo // booking UUID passed as order info
    const responseCode = params.vnp_ResponseCode

    if (responseCode === '00' && transactionStatus === '00') {
      // Payment success — cần import createClient ở đây khi implement thực tế
      // const supabase = createServiceClient()
      // await supabase.from('bookings').update({ payment_status: 'deposit_paid' }).eq('id', bookingId)
      console.log(`Payment success for booking: ${bookingId}`)
    }

    // VNPay requires this response format
    return NextResponse.json({ RspCode: '00', Message: 'Confirm Success' })
  } catch (error) {
    console.error('VNPay webhook error:', error)
    return NextResponse.json(
      { RspCode: '99', Message: 'Unknown error' },
      { status: 500 }
    )
  }
}

function verifyVNPaySignature(
  params: Record<string, string>,
  receivedHash: string
): boolean {
  const secretKey = process.env.VNPAY_HASH_SECRET!

  // Sort params alphabetically and build query string
  const sortedKeys = Object.keys(params).sort()
  const signData = sortedKeys
    .filter((key) => params[key] !== '' && params[key] !== undefined)
    .map((key) => `${key}=${params[key]}`)
    .join('&')

  const hmac = crypto.createHmac('sha512', secretKey)
  const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex')

  return signed === receivedHash
}
