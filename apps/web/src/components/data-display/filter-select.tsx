'use client'

import type { SelectHTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

interface FilterSelectOption {
  readonly value: string
  readonly label: string
}

interface FilterSelectProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'children' | 'onChange' | 'size'
> {
  readonly label: string
  readonly options: readonly FilterSelectOption[]
  readonly onChange?: SelectHTMLAttributes<HTMLSelectElement>['onChange']
  readonly onValueChange?: (value: string) => void
}

export function FilterSelect({
  label,
  options,
  onValueChange,
  onChange,
  className,
  ...props
}: FilterSelectProps) {
  return (
    <label className="grid gap-1 text-sm text-foreground-secondary">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <select
        {...props}
        className={cn(
          'h-10 rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
          className,
        )}
        onChange={(event) => {
          onChange?.(event)
          onValueChange?.(event.target.value)
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
