"""Replace overlapping closed eye shells with clean single-surface patches."""
import bpy, math
scene=bpy.context.scene
mat=bpy.data.materials['SharedVertexPalette']
def linear(c): return c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4
specs=[('eye_white',.086,.096,1.131,.004,'#fff8ed',12,3),('iris',.046,.061,1.127,.008,'#71421d',12,2),('pupil',.027,.040,1.133,.012,'#211b17',10,2),('eye_glint',.012,.017,1.160,.016,'#fff8ed',8,1)]
for obj in list(bpy.data.objects):
    if any(word in obj.name for word,*_ in specs): bpy.data.objects.remove(obj,do_unlink=True)
for side in [-1,1]:
    for name,rx,rz,cz,offset,color,seg,rings in specs:
        cx=side*.137-(.01 if name=='eye_glint' else 0)
        xz=[(cx,cz)]
        for ring in range(1,rings+1):
            for i in range(seg):
                t=math.tau*i/seg
                xz.append((cx+rx*ring/rings*math.cos(t),cz+rz*ring/rings*math.sin(t)))
        verts=[(x,-.018-.302*math.sqrt(max(.05,1-(x/.338)**2-((z-1.071)/.298)**2))-offset,z) for x,z in xz]
        faces=[]
        for i in range(seg):
            k=(i+1)%seg; faces.append((0,1+i,1+k))
            for j in range(rings-1):
                a,b=1+j*seg+i,1+j*seg+k
                faces.append((a,a+seg,b+seg,b))
        mesh=bpy.data.meshes.new(name); mesh.from_pydata(verts,[],faces); mesh.update()
        attr=mesh.color_attributes.new(name='Color',type='BYTE_COLOR',domain='CORNER')
        rgba=tuple(linear(int(color[i:i+2],16)/255) for i in (1,3,5))+(1,)
        for c in attr.data: c.color=rgba
        for p in mesh.polygons: p.use_smooth=True
        mesh.materials.append(mat)
        obj=bpy.data.objects.new('j1_body_'+name+'_'+str(side),mesh); scene.collection.objects.link(obj)
        obj['rig_joint']=1; obj['component']='body'
triangles=0
for obj in bpy.data.objects:
    if obj.type=='MESH': obj.data.calc_loop_triangles(); triangles+=len(obj.data.loop_triangles)
scene.render.image_settings.media_type='IMAGE'; scene.render.image_settings.file_format='PNG'; scene.render.image_settings.color_mode='RGBA'
target=artifacts.file(name='green-recruit-clean-eyes.png',media_type='image/png')
scene.render.filepath=str(target.path); bpy.ops.render.render(write_still=True); target.publish()
result={'triangles':triangles,'materials':1,'textures':0,'status':'modeled draft; clean eye surfaces; ready for game rig packaging'}
