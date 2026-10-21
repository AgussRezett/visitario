import type { FakeState, Row } from './fake-state'

interface Ctx {
  path: string
  url: URL
  state: FakeState
  json: (body: unknown, status?: number) => Promise<void>
  body: () => Row
}

/** Operativos: the day's list, the actions (recorded) and the company's activadores to pick. */
export async function handleOperation({ path, url, state, json, body }: Ctx): Promise<true | undefined> {
  const send = async (b: unknown, status?: number) => {
    await json(b, status)
    return true as const
  }
  const record = (fn: string) => (state.operationCalls ??= []).push({ fn, ...body() })
  if (path.endsWith('/membership') && url.searchParams.has('roles')) return send(state.teammates ?? [])
  if (path.endsWith('/rpc/day_operations')) return send(state.operations ?? [])
  if (path.endsWith('/rpc/create_operation')) {
    record('create')
    return send('op-new')
  }
  for (const fn of ['add_operation_member', 'leave_operation', 'end_operation'] as const) {
    if (path.endsWith(`/rpc/${fn}`)) {
      record(fn)
      return send(null)
    }
  }
  if (path.endsWith('/rpc/bring_to_operation')) {
    record('bring')
    return send(((body().p_visits as string[]) ?? []).length)
  }
  return undefined
}
