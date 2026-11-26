import {
  HEARTLURU_ATTACK_THRESHOLDS_EFFECT,
  HEARTLURU_SOUL_CALL_EFFECT,
  KAIRI_ATTACK_SEQUENCE_EFFECT,
  KAIRI_CHOICE_BOUNCE_EFFECT,
  KAIRI_REPLAY_EFFECT,
  PRISON_CAPTURE_EFFECT,
  PRISON_RELEASE_EFFECT,
  PRISON_SERAPH_ATTACK_EFFECT,
  REGUREGNUS_BATTLE_REPLACE_EFFECT,
  REGUREGNUS_CALL_OF_DEEP_LANDS_EFFECT,
  REGUREGNUS_DROP_CALL_EFFECT,
  VYRGILLA_REWRITE_EFFECT,
  YOUTHBERK_REVOLDRESS_EFFECT,
} from '@web-vg/rules-core'
import type { DeckSection } from '@web-vg/shared'

export const STANDARD_SLICE_QA_PRODUCT = {
  id: '21000000-0000-4000-8000-000000210001',
  canonicalKey: 'product.qa-standard-slice.pre-phase-21',
  familyId: 'family-standard',
  officialCode: 'QA-STD21',
  name: 'Pre-Phase 21 Standard Slice QA Decks',
  productCategory: 'special-set',
  productKind: 'other',
  releaseDate: '2026-06-18',
  regionCode: 'en',
  cycleKey: 'pre-phase-21-standard-slice',
} as const

export interface StandardSliceQaCard {
  readonly id: string
  readonly canonicalKey: string
  readonly name: string
  readonly normalizedName: string
  readonly grade: number
  readonly cardType:
    | 'normal-unit'
    | 'trigger-unit'
    | 'normal-order'
    | 'set-order'
  readonly nation: string
  readonly clan: string | null
  readonly race: string | null
  readonly triggerType: 'critical' | 'draw' | 'front' | 'heal' | null
  readonly basePower: number | null
  readonly baseCritical: number | null
  readonly baseShield: number | null
  readonly keywords: readonly string[]
  readonly effectRefs: readonly string[]
  readonly collectorNumber: string
  readonly rarity: string
}

export interface StandardSliceQaDeck {
  readonly key: string
  readonly displayName: string
  readonly title: string
  readonly nation: string
  readonly deckLogCode: string
  readonly identity: string
  readonly preMatchChecks: readonly string[]
  readonly inMatchChecks: readonly string[]
  readonly signatureChecks: readonly string[]
  readonly knownLimits: readonly string[]
  readonly cards: readonly StandardSliceQaCard[]
  readonly entries: readonly {
    readonly section: DeckSection
    readonly cardEntityId: string
    readonly quantity: number
  }[]
}

const effectId = (effect: { readonly id: string }) => effect.id

export const STANDARD_SLICE_QA_DECKS: readonly StandardSliceQaDeck[] = [
  createDeck({
    deckNo: 1,
    key: 'reguregnus',
    displayName: 'Reguregnus',
    title: '[QA] Standard Slice - Reguregnus',
    nation: 'Stoicheia',
    deckLogCode: '3P5CK',
    identity:
      'Stoicheia drop/order deck built to stress drop calls, energy costs, and battle replacement.',
    preMatchChecks: [
      'Deck has 50 main cards, 4 ride cards, and Standard format.',
      'Reguregnus, Call of the Deep Lands, and replacement pieces are present.',
    ],
    inMatchChecks: [
      'Ride to grade 3, call rear-guards, and create at least one drop target.',
      'Use Call of the Deep Lands and confirm the request highlights drop targets.',
      'Enter battle with Reguregnus as the attacker.',
    ],
    signatureChecks: [
      'Call of the Deep Lands can call from drop and place itself in order zone.',
      'Reguregnus battle replacement can change the active attacker from drop.',
      'Counterblast, energy, drop, order, and active battle context remain readable.',
    ],
    knownLimits: [
      'The support package is a bounded QA fixture, not the full DeckLog card list.',
      'Exact Athanasios/support text is represented only by the current slice handlers.',
    ],
    coreCards: [
      normal(1, 'ride-g0', 'Reguregnus Starter', 0, 6000, 5000),
      normal(2, 'ride-g1', 'Reguregnus Grade 1', 1, 8000, 5000),
      normal(3, 'ride-g2', 'Reguregnus Grade 2', 2, 10000, 5000),
      normal(4, 'boss-g3', 'Reguregnus', 3, 13000, 0, [
        effectId(REGUREGNUS_DROP_CALL_EFFECT),
        effectId(REGUREGNUS_BATTLE_REPLACE_EFFECT),
      ]),
      order(5, 'call-of-deep-lands', 'Call of the Deep Lands', 1, [
        effectId(REGUREGNUS_CALL_OF_DEEP_LANDS_EFFECT),
      ]),
      normal(6, 'drop-caller-a', 'Deep Lands Caller A', 1, 8000, 5000),
      normal(7, 'drop-caller-b', 'Deep Lands Caller B', 2, 10000, 5000),
      normal(8, 'replacement', 'Reguregnus Replacement', 3, 13000, 0, [
        effectId(REGUREGNUS_BATTLE_REPLACE_EFFECT),
      ]),
      normal(9, 'support-a', 'Reguregnus Support A', 1, 8000, 5000),
      normal(10, 'support-b', 'Reguregnus Support B', 2, 10000, 5000),
      normal(11, 'normal-a', 'Reguregnus Normal A', 1, 8000, 5000),
      normal(12, 'normal-b', 'Reguregnus Normal B', 2, 10000, 5000),
    ],
    main: [
      ['boss-g3', 3],
      ['call-of-deep-lands', 4],
      ['drop-caller-a', 4],
      ['drop-caller-b', 4],
      ['replacement', 4],
      ['support-a', 4],
      ['support-b', 3],
      ['normal-a', 4],
      ['normal-b', 4],
    ],
  }),
  createDeck({
    deckNo: 2,
    key: 'heartluru',
    displayName: 'Heartluru',
    title: '[QA] Standard Slice - Heartluru',
    nation: 'Dark States',
    deckLogCode: '704UP',
    identity:
      'Dark States set-order deck built to stress order count, soul call, and attack thresholds.',
    preMatchChecks: [
      'Deck has 50 main cards, 4 ride cards, and Standard format.',
      'Heartluru, four set orders, and soul-call targets are present.',
    ],
    inMatchChecks: [
      'Place several set orders and keep their count visible.',
      'Put at least two Happy Toys-style units into soul or playable zones.',
      'Attack with Heartluru after reaching order thresholds.',
    ],
    signatureChecks: [
      'Heartluru can pay energy and call from soul through a request.',
      'Attack threshold pressure shows power/critical/restand context.',
      'Order zone count remains understandable during battle.',
    ],
    knownLimits: [
      'Happy Toys identity is represented by bounded QA fixture cards.',
      'Full position-specific toy package is outside this manual QA pass.',
    ],
    coreCards: [
      normal(1, 'ride-g0', 'Heartluru Starter', 0, 6000, 5000),
      normal(2, 'ride-g1', 'Heartluru Grade 1', 1, 8000, 5000),
      normal(3, 'ride-g2', 'Heartluru Grade 2', 2, 10000, 5000),
      normal(4, 'boss-g3', 'Heartluru', 3, 13000, 0, [
        effectId(HEARTLURU_SOUL_CALL_EFFECT),
        effectId(HEARTLURU_ATTACK_THRESHOLDS_EFFECT),
      ]),
      setOrder(5, 'set-order-a', 'Heartluru Set Order A'),
      setOrder(6, 'set-order-b', 'Heartluru Set Order B'),
      setOrder(7, 'set-order-c', 'Heartluru Set Order C'),
      setOrder(8, 'set-order-d', 'Heartluru Set Order D'),
      normal(9, 'soul-a', 'Heartluru Soul A', 1, 8000, 5000),
      normal(10, 'soul-b', 'Heartluru Soul B', 2, 10000, 5000),
      normal(11, 'normal-a', 'Heartluru Normal A', 1, 8000, 5000),
      normal(12, 'normal-b', 'Heartluru Normal B', 2, 10000, 5000),
    ],
    main: [
      ['boss-g3', 3],
      ['set-order-a', 4],
      ['set-order-b', 4],
      ['set-order-c', 4],
      ['set-order-d', 4],
      ['soul-a', 4],
      ['soul-b', 4],
      ['normal-a', 4],
      ['normal-b', 3],
    ],
  }),
  createDeck({
    deckNo: 3,
    key: 'youthberk',
    displayName: 'Youthberk',
    title: '[QA] Standard Slice - Youthberk',
    nation: 'Keter Sanctuary',
    deckLogCode: '39XBZ',
    identity:
      'Keter Sanctuary form-change deck built to stress Revoldress and battle continuation.',
    preMatchChecks: [
      'Deck has 50 main cards, 4 ride cards, and Standard format.',
      'Youthberk and Youthberk RevolForm are present.',
    ],
    inMatchChecks: [
      'Ride to Youthberk and keep RevolForm in hand if possible.',
      'Enter battle phase and activate the Revoldress flow.',
      'Confirm the previous vanguard movement and battle continuation are readable.',
    ],
    signatureChecks: [
      'RevolForm replaces the vanguard and binds the previous vanguard.',
      'Power/critical context is visible after the form change.',
      'Battle continues without losing who is attacking.',
    ],
    knownLimits: [
      'One bounded RevolForm represents the critical form-change branch.',
      'Full Exist/Rebuild branches and support cards remain out of scope.',
    ],
    coreCards: [
      normal(1, 'ride-g0', 'Youthberk Starter', 0, 6000, 5000),
      normal(2, 'ride-g1', 'Youthberk Grade 1', 1, 8000, 5000),
      normal(3, 'ride-g2', 'Youthberk Grade 2', 2, 10000, 5000),
      normal(4, 'boss-g3', 'Youthberk', 3, 13000, 0),
      normal(5, 'revoldress', 'Youthberk RevolForm', 3, 13000, 0, [
        effectId(YOUTHBERK_REVOLDRESS_EFFECT),
      ]),
      normal(6, 'rear-a', 'Youthberk Rear A', 1, 8000, 5000),
      normal(7, 'rear-b', 'Youthberk Rear B', 2, 10000, 5000),
      normal(8, 'normal-a', 'Youthberk Normal A', 1, 8000, 5000),
      normal(9, 'normal-b', 'Youthberk Normal B', 2, 10000, 5000),
      normal(10, 'filler-a', 'Youthberk Filler A', 1, 8000, 5000),
      normal(11, 'filler-b', 'Youthberk Filler B', 2, 10000, 5000),
      normal(12, 'filler-c', 'Youthberk Filler C', 1, 8000, 5000),
    ],
    main: [
      ['boss-g3', 3],
      ['revoldress', 4],
      ['rear-a', 4],
      ['rear-b', 4],
      ['normal-a', 4],
      ['normal-b', 4],
      ['filler-a', 4],
      ['filler-b', 4],
      ['filler-c', 3],
    ],
  }),
  createDeck({
    deckNo: 4,
    key: 'prison',
    displayName: 'Prison',
    title: '[QA] Standard Slice - Prison',
    nation: 'Brandt Gate',
    deckLogCode: '75CNF',
    identity:
      'Brandt Gate control deck built to stress opponent-card movement and prison release.',
    preMatchChecks: [
      'Deck has 50 main cards, 4 ride cards, and Standard format.',
      'Seraph Snow, Galaxy Central Prison, and release carrier are present.',
    ],
    inMatchChecks: [
      'Set up Galaxy Central Prison and attack/capture where the UI allows it.',
      'Confirm captured cards are visibly separate from drop/bind/damage.',
      'Use release and Seraph attack pressure in a later battle.',
    ],
    signatureChecks: [
      'Capture request clearly shows opponent legal targets.',
      'Release calls from prison back to owner rear-guard circles.',
      'Seraph attack scaling remains tied to the prison count.',
    ],
    knownLimits: [
      'The list uses Seraph Snow as the bounded QA boss.',
      'Full Purelight/Clearlight package and exact prison card text are out of scope.',
    ],
    coreCards: [
      normal(1, 'ride-g0', 'Prison Starter', 0, 6000, 5000),
      normal(2, 'ride-g1', 'Prison Grade 1', 1, 8000, 5000),
      normal(3, 'ride-g2', 'Prison Grade 2', 2, 10000, 5000),
      normal(4, 'boss-g3', 'Aurora Battle Princess, Seraph Snow', 3, 13000, 0, [
        effectId(PRISON_CAPTURE_EFFECT),
        effectId(PRISON_SERAPH_ATTACK_EFFECT),
      ]),
      setOrder(5, 'galaxy-central-prison', 'Galaxy Central Prison'),
      normal(6, 'control-a', 'Prison Control A', 1, 8000, 5000),
      normal(7, 'control-b', 'Prison Control B', 2, 10000, 5000),
      normal(8, 'release-carrier', 'Prison Release Carrier', 1, 8000, 5000, [
        effectId(PRISON_RELEASE_EFFECT),
      ]),
      normal(9, 'normal-a', 'Prison Normal A', 1, 8000, 5000),
      normal(10, 'normal-b', 'Prison Normal B', 2, 10000, 5000),
      normal(11, 'filler-a', 'Prison Filler A', 1, 8000, 5000),
      normal(12, 'filler-b', 'Prison Filler B', 2, 10000, 5000),
    ],
    main: [
      ['boss-g3', 3],
      ['galaxy-central-prison', 4],
      ['control-a', 4],
      ['control-b', 4],
      ['release-carrier', 4],
      ['normal-a', 4],
      ['normal-b', 4],
      ['filler-a', 4],
      ['filler-b', 3],
    ],
  }),
  createDeck({
    deckNo: 5,
    key: 'vyrgilla',
    displayName: 'Vyrgilla',
    title: '[QA] Standard Slice - Vyrgilla',
    nation: 'Dragon Empire',
    deckLogCode: '2QD1X',
    identity:
      'Dragon Empire rewrite deck built to stress vanguard replacement, opponent bind, and board standing.',
    preMatchChecks: [
      'Deck has 50 main cards, 4 ride cards, and Standard format.',
      'Vyrgilla and Rewrite Form are present.',
    ],
    inMatchChecks: [
      'Ride to Vyrgilla and hold Rewrite Form in hand if possible.',
      'Build at least one own rear-guard and one opponent rear-guard target.',
      'Activate rewrite in battle and watch the lane context.',
    ],
    signatureChecks: [
      'Rewrite Form binds the previous vanguard.',
      'Opponent rear-guard bind is visible and understandable.',
      'Own rear-guards stand after rewrite without losing action context.',
    ],
    knownLimits: [
      'MateUnit and Ultimate Skill branches are represented only by bounded behavior.',
      'Full printed Vyrgilla support package is outside this pass.',
    ],
    coreCards: [
      normal(1, 'ride-g0', 'Vyrgilla Starter', 0, 6000, 5000),
      normal(2, 'ride-g1', 'Vyrgilla Grade 1', 1, 8000, 5000),
      normal(3, 'ride-g2', 'Vyrgilla Grade 2', 2, 10000, 5000),
      normal(4, 'boss-g3', 'Vyrgilla', 3, 13000, 0),
      normal(5, 'rewrite', 'Vyrgilla Rewrite Form', 3, 13000, 0, [
        effectId(VYRGILLA_REWRITE_EFFECT),
      ]),
      normal(6, 'rear-a', 'Vyrgilla Rear A', 1, 8000, 5000),
      normal(7, 'rear-b', 'Vyrgilla Rear B', 2, 10000, 5000),
      normal(8, 'normal-a', 'Vyrgilla Normal A', 1, 8000, 5000),
      normal(9, 'normal-b', 'Vyrgilla Normal B', 2, 10000, 5000),
      normal(10, 'filler-a', 'Vyrgilla Filler A', 1, 8000, 5000),
      normal(11, 'filler-b', 'Vyrgilla Filler B', 2, 10000, 5000),
      normal(12, 'filler-c', 'Vyrgilla Filler C', 1, 8000, 5000),
    ],
    main: [
      ['boss-g3', 3],
      ['rewrite', 4],
      ['rear-a', 4],
      ['rear-b', 4],
      ['normal-a', 4],
      ['normal-b', 4],
      ['filler-a', 4],
      ['filler-b', 4],
      ['filler-c', 3],
    ],
  }),
  createDeck({
    deckNo: 6,
    key: 'kairi',
    displayName: 'Kairi',
    title: '[QA] Standard Slice - Kairi',
    nation: 'Lyrical Monasterio',
    deckLogCode: '29HYB',
    identity:
      'Lyrical Monasterio bounce/replay deck built to stress target choice and repeated board movement.',
    preMatchChecks: [
      'Deck has 50 main cards, 4 ride cards, and Standard format.',
      'Astesice, Kairi and replay targets are present.',
    ],
    inMatchChecks: [
      'Ride to Kairi and build two rear-guards.',
      'Use choice bounce and replay while watching selected targets.',
      'Attack with Kairi and verify the bounce/replay sequence stays understandable.',
    ],
    signatureChecks: [
      'Kairi can choose rear-guards to return to hand.',
      'Replay pays energy and calls from hand through a request.',
      'Replayed units receive readable power context after movement.',
    ],
    knownLimits: [
      'Same-column restanders and persona-sensitive branches remain bounded.',
      'Full Lyrical support package and exact trigger spread are out of scope.',
    ],
    coreCards: [
      normal(1, 'ride-g0', 'Kairi Starter', 0, 6000, 5000),
      normal(2, 'ride-g1', 'Kairi Grade 1', 1, 8000, 5000),
      normal(3, 'ride-g2', 'Kairi Grade 2', 2, 10000, 5000),
      normal(4, 'boss-g3', 'Astesice, Kairi', 3, 13000, 0, [
        effectId(KAIRI_ATTACK_SEQUENCE_EFFECT),
        effectId(KAIRI_CHOICE_BOUNCE_EFFECT),
        effectId(KAIRI_REPLAY_EFFECT),
      ]),
      normal(5, 'rear-a', 'Kairi Rear A', 1, 8000, 5000),
      normal(6, 'rear-b', 'Kairi Rear B', 2, 10000, 5000),
      normal(7, 'replay-a', 'Kairi Replay A', 1, 8000, 5000),
      normal(8, 'replay-b', 'Kairi Replay B', 2, 10000, 5000),
      normal(9, 'normal-a', 'Kairi Normal A', 1, 8000, 5000),
      normal(10, 'normal-b', 'Kairi Normal B', 2, 10000, 5000),
      normal(11, 'filler-a', 'Kairi Filler A', 1, 8000, 5000),
      normal(12, 'filler-b', 'Kairi Filler B', 2, 10000, 5000),
    ],
    main: [
      ['boss-g3', 3],
      ['rear-a', 4],
      ['rear-b', 4],
      ['replay-a', 4],
      ['replay-b', 4],
      ['normal-a', 4],
      ['normal-b', 4],
      ['filler-a', 4],
      ['filler-b', 3],
    ],
  }),
]

export function listStandardSliceQaCatalogCards(): readonly StandardSliceQaCard[] {
  return STANDARD_SLICE_QA_DECKS.flatMap((deck) => deck.cards)
}

export function listStandardSliceQaCardPrintings(): readonly {
  readonly id: string
  readonly printingKey: string
  readonly cardEntityId: string
  readonly productId: string
  readonly collectorNumber: string
  readonly rarity: string
  readonly localeCode: string
  readonly regionCode: string
  readonly printedName: string
}[] {
  return STANDARD_SLICE_QA_DECKS.flatMap((deck, deckIndex) =>
    deck.cards.map((card, cardIndex) => ({
      id: printingId(deckIndex + 1, cardIndex + 1),
      printingKey: `printing.qa-standard-slice.${deck.key}.${card.collectorNumber}.en`,
      cardEntityId: card.id,
      productId: STANDARD_SLICE_QA_PRODUCT.id,
      collectorNumber: card.collectorNumber,
      rarity: card.rarity,
      localeCode: 'en',
      regionCode: 'en',
      printedName: card.name,
    })),
  )
}

function createDeck(input: {
  readonly deckNo: number
  readonly key: string
  readonly displayName: string
  readonly title: string
  readonly nation: string
  readonly deckLogCode: string
  readonly identity: string
  readonly preMatchChecks: readonly string[]
  readonly inMatchChecks: readonly string[]
  readonly signatureChecks: readonly string[]
  readonly knownLimits: readonly string[]
  readonly coreCards: readonly StandardSliceQaCardBlueprint[]
  readonly main: readonly (readonly [string, number])[]
}): StandardSliceQaDeck {
  const triggers = [
    trigger(
      90,
      'critical-trigger',
      `${input.displayName} Critical Trigger`,
      'critical',
    ),
    trigger(91, 'draw-trigger', `${input.displayName} Draw Trigger`, 'draw'),
    trigger(92, 'front-trigger', `${input.displayName} Front Trigger`, 'front'),
    trigger(93, 'heal-trigger', `${input.displayName} Heal Trigger`, 'heal'),
  ] satisfies readonly StandardSliceQaCardBlueprint[]
  const blueprints = [...input.coreCards, ...triggers]
  const cards = blueprints.map((blueprint, index) =>
    materializeCard(input, blueprint, index + 1),
  )
  const cardIdByKey = new Map(
    cards.map((card, index) => [blueprints[index]?.key, card.id]),
  )
  const triggerIds = new Set(
    triggers.map((card) => requireCardId(cardIdByKey, card.key)),
  )
  const rideKeys = ['ride-g0', 'ride-g1', 'ride-g2', 'boss-g3']
  const entries = [
    ...input.main.map(([key, quantity]) => ({
      section: 'main' as DeckSection,
      cardEntityId: requireCardId(cardIdByKey, key),
      quantity,
    })),
    ...triggers.map((card) => ({
      section: 'main' as DeckSection,
      cardEntityId: requireCardId(cardIdByKey, card.key),
      quantity: 4,
    })),
    ...rideKeys.map((key) => ({
      section: 'ride' as DeckSection,
      cardEntityId: requireCardId(cardIdByKey, key),
      quantity: 1,
    })),
  ]

  assertDeckShape(input.title, entries, triggerIds)

  return {
    key: input.key,
    displayName: input.displayName,
    title: input.title,
    nation: input.nation,
    deckLogCode: input.deckLogCode,
    identity: input.identity,
    preMatchChecks: input.preMatchChecks,
    inMatchChecks: input.inMatchChecks,
    signatureChecks: input.signatureChecks,
    knownLimits: input.knownLimits,
    cards,
    entries,
  }
}

interface StandardSliceQaCardBlueprint {
  readonly index: number
  readonly key: string
  readonly name: string
  readonly grade: number
  readonly cardType:
    | 'normal-unit'
    | 'trigger-unit'
    | 'normal-order'
    | 'set-order'
  readonly triggerType: 'critical' | 'draw' | 'front' | 'heal' | null
  readonly basePower: number | null
  readonly baseCritical: number | null
  readonly baseShield: number | null
  readonly effectRefs: readonly string[]
  readonly rarity: string
}

function normal(
  index: number,
  key: string,
  name: string,
  grade: number,
  power: number,
  shield: number,
  effectRefs: readonly string[] = [],
): StandardSliceQaCardBlueprint {
  return {
    index,
    key,
    name,
    grade,
    cardType: 'normal-unit',
    triggerType: null,
    basePower: power,
    baseCritical: 1,
    baseShield: shield,
    effectRefs,
    rarity: grade >= 3 || effectRefs.length > 0 ? 'RRR' : 'C',
  }
}

function order(
  index: number,
  key: string,
  name: string,
  grade: number,
  effectRefs: readonly string[] = [],
): StandardSliceQaCardBlueprint {
  return {
    index,
    key,
    name,
    grade,
    cardType: 'normal-order',
    triggerType: null,
    basePower: null,
    baseCritical: 0,
    baseShield: 0,
    effectRefs,
    rarity: effectRefs.length > 0 ? 'RRR' : 'C',
  }
}

function setOrder(
  index: number,
  key: string,
  name: string,
  effectRefs: readonly string[] = [],
): StandardSliceQaCardBlueprint {
  return {
    index,
    key,
    name,
    grade: 1,
    cardType: 'set-order',
    triggerType: null,
    basePower: null,
    baseCritical: 0,
    baseShield: 0,
    effectRefs,
    rarity: effectRefs.length > 0 ? 'RRR' : 'C',
  }
}

function trigger(
  index: number,
  key: string,
  name: string,
  triggerType: 'critical' | 'draw' | 'front' | 'heal',
): StandardSliceQaCardBlueprint {
  return {
    index,
    key,
    name,
    grade: 0,
    cardType: 'trigger-unit',
    triggerType,
    basePower: 5000,
    baseCritical: 1,
    baseShield: 15000,
    effectRefs: [],
    rarity: 'C',
  }
}

function materializeCard(
  deck: {
    readonly deckNo: number
    readonly key: string
    readonly nation: string
  },
  blueprint: StandardSliceQaCardBlueprint,
  ordinal: number,
): StandardSliceQaCard {
  return {
    id: cardId(deck.deckNo, blueprint.index),
    canonicalKey: `card.qa-standard-slice.${deck.key}.${blueprint.key}`,
    name: blueprint.name,
    normalizedName: normalizeName(blueprint.name),
    grade: blueprint.grade,
    cardType: blueprint.cardType,
    nation: deck.nation,
    clan: null,
    race: 'QA Fixture',
    triggerType: blueprint.triggerType,
    basePower: blueprint.basePower,
    baseCritical: blueprint.baseCritical,
    baseShield: blueprint.baseShield,
    // Grade 3 units print Twin Drive!!; the engine reads it as a keyword.
    keywords:
      blueprint.cardType === 'normal-unit' && blueprint.grade >= 3
        ? ['twin-drive']
        : [],
    effectRefs: blueprint.effectRefs,
    collectorNumber: `${String(deck.deckNo).padStart(2, '0')}-${String(ordinal).padStart(3, '0')}`,
    rarity: blueprint.rarity,
  }
}

function cardId(deckNo: number, cardNo: number): string {
  return `21000000-0000-4000-8000-${String(deckNo).padStart(2, '0')}${String(cardNo).padStart(10, '0')}`
}

function printingId(deckNo: number, cardNo: number): string {
  return `22000000-0000-4000-8000-${String(deckNo).padStart(2, '0')}${String(cardNo).padStart(10, '0')}`
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

function requireCardId(
  cards: ReadonlyMap<string | undefined, string>,
  key: string,
): string {
  const cardId = cards.get(key)

  if (!cardId) {
    throw new Error(`Missing Standard slice QA card key ${key}.`)
  }

  return cardId
}

function assertDeckShape(
  title: string,
  entries: readonly {
    readonly section: DeckSection
    readonly cardEntityId: string
    readonly quantity: number
  }[],
  triggerIds: ReadonlySet<string>,
): void {
  const mainCount = entries
    .filter((entry) => entry.section === 'main')
    .reduce((total, entry) => total + entry.quantity, 0)
  const rideCount = entries
    .filter((entry) => entry.section === 'ride')
    .reduce((total, entry) => total + entry.quantity, 0)
  const triggerCount = entries
    .filter((entry) => entry.section === 'main')
    .filter((entry) => triggerIds.has(entry.cardEntityId))
    .reduce((total, entry) => total + entry.quantity, 0)

  if (mainCount !== 50 || rideCount !== 4 || triggerCount !== 16) {
    throw new Error(
      `${title} QA deck must be 50 main / 4 ride / 16 trigger cards.`,
    )
  }
}
