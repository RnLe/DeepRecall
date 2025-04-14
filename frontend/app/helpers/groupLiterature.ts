// helpers/groupLiteratures.ts

import { LiteratureExtended } from './literatureTypes';

export const groupLiteraturesByType = (literatures: LiteratureExtended[]) => {
  return literatures.reduce((acc: { [key: string]: LiteratureExtended[] }, lit) => {
    const { type } = lit;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(lit);
    return acc;
  }, {});
};
