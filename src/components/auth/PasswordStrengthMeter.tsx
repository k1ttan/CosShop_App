'use client'

import React from 'react'
import { evaluatePasswordStrength, PASSWORD_MIN_LENGTH } from '@/lib/validations/password'

interface PasswordStrengthMeterProps {
  password: string
  showChecklist?: boolean
}

export function PasswordStrengthMeter({
  password,
  showChecklist = true,
}: PasswordStrengthMeterProps) {
  if (!password) return null

  const { score, levelLabel, levelColor, criteria } = evaluatePasswordStrength(password)

  return (
    <div className="space-y-2 pt-1 animate-in fade-in duration-200">
      {/* Strength Bar */}
      <div className="space-y-1">
        <div className="flex gap-1.5 h-1.5">
          {[1, 2, 3, 4].map((level) => (
            <div
              key={level}
              className={`flex-1 rounded-full transition-all duration-300 ${
                score >= level ? levelColor : 'bg-zinc-200 dark:bg-zinc-700/60'
              }`}
            />
          ))}
        </div>
        <div className="flex justify-between items-center text-[11px] font-semibold">
          <span className="text-zinc-500 dark:text-zinc-400">Độ bảo mật:</span>
          <span
            className={
              score <= 1
                ? 'text-rose-500 font-bold'
                : score === 2
                ? 'text-amber-500 font-bold'
                : 'text-emerald-500 font-black'
            }
          >
            {levelLabel}
          </span>
        </div>
      </div>

      {/* Real-time Requirement Checklist */}
      {showChecklist && (
        <div className="grid grid-cols-2 gap-1.5 p-2.5 rounded-xl bg-zinc-50/80 dark:bg-zinc-900/40 border border-zinc-200/70 dark:border-zinc-800 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span>{criteria.minLength ? '✅' : '⚪'}</span>
            <span
              className={
                criteria.minLength
                  ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                  : 'text-zinc-500'
              }
            >
              Ít nhất {PASSWORD_MIN_LENGTH} ký tự
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span>{criteria.hasUpper ? '✅' : '⚪'}</span>
            <span
              className={
                criteria.hasUpper
                  ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                  : 'text-zinc-500'
              }
            >
              Có chữ in hoa (A-Z)
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span>{criteria.hasLower ? '✅' : '⚪'}</span>
            <span
              className={
                criteria.hasLower
                  ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                  : 'text-zinc-500'
              }
            >
              Có chữ in thường (a-z)
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span>{criteria.hasNumber ? '✅' : '⚪'}</span>
            <span
              className={
                criteria.hasNumber
                  ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                  : 'text-zinc-500'
              }
            >
              Có chữ số (0-9)
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
