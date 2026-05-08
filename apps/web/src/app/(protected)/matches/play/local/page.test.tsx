import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  basicMatchRoomView: vi.fn(),
}))

vi.mock('@/components/matches/basic-match-room-view', () => ({
  BasicMatchRoomView: ({ roomId }: { readonly roomId: string }) => {
    mocks.basicMatchRoomView({ roomId })

    return <div data-testid="basic-match-room-view">{roomId}</div>
  },
}))

import LocalMatchPlayPage from './page'

describe('LocalMatchPlayPage', () => {
  it('uses a stable local prototype room as the single-session entrypoint', () => {
    render(<LocalMatchPlayPage />)

    expect(mocks.basicMatchRoomView).toHaveBeenCalledWith({
      roomId: 'local-prototype',
    })
    expect(screen.getByTestId('basic-match-room-view')).toHaveTextContent(
      'local-prototype',
    )
  })
})
