export const COVER_PULL_THRESHOLD = 140
export function coverStretch(distance: number) { return Math.min(128, Math.max(0, distance) * .5) }
export function shouldExpandCover(distance: number) { return distance >= COVER_PULL_THRESHOLD }

export function coverOpacity(scroll: number) { return Math.max(0, Math.min(1, 1 - Math.max(0, scroll) / 180)) }

export function coverOffset(scroll: number) { return scroll <= 0 ? 0 : -Math.min(108, scroll * .6) }
