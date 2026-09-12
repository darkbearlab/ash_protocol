import {MAP_FIELDS} from '../../src/map-geometry.js';
// A hand-built arena replaces the generated rooms; it must not retain their
// ownership/opening descriptor. Assertions and actual save validation stay intact.
export function clearGeneratedMap(g){for(const k of MAP_FIELDS)delete g[k];g.mapGenerations=[1];}
