import { z } from 'zod'

type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

type ChatChoice = {
  message?: {
    content?: string
  }
}

type ChatResponse = {
  choices?: ChatChoice[]
}

const API_URL = 'https://api.deepseek.com/chat/completions'
const API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY

export async function promptToJson<TSchema extends z.ZodType>(
  prompt: string,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  if (!API_KEY) {
    throw new Error('Missing VITE_DEEPSEEK_API_KEY in .env')
  }

  const jsonSchema = z.toJSONSchema(schema)

  const systemPrompt = `You are a JSON generator. Convert the user's prompt into valid JSON only.

Rules:
- The response must be valid JSON.
- Do not wrap the JSON in markdown.
- Do not include explanations.
- The JSON must match this JSON Schema exactly:
${JSON.stringify(jsonSchema, null, 2)}

Example JSON output:
${JSON.stringify(makeExampleFromJsonSchema(jsonSchema), null, 2)}`

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Please output json for this prompt:\n${prompt}` },
  ]

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      response_format: { type: 'json_object' },
      max_tokens: 2048,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Structured output request failed: ${response.status} ${errorText}`)
  }

  const data = (await response.json()) as ChatResponse
  const content = data.choices?.[0]?.message?.content

  if (!content) {
    throw new Error('Structured output request returned empty content')
  }

  const parsed = JSON.parse(content)
  return schema.parse(parsed)
}

function makeExampleFromJsonSchema(schema: unknown): unknown {
  if (!schema || typeof schema !== 'object') return null

  const jsonSchema = schema as {
    type?: string
    properties?: Record<string, unknown>
    items?: unknown
    enum?: unknown[]
  }

  if (jsonSchema.enum?.length) return jsonSchema.enum[0]

  if (jsonSchema.type === 'object') {
    return Object.fromEntries(
      Object.entries(jsonSchema.properties ?? {}).map(([key, value]) => [
        key,
        makeExampleFromJsonSchema(value),
      ]),
    )
  }

  if (jsonSchema.type === 'array') return [makeExampleFromJsonSchema(jsonSchema.items)]
  if (jsonSchema.type === 'number' || jsonSchema.type === 'integer') return 0
  if (jsonSchema.type === 'boolean') return false
  if (jsonSchema.type === 'null') return null

  return 'string'
}