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

uniform sampler2D u_stars;
uniform vec2 u_resolution;
uniform vec2 u_sun;
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
    vec3 stars = texture2D(u_stars,st).rgb;
    st -= .5;
    
    float t = u_time*.1;
    
    // PLANET
    float r = .5; // radius
    float z = sqrt(r*r - st.x*st.x - st.y*st.y);

    // NORMALS
    vec3 norm = normalize(vec3(st.x, st.y, z)); // normals from sphere
    
    // animation
    vec2 sunVec = u_sun-.5;

    // if (u_mouse.x != 0.0 && u_mouse.y != 0.0){
    //     sunVec = u_mouse.xy/u_resolution.y-.5;
    // }
    
    float angle = atan(sunVec.y,sunVec.x);
    float radius = dot(sunVec,sunVec)*2.;
    stars *= smoothstep(0.,.5,z);
    float azimur = 1.-radius;
    float sun = max(1.0 - ( 15.0 * azimur + z) * length(st - sunVec),0.0) + 0.3 * pow(1.0-z,12.0) * (1.6-azimur);
    vec3 color = mix(SKY_COLOR, SUN_COLOR, sun) * ((0.5 + 2.0 * azimur) * azimur + pow(sun, 3.2)  * (1.0 + SUN_BRIG *azimur*azimur))*(1.-z);
    
    gl_FragColor = vec4(mix(stars,color,clamp(azimur,0.,1.)),step(0.,z));
}
