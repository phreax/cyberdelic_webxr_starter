      uniform sampler2D uPaletteFrom;
      uniform sampler2D uPaletteTo;
      uniform float uMoodMix;
      varying float vMix;
      varying float vGlow;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float a = smoothstep(0.5, 0.0, length(c));
        if (a <= 0.01) discard;
        vec2 paletteUv = vec2(vMix, 0.5);
        vec3 color = mix(texture2D(uPaletteFrom, paletteUv).rgb, texture2D(uPaletteTo, paletteUv).rgb, uMoodMix) * vGlow;
        gl_FragColor = vec4(color * a, a);
        #include <colorspace_fragment>
      }
