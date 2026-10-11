export interface PasswordCriteria {
  minLength: boolean
  hasUpper: boolean
  hasLower: boolean
  hasNumber: boolean
  hasSpecial: boolean
}

export interface PasswordStrengthResult {
  score: number // 0 to 4
  levelLabel: string
  levelColor: string
  criteria: PasswordCriteria
  isValid: boolean
  errorMessage?: string
}

export const PASSWORD_MIN_LENGTH = 8

/**
 * Kiểm tra các tiêu chí mật khẩu theo quy chuẩn:
 * - Tối thiểu 8 ký tự
 * - Ít nhất 1 chữ in hoa (A-Z)
 * - Ít nhất 1 chữ in thường (a-z)
 * - Ít nhất 1 chữ số (0-9)
 */
export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  const criteria: PasswordCriteria = {
    minLength: password.length >= PASSWORD_MIN_LENGTH,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[^A-Za-z0-9]/.test(password),
  }

  // Tiêu chuẩn bắt buộc tối thiểu: length >= 8, có hoa, thường, số
  const isValid = criteria.minLength && criteria.hasUpper && criteria.hasLower && criteria.hasNumber


  // Tính score 0..4 chuẩn hóa
  const passedCount = [
    criteria.minLength,
    criteria.hasUpper,
    criteria.hasLower,
    criteria.hasNumber,
  ].filter(Boolean).length

  let finalScore = 0
  if (password.length > 0) {
    if (passedCount <= 1) finalScore = 1
    else if (passedCount === 2) finalScore = 2
    else if (passedCount === 3) finalScore = 2
    else if (passedCount === 4) finalScore = criteria.hasSpecial || password.length >= 10 ? 4 : 3
  }

  let levelLabel = 'Yếu'
  let levelColor = 'bg-rose-500'

  switch (finalScore) {
    case 1:
      levelLabel = '⚠️ Rất yếu'
      levelColor = 'bg-rose-500'
      break
    case 2:
      levelLabel = '🟡 Trung bình'
      levelColor = 'bg-amber-500'
      break
    case 3:
      levelLabel = '🟢 Đạt chuẩn (An toàn)'
      levelColor = 'bg-emerald-500'
      break
    case 4:
      levelLabel = '💪 Rất mạnh (Tuyệt vời)'
      levelColor = 'bg-teal-500'
      break
    default:
      levelLabel = 'Chưa nhập'
      levelColor = 'bg-zinc-300 dark:bg-zinc-700'
  }

  let errorMessage: string | undefined
  if (!criteria.minLength) {
    errorMessage = `Mật khẩu phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự`
  } else if (!criteria.hasUpper) {
    errorMessage = 'Mật khẩu cần ít nhất 1 chữ cái in hoa (A-Z)'
  } else if (!criteria.hasLower) {
    errorMessage = 'Mật khẩu cần ít nhất 1 chữ cái in thường (a-z)'
  } else if (!criteria.hasNumber) {
    errorMessage = 'Mật khẩu cần ít nhất 1 chữ số (0-9)'
  }

  return {
    score: finalScore,
    levelLabel,
    levelColor,
    criteria,
    isValid,
    errorMessage,
  }
}
