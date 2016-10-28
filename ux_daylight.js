function stereographicProjectObj(re, de, lam1, phi1, rad) {
    var DEG2RAD = StarJs.Math.DEG2RAD;
    var cphi = Math.cos(phi1), sphi = Math.sin(phi1);
    de = lam1-de;
    var cosc = Math.cos(re), sinc = Math.sin(re);
    var cosl = Math.cos(de), sinl = Math.sin(de);
    var k = rad / (1.0 + sphi * sinc + cphi * cosc * cosl);
    var x = k * cosc * sinl, y = k * (cphi * sinc - sphi * cosc * cosl);
    return [x, y, x*x + y*y < rad*rad];
}

function stereoProject(body, size, lng, lat, time) {
    var Ti = StarJs.Time;
    var halfsize = Math.floor(size/2)

    if (typeof time === 'undefined') {
        time = +new Date();
    } else if (typeof time !== 'number') {
        time = +time;
    }
    
    var mjd = Ti.time2mjd(time);
    var gms_t = Ti.gmst(mjd);

    /** @const */
    var DEG2RAD = StarJs.Math.DEG2RAD;
    lng *= DEG2RAD;
    lat *= DEG2RAD;

    lng += gms_t;

    var jct = Ti.mjd2jct(mjd);
    var cc = body.getCoord(jct, StarJs.Solar.BODIES.Earth.keplerCoord(jct), StarJs.Coord.ecl2equMatrix(jct));
    
    var cm = stereographicProjectObj(cc.theta, cc.phi, lng, lat, size/2);
    var xx = halfsize-cm[0];
    var yy = halfsize-cm[1];

    return { x: xx/size, y: 1.-yy/size, visible: cm[2] };
}


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
        canvas.setAttribute('data-fragment-url', 'shader.frag');

        var shader = new GlslCanvas(canvas);
        shader.on("render", function() {
            if (scene && scene.lights && scene.lights.default_light && scene.lights.default_light.diffuse &&
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
                console.log('Tangram is loading');
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