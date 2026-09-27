"""Editable green recruit blockout for Higgsfield 3D Jutsu / Blender 5.2.

Builds original mesh geometry from the approved recruit's visible proportions.
This is a modeled production draft, not Meshy image-to-3D or approved final art.
Front is Blender -Y; portable glTF export maps up to +Y and front to +Z.
The game conversion rotates the export to face -Z and adds its shared rig/clips.
"""
import bpy
import math
from mathutils import Vector

scene = bpy.context.scene
assert not any(o.type == 'MESH' for o in scene.objects), 'Build only in the inspected empty workshop'

def linear(c):
    return c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4

def rgba(hex_color):
    return tuple(linear(int(hex_color[i:i + 2], 16) / 255) for i in (1, 3, 5)) + (1,)

palette = {
    'green': '#23894f', 'darkgreen': '#247547', 'highlight': '#61bc7c',
    'cloth': '#f4f0e5', 'fold': '#ddd8cd', 'black': '#292b2a',
    'gun': '#343a39', 'metal': '#454b48', 'tan': '#bea071',
    'lighttan': '#d4b782', 'leather': '#80603c', 'sole': '#3e352e',
    'skin': '#dea378', 'hand': '#d89b70', 'white': '#fff8ed',
    'iris': '#71421d', 'pupil': '#211b17', 'brow': '#382b23',
}

mat = bpy.data.materials.new('SharedVertexPalette')
mat.use_nodes = True
mat.diffuse_color = (1, 1, 1, 1)
nodes = mat.node_tree.nodes
bsdf = nodes.get('Principled BSDF')
bsdf.inputs['Roughness'].default_value = .83
bsdf.inputs['Metallic'].default_value = 0
vc = nodes.new('ShaderNodeVertexColor')
vc.layer_name = 'Color'
mat.node_tree.links.new(vc.outputs['Color'], bsdf.inputs['Base Color'])
parts = []

def mesh(name, vertices, faces, color, joint=0, smooth=True, component='body'):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    colors = data.color_attributes.new(name='Color', type='BYTE_COLOR', domain='CORNER')
    value = rgba(palette.get(color, color))
    for c in colors.data:
        c.color = value
    obj = bpy.data.objects.new('j%d_%s_%s' % (joint, component, name), data)
    scene.collection.objects.link(obj)
    data.materials.append(mat)
    for polygon in data.polygons:
        polygon.use_smooth = smooth
    obj['rig_joint'] = joint
    obj['component'] = component
    parts.append(obj)
    return obj

def ball(name, center, scale, color, joint=0, seg=12, rings=6, component='body'):
    vertices = [(0, 0, 1)]
    for j in range(1, rings):
        phi = math.pi * j / rings
        for i in range(seg):
            a = math.tau * i / seg
            vertices.append((math.sin(phi)*math.cos(a), math.sin(phi)*math.sin(a), math.cos(phi)))
    vertices.append((0, 0, -1))
    faces = []
    for i in range(seg):
        k = (i + 1) % seg
        faces.append((0, 1 + i, 1 + k))
        for j in range(rings - 2):
            a, b = 1 + j * seg + i, 1 + j * seg + k
            faces.append((a, a + seg, b + seg, b))
        faces.append((len(vertices) - 1, 1 + (rings - 2)*seg + k, 1 + (rings - 2)*seg + i))
    return mesh(name, [tuple(center[j] + v[j]*scale[j] for j in range(3)) for v in vertices], faces, color, joint, True, component)

def box(name, center, scale, color, joint=0, bevel=.025, component='body'):
    vertices = [(x*scale[0]/2+center[0], y*scale[1]/2+center[1], z*scale[2]/2+center[2]) for x,y,z in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
    obj = mesh(name, vertices, [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)], color, joint, False, component)
    if bevel:
        bpy.context.view_layer.objects.active = obj
        mod = obj.modifiers.new('Soft cloth edges', 'BEVEL')
        mod.width = min(bevel, min(scale)/3)
        mod.segments = 1
        bpy.ops.object.modifier_apply(modifier=mod.name)
        # The bevel interpolates existing vertex colors without another material.
    return obj

def limb(name, start, end, radius, color, joint, seg=8):
    a, b = Vector(start), Vector(end)
    center = (a+b)/2
    obj = ball(name, (0,0,0), (radius,radius,(b-a).length/2+radius*.35), color, joint, seg, 5)
    rotation = (b-a).to_track_quat('Z','Y')
    for v in obj.data.vertices:
        v.co = rotation @ v.co + center
    return obj

def torus(name, z, rx, ry, radius, color, joint=1, major=20, minor=4):
    vertices, faces = [], []
    for i in range(major):
        t = math.tau*i/major
        for j in range(minor):
            a = math.tau*j/minor
            vertices.append(((rx+radius*math.cos(a))*math.sin(t), -(ry+radius*math.cos(a))*math.cos(t), z+radius*math.sin(a)))
    for i in range(major):
        for j in range(minor):
            faces.append((i*minor+j, ((i+1)%major)*minor+j, ((i+1)%major)*minor+(j+1)%minor, i*minor+(j+1)%minor))
    return mesh(name, vertices, faces, color, joint)

# Compact body, separated legs, boots and sand-colored tactical equipment.
ball('uniform_torso', (0,.01,.585), (.262,.174,.243), 'green', seg=12, rings=6)
box('waist_belt', (0,-.002,.395), (.48,.305,.07), 'black', bevel=.014)
box('belt_buckle', (0,-.161,.40), (.068,.022,.062), 'tan', bevel=.007)
box('plate_carrier', (0,-.149,.625), (.36,.085,.255), 'tan', bevel=.028)
for x in [-.132,.132]:
    box('shoulder_strap', (x,-.13,.756), (.078,.097,.105), 'lighttan', bevel=.014)
    box('magazine_pouch', (x*.8,-.21,.523), (.096,.07,.105), 'leather', bevel=.011)
for side in [-1,1]:
    joint = 2 if side < 0 else 3
    x = side*.137
    ball('trousers', (x,.012,.28), (.114,.112,.177), 'green', joint, 10, 5)
    box('knee_strap', (x,-.03,.264), (.224,.19,.047), 'black', joint, .008)
    box('knee_pad', (x,-.115,.273), (.15,.052,.119), 'lighttan', joint, .018)
    box('boot_sole', (x,-.048,.029), (.239,.328,.058), 'sole', joint, .018)
    ball('boot', (x,-.049,.098), (.117,.163,.089), 'leather', joint, 10, 5)
    box('boot_cuff', (x,.026,.154), (.195,.172,.065), 'leather', joint, .014)
    for z,y in [(.131,-.104),(.148,-.057)]:
        box('boot_lace', (x,y,z), (.135,.013,.012), 'tan', joint, 0)
    box('hip_pouch', (side*.257,-.008,.413), (.092,.171,.172), 'tan', bevel=.014)

# Bent sleeves and hands support the compact rifle across the chest.
limb('left_sleeve', (-.231,.008,.704), (-.317,-.08,.58), .087, 'green', 4)
limb('left_forearm', (-.316,-.08,.58), (-.157,-.277,.6), .076, 'skin', 4)
limb('right_sleeve', (.231,.008,.704), (.32,-.07,.565), .087, 'green', 5)
limb('right_forearm', (.319,-.074,.57), (.234,-.306,.51), .073, 'skin', 5)
ball('left_hand', (-.135,-.294,.596), (.081,.073,.077), 'hand', 4, 8, 5)
ball('right_hand', (.245,-.34,.516), (.074,.069,.079), 'hand', 5, 8, 5)

# Chibi head and large inset eyes. All details remain real mesh geometry.
ball('face', (0,-.018,1.071), (.338,.302,.298), 'skin', 1, 20, 10)
for side in [-1,1]:
    ball('ear', (side*.326,-.024,1.046), (.038,.048,.068), 'skin', 1, 8, 4)
    x = side*.137
    ball('eye_white', (x,-.293,1.109), (.092,.029,.099), 'white', 1, 10, 6)
    ball('iris', (x,-.319,1.102), (.051,.016,.063), 'iris', 1, 8, 5)
    ball('pupil', (x,-.331,1.106), (.029,.012,.041), 'pupil', 1, 8, 4)
    ball('eye_glint', (x-.011,-.341,1.131), (.015,.007,.018), 'white', 1, 6, 3)
    # Swept brows have a raised outside edge and a determined inner corner.
    a, b = side*.067, side*.219
    vertices = [(a,-.302,1.213),(b,-.247,1.256),(b,-.255,1.283),(a,-.311,1.245), (a,-.282,1.213),(b,-.227,1.256),(b,-.235,1.283),(a,-.291,1.245)]
    mesh('eyebrow', vertices, [(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)], 'brow', 1, False)

# Curved green face covering, shaped around cheeks and nose.
vertices, faces = [], []
for row, (height,width) in enumerate([(.877,.166),(.921,.246),(.979,.292),(1.037,.29),(1.067,.281)]):
    for i in range(11):
        u = (i/10*2-1)
        x = u*width
        y = -.302*math.sqrt(max(.1, 1-(x/.342)**2))-.023
        z = height + (.016*(1-u*u) if row == 4 else .009*u*u)
        vertices.append((x,y,z))
for j in range(4):
    for i in range(10):
        a = j*11+i
        faces.append((a,a+1,a+12,a+11))
mesh('face_covering', vertices, faces, 'darkgreen', 1)

# White ghutra: domed cap, draped side/back sheet and subtle modeled folds.
vertices, faces = [(0,.004,1.445)], []
seg=24
for radius,z in [(.42,1.426),(.76,1.385),(.96,1.326),(1,1.278)]:
    for i in range(seg):
        t=math.tau*i/seg
        vertices.append((math.sin(t)*.368*radius, -math.cos(t)*.326*radius+.008, z-.018*max(0,math.cos(t))))
for i in range(seg):
    k=(i+1)%seg
    faces.append((0,1+i,1+k))
    for j in range(3):
        a,b=1+j*seg+i,1+j*seg+k
        faces.append((a,a+seg,b+seg,b))
mesh('ghutra_crown',vertices,faces,'cloth',1)
vertices,faces=[],[]
columns=20
for row in range(4):
    v=row/3
    for i in range(columns+1):
        t=.73+(math.tau-1.46)*i/columns
        fold=math.sin(t*7)*.012*v
        rx=.367 + .052*math.sin(v*math.pi*.7)+fold
        ry=.324 + .025*v+fold
        bottom=.833+.035*abs(math.sin(t))+.025*math.sin(t*6)**2
        z=1.31*(1-v)+bottom*v
        vertices.append((math.sin(t)*rx,-math.cos(t)*ry+.006,z))
for j in range(3):
    for i in range(columns):
        a=j*(columns+1)+i
        faces.append((a,a+1,a+columns+2,a+columns+1))
mesh('ghutra_drape',vertices,faces,'cloth',1)
torus('agal_upper',1.363,.35,.307,.025,'black')
torus('agal_lower',1.32,.37,.32,.024,'black')

# Low-poly rifle. These meshes stay a separate component for the game rig.
weapon_parts=[]
def weapon(name, center, scale, color, bevel=.008):
    o=box(name,center,scale,color,5,bevel,'rifle')
    weapon_parts.append(o)
    return o
weapon('receiver',(0,0,0),(.29,.092,.116),'gun')
weapon('stock',(-.219,0,.009),(.18,.073,.096),'tan')
weapon('stock_pad',(-.319,0,.009),(.026,.088,.128),'black',.006)
weapon('handguard',(.232,0,.017),(.173,.083,.092),'tan')
weapon('barrel',(.378,0,.017),(.17,.038,.042),'black',.004)
weapon('muzzle',(.477,0,.017),(.055,.059,.06),'metal',.005)
weapon('magazine',(.066,0,-.122),(.073,.068,.16),'metal',.009)
weapon('grip',(-.098,0,-.093),(.067,.058,.105),'black',.009)
weapon('green_panel',(.024,-.051,.018),(.155,.016,.055),'darkgreen',.003)
weapon('top_rail',(-.002,0,.079),(.25,.049,.025),'black',.002)
weapon('carry_handle',(-.019,0,.127),(.176,.042,.033),'black',.004)
for x in [-.082,.056]:
    weapon('sight_support',(x,0,.105),(.026,.038,.044),'black',.002)
from mathutils import Matrix
rot=Matrix.Rotation(.25,4,'Y')
for obj in weapon_parts:
    for vertex in obj.data.vertices:
        vertex.co = rot.to_3x3() @ vertex.co + Vector((-.022,-.367,.608))

# Repair winding, remove any stale material slots, and record real triangle cost.
import bmesh
for obj in parts:
    bm=bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()

# Camera and portable lights are only a workshop inspection setup, not runtime assets.
def aim(obj, target):
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
camera_data=bpy.data.cameras.new('Character Review Camera')
camera=bpy.data.objects.new('Character Review Camera',camera_data)
scene.collection.objects.link(camera)
camera.location=(2.25,-4.6,2.0)
aim(camera,(0,-.03,.725))
camera_data.type='ORTHO'
camera_data.ortho_scale=1.86
scene.camera=camera
for name, location, energy, color in [('Warm key',(-3,-4,5),2.1,(1,.92,.8)),('Cool fill',(3,-2,3),.8,(.87,.94,1)),('Rim',(1,4,4),1.1,(1,.93,.82))]:
    light=bpy.data.lights.new(name,'SUN')
    light.energy=energy
    light.angle=.22
    light.color=color
    obj=bpy.data.objects.new(name,light)
    scene.collection.objects.link(obj)
    obj.location=location
    aim(obj,(0,0,.7))
scene.world=bpy.data.worlds.new('Soft ambient') if scene.world is None else scene.world
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.4,.46,.42,1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.25
scene.render.engine='BLENDER_EEVEE'
scene.view_settings.view_transform='Khronos PBR Neutral'
scene.render.resolution_x=640
scene.render.resolution_y=800
scene.render.resolution_percentage=100
scene.render.film_transparent=True
scene.render.image_settings.media_type='IMAGE'
scene.render.image_settings.file_format='PNG'
scene.render.image_settings.color_mode='RGBA'
scene.render.fps=30
scene.frame_start=1
scene.frame_end=30
triangles=0
for obj in parts:
    obj.data.calc_loop_triangles()
    triangles+=len(obj.data.loop_triangles)
target=artifacts.file(name='green-recruit-blockout.png',media_type='image/png')
scene.render.filepath=str(target.path)
bpy.ops.render.render(write_still=True)
target.publish()
result={'triangles':triangles,'meshObjects':len(parts),'materials':1,'textures':0,'height':1.445,'status':'reference-based modeled draft; no rig yet','palette':'green/tan','front':'-Y in Blender; convert after glTF export'}
