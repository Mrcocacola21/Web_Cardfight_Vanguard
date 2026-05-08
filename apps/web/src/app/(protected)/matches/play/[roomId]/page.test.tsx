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

import MatchPlayPage from './page'

describe('MatchPlayPage', () => {
  it('uses the live match play route as the match room entrypoint', async () => {
    render(
      await MatchPlayPage({
        params: Promise.resolve({
          roomId: 'room%2019-2',
        }),
      }),
    )

    expect(mocks.basicMatchRoomView).toHaveBeenCalledWith({
      roomId: 'room 19-2',
    })
    expect(screen.getByTestId('basic-match-room-view')).toHaveTextContent(
      'room 19-2',
    )
  })
})
