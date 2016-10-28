// 3er Parties
import { StarJs } from './vendor/starjs.min.js';
import GlslCanvas from 'glslCanvas';

import { stereoProject } from './astro.js';

L.UxDaylight = L.Control.extend({
    options: {
        position: 'topleft',
        icon: 'ux_daylight.png',
        scene: null,
        open: false,
        min_size: 26,
        size: 260
    },

    initialize: function(options) {
        L.Util.setOptions(this, options);
    },

    onAdd: function(map) {
        var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom ux_daylight-container');
        var size = this.options.size;
        var min_size = this.options.min_size;
        var scene = this.options.scene;
        var open_state = this.options.open;
        var prev_sun_pos = [0,0];
        var bodies = {
            sun: StarJs.Solar.BODIES.Sun,
            moon: { 
                name: 'Moon',
                getCoord: function (jct, earthPos, equ2ecl) {
                    // earthPos and equ2ecl are ignored
                    var pos = StarJs.Solar.approxMoon(jct);
                    return {'phi': pos.ra, 'theta': pos.dec};
                } 
            }
        };
        bodies.sun.getCoord = function (jct, earthPos, equ2ecl) {
            var pos = this.keplerCoord(jct);
            return new StarJs.Vector.Polar3(equ2ecl.apply(pos.sub(earthPos)))
        }

        var icon =  L.DomUtil.create('img', 'ux_daylight-icon', container);
        icon.src = 'ux_daylight.png';
        icon.addEventListener('click', function(){
            if (open_state) {
                container.style.width = min_size+'px';
                container.style.height = min_size+'px';
            } else {
                container.style.width = (size+20)+'px';
                container.style.height = (size+20)+'px';
            }
            open_state = !open_state;
        });

        var canvas =  L.DomUtil.create('canvas', 'ux_daylight-spheremap', container);
        canvas.setAttribute('id', 'ux_daylight');
        canvas.style.width = size+'px';
        canvas.style.height = size+'px';
        // canvas.setAttribute('data-fragment-url', 'shader.frag');

        var shader = new GlslCanvas(canvas);
        shader.load(`
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

uniform vec4 u_date;
uniform vec2 u_resolution;

uniform vec2 u_sun;
uniform vec2 u_moon;

uniform vec2 u_mouse;

uniform float u_time;

#define MOON_RAD 25.
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

void main() {
    vec2 st = gl_FragCoord.xy/u_resolution.xy;
    vec3 stars = vec3(0.0);//texture2D(u_stars,st).rgb;
    st -= .5;
    
    // // LIGHT
    float moon_rotation = u_time*.05;
    vec2 moon_st = st-(u_moon-.5);
    moon_st *= 25.;
    float moon_phase = fract(((JulianDate()) + 2.944) / SYNODIC_MONTH)*TAU; // Moon fase to radiant
    vec3 l = normalize(vec3(-cos(moon_phase),0.,sin(moon_phase)));
    vec3 moon_norm = normalize(vec3(moon_st.x, moon_st.y, sqrt(.25 - moon_st.x*moon_st.x - moon_st.y*moon_st.y)));
    vec3 moon = vec3(1.)*clamp(dot(moon_norm, l),0.0, 1.);
    stars += moon;

    // ATMOSPHERE NORMALS
    float z = sqrt(.25 - dot(st,st));
    vec3 norm = normalize(vec3(st.x, st.y, z)); // normals from sphere
    
    // animation
    vec2 sunVec = u_sun-.5;
    // sunVec = u_mouse.xy/u_resolution.y-.5;

    float radius = dot(sunVec,sunVec)*2.;
    stars *= smoothstep(0.,.5,z);

    float azimur = 1.-radius;
    float sun = max(1.0 - (1. + 10.0 * azimur + z) * dot(st - sunVec,st - sunVec)*SUN_RAD,0.0) + 0.3 * pow(1.0-z,12.0) * (1.6*azimur);
    vec3 color = mix(SKY_COLOR, SUN_COLOR, sun) *  ((0.5 + 2.0 * azimur) * azimur + (sun*sun*sun*sun*sun*sun*sun*sun) * azimur * azimur * (1.0 + SUN_BRIG * azimur * azimur))*(1.-z);

    gl_FragColor = vec4(mix(stars, color,clamp(azimur,0.,1.)),step(0.,z));
}

        `)
        shader.on("render", function() {
            if (scene && scene.lights) {
                if (scene.lights.default_light && scene.lights.default_light.diffuse &&
                    shader.uniforms && shader.uniforms.u_sun ) {
                    var pos = [shader.uniforms.u_sun.value[0][0],shader.uniforms.u_sun.value[0][1]];
                    // If the position of the sun had change...
                    if (prev_sun_pos[0] !== pos[0] || prev_sun_pos[1] !== pos[1]) {
                        // Reload spheretexture from the shader for ambient
                        scene.loadTextures();

                        // UPDATE default_light LIGHT COLOR
                        prev_sun_pos = pos;
                        // Prevent the vector for going under the horizon
                        var vec = [pos[0]-.5,pos[1]-.5];
                        var angle = Math.atan2(vec[1],vec[0]);
                        var radius = Math.sqrt(vec[0]*vec[0] + vec[1]*vec[1]);
                        radius = Math.min(radius,.48);
                        pos = [(Math.cos(angle)*radius)+.5, (Math.sin(angle)*radius)+.5];
                        // Extract the pixel of where the sun is
                        var pixel = new Uint8Array(4);
                        var gl = shader.gl;
                        gl.readPixels(  pos[0]*gl.drawingBufferWidth,
                                        pos[1]*gl.drawingBufferHeight,
                                        1,1, 
                                        gl.RGBA, gl.UNSIGNED_BYTE, pixel);
                        // Actually update the color of the light
                        scene.lights.default_light.diffuse = [pixel[0]/255,pixel[1]/255,pixel[2]/255];
                        // console.log("light color changed to ", pixel);
                    }
                } else {
                    console.log("uxDaylight: leave deafult lights on tangram");
                }
            }
        });

        function updateLight() {
            var loc = map.getCenter();
            var sun = stereoProject(bodies.sun, size, loc.lng, loc.lat, new Date());
            var moon = stereoProject(bodies.moon, size, loc.lng, loc.lat, new Date());

            if (scene && scene.lights && scene.lights.default_light) {
                shader.setUniform('u_sun', sun.x, sun.y);
                shader.setUniform('u_moon', moon.x, moon.y);
                shader.render();

                // If the SUN is visible...
                if (scene.lights.default_light._direction && sun.visible) {
                    sun.x = sun.x-.5; sun.y = sun.y-.5;
                    var vector = new StarJs.Vector.Vector3(sun.x, sun.y, Math.sqrt(Math.abs(1.0-(sun.x*sun.x+sun.y*sun.y))));
                    var normal = vector.scale(-1./vector.len());
                    scene.lights.default_light._direction = [normal.x,normal.y,normal.z];
                }
            } 
            else {
                console.log('Tangram is loading...');
            }
        };

        function tick() {
            updateLight();
            setTimeout(tick, 1000);
        }

        // this.starmap = new StarMap("starmap", 500, REY_STARS60, [], {});

        map.on('move', updateLight);

        tick();
        return container;
    },

    onRemove: function (map) {
        // when removed
    }
});

L.uxDaylight = function(options) { return new L.UxDaylight(options); };