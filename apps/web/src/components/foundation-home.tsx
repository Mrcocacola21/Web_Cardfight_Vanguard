import { ArrowRight, Layers3, Palette, Route } from 'lucide-react'

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
        <Card className="border-white/50 shadow-2xl shadow-black/5 backdrop-blur">
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
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border bg-background/70 p-4">
                <Route className="mb-3 size-4 text-primary" />
                <p className="text-sm font-medium">App Router shell</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Routing and layout foundation are in place for future screens.
                </p>
              </div>
              <div className="rounded-xl border bg-background/70 p-4">
                <Palette className="mb-3 size-4 text-primary" />
                <p className="text-sm font-medium">Design tokens</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Minimal theme variables are configured without a full design
                  system buildout.
                </p>
              </div>
              <div className="rounded-xl border bg-background/70 p-4">
                <Layers3 className="mb-3 size-4 text-primary" />
                <p className="text-sm font-medium">Monorepo-safe start</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Generated components stay app-local for now to avoid premature
                  extraction into shared packages.
                </p>
              </div>
            </div>

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
          <Card className="border-white/50 bg-card/90 shadow-xl shadow-black/5 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-lg">Input Baseline</CardTitle>
              <CardDescription>
                A small, practical component set is ready for the next frontend
                steps.
              </CardDescription>
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

          <Card className="border-white/50 bg-card/85 shadow-xl shadow-black/5 backdrop-blur">
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
        </div>
      </div>
    </main>
  )
}
