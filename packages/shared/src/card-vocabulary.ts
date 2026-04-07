import type { Brand } from './brand'

export type Grade = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10

export type Nation = Brand<string, 'Nation'>
export type Clan = Brand<string, 'Clan'>
export type Race = Brand<string, 'Race'>
export type Keyword = Brand<string, 'Keyword'>

export type CardType =
  | 'normal-unit'
  | 'trigger-unit'
  | 'normal-order'
  | 'blitz-order'
  | 'set-order'
  | 'token'

export type TriggerType =
  | 'critical'
  | 'draw'
  | 'front'
  | 'heal'
  | 'stand'
  | 'over'
