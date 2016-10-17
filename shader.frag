// Author: Patricio
// Title: Atmosphere

#ifdef GL_ES
precision mediump float;
#endif

// GLOBALs
#define TAU 6.283185307179586
#define ONE_OVER_TAU .159154943
#define PI 3.1415926535
#define HALF_PI 1.57079632679

uniform sampler2D u_tex0; // http://patriciogonzalezvivo.github.io/ISS/imgs/earth-clouds-ld.jpg
uniform vec2 u_tex0Resolution;

uniform vec4 u_date;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;

#define SUN_BRIG 30.
#define SUN_COLOR vec3(0.7031,0.4687,0.1055)
#define SKY_COLOR vec3(0.3984,0.5117,0.7305)

vec2 sphereCoords(in vec2 _st, in vec3 _norm) {
    vec3 vertPoint = _norm;
    float lat = acos(dot(vec3(0., 1., 0.), _norm));
    _st.y = lat / PI;
    _st.x = (acos(dot(_norm, vec3(1, 0, 0)) / sin(lat)))*ONE_OVER_TAU;
    return _st;
}

void main() {
    vec2 st = gl_FragCoord.xy/u_resolution.xy;
    st = (st-.5)*1.+.5;
    if (u_resolution.y > u_resolution.x ) {
        st.y *= u_resolution.y/u_resolution.x;
        st.y -= (u_resolution.y*.5-u_resolution.x*.5)/u_resolution.x;
    } else {
        st.x *= u_resolution.x/u_resolution.y;
        st.x -= (u_resolution.x*.5-u_resolution.y*.5)/u_resolution.y;
    }
    st -= .5;
    
    float t = u_time*.1;
    
    // PLANET
    float r = .5; // radius
    float z = sqrt(r*r - st.x*st.x - st.y*st.y);

    // NORMALS
    vec3 norm = normalize(vec3(st.x, st.y, z)); // normals from sphere
    // TEXTURE
    vec3 clouds = texture2D(u_tex0, fract(sphereCoords(st,norm)-vec2(t*.1,0.))).rgb;
    clouds -= step(0.500, dot(st,st)*2.);
    clouds = clamp(clouds,0.,1.);
    
    // animation
    vec2 sunVec;
    if (u_mouse.x == 0.0){
        sunVec = vec2(cos(t),0.)*.5;
    } else {
        sunVec = u_mouse.xy/u_resolution.y-.5;
    }
    
    vec3 color = vec3(0.);

    float angle = atan(sunVec.y,sunVec.x);
    float radius = length(sunVec);

    float azimur = 1.-radius;
    float sun = max(1.0 - (1.0 + 10.0 * azimur + z) * length(st - sunVec),0.0) + 0.3 * pow(1.0-z,12.0) * (1.6-azimur);
    color = mix(SKY_COLOR, SUN_COLOR, sun) * ((0.5 + 1.0 * pow(azimur,0.04)) * azimur + pow(sun, 4.2) * azimur * (1.0 + SUN_BRIG * azimur))*(1.-z);
    
    gl_FragColor = vec4(mix(vec3(0.),color,azimur),step(0.,z));
}
