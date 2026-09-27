"""Second workshop edit: conform the eye surfaces to the face and fit the mobile triangle budget."""
import bpy, math, bmesh
parts=[o for o in bpy.data.objects if o.type=='MESH']
for obj in parts:
    layer=next((depth for word,depth in [('eye_white',.003),('iris',.006),('pupil',.009),('eye_glint',.012)] if word in obj.name),None)
    if layer is not None:
        for v in obj.data.vertices:
            surface=math.sqrt(max(.05,1-(v.co.x/.338)**2-((v.co.z-1.071)/.298)**2))
            v.co.y=-.018-.302*surface-layer
        bm=bmesh.new(); bm.from_mesh(obj.data)
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces)); bm.to_mesh(obj.data); bm.free()
head=0; other=0
for obj in parts:
    obj.data.calc_loop_triangles()
    if obj.name.startswith('j1_'): head+=len(obj.data.loop_triangles)
    else: other+=len(obj.data.loop_triangles)
ratio=max(.2,min(1,(2900-head)/other))
for obj in parts:
    if obj.name.startswith('j1_'): continue
    bpy.context.view_layer.objects.active=obj
    mod=obj.modifiers.new('Mobile silhouette budget','DECIMATE'); mod.ratio=ratio
    bpy.ops.object.modifier_apply(modifier=mod.name)
triangles=0
for obj in parts:
    obj.data.calc_loop_triangles(); triangles+=len(obj.data.loop_triangles)
scene=bpy.context.scene
scene.render.image_settings.media_type='IMAGE'
scene.render.image_settings.file_format='PNG'
scene.render.image_settings.color_mode='RGBA'
target=artifacts.file(name='green-recruit-refined.png',media_type='image/png')
scene.render.filepath=str(target.path); bpy.ops.render.render(write_still=True); target.publish()
result={'triangles':triangles,'headTriangles':head,'bodyDecimationRatio':ratio,'materials':1,'textures':0,'status':'modeled draft; no rig yet'}
