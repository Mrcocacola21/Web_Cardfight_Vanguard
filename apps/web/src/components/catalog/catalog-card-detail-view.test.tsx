import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CatalogCardDetailView } from './catalog-card-detail-view'

describe('CatalogCardDetailView', () => {
  it('renders canonical card sections without collapsing printings into the card identity', () => {
    render(
      <CatalogCardDetailView
        detail={{
          card: {
            id: 'card-1',
            canonicalKey: 'card.azure-vanguard-dragon',
            name: 'Azure Vanguard Dragon',
            normalizedName: 'azure vanguard dragon',
            grade: 3,
            cardType: 'normal-unit',
            nation: 'Dragon Empire',
            clan: null,
            race: 'Cosmo Dragon',
            triggerType: null,
            basePower: 13000,
            baseCritical: 1,
            baseShield: 0,
            keywords: ['twin-drive'],
            effectRefs: ['effect.ref.dev.dragon'],
          },
          keywordTags: [
            {
              id: 'twin-drive',
              displayName: 'Twin Drive',
              category: 'mechanic',
              description:
                'A drive mechanic that resolves two drive checks during battle.',
              sortOrder: 10,
            },
          ],
          rules: {
            effectReferences: ['effect.ref.dev.dragon'],
            hasPublishedOracleText: false,
          },
          printings: [
            {
              id: 'printing-1',
              printingKey: 'printing.azure-vanguard-dragon.d-sd01.004.en',
              cardEntityId: 'card-1',
              collectorNumber: '004',
              rarity: 'RRR',
              localeCode: 'en',
              regionCode: 'en',
              printedName: 'Azure Vanguard Dragon',
              artVariant: 'starter-art',
              isAlternateArt: false,
              isPromoVariant: false,
              product: {
                id: 'product-1',
                canonicalKey: 'product.d-sd01.azure-vanguard-start-deck',
                familyId: 'family-standard',
                officialCode: 'D-SD01',
                name: 'Azure Vanguard Start Deck',
                productCategory: 'deck',
                productKind: 'start',
                releaseDate: '2021-05-28',
                regionCode: 'en',
                cycleKey: 'dev-standard-wave-1',
              },
            },
          ],
          legality: {
            eligibilityOverrides: [
              {
                formatId: 'standard',
                formatName: 'Standard',
                ruleProfileId: 'standard-baseline-v1',
                ruleProfileName: 'Standard Baseline',
                eligibilityState: 'allowed',
                rationale:
                  'Published printings exist in product families supported by this format profile.',
              },
              {
                formatId: 'v-premium',
                formatName: 'V Premium',
                ruleProfileId: 'v-premium-baseline-v1',
                ruleProfileName: 'V Premium Baseline',
                eligibilityState: 'disallowed',
                rationale:
                  'No published printings for this card exist in product families supported by this format profile.',
              },
            ],
            restrictions: [],
            choiceRestrictions: [
              {
                formatId: 'premium',
                formatName: 'Premium',
                ruleProfileId: 'premium-baseline-v1',
                ruleProfileName: 'Premium Baseline',
                allowedChoices: 1,
                note: 'Choose one from this pairing.',
                sourceReference: 'dev-seed',
                effectiveFrom: '2026-04-08',
                versionLabel: '2026-04',
              },
            ],
          },
          relatedProducts: [
            {
              id: 'product-1',
              canonicalKey: 'product.d-sd01.azure-vanguard-start-deck',
              officialCode: 'D-SD01',
              name: 'Azure Vanguard Start Deck',
              productCategory: 'deck',
              productKind: 'start',
              releaseDate: '2021-05-28',
              regionCode: 'en',
              printingCount: 1,
              rarities: ['RRR'],
              localeCodes: ['en'],
            },
          ],
        }}
      />,
    )

    expect(
      screen.getByRole('heading', { name: /azure vanguard dragon/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/canonical card entity/i, {
        selector: '[data-slot="card-title"]',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/rules & references/i, {
        selector: '[data-slot="card-title"]',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/legality facts/i, {
        selector: '[data-slot="card-title"]',
      }),
    ).toBeInTheDocument()
    expect(screen.getAllByText(/azure vanguard start deck/i)).toHaveLength(2)
    expect(screen.getByText(/^allowed$/i)).toBeInTheDocument()
    expect(screen.getByText(/^disallowed$/i)).toBeInTheDocument()
    expect(screen.getByText(/choose one/i)).toBeInTheDocument()
    expect(screen.getByText(/effect\.ref\.dev\.dragon/i)).toBeInTheDocument()
    expect(screen.getByText(/keyword & mechanics tags/i)).toBeInTheDocument()
    expect(screen.getAllByText(/^twin drive$/i)).toHaveLength(2)
    expect(
      screen.getByRole('link', { name: /printing detail/i }),
    ).toHaveAttribute(
      'href',
      '/catalog/printings/printing.azure-vanguard-dragon.d-sd01.004.en',
    )
    expect(screen.getByRole('link', { name: /release page/i })).toHaveAttribute(
      'href',
      '/catalog/products/product.d-sd01.azure-vanguard-start-deck',
    )
  })

  it('renders honest empty states for missing printings, products, and legality facts', () => {
    render(
      <CatalogCardDetailView
        detail={{
          card: {
            id: 'card-2',
            canonicalKey: 'card.azure-critical-pulse',
            name: 'Azure Critical Pulse',
            normalizedName: 'azure critical pulse',
            grade: 0,
            cardType: 'trigger-unit',
            nation: 'Dragon Empire',
            clan: null,
            race: 'Element',
            triggerType: 'critical',
            basePower: 5000,
            baseCritical: 1,
            baseShield: 15000,
            keywords: [],
            effectRefs: [],
          },
          keywordTags: [],
          rules: {
            effectReferences: [],
            hasPublishedOracleText: false,
          },
          printings: [],
          legality: {
            eligibilityOverrides: [],
            restrictions: [],
            choiceRestrictions: [],
          },
          relatedProducts: [],
        }}
      />,
    )

    expect(
      screen.getByText(/no published rules references are attached/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/no structured keyword or mechanic tags are published/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/no concrete printings are currently published/i),
    ).toBeInTheDocument()
    expect(
      screen.getAllByText(/no active card restriction entries are published/i),
    ).toHaveLength(2)
    expect(
      screen.getByText(/no related products can be derived/i),
    ).toBeInTheDocument()
  })
})
