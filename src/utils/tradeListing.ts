// Display metadata may omit listed, or retain a stale value after an RPC failure.
// Trading must use an explicit on-chain boolean, never a falsy default.
export async function resolveTradeListing(
  community: { version?: number | null; isImport?: number | boolean | null },
  readListed: () => Promise<unknown>,
): Promise<boolean> {
  if (Number(community.version) === 10 || community.isImport === 1 || community.isImport === true) return true
  const listed = await readListed()
  if (typeof listed !== 'boolean') throw new Error('Unable to verify token listing status. Please refresh the quote.')
  return listed
}
