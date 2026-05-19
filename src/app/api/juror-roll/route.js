import { getCloudflareContext } from "@opennextjs/cloudflare"
import { readSheetValues } from "@/lib/googleSheets"

const CACHE_TTL_MS = 24 * 60 * 60 * 1000

export async function GET() {
  const env = getCloudflareContext().env
  const kv = env.JURY_DATA
  const cloudEnv = env.CLOUDFLARE_ENV || 'preview'
  const cacheKey = `juror-roll:${cloudEnv}`

  try {
    const cached = await kv.get(cacheKey, { type: "json" })
    if (cached?.cachedAt) {
      const age = Date.now() - new Date(cached.cachedAt).getTime()
      if (age < CACHE_TTL_MS) {
        return Response.json(cached)
      }
    }

    const [comparisons, originality, level3Overview] = await Promise.all([
      readSheetValues(env, "Comparisons").catch(() => []),
      readSheetValues(env, "Originality").catch(() => []),
      readSheetValues(env, "Level3Overview").catch(() => [])
    ])

    const jurorMap = new Map()

    const addJuror = (ensName, sheetType, timestamp) => {
      if (!ensName) return
      const key = ensName.toLowerCase()
      const existing = jurorMap.get(key) || {
        ensName,
        badges: new Set(),
        lastSubmissionAt: null
      }
      existing.badges.add(sheetType)
      if (timestamp) {
        const ts = new Date(timestamp).toISOString()
        if (!existing.lastSubmissionAt || ts > existing.lastSubmissionAt) {
          existing.lastSubmissionAt = ts
        }
      }
      jurorMap.set(key, existing)
    }

    const parseSheet = (rows, sheetType, ensIndex, timeIndex) => {
      if (!rows || rows.length === 0) return
      const start = rows.length > 1 ? 1 : 0
      for (let i = start; i < rows.length; i++) {
        const row = rows[i] || []
        const ensName = row[ensIndex]
        const timestamp = row[timeIndex]
        addJuror(ensName, sheetType, timestamp)
      }
    }

    // Sheet schemas match submit functions in src/lib/googleSheets.js
    parseSheet(comparisons, "Comparisons", 2, 3)
    parseSheet(originality, "Originality", 2, 3)
    parseSheet(level3Overview, "Level3Overview", 2, 3)

    const jurors = Array.from(jurorMap.values()).map(j => {
      const hasComp = j.badges.has("Comparisons")
      const hasOrig = j.badges.has("Originality")
      const hasL3 = j.badges.has("Level3Overview")

      let stars = 0
      if (hasComp) stars += 1
      if (hasOrig) stars += 1
      if (hasL3) stars += 1

      const badgeList = []
      if (hasComp) badgeList.push("Top Projects")
      if (hasOrig) badgeList.push("Originality")
      if (hasL3) badgeList.push("Dependencies")

      return {
        ensName: j.ensName,
        stars,
        badges: badgeList,
        lastSubmissionAt: j.lastSubmissionAt
      }
    })

    jurors.sort((a, b) => {
      if (b.stars !== a.stars) return b.stars - a.stars
      if (b.lastSubmissionAt && a.lastSubmissionAt) {
        return b.lastSubmissionAt.localeCompare(a.lastSubmissionAt)
      }
      if (b.lastSubmissionAt) return 1
      if (a.lastSubmissionAt) return -1
      return a.ensName.localeCompare(b.ensName)
    })

    const payload = {
      cachedAt: new Date().toISOString(),
      ttlSeconds: Math.floor(CACHE_TTL_MS / 1000),
      jurors
    }

    await kv.put(cacheKey, JSON.stringify(payload))

    return Response.json(payload)
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
