export const COVER_PULL_THRESHOLD = 140
export function coverStretch(distance: number) { return Math.min(128, Math.max(0, distance) * .5) }
export function shouldExpandCover(distance: number) { return distance >= COVER_PULL_THRESHOLD }
