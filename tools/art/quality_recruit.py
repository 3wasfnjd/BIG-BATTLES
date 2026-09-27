"""Quality study on the settled recruit workshop revision 3, Blender 5.2.

Keeps the approved white ghutra / green uniform / tan equipment identity.
Adds a folded cloth silhouette, rear vest, eye rims and baked vertex occlusion.
This is an inspected candidate, not a claim of finished concept-matched art.
"""
import bpy, math, bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree

scene = bpy.context.scene
assert not scene.get('quality_recruit'), 'Apply this edit once to workshop revision 3'
mat = bpy.data.materials['SharedVertexPalette']

def linear(c): return c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4
def rgba(color): return tuple(linear(int(color[i:i+2],16)/255) for i in (1,3,5)) + (1,)
def make(name, verts, faces, color, joint=0, smooth=True):
    data=bpy.data.meshes.new(name); data.from_pydata(verts,[],faces); data.update()
    attr=data.color_attributes.new(name='Color',type='BYTE_COLOR',domain='CORNER')
    for c in attr.data: c.color=rgba(color)
    for face in data.polygons: face.use_smooth=smooth
    data.materials.append(mat)
    obj=bpy.data.objects.new('j%d_body_%s' % (joint,name),data); scene.collection.objects.link(obj)
    obj['rig_joint']=joint; obj['component']='body'
    return obj

def box(name, center, size, color, bevel=.018):
    verts=[(center[0]+x*size[0]/2,center[1]+y*size[1]/2,center[2]+z*size[2]/2) for x,y,z in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
    obj=make(name,verts,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],color,smooth=False)
    if bevel:
        bpy.context.view_layer.objects.active=obj
        mod=obj.modifiers.new('Tailored soft edge','BEVEL'); mod.width=bevel; mod.segments=1
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj

# Replace the straight cylindrical sheet with broader, directional cloth folds.
old=bpy.data.objects.get('j1_body_ghutra_drape')
assert old is not None
bpy.data.objects.remove(old,do_unlink=True)
columns,rows=32,7
verts=[]
for j in range(rows):
    v=j/(rows-1)
    for i in range(columns+1):
        u=i/columns
        t=.66+(math.tau-1.32)*u
        s,c=math.sin(t),math.cos(t)
        # Narrow folded point at the back; raised side hems reveal the sleeves.
        bottom=.785+.18*abs(s)**.65+.014*math.sin(5*t)**2
        fold=(math.sin(6*t+v*1.4)*.016+math.sin(11*t-v)*.004)*math.sin(v*math.pi*.85)
        radius_x=.366+.042*math.sin(v*math.pi)-.065*v*v+fold
        radius_y=.32+.055*math.sin(v*math.pi*.9)+fold
        verts.append((s*radius_x,-c*radius_y+.006,1.315*(1-v)+bottom*v))
faces=[]
for j in range(rows-1):
    for i in range(columns):
        a=j*(columns+1)+i
        faces.append((a,a+columns+1,a+columns+2,a+1))
drape=make('ghutra_folded_drape',verts,faces,'#eee9db',1)
# A tiny rolled hem makes the cloth edge readable without a texture.
hem=[]
for i in range(columns+1):
    p=Vector(verts[(rows-1)*(columns+1)+i]); hem.extend([tuple(p),tuple(p+Vector((0,-.001,.013)))])
make('ghutra_hem',hem,[(i*2,i*2+2,i*2+3,i*2+1) for i in range(columns)],'#d5d1c5',1)

# Cloth folds also survive a high gameplay camera because the crown has relief.
crown=bpy.data.objects['j1_body_ghutra_crown']
for vertex in crown.data.vertices:
    x,y,z=vertex.co
    theta=math.atan2(x,-y+.008)
    radius=min(1,math.hypot(x/.368,(y-.008)/.326))
    vertex.co.z += math.sin(theta*6+.4)*.008*radius*(1-radius*.65)
crown.data.update()

# Rear tactical vest and straps follow the existing tan kit instead of a blank back.
box('rear_vest',(0,.17,.62),(.33,.075,.255),'#bc9a67',.024)
box('rear_vest_inset',(0,.214,.625),(.245,.018,.155),'#8f7955',.008)
for x in [-.128,.128]:
    box('rear_shoulder_strap',(x,.146,.768),(.067,.075,.118),'#d4b783',.011)
for z in [.57,.62,.67]:
    box('rear_webbing',(0,.228,z),(.234,.015,.014),'#c9ab76',.003)
box('rear_belt',(0,.159,.397),(.414,.04,.054),'#463d31',.007)

# Thin eye outlines ground the white patches in the face and preserve the big eyes.
for side in [-1,1]:
    points=[]
    for radius in [1,1.10]:
        for i in range(16):
            t=math.tau*i/16
            x=side*.137+.086*radius*math.cos(t)
            z=1.131+.096*radius*math.sin(t)
            y=-.018-.302*math.sqrt(max(.05,1-(x/.338)**2-((z-1.071)/.298)**2))-.003
            points.append((x,y,z))
    make('eye_rim_'+str(side),points,[(i,(i+1)%16,(i+1)%16+16,i+16) for i in range(16)],'#5c3825',1)

# Bake small-scale contact occlusion into the shared vertex palette, offline only.
parts=[obj for obj in scene.objects if obj.type=='MESH']
allverts,allfaces=[],[]
for obj in parts:
    obj.data.update(); base=len(allverts)
    allverts.extend([obj.matrix_world@v.co for v in obj.data.vertices])
    allfaces.extend([tuple(base+i for i in face.vertices) for face in obj.data.polygons])
bvh=BVHTree.FromPolygons(allverts,allfaces,all_triangles=False,epsilon=.0002)
directions=[]
for i in range(20):
    z=(i+.5)/20
    a=i*2.39996323
    directions.append(Vector((math.sqrt(1-z*z)*math.cos(a),math.sqrt(1-z*z)*math.sin(a),z)))
for obj in parts:
    mesh=obj.data; attr=mesh.color_attributes.get('Color'); occlusion=[]
    normal_matrix=obj.matrix_world.to_3x3().inverted().transposed()
    for v in mesh.vertices:
        normal=(normal_matrix@v.normal).normalized()
        if normal.length<.5: normal=Vector((0,0,1))
        rotation=Vector((0,0,1)).rotation_difference(normal)
        origin=obj.matrix_world@v.co+normal*.003
        blocked=0
        for d in directions:
            hit=bvh.ray_cast(origin,rotation@d,.22)
            if hit[0] is not None: blocked+=(1-hit[3]/.22)*.7+.3
        occlusion.append(max(.47,1-blocked/len(directions)*.67))
    for loop in mesh.loops:
        color=attr.data[loop.index].color
        ao=occlusion[loop.vertex_index]
        # A subtle garment gradient gives broad surfaces shape at crowd scale.
        if 'ghutra' in obj.name:
            ao*=.93+.07*max(0,min(1,(mesh.vertices[loop.vertex_index].co.z-.8)/.65))
        attr.data[loop.index].color=(color[0]*ao,color[1]*ao,color[2]*ao,1)

scene['quality_recruit']=True
scene['art_status']='quality-study; not final approved reference art'
scene.render.engine='BLENDER_EEVEE'
scene.render.image_settings.media_type='IMAGE'; scene.render.image_settings.file_format='PNG'; scene.render.image_settings.color_mode='RGBA'
scene.render.resolution_x=600; scene.render.resolution_y=760; scene.render.resolution_percentage=100
scene.render.film_transparent=True
camera=scene.camera; camera.data.type='ORTHO'; camera.data.ortho_scale=1.8
for name,location in [('quality-recruit-front.png',(2.2,-5,2.0)),('quality-recruit-back.png',(-2.3,5,3.4))]:
    camera.location=location
    camera.rotation_euler=(Vector((0,0,.72))-camera.location).to_track_quat('-Z','Y').to_euler()
    target=artifacts.file(name=name,media_type='image/png')
    scene.render.filepath=str(target.path); bpy.ops.render.render(write_still=True); target.publish()
camera.location=(2.2,-5,2.0)
camera.rotation_euler=(Vector((0,0,.72))-camera.location).to_track_quat('-Z','Y').to_euler()
triangles=0
for obj in parts:
    obj.data.calc_loop_triangles(); triangles+=len(obj.data.loop_triangles)
result={'triangles':triangles,'materials':1,'textures':0,'vertexAO':True,'meshObjects':len(parts),'status':'quality candidate; rendered front and gameplay-facing back; no performance claim'}
