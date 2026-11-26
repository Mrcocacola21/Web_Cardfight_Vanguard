/**
 * Card scripts loaded by every match (`vg-card-script/1`, see
 * docs/scripting/card-script-format.md).
 *
 * The engine ships no card content. Add one JSON file per card next to this
 * file and list it below, e.g.:
 *
 *   import cardAbc123 from './abc-123.json'
 *   export const CARD_SCRIPTS: readonly unknown[] = [cardAbc123]
 *
 * `cardId` in each script must equal the card's `cardDefinitionId` in the
 * match state. Scripts are validated when the app starts; an invalid script
 * stops the match engine from loading and names the file path and field.
 */
export const CARD_SCRIPTS: readonly unknown[] = []
