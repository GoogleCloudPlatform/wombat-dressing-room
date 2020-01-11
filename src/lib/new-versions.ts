import {Packument} from '@npm/types';

// Returns a list of versions that exist in p2, but not in p1:
export const newVersions = (p1: Packument, p2: Packument): string[] => {
  const versions1 = new Set(Object.keys(p1.versions));
  const versions2 = new Set(Object.keys(p2.versions));
  return [...versions2].filter(version => {
    return !versions1.has(version);
  });
};
