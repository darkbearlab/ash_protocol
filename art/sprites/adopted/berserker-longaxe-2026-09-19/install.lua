local root=app.params.root
local dir=root..'/art/sprites/adopted/berserker-longaxe-2026-09-19/'
local path=root..'/assets/pixel/classes-v1/atlas.png'
local atlas=Image{fromFile=path}
local sprite=Image{fromFile=dir..'standing.png'}
for y=0,31 do for x=0,31 do atlas:drawPixel(64+x,32+y,sprite:getPixel(x,y)) end end
atlas:saveAs(path)
