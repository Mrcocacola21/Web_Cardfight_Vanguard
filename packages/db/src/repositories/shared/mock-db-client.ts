import type { DbClient } from './client'

export interface MockQueryInvocation {
  readonly schema: string
  readonly table: string
  readonly operation: 'select' | 'insert' | 'update' | 'upsert' | 'delete'
  readonly select: string | null
  readonly count: 'exact' | 'planned' | 'estimated' | null
  readonly values: unknown
  readonly filters: readonly {
    readonly type: 'eq' | 'in' | 'ilike'
    readonly column: string
    readonly value: unknown
  }[]
  readonly orders: readonly {
    readonly column: string
    readonly ascending: boolean
  }[]
  readonly range: {
    readonly from: number
    readonly to: number
  } | null
  readonly onConflict: string | null
  readonly cardinality: 'many' | 'single' | 'maybeSingle'
}

export interface MockQueryResponse {
  readonly data: unknown
  readonly error: unknown
  readonly count?: number | null
}

interface MockStep {
  readonly assert?: (query: MockQueryInvocation) => void
  readonly response: MockQueryResponse
}

class MockQueryBuilder {
  private readonly filters: MockQueryInvocation['filters'] = []
  private readonly orders: MockQueryInvocation['orders'] = []
  private selectClause: string | null = null
  private count: MockQueryInvocation['count'] = null
  private values: unknown = null
  private onConflict: string | null = null
  private operation: MockQueryInvocation['operation'] = 'select'
  private rangeValues: MockQueryInvocation['range'] = null

  constructor(
    private readonly schemaName: string,
    private readonly tableName: string,
    private readonly consumeStep: (
      query: MockQueryInvocation,
    ) => MockQueryResponse | Promise<MockQueryResponse>,
  ) {}

  select(
    select: string,
    options?: {
      count?: MockQueryInvocation['count']
    },
  ) {
    this.selectClause = select
    this.count = options?.count ?? null
    return this
  }

  eq(column: string, value: unknown) {
    ;(this.filters as Array<(typeof this.filters)[number]>).push({
      type: 'eq',
      column,
      value,
    })
    return this
  }

  in(column: string, value: readonly unknown[]) {
    ;(this.filters as Array<(typeof this.filters)[number]>).push({
      type: 'in',
      column,
      value: [...value],
    })
    return this
  }

  ilike(column: string, value: string) {
    ;(this.filters as Array<(typeof this.filters)[number]>).push({
      type: 'ilike',
      column,
      value,
    })
    return this
  }

  order(column: string, options?: { ascending?: boolean }) {
    ;(this.orders as Array<(typeof this.orders)[number]>).push({
      column,
      ascending: options?.ascending ?? true,
    })
    return this
  }

  range(from: number, to: number) {
    this.rangeValues = {
      from,
      to,
    }
    return this
  }

  insert(values: unknown) {
    this.operation = 'insert'
    this.values = values
    return this
  }

  update(values: unknown) {
    this.operation = 'update'
    this.values = values
    return this
  }

  upsert(values: unknown, options?: { onConflict?: string }) {
    this.operation = 'upsert'
    this.values = values
    this.onConflict = options?.onConflict ?? null
    return this
  }

  delete() {
    this.operation = 'delete'
    return this
  }

  maybeSingle() {
    return this.execute('maybeSingle')
  }

  single() {
    return this.execute('single')
  }

  then<TResult1 = MockQueryResponse, TResult2 = never>(
    onfulfilled?:
      | ((value: MockQueryResponse) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute('many').then(onfulfilled, onrejected)
  }

  private execute(cardinality: MockQueryInvocation['cardinality']) {
    return Promise.resolve(
      this.consumeStep({
        schema: this.schemaName,
        table: this.tableName,
        operation: this.operation,
        select: this.selectClause,
        count: this.count,
        values: this.values,
        filters: this.filters,
        orders: this.orders,
        range: this.rangeValues,
        onConflict: this.onConflict,
        cardinality,
      }),
    )
  }
}

export function createSequentialMockDbClient(steps: readonly MockStep[]): {
  readonly client: DbClient
  readonly assertConsumed: () => void
} {
  let stepIndex = 0

  const consumeStep = (query: MockQueryInvocation) => {
    const step = steps[stepIndex]

    if (!step) {
      throw new Error(
        `Unexpected mock DB invocation #${stepIndex + 1} for ${query.schema}.${query.table}.`,
      )
    }

    stepIndex += 1
    step.assert?.(query)

    return step.response
  }

  const client = {
    schema(schemaName: string) {
      return {
        from(tableName: string) {
          return new MockQueryBuilder(schemaName, tableName, consumeStep)
        },
      }
    },
  }

  return {
    client: client as unknown as DbClient,
    assertConsumed() {
      if (stepIndex !== steps.length) {
        throw new Error(
          `Mock DB client consumed ${stepIndex} of ${steps.length} expected steps.`,
        )
      }
    },
  }
}
