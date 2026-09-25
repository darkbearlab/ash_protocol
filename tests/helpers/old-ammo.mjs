// 3.185.0 (plan C): a save from before it carried a third of today's rifle rounds and half the pistol rounds, and loading
// one multiplies them back (Game.restore). A test that relabels a current game as an older version first turns its
// ammunition back to that scale, so the migration it checks hands back exactly the game it started from.
const exact=(n,k,what)=>{if(n%k)throw new Error(`${what}: ${n} is not a multiple of ${k}`);return n/k;};
export function oldScaleAmmo(data){
  const down=o=>{if(!Number.isSafeInteger(o?.amount))return;if(o.type==='ammo')o.amount=exact(o.amount,3,'rifle item');else if(o.type==='pistol')o.amount=exact(o.amount,2,'pistol item');};
  data.player.reserve=exact(data.player.reserve,3,'rifle reserve');data.player.pistol=exact(data.player.pistol,2,'pistol reserve');
  for(const f of [data,...Object.values(data.floorStates||{})]){for(const i of f.items||[])down(i);for(const o of f.props||[])for(const i of o.contents||[])down(i);}
  return data;
}
// The same for a test that keeps the relabeled save untouched to compare against: a scaled-down copy, as restore text.
export const oldSaveText=raw=>{const copy=structuredClone(raw);oldScaleAmmo(copy.data);return JSON.stringify(copy);};
