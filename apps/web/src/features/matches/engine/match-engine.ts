import { createScriptedMatchRoomEngineAdapters } from '@web-vg/match-session'
import { createCardScriptRuntime } from '@web-vg/rules-core'

import { CARD_SCRIPTS } from '@/card-scripts'

/**
 * One card script runtime for the whole app. Server routes, local rooms and
 * client-side availability probes all use the same adapters, so a probe never
 * disagrees with the authoritative server about what a card can do.
 */
export const cardScriptRuntime = createCardScriptRuntime(CARD_SCRIPTS)

export const matchEngineAdapters =
  createScriptedMatchRoomEngineAdapters(cardScriptRuntime)
