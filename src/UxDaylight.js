// 3er Parties
import { StarJs } from './vendor/starjs.min.js';
import GlslCanvas from 'glslCanvas';

import { stereoProject, stereoProjectStars, constellations } from './astro.js';
import anytime from 'anytime';

L.UxDaylight = L.Control.extend({
    options: {
        position: 'topleft',
        icon: 'https://tangrams.github.io/ux_daylight/ux_daylight.png',
        icon_stars: 'https://tangrams.github.io/ux_daylight/ux_stars.png',
        icon_const: 'https://tangrams.github.io/ux_daylight/ux_const.png',
        scene: null,
        time: "now",
        sun_size: 20,
        moon: true,
        stars: true,
        constellations: false
    },

    initialize: function(options) {
        L.Util.setOptions(this, options);
    },

    onAdd: function(map) {
        // GLOBAL VARIABLES
        // -------------------------------------------------------------
        var icon_size = 26;
        var toolbar_size = 30;
        var size = 260;
        var halfsize = Math.floor(size/2);

        var time = this.options.time;
        var scene = this.options.scene;
        var state_open = false;
        var state_moon = this.options.moon;
        var state_stars = this.options.stars;
        var state_constellations = this.options.constellations;
        
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

        // CONTAINER
        // -------------------------------------------------------------
        var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom ux_daylight-container');
        container.addEventListener('mousedown', function(){
            map.dragging.disable();
        });

        container.addEventListener('mouseup', function(){
            map.dragging.enable();
        });

        // ICON
        // -------------------------------------------------------------
        var constellations_icon = this.options.icon_const;
        var stars_icon = this.options.icon_stars;
        var icon_sc =  L.DomUtil.create('img', 'ux_daylight-icon-sc', container);
        icon_sc.src = constellations_icon;
        icon_sc.addEventListener('click', function(){
            if (!state_stars) {
                state_stars = true;
                state_constellations = false;
                icon_sc.style.opacity = 1.;
                icon_sc.src = constellations_icon;
            }
            else if (!state_constellations) {
                state_stars = true;
                state_constellations = true;
                icon_sc.src = stars_icon;
                icon_sc.style.opacity = .5;
            }
            else {
                
                state_stars = false;
                state_constellations = false;
                icon_sc.src = stars_icon;
                icon_sc.style.opacity = 1.;
                console.log('no stars no const')
            }
        });

        var icon =  L.DomUtil.create('img', 'ux_daylight-icon', container);
        icon.src = this.options.icon;
        icon.addEventListener('click', function(){
            if (state_open) {
                container.style.width = icon_size+'px';
                container.style.height = icon_size+'px';
                icon_sc.style.visibility = 'hidden';
            } else {
                container.style.width = (size+20)+'px';
                container.style.height = (size+20+toolbar_size)+'px';
                icon_sc.style.visibility = 'visible';
            }
            state_open = !state_open;
        });
    
        // TOOLBAR
        // -------------------------------------------------------------
        var toolbar =  L.DomUtil.create('div', 'ux_daylight-toolbar', container);
        toolbar.style.height = toolbar_size+'px';

        // Date/time selection
        var date =  L.DomUtil.create('input', 'ux_daylight-date', toolbar);
        var date_picker =  L.DomUtil.create('button', 'ux_daylight-date_picker', toolbar);
        date_picker.appendChild(document.createTextNode("choose"));
        var p = new anytime({input:date, button: date_picker, anchor: date, initialValue: new Date(), format: 'hh:mm DD/MM/YY' });
        p.render();
        p.on('change', function (d) {
            time = d;
            console.log('The new date/time is…', time);
        })
        var date_now =  L.DomUtil.create('button', 'ux_daylight-date_now', toolbar);
        date_now.appendChild(document.createTextNode("now"));
        date_now.onclick = function() {
            p.update(new Date());
            date.value = p.value;
            time = 'now';
        }

        // CANVAS
        // -------------------------------------------------------------
        var canvas = L.DomUtil.create('canvas', 'ux_daylight-spheremap', container);
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

uniform sampler2D u_stars;
uniform vec4 u_date;
uniform vec2 u_resolution;

uniform vec2 u_sun;
uniform float u_sun_size;
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
    vec3 stars = texture2D(u_stars,st).rgb;
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
    float sun = max(1.0 - (1. + 10.0 * azimur + z) * dot(st - sunVec,st - sunVec)*(SUN_RAD-u_sun_size),0.0) + 0.3 * pow(1.0-z,12.0) * (1.6*azimur);
    vec3 color = mix(SKY_COLOR, SUN_COLOR, sun) *  ((0.5 + 2.0 * azimur) * azimur + (sun*sun*sun*sun*sun*sun*sun*sun) * azimur * azimur * (1.0 + SUN_BRIG * azimur * azimur))*(1.-z);

    gl_FragColor = vec4(mix(stars, color,clamp(azimur,0.,1.)),step(0.,z));
}
        `)
        var prev_sun_pos = [0,0];
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
                } 
                // else {
                //     console.log("uxDaylight: leave deafult lights on tangram");
                // }
            }
        });

        var stars_canvas = L.DomUtil.create('canvas', 'ux_daylight-starmap', container);
        stars_canvas.style.width = size+'px';
        stars_canvas.style.height = size+'px';
        stars_canvas.setAttribute('width', size+'px');
        stars_canvas.setAttribute('height', size+'px');
        var ctx = stars_canvas.getContext("2d");

        // Sun Slider
        var sun_range =  L.DomUtil.create('input', 'ux_daylight-sun-slider', toolbar);
        sun_range.setAttribute('type', 'range');
        sun_range.setAttribute('min', '1');
        sun_range.setAttribute('max', '19.5');
        sun_range.setAttribute('value', '18');
        sun_range.setAttribute('step', '.1');
        sun_range.addEventListener('input', function(e) {
            shader.setUniform('u_sun_size', parseFloat(e.target.value));
            shader.render();
        })

        function updateLight() {
            if (scene && scene.lights && scene.lights.default_light) {
                var t = (time === "now" || time === "")? new Date() : p.value;
                var loc = map.getCenter();

                var sun = stereoProject(bodies.sun, size, loc.lng, loc.lat, t);
                shader.setUniform('u_sun', sun.x, sun.y);
                shader.setUniform('u_sun_size', parseFloat(sun_range.value));

                // If the SUN is visible...
                if (scene.lights.default_light._direction && sun.visible) {
                    sun.x = sun.x-.5; sun.y = sun.y-.5;
                    var vector = new StarJs.Vector.Vector3(sun.x, sun.y, Math.sqrt(Math.abs(1.0-(sun.x*sun.x+sun.y*sun.y))));
                    var normal = vector.scale(-1./vector.len());
                    scene.lights.default_light._direction = [normal.x,normal.y,normal.z];
                }

                if (state_moon) {
                    var moon = stereoProject(bodies.moon, size, loc.lng, loc.lat, t);
                    shader.setUniform('u_moon', moon.x, moon.y);
                }

                // Draw Background
                ctx.clearRect(0,0,size,size);
                ctx.fillStyle='rgba(0,0,0,0)';
                ctx.fillRect(0,0,size,size);
                ctx.beginPath();
                ctx.fillStyle = "#000010";
                ctx.arc(halfsize, halfsize, halfsize, 0, 2*Math.PI, true);
                ctx.fill();

                if (state_stars) {
                    // Draw stars in other canvas
                    var stars =  stereoProjectStars(size, loc.lng, loc.lat, t);
                    var starsTotal = stars.length;

                    // Draw stars
                    ctx.fillStyle = '#FFF';
                    for (let i = 0; i < starsTotal; ++i) {
                        var s = stars[i];
                        if (s[3]) {
                            ctx.beginPath();
                            ctx.fillStyle = 'rgba(255,255,255,'+Math.abs(s[0]*.1)+')';
                            ctx.arc(halfsize-s[1], halfsize-s[2], Math.abs(s[0]*.1), 0, 2*Math.PI, true);
                            ctx.fill();
                        }
                    }

                    if (state_constellations && constellations) {
                        var constellationsTotal = constellations.length;
                        ctx.beginPath();
                        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
                        // Draw Constelations
                        for (let j = constellationsTotal; j--; ) {
                            var s = constellations[j][0];
                            var e = constellations[j][1];
                            var so = stars[s], eo = stars[e];
                            if (so[3] || eo[3]) {
                                ctx.moveTo((halfsize-so[1]), (halfsize-so[2]));
                                ctx.lineTo((halfsize-eo[1]), (halfsize-eo[2]));
                            }
                        }
                        ctx.stroke();
                    }
                }

                shader.loadTexture('loadTexture', stars_canvas);
                shader.render();
            }             
            else {
                console.log('Tangram is loading...');
            }
        };

        function tick() {
            updateLight();
            setTimeout(tick, 1000);
        }
        
        map.on('move', updateLight);

        tick();
        return container;
    },

    onRemove: function (map) {
        // when removed
    }
});

L.uxDaylight = function(options) { return new L.UxDaylight(options); };