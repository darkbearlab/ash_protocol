local root=app.params.root
local dir=root..'/art/sprites/adopted/berserker-longaxe-2026-09-19/'
local src=Image{fromFile=dir..'source.png'}
local C=app.pixelColor
local boxes={{124,67,1044,1143}}
local atlas=Image(64,64,ColorMode.RGB)
for n,b in ipairs(boxes) do
 local s=Sprite(b[3],b[4],ColorMode.RGB)
 s.cels[1].image:drawImage(src,Point(-b[1],-b[2]))
 local scale=math.min(28/b[4],30/b[3])
 local w=math.floor(b[3]*scale+0.5);local h=math.floor(b[4]*scale+0.5)
 app.command.SpriteSize{ui=false,width=w,height=h,method='nearest'}
 local im=Image(32,32,ColorMode.RGB)
 local x0=math.floor((32-w)/2);local y0=30-h
 for y=0,h-1 do for x=0,w-1 do
  local p=s.cels[1].image:getPixel(x,y)
  if C.rgbaA(p)>=128 then
   local v=math.floor((C.rgbaR(p)+C.rgbaG(p)+C.rgbaB(p))/3+0.5)
   im:drawPixel(x+x0,y+y0,C.rgba(v,v,v,255))
  end
 end end
 s:close()
 local outline=Image(im)
 local function opaque(x,y) return x>=0 and x<32 and y>=0 and y<32 and C.rgbaA(im:getPixel(x,y))>0 end
 for y=0,31 do for x=0,31 do if not opaque(x,y) then
  local add=false
  for dy=-1,1 do for dx=-1,1 do
   if opaque(x+dx,y+dy) and C.rgbaR(im:getPixel(x+dx,y+dy))>45 then add=true end
  end end
  if add then outline:drawPixel(x,y,C.rgba(12,14,18,255)) end
 end end end
 local out=Sprite(32,32,ColorMode.RGB);out.cels[1].image:drawImage(outline,Point(0,0))
 out:saveAs(dir..'candidate-'..n..'.png');out:saveAs(dir..'candidate-'..n..'.aseprite');out:close()
 atlas:drawImage(outline,Point(((n-1)%2)*32,math.floor((n-1)/2)*32))
end
local board=Sprite(32,32,ColorMode.RGB)
board.cels[1].image:clear(C.rgba(51,65,59,255))
board.cels[1].image:drawImage(Image{fromFile=dir..'candidate-1.png'},Point(0,0))
app.command.SpriteSize{ui=false,width=384,height=384,method='nearest'}
board:saveAs(dir..'preview.png');board:close()

