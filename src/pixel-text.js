// Pixel lettering (3.116.0, user request): the level-up transmission is set in a 5x7 bitmap face and scaled up without
// smoothing, so the letters read as pixels. Only the glyphs the game uses are defined; an unknown character is a gap.
const G=rows=>Object.freeze(rows.map(r=>[...r].map(Number)));
export const PIXEL_GLYPHS=Object.freeze({
  A:G(['01110','10001','10001','11111','10001','10001','10001']),
  C:G(['01110','10001','10000','10000','10000','10001','01110']),
  G:G(['01110','10001','10000','10111','10001','10001','01111']),
  I:G(['11111','00100','00100','00100','00100','00100','11111']),
  M:G(['10001','11011','10101','10101','10001','10001','10001']),
  N:G(['10001','10001','11001','10101','10011','10001','10001']),
  O:G(['01110','10001','10001','10001','10001','10001','01110']),
  R:G(['11110','10001','10001','11110','10100','10010','10001']),
  S:G(['01111','10000','10000','01110','00001','00001','11110']),
  T:G(['11111','00100','00100','00100','00100','00100','00100']),
});
export const GLYPH_W=5,GLYPH_H=7,LETTER_GAP=1,LINE_GAP=3;
// Lit cells for centred lines, plus the bitmap size. A one-pixel shadow sits down and right, so the size leaves room.
export function pixelTextLayout(lines){
  const widths=lines.map(line=>Math.max(0,line.length*(GLYPH_W+LETTER_GAP)-LETTER_GAP)),width=Math.max(0,...widths);
  const cells=[];
  lines.forEach((line,row)=>{
    const left=Math.floor((width-widths[row])/2),top=row*(GLYPH_H+LINE_GAP);
    [...line].forEach((ch,i)=>{const glyph=PIXEL_GLYPHS[ch];if(!glyph)return;glyph.forEach((bits,y)=>bits.forEach((on,x)=>{if(on)cells.push({x:left+i*(GLYPH_W+LETTER_GAP)+x,y:top+y});}));});
  });
  return {width:width+1,height:lines.length*(GLYPH_H+LINE_GAP)-LINE_GAP+1,cells};
}
export function drawPixelText(canvas,lines,{color,shadow,scale=3}){
  const {width,height,cells}=pixelTextLayout(lines);
  canvas.width=width;canvas.height=height;canvas.style.width=`${width*scale}px`;canvas.style.height=`${height*scale}px`;
  const c=canvas.getContext('2d');c.clearRect(0,0,width,height);
  if(shadow){c.fillStyle=shadow;for(const p of cells)c.fillRect(p.x+1,p.y+1,1,1);}
  c.fillStyle=color;for(const p of cells)c.fillRect(p.x,p.y,1,1);
}
