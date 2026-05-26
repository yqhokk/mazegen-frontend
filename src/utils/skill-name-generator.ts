import { z } from 'zod'
import { promptToJson } from './structured-output'

const generatedSkillNamesSchema = z.object({
  skillNames: z
    .array(z.string().min(1))
    .describe('Generated skill names in Chinese, without duplicate values'),
})

const generatedSkillCardsSchema = z.object({
  cards: z
    .array(
      z.object({
        name: z.string().min(1).describe('Generated skill card name in Chinese'),
      }),
    )
    .describe('Generated skill cards in Chinese, without duplicate names'),
})

export type GeneratedSkillNames = z.infer<typeof generatedSkillNamesSchema>

export type GeneratedSkillCard = {
  name: string
  damage: number
  cooldown: number
}

export type GenerateSkillNamesOptions = {
  /** 技能数量 */
  count: number

  /** 额外风格描述，例如：暗黑地牢、火焰剑技、魔法吟唱 */
  theme?: string
}

export async function generateSkillNames(
  options: GenerateSkillNamesOptions,
): Promise<string[]> {
  const count = Math.max(1, Math.floor(options.count))
  const theme = options.theme?.trim() || '奇幻迷宫 BOSS 战'

  const result = await promptToJson(
    `生成 ${count} 个玩家技能名称。

要求：
- 使用中文。
- 每个名称 2 到 6 个汉字。
- 名称要适合「${theme}」风格。
- 不要重复。
- 只返回 exactly ${count} 个技能名称。`,
    generatedSkillNamesSchema,
  )

  return result.skillNames.slice(0, count)
}

export async function generateSkillCards(
  options: GenerateSkillNamesOptions,
): Promise<GeneratedSkillCard[]> {
  const count = Math.max(1, Math.floor(options.count))
  const theme = options.theme?.trim() || '奇幻迷宫 BOSS 战'

  const result = await promptToJson(
    `生成 ${count} 张玩家技能卡牌。

要求：
- 使用中文。
- 每张卡牌只生成 name 字段。
- name 为 2 到 6 个汉字。
- 名称要适合「${theme}」风格。
- 卡牌名称不要重复。
- 只返回 exactly ${count} 张卡牌。`,
    generatedSkillCardsSchema,
  )

  return result.cards.slice(0, count).map((card) => ({
    name: card.name,
    damage: randomInteger(4, 24),
    cooldown: randomInteger(0, 4),
  }))
}

function randomInteger(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}