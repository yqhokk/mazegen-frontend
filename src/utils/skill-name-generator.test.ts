import { describe, expect, it, vi } from 'vitest'

vi.mock('./structured-output', () => ({
  promptToJson: vi.fn(async () => ({
    cards: [
      { name: '打击' },
      { name: '防御' },
      { name: '痛击' },
      { name: '重刃' },
      { name: '旋风斩' },
      { name: '燃烧血' },
      { name: '战吼' },
      { name: '耸肩' },
      { name: '壁垒' },
      { name: '恶魔形态' },
      { name: '剑柄打击' },
      { name: '顺劈斩' },
      { name: '双重打击' },
      { name: '火焰吐息' },
      { name: '祭品' },
      { name: '狂怒' },
      { name: '金属化' },
      { name: '震荡波' },
      { name: '上勾拳' },
      { name: '极限突破' },
    ],
  })),
}))

describe('generateSkillCards', () => {
  it('generates 20 Slay the Spire style skill cards with random damage and cooldown', async () => {
    const { promptToJson } = await import('./structured-output')
    const { generateSkillCards } = await import('./skill-name-generator')

    const cards = await generateSkillCards({
      count: 20,
      theme: '杀戮尖塔',
    })

    expect(cards).toHaveLength(20)
    expect(new Set(cards.map((card) => card.name)).size).toBe(20)
    expect(cards.every((card) => card.name.length >= 2 && card.name.length <= 6)).toBe(true)
    expect(cards.every((card) => card.damage >= 4 && card.damage <= 24)).toBe(true)
    expect(cards.every((card) => card.cooldown >= 0 && card.cooldown <= 4)).toBe(true)
    expect(promptToJson).toHaveBeenCalledOnce()
    expect(promptToJson).toHaveBeenCalledWith(
      expect.stringContaining('生成 20 张玩家技能卡牌'),
      expect.anything(),
    )
    expect(promptToJson).toHaveBeenCalledWith(
      expect.stringContaining('杀戮尖塔'),
      expect.anything(),
    )
  })
})