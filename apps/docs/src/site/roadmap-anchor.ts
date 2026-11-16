import { slugify } from '@brett_lamy/docstream';
import type { Library } from './libraries';

/** A library's section on the roadmap's package map (`### <name>`). */
export const packageAnchor = (l: Library) => slugify(l.name);
