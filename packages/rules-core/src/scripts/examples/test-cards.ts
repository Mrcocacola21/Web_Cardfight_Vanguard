/**
 * Original placeholder cards used to exercise the script runtime. They are
 * not cards from any published game; real card scripts live in the card
 * database, outside the engine.
 */
export const TEST_CARD_SCRIPTS = [
  {
    format: 'vg-card-script/1',
    cardId: 'test-ember-squire',
    name: 'Ember Squire',
    abilities: [
      {
        id: 'call-draw',
        type: 'AUTO',
        on: 'call',
        zones: ['rear_guard_circle'],
        optional: true,
        text: '[AUTO](RC): When placed on (RC), you may pay [Counter Blast 1]. If you do, draw a card.',
        cost: [{ do: 'counter_blast', count: 1 }],
        effect: [{ do: 'draw', count: 1 }],
      },
    ],
  },
  {
    format: 'vg-card-script/1',
    cardId: 'test-tide-adept',
    name: 'Tide Adept',
    abilities: [
      {
        id: 'drop-call',
        type: 'ACT',
        zones: ['rear_guard_circle'],
        oncePerTurn: true,
        text: '[ACT](RC)[1/Turn]: [Soul Blast 1] Choose up to one grade 1 or lower card from your drop, and call it to (RC).',
        cost: [{ do: 'soul_blast', count: 1 }],
        effect: [
          {
            do: 'choose',
            as: 'unit',
            from: { player: 'self', zone: 'drop' },
            filter: { grade: { lte: 1 } },
            min: 0,
            max: 1,
          },
          { do: 'call', target: '$unit' },
        ],
      },
    ],
  },
  {
    format: 'vg-card-script/1',
    cardId: 'test-glimmer-sprite',
    name: 'Glimmer Sprite',
    abilities: [
      {
        id: 'placed-power',
        type: 'AUTO',
        on: 'call',
        zones: ['rear_guard_circle'],
        text: '[AUTO](RC): When placed on (RC), this unit gets [Power]+5000 until end of turn.',
        effect: [{ do: 'power', target: 'source', amount: 5000 }],
      },
    ],
  },
  {
    format: 'vg-card-script/1',
    cardId: 'test-gale-sovereign',
    name: 'Gale Sovereign',
    abilities: [
      {
        id: 'attack-mode',
        type: 'AUTO',
        on: 'attack',
        zones: ['vanguard_circle'],
        condition: { count: { player: 'self', zone: 'damage' }, gte: 3 },
        text: "[AUTO](VC): When this unit attacks, if you have three or more damage, choose one: this unit gets [Power]+10000; or choose one of your opponent's rear-guards and retire it.",
        effect: [
          {
            do: 'choose_one',
            options: [
              {
                key: 'power',
                label: '+10000 power',
                steps: [{ do: 'power', target: 'source', amount: 10000 }],
              },
              {
                key: 'retire',
                label: 'Retire a rear-guard',
                steps: [
                  {
                    do: 'choose',
                    as: 'foe',
                    from: { player: 'opponent', zone: 'rear_guard_circle' },
                    min: 1,
                    max: 1,
                  },
                  { do: 'retire', target: '$foe' },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    format: 'vg-card-script/1',
    cardId: 'test-banner-herald',
    name: 'Banner Herald',
    abilities: [
      {
        id: 'ally-placed',
        type: 'AUTO',
        on: 'call',
        subject: 'other',
        subjectFilter: { player: 'self', zones: ['rear_guard_circle'] },
        zones: ['rear_guard_circle'],
        optional: true,
        text: '[AUTO](RC): When another of your units is placed on (RC), you may have that unit get [Power]+2000 until end of turn.',
        effect: [{ do: 'power', target: '$trigger', amount: 2000 }],
      },
    ],
  },
  {
    format: 'vg-card-script/1',
    cardId: 'test-oracle-seeker',
    name: 'Oracle Seeker',
    abilities: [
      {
        id: 'peek',
        type: 'ACT',
        zones: ['rear_guard_circle'],
        oncePerTurn: true,
        text: '[ACT](RC)[1/Turn]: Look at the top three cards of your deck, choose up to one of them and put it into your hand, and put the rest on the bottom of your deck.',
        effect: [
          { do: 'look_top', count: 3, as: 'top' },
          { do: 'choose', as: 'pick', among: '$top', min: 0, max: 1 },
          { do: 'move', target: '$pick', to: 'hand' },
          { do: 'exclude', as: 'rest', from: '$top', minus: '$pick' },
          { do: 'move', target: '$rest', to: 'deck_bottom' },
        ],
      },
    ],
  },
  {
    format: 'vg-card-script/1',
    cardId: 'test-dawn-scout',
    name: 'Dawn Scout',
    abilities: [
      {
        id: 'ride-search',
        type: 'AUTO',
        on: 'call',
        zones: ['rear_guard_circle'],
        text: '[AUTO](RC): When placed on (RC), search your deck for up to one grade 0 card, put it into your hand, and shuffle your deck.',
        effect: [
          {
            do: 'choose',
            as: 'found',
            from: { player: 'self', zone: 'deck' },
            filter: { grade: { eq: 0 } },
            min: 0,
            max: 1,
          },
          { do: 'move', target: '$found', to: 'hand' },
          { do: 'shuffle' },
        ],
      },
    ],
  },
  {
    format: 'vg-card-script/1',
    cardId: 'test-iron-bastion',
    name: 'Iron Bastion',
    abilities: [
      {
        id: 'guard-stance',
        type: 'CONT',
        zones: ['rear_guard_circle'],
        condition: { turn: 'opponent' },
        text: "[CONT](RC): During your opponent's turn, this unit gets [Power]+5000.",
        effect: [{ do: 'power', target: 'source', amount: 5000 }],
      },
      {
        id: 'ward',
        type: 'REPLACE',
        zones: ['rear_guard_circle'],
        replaces: 'retire',
        instead: 'soul',
        text: '[CONT](RC): If this unit would be retired, put it into your soul instead.',
      },
    ],
  },
  {
    format: 'vg-card-script/1',
    cardId: 'test-war-standard',
    name: 'War Standard',
    abilities: [
      {
        id: 'rally',
        type: 'CONT',
        zones: ['vanguard_circle'],
        condition: { count: { player: 'self', zone: 'damage' }, gte: 3 },
        text: '[CONT](VC): If you have three or more damage, all of your rear-guards get [Power]+2000.',
        effect: [
          {
            do: 'power',
            target: { player: 'self', zone: 'rear_guard_circle' },
            amount: 2000,
          },
        ],
      },
    ],
  },
] as const
