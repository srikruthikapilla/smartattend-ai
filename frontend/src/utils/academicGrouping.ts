export const normalizeAcademicValue = (value?: string | null): string =>
  (value || '').trim().replace(/\s+/g, ' ').toUpperCase();

export const getAcademicGroups = <T>(
  items: T[],
  getBranch: (item: T) => string | undefined,
  getSection: (item: T) => string | undefined
) => {
  const groups = new Map<string, { branch: string; section: string; count: number }>();

  items.forEach(item => {
    const branch = normalizeAcademicValue(getBranch(item)) || 'UNASSIGNED';
    const section = normalizeAcademicValue(getSection(item)) || 'UNASSIGNED';
    const key = `${branch}::${section}`;
    const group = groups.get(key);
    if (group) group.count += 1;
    else groups.set(key, { branch, section, count: 1 });
  });

  return Array.from(groups.values()).sort((a, b) =>
    a.branch.localeCompare(b.branch) || a.section.localeCompare(b.section)
  );
};
