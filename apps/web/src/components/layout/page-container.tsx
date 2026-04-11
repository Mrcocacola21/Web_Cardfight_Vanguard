import type { HTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

type PageContainerElement = 'div' | 'main' | 'section' | 'header'
type PageContainerSize = 'narrow' | 'default' | 'wide'

const containerSizeClasses: Record<PageContainerSize, string> = {
  narrow: 'max-w-3xl',
  default: 'max-w-5xl',
  wide: 'max-w-6xl',
}

interface PageContainerProps extends HTMLAttributes<HTMLElement> {
  readonly as?: PageContainerElement
  readonly size?: PageContainerSize
}

export function PageContainer({
  as = 'div',
  size = 'default',
  className,
  ...props
}: PageContainerProps) {
  const Comp = as

  return (
    <Comp
      className={cn(
        'mx-auto w-full px-6 md:px-10',
        containerSizeClasses[size],
        className,
      )}
      {...props}
    />
  )
}

export type { PageContainerSize }
