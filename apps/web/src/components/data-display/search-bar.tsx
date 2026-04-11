'use client'

import { useState } from 'react'
import { Search, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface SearchBarProps {
  readonly label: string
  readonly placeholder?: string
  readonly value?: string
  readonly defaultValue?: string
  readonly name?: string
  readonly onValueChange?: (value: string) => void
  readonly onClear?: () => void
  readonly className?: string
}

export function SearchBar({
  label,
  placeholder = 'Search',
  value,
  defaultValue = '',
  name,
  onValueChange,
  onClear,
  className,
}: SearchBarProps) {
  const [internalValue, setInternalValue] = useState(defaultValue)
  const isControlled = value !== undefined
  const currentValue = isControlled ? value : internalValue

  function handleValueChange(nextValue: string) {
    if (!isControlled) {
      setInternalValue(nextValue)
    }

    onValueChange?.(nextValue)
  }

  function handleClear() {
    handleValueChange('')
    onClear?.()
  }

  return (
    <label className={cn('grid gap-1', className)}>
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          name={name}
          value={currentValue}
          placeholder={placeholder}
          onChange={(event) => handleValueChange(event.target.value)}
          className="pr-10 pl-9"
        />
        {currentValue ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-1/2 right-1.5 size-7 -translate-y-1/2 rounded-full"
            onClick={handleClear}
            aria-label={`Clear ${label}`}
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </div>
    </label>
  )
}
