export function clampWatchedEpisodeCount(value: number, totalEpisodeCount: number) {
  const normalizedTotal = Math.max(0, Math.trunc(totalEpisodeCount))
  const normalizedValue = Number.isFinite(value) ? Math.trunc(value) : 0

  return Math.min(Math.max(normalizedValue, 0), normalizedTotal)
}
