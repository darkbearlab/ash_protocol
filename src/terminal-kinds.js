// Terminal kinds (3.135.0, user decision 2026-09-18, docs/ITEMS.md). No imports, so map generation can read it.
import {t} from './i18n.js';
export const TERMINAL_KINDS=Object.freeze({arms:t('terminalKinds.arms'),medical:t('terminalKinds.medical'),gear:t('terminalKinds.gear')});
// Each kind stands in the supply room of its theme: arms and ammunition in the ammo room (where the armory weapon
// lies), medical in the medical room, gear in the armour room.
export const KIND_ROOMS=Object.freeze({arms:'ammo',medical:'medical',gear:'armor'});
// Which two kinds a floor gets: the third is left out by a fixed hash of seed and floor, no dice.
export function floorTerminalKinds(seed,floor){const out=((Math.imul(seed|0,31)+Math.imul(floor|0,17))>>>0)%3;return Object.keys(TERMINAL_KINDS).filter((_,i)=>i!==out);}
