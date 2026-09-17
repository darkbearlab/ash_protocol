-- Aseprite batch prototype: all unit art, shared living/dead palettes, no dithering.
local root=app.params.root
local out=root..'/assets/pixel/'
local C=app.pixelColor
local function copyCell(src, sx, sy)
 local im=Image(32,32,ColorMode.RGB)
 for y=0,31 do for x=0,31 do im:drawPixel(x,y,src:getPixel(sx+x,sy+y)) end end
 return im
end
local function outlined(src,preserveColors)
 local ink=C.rgba(12,14,18,255)
 local function opaque(x,y) return x>=0 and x<32 and y>=0 and y<32 and C.rgbaA(src:getPixel(x,y))>0 end
 local function dark(p) return math.max(C.rgbaR(p),C.rgbaG(p),C.rgbaB(p))<=45 end
 local edge={}
 for y=0,31 do for x=0,31 do if opaque(x,y) then
  for dy=-1,1 do for dx=-1,1 do if not opaque(x+dx,y+dy) then edge[y*32+x]=true end end end
 end end end
 -- Reuse existing dark silhouette pixels as the ink, instead of wrapping them
 -- with another dark ring. Light boundary pixels still receive an outside rim.
 local im=Image(src)
 for y=0,31 do for x=0,31 do
  local p=src:getPixel(x,y)
  if opaque(x,y) and preserveColors then
   -- Original-colour edition: every source pixel is immutable, including shadows.
  elseif opaque(x,y) then
   if edge[y*32+x] and dark(p) then im:drawPixel(x,y,ink)
   elseif dark(p) then
    local touchesInk=false
    for dy=-1,1 do for dx=-1,1 do local a,b=x+dx,y+dy
     if opaque(a,b) and edge[b*32+a] and dark(src:getPixel(a,b)) then touchesInk=true end
    end end
    if touchesInk then
     -- Restore the second dark band to a nearby existing material colour.
     -- Enclosed shadows away from the silhouette are deliberately untouched.
     local best=nil;local bestScore=99999
     for dy=-2,2 do for dx=-2,2 do local a,b=x+dx,y+dy
      if opaque(a,b) then local q=src:getPixel(a,b)
       if not dark(q) then local score=(dx*dx+dy*dy)*1000+C.rgbaR(q)+C.rgbaG(q)+C.rgbaB(q)
        if score<bestScore then best=q;bestScore=score end
       end
      end
     end end
     if best then im:drawPixel(x,y,best) end
    end
   end
  else
   local brightNeighbor=false
   for dy=-1,1 do for dx=-1,1 do local a,b=x+dx,y+dy
    if opaque(a,b) and not dark(src:getPixel(a,b)) then brightNeighbor=true end
   end end
   if brightNeighbor then im:drawPixel(x,y,ink) end
  end
 end end
 return im
end

local units={
 {'soldier',true,0},{'recon',true,1},{'engineer',true,2},{'druid',true,3},
 {'necromancer',true,4},{'bulwark',true,5},{'berserker',true,6},{'ninja',true,7},
 {'legacy-player',false,0},{'rifleman',false,1},{'raider',false,2},{'sniper',false,3},
 {'brute',false,4},{'drone',false,5},{'warden',false,6},{'boss',false,7},
 {'crawler',false,8},{'bomber',false,9},{'civilian',false,16},{'spitter',false,17}
}
local originals={classes=Image{fromFile=out..'classes-v1/atlas.png'},actors=Image{fromFile=out..'atlas.png'},dead=Image{fromFile=out..'aftermath.png'}}
local variants={colors={},outline={},['original-outline']={}}
for mode,t in pairs(variants) do for key,im in pairs(originals) do t[key]=Image(im) end end
for _,u in ipairs(units) do
 local name,isClass,idx=u[1],u[2],u[3]
 local stand=copyCell(originals[isClass and 'classes' or 'actors'],(idx%4)*32,math.floor(idx/4)*32)
 if name=='berserker' then
  -- Broaden standing silhouette by 25%, anchored at the tile centre.
  -- Stretch y=2..28 to y=2..30, keeping one bottom pixel for the outline.
  -- Nearest-neighbour sampling preserves the source colours and hard pixels.
  local wide=Image(32,32,ColorMode.RGB)
  for y=0,31 do for x=0,31 do
   local sx=math.floor((x-15.5)/1.25+16)
   local sy=y>=2 and y<=30 and 2+math.floor((y-2)*27/29) or y
   if sx>=0 and sx<32 then wide:drawPixel(x,y,stand:getPixel(sx,sy)) end
  end end
  stand=wide
  stand:saveAs(root..'/art/palette-preview/berserker-wide-source.png')
 end
 local deadIdx=isClass and idx+8 or idx
 local dead=copyCell(originals[isClass and 'classes' or 'dead'],(deadIdx%4)*32,math.floor(deadIdx/4)*32)
 local s=Sprite(64,32,ColorMode.RGB)
 s.cels[1].image:drawImage(stand,Point(0,0));s.cels[1].image:drawImage(dead,Point(32,0))
 if isClass then
  local pal=Palette(6);pal:setColor(0,Color{r=0,g=0,b=0,a=0})
  for i,v in ipairs({20,65,120,180,235}) do pal:setColor(i,Color{r=v,g=v,b=v,a=255}) end
  s:setPalette(pal)
 else app.command.ColorQuantization{ui=false,withAlpha=true,maxColors=9,algorithm='octree'} end
 app.command.ChangePixelFormat{ui=false,format='indexed',dithering='none'}
 s:saveAs(root..'/art/palette-preview/'..name..'.aseprite')
 app.command.ChangePixelFormat{ui=false,format='rgb'}
 for pose=0,1 do
  local im=copyCell(s.cels[1].image,pose*32,0)
  for mode,t in pairs(variants) do
   local output=mode=='original-outline' and outlined(pose==0 and stand or dead,true) or (mode=='outline' and outlined(im) or im)
   local key=isClass and 'classes' or (pose==0 and 'actors' or 'dead')
   local cell=pose==0 and idx or deadIdx
   -- Clear only the selected cell; leave every other atlas pixel untouched.
   local atlas=t[key]
   for y=0,31 do for x=0,31 do atlas:drawPixel((cell%4)*32+x,math.floor(cell/4)*32+y,output:getPixel(x,y)) end end
  end
 end
 s:close()
end
for mode,t in pairs(variants) do for key,im in pairs(t) do im:saveAs(out..'preview-'..mode..'-'..key..'.png') end end
