import {MAP_FIELDS} from '../../src/map-geometry.js';
// A hand-built arena replaces the generated rooms; it must not retain their
// ownership/opening descriptor. Assertions and actual save validation stay intact.
// 3.178.0: a hand-built arena keeps the old light rule (an unpowered tile is dim, nothing is black) and drops the
// generated floor's wall lamps; a test of real lighting opts in with its own lamps and light model.
export function clearGeneratedMap(g){for(const k of MAP_FIELDS)delete g[k];g.mapGenerations=[1];g.lightModel=undefined;g.lamps=undefined;}
