const preparations = new Set<() => boolean | Promise<boolean>>()

export function registerUpdatePreparation(prepare: () => boolean | Promise<boolean>) {
 preparations.add(prepare)
 return () => { preparations.delete(prepare) }
}

export async function prepareEditorsForUpdate(): Promise<boolean> {
 for (const prepare of [...preparations]) {
  try { if (!await prepare()) return false }
  catch { return false }
 }
 return true
}
