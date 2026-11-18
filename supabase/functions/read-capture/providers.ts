// Who reads the capture. Cloudflare Workers AI first: open models on Cloudflare's free daily
// allowance (10,000 neurons; a capture takes about 50, so some 180 a day). Claude when only
// its key is loaded. Mistral Small 3.1 read 124 of 126 stores of 12 real captures exactly,
// with nothing made up, in about 10 s (Llama 4 Scout and Gemma 4: 105 and 106, slower).
import { PROMPT, SCHEMA, toTranscript, type Transcript } from './transcript.ts'

export interface Reading {
  transcript: Transcript | null
  model: string
  /** Estimated cost, in thousandths of a dollar (0 while within Cloudflare's free allowance). */
  cost: number
}
export class ProviderError extends Error {}

const cfAccount = Deno.env.get('CLOUDFLARE_ACCOUNT_ID') ?? ''
const cfToken = Deno.env.get('CLOUDFLARE_AI_TOKEN') ?? ''
const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') ?? ''

// USD per million tokens (input, output), to estimate what each capture would cost if paid.
const PRICES: Record<string, [number, number]> = {
  '@cf/meta/llama-4-scout-17b-16e-instruct': [0.27, 0.85],
  '@cf/mistralai/mistral-small-3.1-24b-instruct': [0.351, 0.555],
  '@cf/google/gemma-3-12b-it': [0.345, 0.556],
  '@cf/google/gemma-4-26b-a4b-it': [0.1, 0.3],
  'claude-haiku-5-5': [0.1, 0.5],
  'claude-sonnet-5-5': [2, 10],
}
const costOf = (model: string, input = 0, output = 0) => {
  const [i, o] = PRICES[model] ?? [1, 4]
  return (input * i + output * o) / 1000
}

export const provider = cfAccount && cfToken ? 'cloudflare' : anthropicKey ? 'anthropic' : null

/** AI_MODEL picks another model of the provider in use. */
export function defaultModel() {
  const set = Deno.env.get('AI_MODEL') ?? ''
  if (provider === 'cloudflare') return set.startsWith('@cf/') ? set : '@cf/mistralai/mistral-small-3.1-24b-instruct'
  return set && !set.startsWith('@cf/') ? set : 'claude-haiku-5-5'
}

export interface Image {
  data: string
  type: string
}

/** What to ask: one capture, or the slices of a long one (the overlap is not repeated). */
const ask = (n: number) => n > 1
  ? `Estas ${n} imágenes son partes de UNA misma captura larga, en orden de arriba hacia abajo, y se superponen un poco. Transcribí la lista completa una sola vez: todas las filas, sin repetir las que aparecen en dos partes.`
  : 'Transcribí esta captura.'

export async function readImage(images: Image[], model = defaultModel()): Promise<Reading> {
  const read = (some: Image[]) => (provider === 'cloudflare' ? readWithCloudflare(some, model) : readWithClaude(some, model))
  try {
    return await read(images)
  } catch (e) {
    // A model that takes one image at a time: each slice on its own, the rows joined in order.
    if (images.length < 2 || !(e instanceof ProviderError) || e.message !== 'ai_failed') throw e
    const parts = await Promise.all(images.map((i) => read([i])))
    return { transcript: joinTranscripts(parts.map((p) => p.transcript)), model, cost: parts.reduce((n, p) => n + p.cost, 0) }
  }
}

/** Slices read one by one as one list: the first one's title and column titles, each row once. */
function joinTranscripts(parts: (Transcript | null)[]): Transcript | null {
  const read = parts.filter((p): p is Transcript => p !== null)
  const [first] = read
  if (!first) return null
  const seen = new Set<string>()
  const rows = read.flatMap((p) => p.rows).filter((r) => {
    const key = r.join('|')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return { title: first.title, headers: first.headers.length ? first.headers : read.find((p) => p.headers.length)?.headers ?? [], rows, unreadable: read.reduce((n, p) => n + p.unreadable, 0) }
}

async function readWithCloudflare(images: Image[], model: string): Promise<Reading> {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfAccount}/ai/v1/chat/completions`, {
    method: 'POST',
    signal: AbortSignal.timeout(90_000),
    headers: { Authorization: `Bearer ${cfToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 8000,
      messages: [
        { role: 'system', content: PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: ask(images.length) },
            ...images.map((i) => ({ type: 'image_url', image_url: { url: `data:${i.type};base64,${i.data}` } })),
          ],
        },
      ],
    }),
  }).catch(() => null)
  if (!res?.ok) {
    console.error('cloudflare', res?.status, (await res?.text())?.slice(0, 500))
    throw new ProviderError('ai_failed')
  }
  const out = (await res.json()) as {
    choices?: { message?: { content?: unknown }; finish_reason?: string }[]
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }
  const choice = out.choices?.[0]
  if (choice?.finish_reason === 'length') throw new ProviderError('ai_incomplete')
  return {
    transcript: toTranscript(choice?.message?.content),
    model,
    cost: costOf(model, out.usage?.prompt_tokens, out.usage?.completion_tokens),
  }
}

async function readWithClaude(images: Image[], model: string): Promise<Reading> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal: AbortSignal.timeout(90_000),
    headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: 16000,
      messages: [{
        role: 'user',
        content: [
          ...images.map((i) => ({ type: 'image', source: { type: 'base64', media_type: i.type, data: i.data } })),
          { type: 'text', text: `${PROMPT}\n\n${ask(images.length)}` },
        ],
      }],
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
    }),
  }).catch(() => null)
  if (!res?.ok) {
    console.error('anthropic', res?.status, (await res?.text())?.slice(0, 500))
    throw new ProviderError('ai_failed')
  }
  const out = (await res.json()) as { stop_reason?: string; content?: { type: string; text?: string }[]; usage?: { input_tokens?: number; output_tokens?: number } }
  if (out.stop_reason !== 'end_turn') throw new ProviderError('ai_incomplete')
  return {
    transcript: toTranscript(out.content?.find((c) => c.type === 'text')?.text ?? ''),
    model,
    cost: costOf(model, out.usage?.input_tokens, out.usage?.output_tokens),
  }
}
