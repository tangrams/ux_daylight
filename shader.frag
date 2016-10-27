// Atmosphere scattering + Moon phase
// Patricio Gonzalez Vivo @patriciogv 2016

#ifdef GL_ES
precision mediump float;
#endif

// GLOBALs
#define TAU 6.283185307179586
#define ONE_OVER_TAU .159154943
#define PI 3.1415926535
#define HALF_PI 1.57079632679

uniform sampler2D u_stars;
uniform sampler2D u_tex0;

uniform vec4 u_date;
uniform vec2 u_resolution;

uniform vec2 u_sun;
uniform vec2 u_moon;

uniform float u_time;

#define SUN_BRIG 100.
#define SUN_RAD 20.
#define SUN_COLOR vec3(0.7031,0.4687,0.1055)
#define SKY_COLOR vec3(0.3984,0.5117,0.7305)

// http://quasar.as.utexas.edu/BillInfo/JulianDatesG.html
#define SOLAR_YEAR 365.25
#define SOLAR_MONTH 30.6001
#define JULIAN_EPOCH 4712.
#define SYNODIC_MONTH 29.5305

float JulianDate() { 
    float yy = u_date.x - floor((10.-u_date.y)*.1);
    float mm = mod(u_date.y + 9.,12.);
    // int k1 = int(SOLAR_YEAR * (yy + JULIAN_EPOCH)); // 2457365.475 TO BIG
    int k1 = int(SOLAR_YEAR * (yy - 2003.)) - 4665;
    int k2 = int(SOLAR_MONTH * mm + 0.5);
    int k3 = int(floor((yy*.01) + 49.) * 0.75) - 38;
    return float(k1 + k2 - k3 + 59) + u_date.z;
}

// Project a texture into a sphere
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
    
    // // LIGHT
    float moon_rotation = u_time*.05;
    vec2 moon_st = st-(u_moon-.5);
    moon_st *= 25.;
    float moon_phase = fract(((JulianDate()) + 2.944) / SYNODIC_MONTH)*TAU; // Moon fase to radiant
    vec3 l = normalize(vec3(-cos(moon_phase),0.,sin(moon_phase)));
    vec3 moon_norm = normalize(vec3(moon_st.x, moon_st.y, sqrt(.25 - moon_st.x*moon_st.x - moon_st.y*moon_st.y)));
    vec3 moon = texture2D(u_tex0, fract(sphereCoords(moon_st,moon_norm)-vec2(moon_rotation*.1,0.))).rgb;
    moon = clamp(moon,0.,1.);
    moon *= clamp(dot(moon_norm, l),0.0, 1.);
    stars += moon;

    // ATMOSPHERE NORMALS
    float z = sqrt(.25 - dot(st,st));
    vec3 norm = normalize(vec3(st.x, st.y, z)); // normals from sphere
    
    // animation
    vec2 sunVec = u_sun-.5;

    float angle = atan(sunVec.y,sunVec.x);
    float radius = dot(sunVec,sunVec)*2.;
    stars *= smoothstep(0.,.5,z);

    float azimur = 1.-radius;
    float sun = max(1.0 - (1. + 10.0 * azimur + z) * dot(st - sunVec,st - sunVec)*SUN_RAD,0.0) + 0.3 * pow(1.0-z,12.0) * (1.6*azimur);
    vec3 color = mix(SKY_COLOR, SUN_COLOR, sun) *  ((0.5 + 2.0 * azimur) * azimur + (sun*sun*sun*sun*sun*sun*sun*sun) * azimur * azimur * (1.0 + SUN_BRIG * azimur * azimur))*(1.-z);

    gl_FragColor = vec4(mix(stars,color,clamp(azimur,0.,1.)),step(0.,z));
}
