import { describe, expect, it } from 'vitest'

import {
  LOCAL_MATCH_PLAYER_ONE_ID,
  LOCAL_MATCH_PLAYER_TWO_ID,
  createLocalPrototypeMatchRoom,
} from './local-match-room'
import { buildMatchBoardProjection } from './zone-projection'

describe('buildMatchBoardProjection', () => {
  it('projects current and opponent sides from engine-owned zones', () => {
    const room = createLocalPrototypeMatchRoom('zone-projection')
    const stateBeforeProjection = JSON.stringify(room.engineState)

    const projection = buildMatchBoardProjection(
      room.engineState,
      LOCAL_MATCH_PLAYER_ONE_ID,
    )

    expect(JSON.stringify(room.engineState)).toBe(stateBeforeProjection)
    expect(projection.currentSide?.player.playerId).toBe(
      LOCAL_MATCH_PLAYER_ONE_ID,
    )
    expect(projection.opponentSides).toHaveLength(1)
    expect(projection.opponentSides[0]?.player.playerId).toBe(
      LOCAL_MATCH_PLAYER_TWO_ID,
    )
    expect(projection.currentSide?.zones.map((zone) => zone.role)).toEqual(
      expect.arrayContaining([
        'deck',
        'hand',
        'vanguard',
        'rear_guard',
        'ride_deck',
        'g_deck',
        'damage',
        'soul',
        'drop',
        'bind',
      ]),
    )
    expect(
      projection.currentSide?.battlefieldZones.map((zone) => zone.role),
    ).toEqual(['vanguard', 'rear_guard'])
    expect(projection.currentSide?.handZones.map((zone) => zone.role)).toEqual([
      'hand',
    ])
    expect(
      projection.currentSide?.libraryZones.map((zone) => zone.role),
    ).toEqual(['deck', 'ride_deck', 'g_deck'])
    expect(
      projection.currentSide?.resourceZones.map((zone) => zone.role),
    ).toEqual(['damage', 'soul'])
    expect(
      projection.currentSide?.discardZones.map((zone) => zone.role),
    ).toEqual(['drop', 'bind'])
  })

  it('keeps occupied, empty, slotted, and piece state data in the projection', () => {
    const room = createLocalPrototypeMatchRoom('zone-contents')
    const projection = buildMatchBoardProjection(
      room.engineState,
      LOCAL_MATCH_PLAYER_ONE_ID,
    )
    const currentSide = projection.currentSide

    expect(currentSide).toBeDefined()

    const rearGuardZone = currentSide?.centralZones.find(
      (zone) => zone.role === 'rear_guard',
    )
    const vanguardZone = currentSide?.centralZones.find(
      (zone) => zone.role === 'vanguard',
    )
    const dropZone = currentSide?.supportZones.find(
      (zone) => zone.role === 'drop',
    )
    const damageZone = currentSide?.supportZones.find(
      (zone) => zone.role === 'damage',
    )
    const soulZone = currentSide?.resourceZones.find(
      (zone) => zone.role === 'soul',
    )
    const rideDeckZone = currentSide?.libraryZones.find(
      (zone) => zone.role === 'ride_deck',
    )
    const gDeckZone = currentSide?.libraryZones.find(
      (zone) => zone.role === 'g_deck',
    )
    const bindZone = currentSide?.discardZones.find(
      (zone) => zone.role === 'bind',
    )

    expect(vanguardZone?.pieces[0]).toMatchObject({
      pieceId: 'p1:piece:ride:3:1:local-catalog:keter:starting-sage',
      cardDefinitionId: 'local-catalog:keter:starting-sage',
    })
    expect(rearGuardZone?.slotIds).toEqual([
      'p1:front-left',
      'p1:back-left',
      'p1:back-center',
      'p1:front-right',
      'p1:back-right',
    ])
    expect(rearGuardZone?.pieces).toHaveLength(0)
    expect(dropZone?.pieces).toHaveLength(0)
    expect(damageZone?.pieces).toHaveLength(0)
    expect(soulZone?.pieces).toHaveLength(0)
    expect(rideDeckZone?.pieces.map((piece) => piece.cardDefinitionId)).toEqual(
      [
        'local-catalog:keter:wayward-boost',
        'local-catalog:keter:skyfall-knight',
        'local-catalog:keter:apex-ruler',
      ],
    )
    expect(gDeckZone?.pieces).toHaveLength(0)
    expect(bindZone?.pieces).toHaveLength(0)
  })

  it('flips current and opponent orientation for another player perspective', () => {
    const room = createLocalPrototypeMatchRoom('zone-perspective')

    const projection = buildMatchBoardProjection(
      room.engineState,
      LOCAL_MATCH_PLAYER_TWO_ID,
    )

    expect(projection.currentSide?.player.playerId).toBe(
      LOCAL_MATCH_PLAYER_TWO_ID,
    )
    expect(projection.opponentSides[0]?.player.playerId).toBe(
      LOCAL_MATCH_PLAYER_ONE_ID,
    )
  })
})
