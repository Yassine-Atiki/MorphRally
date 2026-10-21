/* Éclairage original pour meshes colorés, compatible p5 1.7 / WebGL 1.
   Brume de distance, grain fin et reflet du ciel ; aucun post-traitement externe. */
class RaceMaterials {
  constructor() {
    this.opacity = 1;
    this.shader = createShader(
      `
      precision highp float;
      attribute vec3 aPosition;attribute vec3 aNormal;attribute vec4 aVertexColor;
      uniform mat4 uModelViewMatrix;uniform mat4 uProjectionMatrix;uniform mat4 uViewMatrix;
      uniform mat3 uNormalMatrix;
      varying vec3 vNormal;varying vec3 vView;varying vec3 vSun;varying vec3 vUp;
      varying vec4 vColor;varying vec3 vLocal;
      void main(){
        vec4 p=uModelViewMatrix*vec4(aPosition,1.0);
        vView=p.xyz;vNormal=normalize(uNormalMatrix*aNormal);
        vSun=normalize((uViewMatrix*vec4(-0.5,-0.85,-0.35,0.0)).xyz);
        vUp=normalize((uViewMatrix*vec4(0.0,-1.0,0.0,0.0)).xyz);
        vColor=aVertexColor;vLocal=aPosition;
        gl_Position=uProjectionMatrix*p;
      }
    `,
      `
      precision highp float;
      uniform float uGloss;uniform float uGrain;uniform float uShine;uniform float uOpacity;
      varying vec3 vNormal;varying vec3 vView;varying vec3 vSun;varying vec3 vUp;
      varying vec4 vColor;varying vec3 vLocal;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){
        vec3 n=normalize(vNormal),eye=normalize(-vView),sun=normalize(vSun);
        float up=dot(n,normalize(vUp))*.5+.5;
        float diffuse=max(0.0,dot(n,sun));
        vec3 ambient=mix(vec3(.29,.28,.26),vec3(.57,.67,.74),up);
        vec3 lighting=ambient+vec3(.74,.65,.50)*diffuse;
        float grain=(hash(floor(vLocal.xz*5.0))-.5)*uGrain;
        vec3 base=vColor.rgb*(1.0+grain);
        float fresnel=pow(1.0-max(dot(n,eye),0.0),3.0);
        float spec=pow(max(0.0,dot(n,normalize(eye+sun))),uShine)*uGloss;
        vec3 reflected=mix(vec3(.25,.35,.43),vec3(.72,.83,.88),up);
        vec3 color=base*lighting+vec3(1.0,.89,.72)*spec+reflected*fresnel*uGloss*.27;
        float fog=1.0-exp(-length(vView)*.00020);
        color=mix(color,vec3(.69,.79,.83),fog);
        float alpha=vColor.a*uOpacity;gl_FragColor=vec4(color*alpha,alpha);
      }
    `,
    );
  }
  use(gloss = 0, grain = 0, shine = 80) {
    shader(this.shader);
    fill(255, 255 * this.opacity);
    this.shader.setUniform("uGloss", gloss);
    this.shader.setUniform("uGrain", grain);
    this.shader.setUniform("uShine", shine);
    this.shader.setUniform("uOpacity", this.opacity);
  }
}
