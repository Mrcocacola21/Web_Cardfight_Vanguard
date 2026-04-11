'use client'

import type { ComponentProps, ReactNode } from 'react'
import { useFormStatus } from 'react-dom'

import { Button } from '@/components/ui/button'

interface DeckSubmitButtonProps extends Omit<
  ComponentProps<typeof Button>,
  'children' | 'type'
> {
  readonly label: string
  readonly pendingLabel?: string
  readonly confirmMessage?: string
  readonly children?: ReactNode
}

export function DeckSubmitButton({
  label,
  pendingLabel,
  confirmMessage,
  children,
  disabled,
  onClick,
  ...props
}: DeckSubmitButtonProps) {
  const { pending } = useFormStatus()

  return (
    <Button
      type="submit"
      disabled={disabled || pending}
      onClick={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          event.preventDefault()
          return
        }

        onClick?.(event)
      }}
      {...props}
    >
      {pending ? (pendingLabel ?? label) : (children ?? label)}
    </Button>
  )
}
