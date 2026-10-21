export function coverOpacity(scroll: number) { return Math.max(0, Math.min(1, 1 - Math.max(0, scroll) / 180)) }

export function coverOffset(scroll: number) { return scroll <= 0 ? 0 : -Math.min(108, scroll * .6) }
