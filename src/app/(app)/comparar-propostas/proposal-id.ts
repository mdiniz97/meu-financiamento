export function nextProposalId(proposals: ReadonlyArray<{ id: string }>) {
  const used = new Set(proposals.map((proposal) => proposal.id));
  for (const id of ['p1', 'p2', 'p3', 'p4']) {
    if (!used.has(id)) return id;
  }
  return null;
}
