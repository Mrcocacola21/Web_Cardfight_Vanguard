import Link from 'next/link'
import { ArrowRight, Layers3, Palette, Route } from 'lucide-react'

import { StatBlock, StatGrid } from '@/components/data-display'
import { FoundationDataDisplayPreview } from '@/components/foundation/foundation-data-display-preview'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { siteConfig } from '@/lib/site'

const readinessItems = [
  'Tailwind CSS is active in the App Router shell.',
  'shadcn/ui components are installed app-local for a faster and cleaner start.',
  'The web app remains a composition layer and does not own domain behavior.',
]

export function FoundationHome() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-14 md:px-10">
      <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
        <Card className="bg-card/92 backdrop-blur-sm">
          <CardHeader className="gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">UI Foundation</Badge>
              <Badge variant="secondary">Next.js App Router</Badge>
              <Badge>shadcn/ui Ready</Badge>
            </div>
            <div className="space-y-3">
              <CardTitle className="text-3xl tracking-tight md:text-5xl">
                {siteConfig.title}
              </CardTitle>
              <CardDescription className="max-w-2xl text-pretty text-sm leading-6 md:text-base">
                Tailwind CSS and shadcn/ui are integrated into the app shell.
                This page is a technical baseline only. It demonstrates the UI
                foundation without pretending that product features already
                exist.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <StatGrid columns={3}>
              <StatBlock
                label="App Router shell"
                value={
                  <span className="inline-flex items-center gap-2">
                    <Route className="size-4 text-primary" />
                    Ready
                  </span>
                }
                hint="Routing and layout foundation are in place for future screens."
              />
              <StatBlock
                label="Design tokens"
                value={
                  <span className="inline-flex items-center gap-2">
                    <Palette className="size-4 text-primary" />
                    Dark-first
                  </span>
                }
                hint="Minimal theme variables are configured without a full design system buildout."
                tone="accent"
              />
              <StatBlock
                label="Component scope"
                value={
                  <span className="inline-flex items-center gap-2">
                    <Layers3 className="size-4 text-primary" />
                    App-local
                  </span>
                }
                hint="Generated components stay app-local for now to avoid premature extraction into shared packages."
              />
            </StatGrid>

            <Separator />

            <div className="space-y-3">
              <p className="text-sm font-medium">Primitive check</p>
              <div className="flex flex-wrap items-center gap-3">
                <Button>Primary action</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">
                  Next step
                  <ArrowRight className="size-4" />
                </Button>
                <Link
                  href="/catalog"
                  className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium transition-colors hover:bg-muted"
                >
                  Open catalog
                </Link>
                <Link
                  href="/profile"
                  className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium transition-colors hover:bg-muted"
                >
                  Profile (protected)
                </Link>
                <Link
                  href="/users"
                  className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium transition-colors hover:bg-muted"
                >
                  Users
                </Link>
                <Link
                  href="/friends"
                  className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium transition-colors hover:bg-muted"
                >
                  Friends
                </Link>
                <Link
                  href="/decks"
                  className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium transition-colors hover:bg-muted"
                >
                  Decks (protected)
                </Link>
                <Link
                  href="/login"
                  className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium transition-colors hover:bg-muted"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium transition-colors hover:bg-muted"
                >
                  Register
                </Link>
                <Badge variant="outline">Button</Badge>
                <Badge variant="secondary">Input</Badge>
                <Badge>Card</Badge>
              </div>
            </div>
          </CardContent>
          <CardFooter className="text-sm text-muted-foreground">
            The next steps are package integration, app structure growth, and
            real feature work through bounded package contracts.
          </CardFooter>
        </Card>

        <div className="grid gap-6">
          <Card className="bg-card/92 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg">Data Display Baseline</CardTitle>
              <CardDescription>
                Shared search, filters, and stat display primitives are ready
                for future catalog and deck screens.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FoundationDataDisplayPreview />
            </CardContent>
          </Card>

          <Card className="bg-card/90 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg">Current Boundaries</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {readinessItems.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-card/90 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg">Loading Baseline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                aria-label="Foundation input preview"
                placeholder="App-local UI primitives are now available"
              />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
