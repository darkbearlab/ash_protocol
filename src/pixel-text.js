// Tiny heading (3.117.0, user correction of 3.116.0): the level-up transmission title is ordinary monospace text set very
// small, drawn at one canvas pixel per CSS pixel with its anti-aliasing thrown away. The canvas is shown without
// smoothing, so on a high-density phone each text pixel becomes a visible square, and the VHS scanlines cut through
// them as a grid. It is not a bitmap face.
export const TINY_TEXT=Object.freeze({px:9,weight:700,letterSpacing:1,alphaCut:110,font:'"IBM Plex Mono", monospace'});
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));

// Hard pixels from an anti-aliased render: a pixel is lit when its coverage passes the cut. A one-pixel shadow down and
// to the right fills only unlit pixels, so the letters keep their shape.
export function hardenText(data,width,height,{color,shadow,cut=TINY_TEXT.alphaCut}){
  const lit=new Uint8Array(width*height);
  for(let i=0;i<lit.length;i++)lit[i]=data[i*4+3]>=cut?1:0;
  const [r,g,b]=rgb(color),dark=shadow?rgb(shadow):null;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=y*width+x,o=i*4;
    if(lit[i]){data[o]=r;data[o+1]=g;data[o+2]=b;data[o+3]=255;}
    else if(dark&&x>0&&y>0&&lit[i-width-1]){data[o]=dark[0];data[o+1]=dark[1];data[o+2]=dark[2];data[o+3]=255;}
    else data[o+3]=0;
  }
  return lit.reduce((n,v)=>n+v,0);
}

export function drawTinyText(canvas,text,{color,shadow}){
  const {px,weight,letterSpacing,font}=TINY_TEXT,c=canvas.getContext('2d'),spec=`${weight} ${px}px ${font}`;
  c.font=spec;
  const advances=[...text].map(ch=>c.measureText(ch).width+letterSpacing);
  const width=Math.ceil(advances.reduce((a,w)=>a+w,0)-letterSpacing)+2,height=px+4;
  canvas.width=width;canvas.height=height;canvas.style.width=`${width}px`;canvas.style.height=`${height}px`;
  c.font=spec;c.textBaseline='top';c.fillStyle='#fff';
  let x=0;[...text].forEach((ch,i)=>{c.fillText(ch,Math.round(x),1);x+=advances[i];});
  const image=c.getImageData(0,0,width,height);hardenText(image.data,width,height,{color,shadow});c.putImageData(image,0,0);
}
