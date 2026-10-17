/**
 * Vertex-shader paper bend for the gatefold doors.
 * The door is curled along its width (distance from the hinge), so while it
 * swings the free scalloped edge lags behind like real 600 gsm board.
 * The same chunk is injected into the shadow depth material so the cast
 * shadow bends with the paper.
 */
import * as THREE from "three";

export type BendUniforms = {
  uBend: { value: number };
  uFlutter: { value: number };
  uTime: { value: number };
  uWidth: { value: number };
};

export function createBendUniforms(width: number): BendUniforms {
  return { uBend: { value: 0 }, uFlutter: { value: 0 }, uTime: { value: 0 }, uWidth: { value: width } };
}

const header = /* glsl */ `
uniform float uBend;
uniform float uFlutter;
uniform float uTime;
uniform float uWidth;
float bendS(vec3 p) { return clamp(abs(p.x) / uWidth, 0.0, 1.2); }
float bendZ(vec3 p) {
  float s = bendS(p);
  return uBend * s * s * uWidth * 0.5 + uFlutter * sin(s * 3.2 - uTime * 5.0 + p.y * 1.7) * s * 0.012;
}
`;

export function applyPaperBend<T extends THREE.Material>(material: T, uniforms: BendUniforms, withNormals = true): T {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = header + shader.vertexShader;
    if (withNormals) {
      shader.vertexShader = shader.vertexShader.replace(
        "#include <beginnormal_vertex>",
        /* glsl */ `
        #include <beginnormal_vertex>
        {
          float s = bendS(position);
          float dzds = uBend * 2.0 * s * uWidth * 0.5;
          float dzdx = dzds * sign(position.x) / uWidth;
          objectNormal = normalize(objectNormal + vec3(-dzdx * objectNormal.z, 0.0, dzdx * objectNormal.x));
        }`
      );
    }
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      /* glsl */ `
      #include <begin_vertex>
      transformed.z += bendZ(position);`
    );
  };
  material.customProgramCacheKey = () => "paper-bend-" + (withNormals ? "n" : "d");
  return material;
}
