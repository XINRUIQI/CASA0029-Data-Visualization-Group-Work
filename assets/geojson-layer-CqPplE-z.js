import{d as e,f as t,h as n,l as r,n as i,p as a,r as o}from"./deckgl-Bz6lho02.js";import{P as s,b as c}from"./mapbox-gl-C042HBuN.js";import{c as l,i as u,n as d,s as f,t as p}from"./utils-CDjYyzaT.js";var m=`uniform iconUniforms {
  float sizeScale;
  vec2 iconsTextureDim;
  float sizeBasis;
  float sizeMinPixels;
  float sizeMaxPixels;
  bool billboard;
  highp int sizeUnits;
  float alphaCutoff;
} icon;
`,h={name:`icon`,vs:m,fs:m,uniformTypes:{sizeScale:`f32`,iconsTextureDim:`vec2<f32>`,sizeBasis:`f32`,sizeMinPixels:`f32`,sizeMaxPixels:`f32`,billboard:`f32`,sizeUnits:`i32`,alphaCutoff:`f32`}},g=`#version 300 es
#define SHADER_NAME icon-layer-vertex-shader
in vec2 positions;
in vec3 instancePositions;
in vec3 instancePositions64Low;
in float instanceSizes;
in float instanceAngles;
in vec4 instanceColors;
in vec3 instancePickingColors;
in vec4 instanceIconFrames;
in float instanceColorModes;
in vec2 instanceOffsets;
in vec2 instancePixelOffset;
out float vColorMode;
out vec4 vColor;
out vec2 vTextureCoords;
out vec2 uv;
vec2 rotate_by_angle(vec2 vertex, float angle) {
float angle_radian = angle * PI / 180.0;
float cos_angle = cos(angle_radian);
float sin_angle = sin(angle_radian);
mat2 rotationMatrix = mat2(cos_angle, -sin_angle, sin_angle, cos_angle);
return rotationMatrix * vertex;
}
void main(void) {
geometry.worldPosition = instancePositions;
geometry.uv = positions;
geometry.pickingColor = instancePickingColors;
uv = positions;
vec2 iconSize = instanceIconFrames.zw;
float sizePixels = clamp(
project_size_to_pixel(instanceSizes * icon.sizeScale, icon.sizeUnits),
icon.sizeMinPixels, icon.sizeMaxPixels
);
float iconConstraint = icon.sizeBasis == 0.0 ? iconSize.x : iconSize.y;
float instanceScale = iconConstraint == 0.0 ? 0.0 : sizePixels / iconConstraint;
vec2 pixelOffset = positions / 2.0 * iconSize + instanceOffsets;
pixelOffset = rotate_by_angle(pixelOffset, instanceAngles) * instanceScale;
pixelOffset += instancePixelOffset;
pixelOffset.y *= -1.0;
if (icon.billboard)  {
gl_Position = project_position_to_clipspace(instancePositions, instancePositions64Low, vec3(0.0), geometry.position);
DECKGL_FILTER_GL_POSITION(gl_Position, geometry);
vec3 offset = vec3(pixelOffset, 0.0);
DECKGL_FILTER_SIZE(offset, geometry);
gl_Position.xy += project_pixel_size_to_clipspace(offset.xy);
} else {
vec3 offset_common = vec3(project_pixel_size(pixelOffset), 0.0);
DECKGL_FILTER_SIZE(offset_common, geometry);
gl_Position = project_position_to_clipspace(instancePositions, instancePositions64Low, offset_common, geometry.position);
DECKGL_FILTER_GL_POSITION(gl_Position, geometry);
}
vTextureCoords = mix(
instanceIconFrames.xy,
instanceIconFrames.xy + iconSize,
(positions.xy + 1.0) / 2.0
) / icon.iconsTextureDim;
vColor = instanceColors;
DECKGL_FILTER_COLOR(vColor, geometry);
vColorMode = instanceColorModes;
}
`,_=`#version 300 es
#define SHADER_NAME icon-layer-fragment-shader
precision highp float;
uniform sampler2D iconsTexture;
in float vColorMode;
in vec4 vColor;
in vec2 vTextureCoords;
in vec2 uv;
out vec4 fragColor;
void main(void) {
geometry.uv = uv;
vec4 texColor = texture(iconsTexture, vTextureCoords);
vec3 color = mix(texColor.rgb, vColor.rgb, vColorMode);
float a = texColor.a * layer.opacity * vColor.a;
if (a < icon.alphaCutoff) {
discard;
}
fragColor = vec4(color, a);
DECKGL_FILTER_COLOR(fragColor, geometry);
}
`,v=1024,y=4,b=()=>{},x={minFilter:`linear`,mipmapFilter:`linear`,magFilter:`linear`,addressModeU:`clamp-to-edge`,addressModeV:`clamp-to-edge`},S={x:0,y:0,width:0,height:0};function ee(e){return 2**Math.ceil(Math.log2(e))}function C(e,t,n,r){let i=Math.min(n/t.width,r/t.height),a=Math.floor(t.width*i),o=Math.floor(t.height*i);return i===1?{image:t,width:a,height:o}:(e.canvas.height=o,e.canvas.width=a,e.clearRect(0,0,a,o),e.drawImage(t,0,0,t.width,t.height,0,0,a,o),{image:e.canvas,width:a,height:o})}function w(e){return e&&(e.id||e.url)}function T(e,t,n,r){let{width:i,height:a,device:o}=e,s=o.createTexture({format:`rgba8unorm`,width:t,height:n,sampler:r,mipLevels:o.getMipLevelCount(t,n)}),c=o.createCommandEncoder();return c.copyTextureToTexture({sourceTexture:e,destinationTexture:s,width:i,height:a}),c.finish(),s.generateMipmapsWebGL(),e.destroy(),s}function E(e,t,n){for(let r=0;r<t.length;r++){let{icon:i,xOffset:a}=t[r],o=w(i);e[o]={...i,x:a,y:n}}}function D({icons:e,buffer:t,mapping:n={},xOffset:r=0,yOffset:i=0,rowHeight:a=0,canvasWidth:o}){let s=[];for(let c=0;c<e.length;c++){let l=e[c];if(!n[w(l)]){let{height:e,width:c}=l;r+c+t>o&&(E(n,s,i),r=0,i=a+i+t,a=0,s=[]),s.push({icon:l,xOffset:r}),r=r+c+t,a=Math.max(a,e)}}return s.length>0&&E(n,s,i),{mapping:n,rowHeight:a,xOffset:r,yOffset:i,canvasWidth:o,canvasHeight:ee(a+i+t)}}function O(e,t,n){if(!e||!t)return null;n||={};let r={},{iterable:i,objectInfo:a}=o(e);for(let e of i){a.index++;let i=t(e,a),o=w(i);if(!i)throw Error(`Icon is missing.`);if(!i.url)throw Error(`Icon url is missing.`);!r[o]&&(!n[o]||i.url!==n[o].url)&&(r[o]={...i,source:e,sourceIndex:a.index})}return r}var te=class{constructor(e,{onUpdate:t=b,onError:n=b}){this._loadOptions=null,this._texture=null,this._externalTexture=null,this._mapping={},this._samplerParameters=null,this._pendingCount=0,this._autoPacking=!1,this._xOffset=0,this._yOffset=0,this._rowHeight=0,this._buffer=y,this._canvasWidth=v,this._canvasHeight=0,this._canvas=null,this.device=e,this.onUpdate=t,this.onError=n}finalize(){this._texture?.delete()}getTexture(){return this._texture||this._externalTexture}getIconMapping(e){let t=this._autoPacking?w(e):e;return this._mapping[t]||S}setProps({loadOptions:e,autoPacking:t,iconAtlas:n,iconMapping:r,textureParameters:i}){e&&(this._loadOptions=e),t!==void 0&&(this._autoPacking=t),r&&(this._mapping=r),n&&(this._texture?.delete(),this._texture=null,this._externalTexture=n),i&&(this._samplerParameters=i)}get isLoaded(){return this._pendingCount===0}packIcons(e,t){if(!this._autoPacking||typeof document>`u`)return;let n=Object.values(O(e,t,this._mapping)||{});if(n.length>0){let{mapping:e,xOffset:t,yOffset:r,rowHeight:i,canvasHeight:a}=D({icons:n,buffer:this._buffer,canvasWidth:this._canvasWidth,mapping:this._mapping,rowHeight:this._rowHeight,xOffset:this._xOffset,yOffset:this._yOffset});this._rowHeight=i,this._mapping=e,this._xOffset=t,this._yOffset=r,this._canvasHeight=a,this._texture||=this.device.createTexture({format:`rgba8unorm`,data:null,width:this._canvasWidth,height:this._canvasHeight,sampler:this._samplerParameters||x,mipLevels:this.device.getMipLevelCount(this._canvasWidth,this._canvasHeight)}),this._texture.height!==this._canvasHeight&&(this._texture=T(this._texture,this._canvasWidth,this._canvasHeight,this._samplerParameters||x)),this.onUpdate(!0),this._canvas=this._canvas||document.createElement(`canvas`),this._loadIcons(n)}}_loadIcons(e){let t=this._canvas.getContext(`2d`,{willReadFrequently:!0});for(let r of e)this._pendingCount++,n(r.url,this._loadOptions).then(e=>{let n=w(r),i=this._mapping[n],{x:a,y:o,width:s,height:c}=i,{image:l,width:u,height:d}=C(t,e,s,c),f=a+(s-u)/2,p=o+(c-d)/2;this._texture?.copyExternalImage({image:l,x:f,y:p,width:u,height:d}),i.x=f,i.y=p,i.width=u,i.height=d,this._texture?.generateMipmapsWebGL(),this.onUpdate(u!==s||d!==c)}).catch(e=>{this.onError({url:r.url,source:r.source,sourceIndex:r.sourceIndex,loadOptions:this._loadOptions,error:e})}).finally(()=>{this._pendingCount--})}},k=[0,0,0,255],ne={iconAtlas:{type:`image`,value:null,async:!0},iconMapping:{type:`object`,value:{},async:!0},sizeScale:{type:`number`,value:1,min:0},billboard:!0,sizeUnits:`pixels`,sizeBasis:`height`,sizeMinPixels:{type:`number`,min:0,value:0},sizeMaxPixels:{type:`number`,min:0,value:2**53-1},alphaCutoff:{type:`number`,value:.05,min:0,max:1},getPosition:{type:`accessor`,value:e=>e.position},getIcon:{type:`accessor`,value:e=>e.icon},getColor:{type:`accessor`,value:k},getSize:{type:`accessor`,value:1},getAngle:{type:`accessor`,value:0},getPixelOffset:{type:`accessor`,value:[0,0]},onIconError:{type:`function`,value:null,optional:!0},textureParameters:{type:`object`,ignore:!0,value:null}},A=class extends i{getShaders(){return super.getShaders({vs:g,fs:_,modules:[t,e,h]})}initializeState(){this.state={iconManager:new te(this.context.device,{onUpdate:this._onUpdate.bind(this),onError:this._onError.bind(this)})},this.getAttributeManager().addInstanced({instancePositions:{size:3,type:`float64`,fp64:this.use64bitPositions(),transition:!0,accessor:`getPosition`},instanceSizes:{size:1,transition:!0,accessor:`getSize`,defaultValue:1},instanceOffsets:{size:2,accessor:`getIcon`,transform:this.getInstanceOffset},instanceIconFrames:{size:4,accessor:`getIcon`,transform:this.getInstanceIconFrame},instanceColorModes:{size:1,type:`uint8`,accessor:`getIcon`,transform:this.getInstanceColorMode},instanceColors:{size:this.props.colorFormat.length,type:`unorm8`,transition:!0,accessor:`getColor`,defaultValue:k},instanceAngles:{size:1,transition:!0,accessor:`getAngle`},instancePixelOffset:{size:2,transition:!0,accessor:`getPixelOffset`}})}updateState(e){super.updateState(e);let{props:t,oldProps:n,changeFlags:r}=e,i=this.getAttributeManager(),{iconAtlas:a,iconMapping:o,data:s,getIcon:c,textureParameters:l}=t,{iconManager:u}=this.state;if(typeof a==`string`)return;let d=a||this.internalState.isAsyncPropLoading(`iconAtlas`);u.setProps({loadOptions:t.loadOptions,autoPacking:!d,iconAtlas:a,iconMapping:d?o:null,textureParameters:l}),d?n.iconMapping!==t.iconMapping&&i.invalidate(`getIcon`):(r.dataChanged||r.updateTriggersChanged&&(r.updateTriggersChanged.all||r.updateTriggersChanged.getIcon))&&u.packIcons(s,c),r.extensionsChanged&&(this.state.model?.destroy(),this.state.model=this._getModel(),i.invalidateAll())}get isLoaded(){return super.isLoaded&&this.state.iconManager.isLoaded}finalizeState(e){super.finalizeState(e),this.state.iconManager.finalize()}draw({uniforms:e}){let{sizeScale:t,sizeBasis:n,sizeMinPixels:r,sizeMaxPixels:i,sizeUnits:a,billboard:o,alphaCutoff:s}=this.props,{iconManager:l}=this.state,u=l.getTexture();if(u){let e=this.state.model,l={iconsTexture:u,iconsTextureDim:[u.width,u.height],sizeUnits:c[a],sizeScale:t,sizeBasis:+(n===`height`),sizeMinPixels:r,sizeMaxPixels:i,billboard:o,alphaCutoff:s};e.shaderInputs.setProps({icon:l}),e.draw(this.context.renderPass)}}_getModel(){let e=[-1,-1,1,-1,-1,1,1,1];return new r(this.context.device,{...this.getShaders(),id:this.props.id,bufferLayout:this.getAttributeManager().getBufferLayouts(),geometry:new l({topology:`triangle-strip`,attributes:{positions:{size:2,value:new Float32Array(e)}}}),isInstanced:!0})}_onUpdate(e){e?(this.getAttributeManager()?.invalidate(`getIcon`),this.setNeedsUpdate()):this.setNeedsRedraw()}_onError(e){let t=this.getCurrentLayer()?.props.onIconError;t?t(e):s.error(e.error.message)()}getInstanceOffset(e){let{width:t,height:n,anchorX:r=t/2,anchorY:i=n/2}=this.state.iconManager.getIconMapping(e);return[t/2-r,n/2-i]}getInstanceColorMode(e){return+!!this.state.iconManager.getIconMapping(e).mask}getInstanceIconFrame(e){let{x:t,y:n,width:r,height:i}=this.state.iconManager.getIconMapping(e);return[t,n,r,i]}};A.defaultProps=ne,A.layerName=`IconLayer`;var j=`uniform scatterplotUniforms {
  float radiusScale;
  float radiusMinPixels;
  float radiusMaxPixels;
  float lineWidthScale;
  float lineWidthMinPixels;
  float lineWidthMaxPixels;
  float stroked;
  float filled;
  bool antialiasing;
  bool billboard;
  highp int radiusUnits;
  highp int lineWidthUnits;
} scatterplot;
`,re={name:`scatterplot`,vs:j,fs:j,source:``,uniformTypes:{radiusScale:`f32`,radiusMinPixels:`f32`,radiusMaxPixels:`f32`,lineWidthScale:`f32`,lineWidthMinPixels:`f32`,lineWidthMaxPixels:`f32`,stroked:`f32`,filled:`f32`,antialiasing:`f32`,billboard:`f32`,radiusUnits:`i32`,lineWidthUnits:`i32`}},ie=`#version 300 es
#define SHADER_NAME scatterplot-layer-vertex-shader
in vec3 positions;
in vec3 instancePositions;
in vec3 instancePositions64Low;
in float instanceRadius;
in float instanceLineWidths;
in vec4 instanceFillColors;
in vec4 instanceLineColors;
in vec3 instancePickingColors;
out vec4 vFillColor;
out vec4 vLineColor;
out vec2 unitPosition;
out float innerUnitRadius;
out float outerRadiusPixels;
void main(void) {
geometry.worldPosition = instancePositions;
outerRadiusPixels = clamp(
project_size_to_pixel(scatterplot.radiusScale * instanceRadius, scatterplot.radiusUnits),
scatterplot.radiusMinPixels, scatterplot.radiusMaxPixels
);
float lineWidthPixels = clamp(
project_size_to_pixel(scatterplot.lineWidthScale * instanceLineWidths, scatterplot.lineWidthUnits),
scatterplot.lineWidthMinPixels, scatterplot.lineWidthMaxPixels
);
outerRadiusPixels += scatterplot.stroked * lineWidthPixels / 2.0;
float edgePadding = scatterplot.antialiasing ? (outerRadiusPixels + SMOOTH_EDGE_RADIUS) / outerRadiusPixels : 1.0;
unitPosition = edgePadding * positions.xy;
geometry.uv = unitPosition;
geometry.pickingColor = instancePickingColors;
innerUnitRadius = 1.0 - scatterplot.stroked * lineWidthPixels / outerRadiusPixels;
if (scatterplot.billboard) {
gl_Position = project_position_to_clipspace(instancePositions, instancePositions64Low, vec3(0.0), geometry.position);
DECKGL_FILTER_GL_POSITION(gl_Position, geometry);
vec3 offset = edgePadding * positions * outerRadiusPixels;
DECKGL_FILTER_SIZE(offset, geometry);
gl_Position.xy += project_pixel_size_to_clipspace(offset.xy);
} else {
vec3 offset = edgePadding * positions * project_pixel_size(outerRadiusPixels);
DECKGL_FILTER_SIZE(offset, geometry);
gl_Position = project_position_to_clipspace(instancePositions, instancePositions64Low, offset, geometry.position);
DECKGL_FILTER_GL_POSITION(gl_Position, geometry);
}
vFillColor = vec4(instanceFillColors.rgb, instanceFillColors.a * layer.opacity);
DECKGL_FILTER_COLOR(vFillColor, geometry);
vLineColor = vec4(instanceLineColors.rgb, instanceLineColors.a * layer.opacity);
DECKGL_FILTER_COLOR(vLineColor, geometry);
}
`,ae=`#version 300 es
#define SHADER_NAME scatterplot-layer-fragment-shader
precision highp float;
in vec4 vFillColor;
in vec4 vLineColor;
in vec2 unitPosition;
in float innerUnitRadius;
in float outerRadiusPixels;
out vec4 fragColor;
void main(void) {
geometry.uv = unitPosition;
float distToCenter = length(unitPosition) * outerRadiusPixels;
float inCircle = scatterplot.antialiasing ?
smoothedge(distToCenter, outerRadiusPixels) :
step(distToCenter, outerRadiusPixels);
if (inCircle == 0.0) {
discard;
}
if (scatterplot.stroked > 0.5) {
float isLine = scatterplot.antialiasing ?
smoothedge(innerUnitRadius * outerRadiusPixels, distToCenter) :
step(innerUnitRadius * outerRadiusPixels, distToCenter);
if (scatterplot.filled > 0.5) {
fragColor = mix(vFillColor, vLineColor, isLine);
} else {
if (isLine == 0.0) {
discard;
}
fragColor = vec4(vLineColor.rgb, vLineColor.a * isLine);
}
} else if (scatterplot.filled < 0.5) {
discard;
} else {
fragColor = vFillColor;
}
fragColor.a *= inCircle;
DECKGL_FILTER_COLOR(fragColor, geometry);
}
`,oe=`// Main shaders

struct ScatterplotUniforms {
  radiusScale: f32,
  radiusMinPixels: f32,
  radiusMaxPixels: f32,
  lineWidthScale: f32,
  lineWidthMinPixels: f32,
  lineWidthMaxPixels: f32,
  stroked: f32,
  filled: i32,
  antialiasing: i32,
  billboard: i32,
  radiusUnits: i32,
  lineWidthUnits: i32,
};

struct ConstantAttributeUniforms {
 instancePositions: vec3<f32>,
 instancePositions64Low: vec3<f32>,
 instanceRadius: f32,
 instanceLineWidths: f32,
 instanceFillColors: vec4<f32>,
 instanceLineColors: vec4<f32>,
 instancePickingColors: vec3<f32>,

 instancePositionsConstant: i32,
 instancePositions64LowConstant: i32,
 instanceRadiusConstant: i32,
 instanceLineWidthsConstant: i32,
 instanceFillColorsConstant: i32,
 instanceLineColorsConstant: i32,
 instancePickingColorsConstant: i32
};

@group(0) @binding(2) var<uniform> scatterplot: ScatterplotUniforms;

struct ConstantAttributes {
  instancePositions: vec3<f32>,
  instancePositions64Low: vec3<f32>,
  instanceRadius: f32,
  instanceLineWidths: f32,
  instanceFillColors: vec4<f32>,
  instanceLineColors: vec4<f32>,
  instancePickingColors: vec3<f32>
};

const constants = ConstantAttributes(
  vec3<f32>(0.0),
  vec3<f32>(0.0),
  0.0,
  0.0,
  vec4<f32>(0.0, 0.0, 0.0, 1.0),
  vec4<f32>(0.0, 0.0, 0.0, 1.0),
  vec3<f32>(0.0)
);

struct Attributes {
  @builtin(instance_index) instanceIndex : u32,
  @builtin(vertex_index) vertexIndex : u32,
  @location(0) positions: vec3<f32>,
  @location(1) instancePositions: vec3<f32>,
  @location(2) instancePositions64Low: vec3<f32>,
  @location(3) instanceRadius: f32,
  @location(4) instanceLineWidths: f32,
  @location(5) instanceFillColors: vec4<f32>,
  @location(6) instanceLineColors: vec4<f32>,
  @location(7) instancePickingColors: vec3<f32>
};

struct Varyings {
  @builtin(position) position: vec4<f32>,
  @location(0) vFillColor: vec4<f32>,
  @location(1) vLineColor: vec4<f32>,
  @location(2) unitPosition: vec2<f32>,
  @location(3) innerUnitRadius: f32,
  @location(4) outerRadiusPixels: f32,
};

@vertex
fn vertexMain(attributes: Attributes) -> Varyings {
  var varyings: Varyings;

  // Draw an inline geometry constant array clip space triangle to verify that rendering works.
  // var positions = array<vec2<f32>, 3>(vec2(0.0, 0.5), vec2(-0.5, -0.5), vec2(0.5, -0.5));
  // if (attributes.instanceIndex == 0) {
  //   varyings.position = vec4<f32>(positions[attributes.vertexIndex], 0.0, 1.0);
  //   return varyings;
  // }

  // var geometry: Geometry;
  // geometry.worldPosition = instancePositions;

  // Multiply out radius and clamp to limits
  varyings.outerRadiusPixels = clamp(
    project_unit_size_to_pixel(scatterplot.radiusScale * attributes.instanceRadius, scatterplot.radiusUnits),
    scatterplot.radiusMinPixels, scatterplot.radiusMaxPixels
  );

  // Multiply out line width and clamp to limits
  let lineWidthPixels = clamp(
    project_unit_size_to_pixel(scatterplot.lineWidthScale * attributes.instanceLineWidths, scatterplot.lineWidthUnits),
    scatterplot.lineWidthMinPixels, scatterplot.lineWidthMaxPixels
  );

  // outer radius needs to offset by half stroke width
  varyings.outerRadiusPixels += scatterplot.stroked * lineWidthPixels / 2.0;
  // Expand geometry to accommodate edge smoothing
  let edgePadding = select(
    (varyings.outerRadiusPixels + SMOOTH_EDGE_RADIUS) / varyings.outerRadiusPixels,
    1.0,
    scatterplot.antialiasing != 0
  );

  // position on the containing square in [-1, 1] space
  varyings.unitPosition = edgePadding * attributes.positions.xy;
  geometry.uv = varyings.unitPosition;
  geometry.pickingColor = attributes.instancePickingColors;

  varyings.innerUnitRadius = 1.0 - scatterplot.stroked * lineWidthPixels / varyings.outerRadiusPixels;

  if (scatterplot.billboard != 0) {
    varyings.position = project_position_to_clipspace(attributes.instancePositions, attributes.instancePositions64Low, vec3<f32>(0.0)); // TODO , geometry.position);
    // DECKGL_FILTER_GL_POSITION(varyings.position, geometry);
    let offset = attributes.positions; // * edgePadding * varyings.outerRadiusPixels;
    // DECKGL_FILTER_SIZE(offset, geometry);
    let clipPixels = project_pixel_size_to_clipspace(offset.xy);
    varyings.position.x = clipPixels.x;
    varyings.position.y = clipPixels.y;
  } else {
    let offset = edgePadding * attributes.positions * project_pixel_size_float(varyings.outerRadiusPixels);
    // DECKGL_FILTER_SIZE(offset, geometry);
    varyings.position = project_position_to_clipspace(attributes.instancePositions, attributes.instancePositions64Low, offset); // TODO , geometry.position);
    // DECKGL_FILTER_GL_POSITION(varyings.position, geometry);
  }

  // Apply opacity to instance color, or return instance picking color
  varyings.vFillColor = vec4<f32>(attributes.instanceFillColors.rgb, attributes.instanceFillColors.a * color.opacity);
  // DECKGL_FILTER_COLOR(varyings.vFillColor, geometry);
  varyings.vLineColor = vec4<f32>(attributes.instanceLineColors.rgb, attributes.instanceLineColors.a * color.opacity);
  // DECKGL_FILTER_COLOR(varyings.vLineColor, geometry);

  return varyings;
}

@fragment
fn fragmentMain(varyings: Varyings) -> @location(0) vec4<f32> {
  // var geometry: Geometry;
  // geometry.uv = unitPosition;

  let distToCenter = length(varyings.unitPosition) * varyings.outerRadiusPixels;
  let inCircle = select(
    smoothedge(distToCenter, varyings.outerRadiusPixels),
    step(distToCenter, varyings.outerRadiusPixels),
    scatterplot.antialiasing != 0
  );

  if (inCircle == 0.0) {
    discard;
  }

  var fragColor: vec4<f32>;

  if (scatterplot.stroked != 0) {
    let isLine = select(
      smoothedge(varyings.innerUnitRadius * varyings.outerRadiusPixels, distToCenter),
      step(varyings.innerUnitRadius * varyings.outerRadiusPixels, distToCenter),
      scatterplot.antialiasing != 0
    );

    if (scatterplot.filled != 0) {
      fragColor = mix(varyings.vFillColor, varyings.vLineColor, isLine);
    } else {
      if (isLine == 0.0) {
        discard;
      }
      fragColor = vec4<f32>(varyings.vLineColor.rgb, varyings.vLineColor.a * isLine);
    }
  } else if (scatterplot.filled == 0) {
    discard;
  } else {
    fragColor = varyings.vFillColor;
  }

  fragColor.a *= inCircle;
  // DECKGL_FILTER_COLOR(fragColor, geometry);

  // Apply premultiplied alpha as required by transparent canvas
  fragColor = deckgl_premultiplied_alpha(fragColor);

  return fragColor;
  // return vec4<f32>(0, 0, 1, 1);
}
`,se=[0,0,0,255],ce={radiusUnits:`meters`,radiusScale:{type:`number`,min:0,value:1},radiusMinPixels:{type:`number`,min:0,value:0},radiusMaxPixels:{type:`number`,min:0,value:2**53-1},lineWidthUnits:`meters`,lineWidthScale:{type:`number`,min:0,value:1},lineWidthMinPixels:{type:`number`,min:0,value:0},lineWidthMaxPixels:{type:`number`,min:0,value:2**53-1},stroked:!1,filled:!0,billboard:!1,antialiasing:!0,getPosition:{type:`accessor`,value:e=>e.position},getRadius:{type:`accessor`,value:1},getFillColor:{type:`accessor`,value:se},getLineColor:{type:`accessor`,value:se},getLineWidth:{type:`accessor`,value:1},strokeWidth:{deprecatedFor:`getLineWidth`},outline:{deprecatedFor:`stroked`},getColor:{deprecatedFor:[`getFillColor`,`getLineColor`]}},M=class extends i{getShaders(){return super.getShaders({vs:ie,fs:ae,source:oe,modules:[t,a,e,re]})}initializeState(){this.getAttributeManager().addInstanced({instancePositions:{size:3,type:`float64`,fp64:this.use64bitPositions(),transition:!0,accessor:`getPosition`},instanceRadius:{size:1,transition:!0,accessor:`getRadius`,defaultValue:1},instanceFillColors:{size:this.props.colorFormat.length,transition:!0,type:`unorm8`,accessor:`getFillColor`,defaultValue:[0,0,0,255]},instanceLineColors:{size:this.props.colorFormat.length,transition:!0,type:`unorm8`,accessor:`getLineColor`,defaultValue:[0,0,0,255]},instanceLineWidths:{size:1,transition:!0,accessor:`getLineWidth`,defaultValue:1}})}updateState(e){super.updateState(e),e.changeFlags.extensionsChanged&&(this.state.model?.destroy(),this.state.model=this._getModel(),this.getAttributeManager().invalidateAll())}draw({uniforms:e}){let{radiusUnits:t,radiusScale:n,radiusMinPixels:r,radiusMaxPixels:i,stroked:a,filled:o,billboard:s,antialiasing:l,lineWidthUnits:u,lineWidthScale:d,lineWidthMinPixels:f,lineWidthMaxPixels:p}=this.props,m={stroked:a,filled:o,billboard:s,antialiasing:l,radiusUnits:c[t],radiusScale:n,radiusMinPixels:r,radiusMaxPixels:i,lineWidthUnits:c[u],lineWidthScale:d,lineWidthMinPixels:f,lineWidthMaxPixels:p},h=this.state.model;h.shaderInputs.setProps({scatterplot:m}),this.context.device.type===`webgpu`&&(h.instanceCount=this.props.data.length),h.draw(this.context.renderPass)}_getModel(){let e=this.context.device.type===`webgpu`?{depthWriteEnabled:!0,depthCompare:`less-equal`}:void 0,t=[-1,-1,0,1,-1,0,-1,1,0,1,1,0];return new r(this.context.device,{...this.getShaders(),id:this.props.id,bufferLayout:this.getAttributeManager().getBufferLayouts(),geometry:new l({topology:`triangle-strip`,attributes:{positions:{size:3,value:new Float32Array(t)}}}),isInstanced:!0,parameters:e})}};M.defaultProps=ce,M.layerName=`ScatterplotLayer`;function le(e,t){if(!e)return null;let n=`startIndices`in e?e.startIndices[t]:t,r=e.featureIds.value[n];return n===-1?null:ue(e,r,n)}function ue(e,t,n){let r={properties:{...e.properties[t]}};for(let t in e.numericProps)r.properties[t]=e.numericProps[t].value[n];return r}function de(e,t){let n={points:null,lines:null,polygons:null};for(let r in n){let i=e[r].globalFeatureIds.value;n[r]=new Uint8ClampedArray(i.length*4);let a=[];for(let e=0;e<i.length;e++)t(i[e],a),n[r][e*4+0]=a[0],n[r][e*4+1]=a[1],n[r][e*4+2]=a[2],n[r][e*4+3]=255}return n}var fe=`uniform sdfUniforms {
  float gamma;
  bool enabled;
  float buffer;
  float outlineBuffer;
  vec4 outlineColor;
} sdf;
`,pe={name:`sdf`,vs:fe,fs:fe,uniformTypes:{gamma:`f32`,enabled:`f32`,buffer:`f32`,outlineBuffer:`f32`,outlineColor:`vec4<f32>`}},me=`#version 300 es
#define SHADER_NAME multi-icon-layer-fragment-shader
precision highp float;
uniform sampler2D iconsTexture;
in vec4 vColor;
in vec2 vTextureCoords;
in vec2 uv;
out vec4 fragColor;
void main(void) {
geometry.uv = uv;
if (!bool(picking.isActive)) {
float alpha = texture(iconsTexture, vTextureCoords).a;
vec4 color = vColor;
if (sdf.enabled) {
float distance = alpha;
alpha = smoothstep(sdf.buffer - sdf.gamma, sdf.buffer + sdf.gamma, distance);
if (sdf.outlineBuffer > 0.0) {
float inFill = alpha;
float inBorder = smoothstep(sdf.outlineBuffer - sdf.gamma, sdf.outlineBuffer + sdf.gamma, distance);
color = mix(sdf.outlineColor, vColor, inFill);
alpha = inBorder;
}
}
float a = alpha * color.a;
if (a < icon.alphaCutoff) {
discard;
}
fragColor = vec4(color.rgb, a * layer.opacity);
}
DECKGL_FILTER_COLOR(fragColor, geometry);
}
`,N=192/256,P=[],he={getIconOffsets:{type:`accessor`,value:e=>e.offsets},alphaCutoff:.001,smoothing:.1,outlineWidth:0,outlineColor:{type:`color`,value:[0,0,0,255]}},F=class extends A{getShaders(){let e=super.getShaders();return{...e,modules:[...e.modules,pe],fs:me}}initializeState(){super.initializeState(),this.getAttributeManager().addInstanced({instanceOffsets:{size:2,accessor:`getIconOffsets`},instancePickingColors:{type:`uint8`,size:3,accessor:(e,{index:t,target:n})=>this.encodePickingColor(t,n)}})}updateState(e){super.updateState(e);let{props:t,oldProps:n}=e,{outlineColor:r}=t;if(r!==n.outlineColor){let e=[r[0]/255,r[1]/255,r[2]/255,(r[3]??255)/255];this.setState({outlineColor:e})}!t.sdf&&t.outlineWidth&&s.warn(`${this.id}: fontSettings.sdf is required to render outline`)()}draw(e){let{sdf:t,smoothing:n,outlineWidth:r}=this.props,{outlineColor:i}=this.state,a=r?Math.max(n,N*(1-r)):-1,o=this.state.model,s={buffer:N,outlineBuffer:a,gamma:n,enabled:!!t,outlineColor:i};if(o.shaderInputs.setProps({sdf:s}),super.draw(e),t&&r){let{iconManager:e}=this.state;e.getTexture()&&(o.shaderInputs.setProps({sdf:{...s,outlineBuffer:N}}),o.draw(this.context.renderPass))}}getInstanceOffset(e){return e?Array.from(e).flatMap(e=>super.getInstanceOffset(e)):P}getInstanceColorMode(e){return 1}getInstanceIconFrame(e){return e?Array.from(e).flatMap(e=>super.getInstanceIconFrame(e)):P}};F.defaultProps=he,F.layerName=`MultiIconLayer`;var I=0x56bc75e2d63100000,L=new Float64Array(256);for(let e=0;e<256;e++){let t=.5-(e/255)**(1/2.2);L[e]=t*Math.abs(t)}L[255]=-I;var ge=class{constructor({fontSize:e=24,buffer:t=3,radius:n=8,cutoff:r=.25,fontFamily:i=`sans-serif`,fontWeight:a=`normal`,fontStyle:o=`normal`,lang:s=null}={}){this.buffer=t,this.radius=n,this.cutoff=r,this.lang=s;let c=this.size=e+t*4,l=this.ctx=this._createCanvas(c).getContext(`2d`,{willReadFrequently:!0});l.font=`${o} ${a} ${e}px ${i}`,l.textBaseline=`alphabetic`,l.textAlign=`left`,l.fillStyle=`black`,this.gridOuter=new Float64Array(c*c),this.gridInner=new Float64Array(c*c),this.f=new Float64Array(c),this.z=new Float64Array(c+1),this.v=new Uint16Array(c)}_createCanvas(e){if(typeof OffscreenCanvas<`u`)return new OffscreenCanvas(e,e);let t=document.createElement(`canvas`);return t.width=t.height=e,t}draw(e){let{width:t,actualBoundingBoxAscent:n,actualBoundingBoxDescent:r,actualBoundingBoxLeft:i,actualBoundingBoxRight:a}=this.ctx.measureText(e),o=Math.ceil(n),s=Math.floor(i),c=Math.max(0,Math.min(this.size-this.buffer,Math.ceil(a)-s)),l=Math.max(0,Math.min(this.size-this.buffer,o+Math.ceil(r))),u=c+2*this.buffer,d=l+2*this.buffer,f=Math.max(u*d,0),p=new Uint8ClampedArray(f),m={data:p,width:u,height:d,glyphWidth:c,glyphHeight:l,glyphTop:o,glyphLeft:s,glyphAdvance:t};if(c===0||l===0)return m;let{ctx:h,buffer:g,gridInner:_,gridOuter:v}=this;this.lang&&(h.lang=this.lang),h.clearRect(g,g,c,l),h.fillText(e,g-s,g+o);let y=h.getImageData(g,g,c,l);v.fill(I,0,f),_.fill(0,0,f);let b=3;for(let e=0;e<l;e++){let t=(e+g)*u+g;for(let e=0;e<c;e++,b+=4,t++){let e=y.data[b];if(e===0)continue;let n=L[e];v[t]=Math.max(0,n),_[t]=Math.max(0,-n)}}R(v,0,0,u,d,u,this.f,this.v,this.z),R(_,g,g,c,l,u,this.f,this.v,this.z);let x=255/this.radius,S=255*(1-this.cutoff);for(let e=0;e<f;e++){let t=Math.sqrt(v[e])-Math.sqrt(_[e]);p[e]=Math.round(S-x*t)}return m}};function R(e,t,n,r,i,a,o,s,c){for(let l=t;l<t+r;l++)z(e,n*a+l,a,i,o,s,c);for(let l=n;l<n+i;l++)z(e,l*a+t,1,r,o,s,c)}function z(e,t,n,r,i,a,o){a[0]=0,o[0]=-I,o[1]=I,i[0]=e[t];for(let s=1,c=0,l=0;s<r;s++){i[s]=e[t+s*n];let r=s*s;do{let e=a[c];l=(i[s]-i[e]+r-e*e)/(s-e)/2}while(l<=o[c]&&--c>-1);c++,a[c]=s,o[c]=l,o[c+1]=I}for(let s=0,c=0;s<r;s++){for(;o[c+1]<s;)c++;let r=a[c],l=s-r;e[t+s*n]=i[r]+l*l}}var _e=32,ve=[];function ye(e){return 2**Math.ceil(Math.log2(e))}function be({characterSet:e,getFontWidth:t,fontHeight:n,buffer:r,maxCanvasWidth:i,mapping:a={},xOffset:o=0,yOffset:s=0}){let c=0,l=o,u=n+r*2;for(let o of e)if(!a[o]){let e=t(o);l+e+r*2>i&&(l=0,c++),a[o]={x:l+r,y:s+c*u+r,width:e,height:u,layoutWidth:e,layoutHeight:n},l+=e+r*2}return{mapping:a,xOffset:l,yOffset:s+c*u,canvasHeight:ye(s+(c+1)*u)}}function B(e,t,n,r){let i=0;for(let a=t;a<n;a++){let t=e[a];i+=r[t]?.layoutWidth||0}return i}function xe(e,t,n,r,i,a){let o=t,s=0;for(let c=t;c<n;c++){let t=B(e,c,c+1,i);s+t>r&&(o<c&&a.push(c),o=c,s=0),s+=t}return s}function Se(e,t,n,r,i,a){let o=t,s=t,c=t,l=0;for(let u=t;u<n;u++)if((e[u]===` `||e[u+1]===` `||u+1===n)&&(c=u+1),c>s){let t=B(e,s,c,i);l+t>r&&(o<s&&(a.push(s),o=s,l=0),t>r&&(t=xe(e,s,c,r,i,a),o=a[a.length-1])),s=c,l+=t}return l}function Ce(e,t,n,r,i=0,a){a===void 0&&(a=e.length);let o=[];return t===`break-all`?xe(e,i,a,n,r,o):Se(e,i,a,n,r,o),o}function we(e,t,n,r,i,a){let o=0,c=0;for(let a=t;a<n;a++){let t=e[a],n=r[t];n?(c||=n.layoutHeight,i[a]=o+n.layoutWidth/2,o+=n.layoutWidth):(s.warn(`Missing character: ${t} (${t.codePointAt(0)})`)(),i[a]=o,o+=_e)}a[0]=o,a[1]=c}function Te(e,t,n,r,i){let a=Array.from(e),o=a.length,s=Array(o),c=Array(o),l=Array(o),u=(n===`break-word`||n===`break-all`)&&isFinite(r)&&r>0,d=[0,0],f=[0,0],p=0,m=0,h=0;for(let e=0;e<=o;e++){let g=a[e];if((g===`
`||e===o)&&(h=e),h>m){let e=u?Ce(a,n,r,i,m,h):ve;for(let n=0;n<=e.length;n++){let r=n===0?m:e[n-1],o=n<e.length?e[n]:h;we(a,r,o,i,s,f);for(let e=r;e<o;e++){let t=i[a[e]]?.layoutOffsetY||0;c[e]=p+f[1]/2+t,l[e]=f[0]}p+=f[1]*t,d[0]=Math.max(d[0],f[0])}m=h}g===`
`&&(s[m]=0,c[m]=0,l[m]=0,m++)}return d[1]=p,{x:s,y:c,rowWidth:l,size:d}}function Ee({value:e,length:t,stride:n,offset:r,startIndices:i,characterSet:a}){let o=e.BYTES_PER_ELEMENT,s=n?n/o:1,c=r?r/o:0,l=i[t]||Math.ceil((e.length-c)/s),u=a&&new Set,d=Array(t),f=e;if(s>1||c>0){let t=e.constructor;f=new t(l);for(let t=0;t<l;t++)f[t]=e[t*s+c]}for(let e=0;e<t;e++){let t=i[e],n=i[e+1]||l,r=f.subarray(t,n);d[e]=String.fromCodePoint.apply(null,r),u&&r.forEach(u.add,u)}if(u)for(let e of u)a.add(String.fromCodePoint(e));return{texts:d,characterCount:l}}var De=class{constructor(e=5){this._cache={},this._order=[],this.limit=e}get(e){let t=this._cache[e];return t&&(this._deleteOrder(e),this._appendOrder(e)),t}set(e,t){this._cache[e]?(this.delete(e),this._cache[e]=t,this._appendOrder(e)):(Object.keys(this._cache).length===this.limit&&this.delete(this._order[0]),this._cache[e]=t,this._appendOrder(e))}delete(e){this._cache[e]&&(delete this._cache[e],this._deleteOrder(e))}_deleteOrder(e){let t=this._order.indexOf(e);t>=0&&this._order.splice(t,1)}_appendOrder(e){this._order.push(e)}};function Oe(){let e=[];for(let t=32;t<128;t++)e.push(String.fromCharCode(t));return e}var V={fontFamily:`Monaco, monospace`,fontWeight:`normal`,characterSet:Oe(),fontSize:64,buffer:4,sdf:!1,cutoff:.25,radius:12,smoothing:.1},ke=1024,H=.9,Ae=1.2,je=3,U=new De(je);function Me(e,t){let n;n=typeof t==`string`?new Set(Array.from(t)):new Set(t);let r=U.get(e);if(!r)return n;for(let e in r.mapping)n.has(e)&&n.delete(e);return n}function Ne(e,t){for(let n=0;n<e.length;n++)t.data[4*n+3]=e[n]}function Pe(e,t,n,r){e.font=`${r} ${n}px ${t}`,e.fillStyle=`#000`,e.textBaseline=`alphabetic`,e.textAlign=`left`}function Fe(e){s.assert(Number.isFinite(e)&&e>=je,`Invalid cache limit`),U=new De(e)}var Ie=class{constructor(){this.props={...V}}get atlas(){return this._atlas}get mapping(){return this._atlas&&this._atlas.mapping}get scale(){let{fontSize:e,buffer:t}=this.props;return(e*Ae+t*2)/e}setProps(e={}){Object.assign(this.props,e),this._key=this._getKey();let t=Me(this._key,this.props.characterSet),n=U.get(this._key);if(n&&t.size===0){this._atlas!==n&&(this._atlas=n);return}let r=this._generateFontAtlas(t,n);this._atlas=r,U.set(this._key,r)}_generateFontAtlas(e,t){let{fontFamily:n,fontWeight:r,fontSize:i,buffer:a,sdf:o,radius:s,cutoff:c}=this.props,l=t&&t.data;l||(l=document.createElement(`canvas`),l.width=ke);let u=l.getContext(`2d`,{willReadFrequently:!0});Pe(u,n,i,r);let{mapping:d,canvasHeight:f,xOffset:p,yOffset:m}=be({getFontWidth:e=>u.measureText(e).width,fontHeight:i*Ae,buffer:a,characterSet:e,maxCanvasWidth:ke,...t&&{mapping:t.mapping,xOffset:t.xOffset,yOffset:t.yOffset}});if(l.height!==f){let e=u.getImageData(0,0,l.width,l.height);l.height=f,u.putImageData(e,0,0)}if(Pe(u,n,i,r),o){let t=new ge({fontSize:i,buffer:a,radius:s,cutoff:c,fontFamily:n,fontWeight:`${r}`});for(let n of e){let{data:e,width:r,height:a,glyphTop:o}=t.draw(n);d[n].width=r,d[n].layoutOffsetY=i*H-o;let s=u.createImageData(r,a);Ne(e,s),u.putImageData(s,d[n].x,d[n].y)}}else for(let t of e)u.fillText(t,d[t].x,d[t].y+a+i*H);return{xOffset:p,yOffset:m,mapping:d,data:l,width:l.width,height:l.height}}_getKey(){let{fontFamily:e,fontWeight:t,fontSize:n,buffer:r,sdf:i,radius:a,cutoff:o}=this.props;return i?`${e} ${t} ${n} ${r} ${a} ${o}`:`${e} ${t} ${n} ${r}`}},Le=`uniform textBackgroundUniforms {
  bool billboard;
  float sizeScale;
  float sizeMinPixels;
  float sizeMaxPixels;
  vec4 borderRadius;
  vec4 padding;
  highp int sizeUnits;
  bool stroked;
} textBackground;
`,Re={name:`textBackground`,vs:Le,fs:Le,uniformTypes:{billboard:`f32`,sizeScale:`f32`,sizeMinPixels:`f32`,sizeMaxPixels:`f32`,borderRadius:`vec4<f32>`,padding:`vec4<f32>`,sizeUnits:`i32`,stroked:`f32`}},ze=`#version 300 es
#define SHADER_NAME text-background-layer-vertex-shader
in vec2 positions;
in vec3 instancePositions;
in vec3 instancePositions64Low;
in vec4 instanceRects;
in float instanceSizes;
in float instanceAngles;
in vec2 instancePixelOffsets;
in float instanceLineWidths;
in vec4 instanceFillColors;
in vec4 instanceLineColors;
in vec3 instancePickingColors;
out vec4 vFillColor;
out vec4 vLineColor;
out float vLineWidth;
out vec2 uv;
out vec2 dimensions;
vec2 rotate_by_angle(vec2 vertex, float angle) {
float angle_radian = radians(angle);
float cos_angle = cos(angle_radian);
float sin_angle = sin(angle_radian);
mat2 rotationMatrix = mat2(cos_angle, -sin_angle, sin_angle, cos_angle);
return rotationMatrix * vertex;
}
void main(void) {
geometry.worldPosition = instancePositions;
geometry.uv = positions;
geometry.pickingColor = instancePickingColors;
uv = positions;
vLineWidth = instanceLineWidths;
float sizePixels = clamp(
project_size_to_pixel(instanceSizes * textBackground.sizeScale, textBackground.sizeUnits),
textBackground.sizeMinPixels, textBackground.sizeMaxPixels
);
dimensions = instanceRects.zw * sizePixels + textBackground.padding.xy + textBackground.padding.zw;
vec2 pixelOffset = (positions * instanceRects.zw + instanceRects.xy) * sizePixels + mix(-textBackground.padding.xy, textBackground.padding.zw, positions);
pixelOffset = rotate_by_angle(pixelOffset, instanceAngles);
pixelOffset += instancePixelOffsets;
pixelOffset.y *= -1.0;
if (textBackground.billboard)  {
gl_Position = project_position_to_clipspace(instancePositions, instancePositions64Low, vec3(0.0), geometry.position);
DECKGL_FILTER_GL_POSITION(gl_Position, geometry);
vec3 offset = vec3(pixelOffset, 0.0);
DECKGL_FILTER_SIZE(offset, geometry);
gl_Position.xy += project_pixel_size_to_clipspace(offset.xy);
} else {
vec3 offset_common = vec3(project_pixel_size(pixelOffset), 0.0);
DECKGL_FILTER_SIZE(offset_common, geometry);
gl_Position = project_position_to_clipspace(instancePositions, instancePositions64Low, offset_common, geometry.position);
DECKGL_FILTER_GL_POSITION(gl_Position, geometry);
}
vFillColor = vec4(instanceFillColors.rgb, instanceFillColors.a * layer.opacity);
DECKGL_FILTER_COLOR(vFillColor, geometry);
vLineColor = vec4(instanceLineColors.rgb, instanceLineColors.a * layer.opacity);
DECKGL_FILTER_COLOR(vLineColor, geometry);
}
`,Be=`#version 300 es
#define SHADER_NAME text-background-layer-fragment-shader
precision highp float;
in vec4 vFillColor;
in vec4 vLineColor;
in float vLineWidth;
in vec2 uv;
in vec2 dimensions;
out vec4 fragColor;
float round_rect(vec2 p, vec2 size, vec4 radii) {
vec2 pixelPositionCB = (p - 0.5) * size;
vec2 sizeCB = size * 0.5;
float maxBorderRadius = min(size.x, size.y) * 0.5;
vec4 borderRadius = vec4(min(radii, maxBorderRadius));
borderRadius.xy =
(pixelPositionCB.x > 0.0) ? borderRadius.xy : borderRadius.zw;
borderRadius.x = (pixelPositionCB.y > 0.0) ? borderRadius.x : borderRadius.y;
vec2 q = abs(pixelPositionCB) - sizeCB + borderRadius.x;
return -(min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - borderRadius.x);
}
float rect(vec2 p, vec2 size) {
vec2 pixelPosition = p * size;
return min(min(pixelPosition.x, size.x - pixelPosition.x),
min(pixelPosition.y, size.y - pixelPosition.y));
}
vec4 get_stroked_fragColor(float dist) {
float isBorder = smoothedge(dist, vLineWidth);
return mix(vFillColor, vLineColor, isBorder);
}
void main(void) {
geometry.uv = uv;
if (textBackground.borderRadius != vec4(0.0)) {
float distToEdge = round_rect(uv, dimensions, textBackground.borderRadius);
if (textBackground.stroked) {
fragColor = get_stroked_fragColor(distToEdge);
} else {
fragColor = vFillColor;
}
float shapeAlpha = smoothedge(-distToEdge, 0.0);
fragColor.a *= shapeAlpha;
} else {
if (textBackground.stroked) {
float distToEdge = rect(uv, dimensions);
fragColor = get_stroked_fragColor(distToEdge);
} else {
fragColor = vFillColor;
}
}
DECKGL_FILTER_COLOR(fragColor, geometry);
}
`,Ve={billboard:!0,sizeScale:1,sizeUnits:`pixels`,sizeMinPixels:0,sizeMaxPixels:2**53-1,borderRadius:{type:`object`,value:0},padding:{type:`array`,value:[0,0,0,0]},getPosition:{type:`accessor`,value:e=>e.position},getSize:{type:`accessor`,value:1},getAngle:{type:`accessor`,value:0},getPixelOffset:{type:`accessor`,value:[0,0]},getBoundingRect:{type:`accessor`,value:[0,0,0,0]},getFillColor:{type:`accessor`,value:[0,0,0,255]},getLineColor:{type:`accessor`,value:[0,0,0,255]},getLineWidth:{type:`accessor`,value:1}},W=class extends i{getShaders(){return super.getShaders({vs:ze,fs:Be,modules:[t,e,Re]})}initializeState(){this.getAttributeManager().addInstanced({instancePositions:{size:3,type:`float64`,fp64:this.use64bitPositions(),transition:!0,accessor:`getPosition`},instanceSizes:{size:1,transition:!0,accessor:`getSize`,defaultValue:1},instanceAngles:{size:1,transition:!0,accessor:`getAngle`},instanceRects:{size:4,accessor:`getBoundingRect`},instancePixelOffsets:{size:2,transition:!0,accessor:`getPixelOffset`},instanceFillColors:{size:4,transition:!0,type:`unorm8`,accessor:`getFillColor`,defaultValue:[0,0,0,255]},instanceLineColors:{size:4,transition:!0,type:`unorm8`,accessor:`getLineColor`,defaultValue:[0,0,0,255]},instanceLineWidths:{size:1,transition:!0,accessor:`getLineWidth`,defaultValue:1}})}updateState(e){super.updateState(e);let{changeFlags:t}=e;t.extensionsChanged&&(this.state.model?.destroy(),this.state.model=this._getModel(),this.getAttributeManager().invalidateAll())}draw({uniforms:e}){let{billboard:t,sizeScale:n,sizeUnits:r,sizeMinPixels:i,sizeMaxPixels:a,getLineWidth:o}=this.props,{padding:s,borderRadius:l}=this.props;s.length<4&&(s=[s[0],s[1],s[0],s[1]]),Array.isArray(l)||(l=[l,l,l,l]);let u=this.state.model,d={billboard:t,stroked:!!o,borderRadius:l,padding:s,sizeUnits:c[r],sizeScale:n,sizeMinPixels:i,sizeMaxPixels:a};u.shaderInputs.setProps({textBackground:d}),u.draw(this.context.renderPass)}_getModel(){let e=[0,0,1,0,0,1,1,1];return new r(this.context.device,{...this.getShaders(),id:this.props.id,bufferLayout:this.getAttributeManager().getBufferLayouts(),geometry:new l({topology:`triangle-strip`,vertexCount:4,attributes:{positions:{size:2,value:new Float32Array(e)}}}),isInstanced:!0})}};W.defaultProps=Ve,W.layerName=`TextBackgroundLayer`;var He={start:1,middle:0,end:-1},Ue={top:1,center:0,bottom:-1},G=[0,0,0,255],We={billboard:!0,sizeScale:1,sizeUnits:`pixels`,sizeMinPixels:0,sizeMaxPixels:2**53-1,background:!1,getBackgroundColor:{type:`accessor`,value:[255,255,255,255]},getBorderColor:{type:`accessor`,value:G},getBorderWidth:{type:`accessor`,value:0},backgroundBorderRadius:{type:`object`,value:0},backgroundPadding:{type:`array`,value:[0,0,0,0]},characterSet:{type:`object`,value:V.characterSet},fontFamily:V.fontFamily,fontWeight:V.fontWeight,lineHeight:1,outlineWidth:{type:`number`,value:0,min:0},outlineColor:{type:`color`,value:G},fontSettings:{type:`object`,value:{},compare:1},wordBreak:`break-word`,maxWidth:{type:`number`,value:-1},getText:{type:`accessor`,value:e=>e.text},getPosition:{type:`accessor`,value:e=>e.position},getColor:{type:`accessor`,value:G},getSize:{type:`accessor`,value:32},getAngle:{type:`accessor`,value:0},getTextAnchor:{type:`accessor`,value:`middle`},getAlignmentBaseline:{type:`accessor`,value:`center`},getPixelOffset:{type:`accessor`,value:[0,0]},backgroundColor:{deprecatedFor:[`background`,`getBackgroundColor`]}},K=class extends f{constructor(){super(...arguments),this.getBoundingRect=(e,t)=>{let{size:[n,r]}=this.transformParagraph(e,t),{fontSize:i}=this.state.fontAtlasManager.props;n/=i,r/=i;let{getTextAnchor:a,getAlignmentBaseline:o}=this.props,s=He[typeof a==`function`?a(e,t):a],c=Ue[typeof o==`function`?o(e,t):o];return[(s-1)*n/2,(c-1)*r/2,n,r]},this.getIconOffsets=(e,t)=>{let{getTextAnchor:n,getAlignmentBaseline:r}=this.props,{x:i,y:a,rowWidth:o,size:[s,c]}=this.transformParagraph(e,t),l=He[typeof n==`function`?n(e,t):n],u=Ue[typeof r==`function`?r(e,t):r],d=i.length,f=Array(d*2),p=0;for(let e=0;e<d;e++){let t=(1-l)*(s-o[e])/2;f[p++]=(l-1)*s/2+t+i[e],f[p++]=(u-1)*c/2+a[e]}return f}}initializeState(){this.state={styleVersion:0,fontAtlasManager:new Ie},this.props.maxWidth>0&&s.once(1,`v8.9 breaking change: TextLayer maxWidth is now relative to text size`)()}updateState(e){let{props:t,oldProps:n,changeFlags:r}=e;(r.dataChanged||r.updateTriggersChanged&&(r.updateTriggersChanged.all||r.updateTriggersChanged.getText))&&this._updateText(),(this._updateFontAtlas()||t.lineHeight!==n.lineHeight||t.wordBreak!==n.wordBreak||t.maxWidth!==n.maxWidth)&&this.setState({styleVersion:this.state.styleVersion+1})}getPickingInfo({info:e}){return e.object=e.index>=0?this.props.data[e.index]:null,e}_updateFontAtlas(){let{fontSettings:e,fontFamily:t,fontWeight:n}=this.props,{fontAtlasManager:r,characterSet:i}=this.state,a={...e,characterSet:i,fontFamily:t,fontWeight:n};if(!r.mapping)return r.setProps(a),!0;for(let e in a)if(a[e]!==r.props[e])return r.setProps(a),!0;return!1}_updateText(){let{data:e,characterSet:t}=this.props,n=e.attributes?.getText,{getText:r}=this.props,i=e.startIndices,a,s=t===`auto`&&new Set;if(n&&i){let{texts:t,characterCount:o}=Ee({...ArrayBuffer.isView(n)?{value:n}:n,length:e.length,startIndices:i,characterSet:s});a=o,r=(e,{index:n})=>t[n]}else{let{iterable:t,objectInfo:n}=o(e);i=[0],a=0;for(let e of t){n.index++;let t=Array.from(r(e,n)||``);s&&t.forEach(s.add,s),a+=t.length,i.push(a)}}this.setState({getText:r,startIndices:i,numInstances:a,characterSet:s||t})}transformParagraph(e,t){let{fontAtlasManager:n}=this.state,r=n.mapping,i=this.state.getText,{wordBreak:a,lineHeight:o,maxWidth:s}=this.props;return Te(i(e,t)||``,o,a,s*n.props.fontSize,r)}renderLayers(){let{startIndices:e,numInstances:t,getText:n,fontAtlasManager:{scale:r,atlas:i,mapping:a},styleVersion:o}=this.state,{data:s,_dataDiff:c,getPosition:l,getColor:u,getSize:d,getAngle:f,getPixelOffset:p,getBackgroundColor:m,getBorderColor:h,getBorderWidth:g,backgroundBorderRadius:_,backgroundPadding:v,background:y,billboard:b,fontSettings:x,outlineWidth:S,outlineColor:ee,sizeScale:C,sizeUnits:w,sizeMinPixels:T,sizeMaxPixels:E,transitions:D,updateTriggers:O}=this.props,te=this.getSubLayerClass(`characters`,F),k=this.getSubLayerClass(`background`,W);return[y&&new k({getFillColor:m,getLineColor:h,getLineWidth:g,borderRadius:_,padding:v,getPosition:l,getSize:d,getAngle:f,getPixelOffset:p,billboard:b,sizeScale:C,sizeUnits:w,sizeMinPixels:T,sizeMaxPixels:E,transitions:D&&{getPosition:D.getPosition,getAngle:D.getAngle,getSize:D.getSize,getFillColor:D.getBackgroundColor,getLineColor:D.getBorderColor,getLineWidth:D.getBorderWidth,getPixelOffset:D.getPixelOffset}},this.getSubLayerProps({id:`background`,updateTriggers:{getPosition:O.getPosition,getAngle:O.getAngle,getSize:O.getSize,getFillColor:O.getBackgroundColor,getLineColor:O.getBorderColor,getLineWidth:O.getBorderWidth,getPixelOffset:O.getPixelOffset,getBoundingRect:{getText:O.getText,getTextAnchor:O.getTextAnchor,getAlignmentBaseline:O.getAlignmentBaseline,styleVersion:o}}}),{data:s.attributes&&s.attributes.background?{length:s.length,attributes:s.attributes.background}:s,_dataDiff:c,autoHighlight:!1,getBoundingRect:this.getBoundingRect}),new te({sdf:x.sdf,smoothing:Number.isFinite(x.smoothing)?x.smoothing:V.smoothing,outlineWidth:S/(x.radius||V.radius),outlineColor:ee,iconAtlas:i,iconMapping:a,getPosition:l,getColor:u,getSize:d,getAngle:f,getPixelOffset:p,billboard:b,sizeScale:C*r,sizeUnits:w,sizeMinPixels:T*r,sizeMaxPixels:E*r,transitions:D&&{getPosition:D.getPosition,getAngle:D.getAngle,getColor:D.getColor,getSize:D.getSize,getPixelOffset:D.getPixelOffset}},this.getSubLayerProps({id:`characters`,updateTriggers:{all:O.getText,getPosition:O.getPosition,getAngle:O.getAngle,getColor:O.getColor,getSize:O.getSize,getPixelOffset:O.getPixelOffset,getIconOffsets:{getTextAnchor:O.getTextAnchor,getAlignmentBaseline:O.getAlignmentBaseline,styleVersion:o}}}),{data:s,_dataDiff:c,startIndices:e,numInstances:t,getIconOffsets:this.getIconOffsets,getIcon:n})]}static set fontAtlasCacheLimit(e){Fe(e)}};K.defaultProps=We,K.layerName=`TextLayer`;var q={circle:{type:M,props:{filled:`filled`,stroked:`stroked`,lineWidthMaxPixels:`lineWidthMaxPixels`,lineWidthMinPixels:`lineWidthMinPixels`,lineWidthScale:`lineWidthScale`,lineWidthUnits:`lineWidthUnits`,pointRadiusMaxPixels:`radiusMaxPixels`,pointRadiusMinPixels:`radiusMinPixels`,pointRadiusScale:`radiusScale`,pointRadiusUnits:`radiusUnits`,pointAntialiasing:`antialiasing`,pointBillboard:`billboard`,getFillColor:`getFillColor`,getLineColor:`getLineColor`,getLineWidth:`getLineWidth`,getPointRadius:`getRadius`}},icon:{type:A,props:{iconAtlas:`iconAtlas`,iconMapping:`iconMapping`,iconSizeMaxPixels:`sizeMaxPixels`,iconSizeMinPixels:`sizeMinPixels`,iconSizeScale:`sizeScale`,iconSizeUnits:`sizeUnits`,iconAlphaCutoff:`alphaCutoff`,iconBillboard:`billboard`,getIcon:`getIcon`,getIconAngle:`getAngle`,getIconColor:`getColor`,getIconPixelOffset:`getPixelOffset`,getIconSize:`getSize`}},text:{type:K,props:{textSizeMaxPixels:`sizeMaxPixels`,textSizeMinPixels:`sizeMinPixels`,textSizeScale:`sizeScale`,textSizeUnits:`sizeUnits`,textBackground:`background`,textBackgroundPadding:`backgroundPadding`,textFontFamily:`fontFamily`,textFontWeight:`fontWeight`,textLineHeight:`lineHeight`,textMaxWidth:`maxWidth`,textOutlineColor:`outlineColor`,textOutlineWidth:`outlineWidth`,textWordBreak:`wordBreak`,textCharacterSet:`characterSet`,textBillboard:`billboard`,textFontSettings:`fontSettings`,getText:`getText`,getTextAngle:`getAngle`,getTextColor:`getColor`,getTextPixelOffset:`getPixelOffset`,getTextSize:`getSize`,getTextAnchor:`getTextAnchor`,getTextAlignmentBaseline:`getAlignmentBaseline`,getTextBackgroundColor:`getBackgroundColor`,getTextBorderColor:`getBorderColor`,getTextBorderWidth:`getBorderWidth`}}},J={type:u,props:{lineWidthUnits:`widthUnits`,lineWidthScale:`widthScale`,lineWidthMinPixels:`widthMinPixels`,lineWidthMaxPixels:`widthMaxPixels`,lineJointRounded:`jointRounded`,lineCapRounded:`capRounded`,lineMiterLimit:`miterLimit`,lineBillboard:`billboard`,getLineColor:`getColor`,getLineWidth:`getWidth`}},Y={type:d,props:{extruded:`extruded`,filled:`filled`,wireframe:`wireframe`,elevationScale:`elevationScale`,material:`material`,_full3d:`_full3d`,getElevation:`getElevation`,getFillColor:`getFillColor`,getLineColor:`getLineColor`}};function X({type:e,props:t}){let n={};for(let r in t)n[r]=e.defaultProps[t[r]];return n}function Z(e,t){let{transitions:n,updateTriggers:r}=e.props,i={updateTriggers:{},transitions:n&&{getPosition:n.geometry}};for(let a in t){let o=t[a],s=e.props[a];a.startsWith(`get`)&&(s=e.getSubLayerAccessor(s),i.updateTriggers[o]=r[a],n&&(i.transitions[o]=n[a])),i[o]=s}return i}function Ge(e){if(Array.isArray(e))return e;switch(s.assert(e.type,`GeoJSON does not have type`),e.type){case`Feature`:return[e];case`FeatureCollection`:return s.assert(Array.isArray(e.features),`GeoJSON does not have features array`),e.features;default:return[{geometry:e}]}}function Ke(e,t,n={}){let r={pointFeatures:[],lineFeatures:[],polygonFeatures:[],polygonOutlineFeatures:[]},{startRow:i=0,endRow:a=e.length}=n;for(let n=i;n<a;n++){let i=e[n],{geometry:a}=i;if(a)if(a.type===`GeometryCollection`){s.assert(Array.isArray(a.geometries),`GeoJSON does not have geometries array`);let{geometries:e}=a;for(let a=0;a<e.length;a++){let o=e[a];qe(o,r,t,i,n)}}else qe(a,r,t,i,n)}return r}function qe(e,t,n,r,i){let{type:a,coordinates:o}=e,{pointFeatures:c,lineFeatures:l,polygonFeatures:u,polygonOutlineFeatures:d}=t;if(!Ye(a,o)){s.warn(`${a} coordinates are malformed`)();return}switch(a){case`Point`:c.push(n({geometry:e},r,i));break;case`MultiPoint`:o.forEach(e=>{c.push(n({geometry:{type:`Point`,coordinates:e}},r,i))});break;case`LineString`:l.push(n({geometry:e},r,i));break;case`MultiLineString`:o.forEach(e=>{l.push(n({geometry:{type:`LineString`,coordinates:e}},r,i))});break;case`Polygon`:u.push(n({geometry:e},r,i)),o.forEach(e=>{d.push(n({geometry:{type:`LineString`,coordinates:e}},r,i))});break;case`MultiPolygon`:o.forEach(e=>{u.push(n({geometry:{type:`Polygon`,coordinates:e}},r,i)),e.forEach(e=>{d.push(n({geometry:{type:`LineString`,coordinates:e}},r,i))})});break;default:}}var Je={Point:1,MultiPoint:2,LineString:2,MultiLineString:3,Polygon:3,MultiPolygon:4};function Ye(e,t){let n=Je[e];for(s.assert(n,`Unknown GeoJSON type ${e}`);t&&--n>0;)t=t[0];return t&&Number.isFinite(t[0])}function Xe(){return{points:{},lines:{},polygons:{},polygonsOutline:{}}}function Q(e){return e.geometry.coordinates}function Ze(e,t){let n=Xe(),{pointFeatures:r,lineFeatures:i,polygonFeatures:a,polygonOutlineFeatures:o}=e;return n.points.data=r,n.points._dataDiff=t.pointFeatures&&(()=>t.pointFeatures),n.points.getPosition=Q,n.lines.data=i,n.lines._dataDiff=t.lineFeatures&&(()=>t.lineFeatures),n.lines.getPath=Q,n.polygons.data=a,n.polygons._dataDiff=t.polygonFeatures&&(()=>t.polygonFeatures),n.polygons.getPolygon=Q,n.polygonsOutline.data=o,n.polygonsOutline._dataDiff=t.polygonOutlineFeatures&&(()=>t.polygonOutlineFeatures),n.polygonsOutline.getPath=Q,n}function Qe(e,t){let n=Xe(),{points:r,lines:i,polygons:a}=e,o=de(e,t);n.points.data={length:r.positions.value.length/r.positions.size,attributes:{...r.attributes,getPosition:r.positions,instancePickingColors:{size:4,value:o.points}},properties:r.properties,numericProps:r.numericProps,featureIds:r.featureIds},n.lines.data={length:i.pathIndices.value.length-1,startIndices:i.pathIndices.value,attributes:{...i.attributes,getPath:i.positions,instancePickingColors:{size:4,value:o.lines}},properties:i.properties,numericProps:i.numericProps,featureIds:i.featureIds},n.lines._pathType=`open`;let s=a.positions.value.length/a.positions.size,c=Array(s).fill(1);for(let e of a.primitivePolygonIndices.value)c[e-1]=0;return n.polygons.data={length:a.polygonIndices.value.length-1,startIndices:a.polygonIndices.value,attributes:{...a.attributes,getPolygon:a.positions,instanceVertexValid:{size:1,value:new Uint16Array(c)},pickingColors:{size:4,value:o.polygons}},properties:a.properties,numericProps:a.numericProps,featureIds:a.featureIds},n.polygons._normalize=!1,a.triangles&&(n.polygons.data.attributes.indices=a.triangles.value),n.polygonsOutline.data={length:a.primitivePolygonIndices.value.length-1,startIndices:a.primitivePolygonIndices.value,attributes:{...a.attributes,getPath:a.positions,instancePickingColors:{size:4,value:o.polygons}},properties:a.properties,numericProps:a.numericProps,featureIds:a.featureIds},n.polygonsOutline._pathType=`open`,n}var $e=[`points`,`linestrings`,`polygons`],et={...X(q.circle),...X(q.icon),...X(q.text),...X(J),...X(Y),stroked:!0,filled:!0,extruded:!1,wireframe:!1,_full3d:!1,iconAtlas:{type:`object`,value:null},iconMapping:{type:`object`,value:{}},getIcon:{type:`accessor`,value:e=>e.properties.icon},getText:{type:`accessor`,value:e=>e.properties.text},pointType:`circle`,getRadius:{deprecatedFor:`getPointRadius`}},$=class extends f{initializeState(){this.state={layerProps:{},features:{},featuresDiff:{}}}updateState({props:e,changeFlags:t}){if(!t.dataChanged)return;let{data:n}=this.props,r=n&&`points`in n&&`polygons`in n&&`lines`in n;this.setState({binary:r}),r?this._updateStateBinary({props:e,changeFlags:t}):this._updateStateJSON({props:e,changeFlags:t})}_updateStateBinary({props:e,changeFlags:t}){let n=Qe(e.data,this.encodePickingColor);this.setState({layerProps:n})}_updateStateJSON({props:e,changeFlags:t}){let n=Ge(e.data),r=this.getSubLayerRow.bind(this),i={},a={};if(Array.isArray(t.dataChanged)){let e=this.state.features;for(let t in e)i[t]=e[t].slice(),a[t]=[];for(let o of t.dataChanged){let t=Ke(n,r,o);for(let n in e)a[n].push(p({data:i[n],getIndex:e=>e.__source.index,dataRange:o,replace:t[n]}))}}else i=Ke(n,r);let o=Ze(i,a);this.setState({features:i,featuresDiff:a,layerProps:o})}getPickingInfo(e){let t=super.getPickingInfo(e),{index:n,sourceLayer:r}=t;return t.featureType=$e.find(e=>r.id.startsWith(`${this.id}-${e}-`)),n>=0&&r.id.startsWith(`${this.id}-points-text`)&&this.state.binary&&(t.index=this.props.data.points.globalFeatureIds.value[n]),t}_updateAutoHighlight(e){let t=`${this.id}-points-`,n=e.featureType===`points`;for(let r of this.getSubLayers())r.id.startsWith(t)===n&&r.updateAutoHighlight(e)}_renderPolygonLayer(){let{extruded:e,wireframe:t}=this.props,{layerProps:n}=this.state,r=`polygons-fill`,i=this.shouldRenderSubLayer(r,n.polygons?.data)&&this.getSubLayerClass(r,Y.type);if(i){let a=Z(this,Y.props),o=e&&t;return o||delete a.getLineColor,a.updateTriggers.lineColors=o,new i(a,this.getSubLayerProps({id:r,updateTriggers:a.updateTriggers}),n.polygons)}return null}_renderLineLayers(){let{extruded:e,stroked:t}=this.props,{layerProps:n}=this.state,r=`polygons-stroke`,i=`linestrings`,a=!e&&t&&this.shouldRenderSubLayer(r,n.polygonsOutline?.data)&&this.getSubLayerClass(r,J.type),o=this.shouldRenderSubLayer(i,n.lines?.data)&&this.getSubLayerClass(i,J.type);if(a||o){let e=Z(this,J.props);return[a&&new a(e,this.getSubLayerProps({id:r,updateTriggers:e.updateTriggers}),n.polygonsOutline),o&&new o(e,this.getSubLayerProps({id:i,updateTriggers:e.updateTriggers}),n.lines)]}return null}_renderPointLayers(){let{pointType:e}=this.props,{layerProps:t,binary:n}=this.state,{highlightedObjectIndex:r}=this.props;!n&&Number.isFinite(r)&&(r=t.points.data.findIndex(e=>e.__source.index===r));let i=new Set(e.split(`+`)),a=[];for(let e of i){let i=`points-${e}`,o=q[e],s=o&&this.shouldRenderSubLayer(i,t.points?.data)&&this.getSubLayerClass(i,o.type);if(s){let c=Z(this,o.props),l=t.points;if(e===`text`&&n){let{instancePickingColors:e,...t}=l.data.attributes;l={...l,data:{...l.data,attributes:t}}}a.push(new s(c,this.getSubLayerProps({id:i,updateTriggers:c.updateTriggers,highlightedObjectIndex:r}),l))}}return a}renderLayers(){let{extruded:e}=this.props,t=this._renderPolygonLayer(),n=this._renderLineLayers(),r=this._renderPointLayers();return[!e&&t,n,r,e&&t]}getSubLayerAccessor(e){let{binary:t}=this.state;return!t||typeof e!=`function`?super.getSubLayerAccessor(e):(t,n)=>{let{data:r,index:i}=n;return e(le(r,i),n)}}};$.layerName=`GeoJsonLayer`,$.defaultProps=et;export{K as n,M as r,$ as t};