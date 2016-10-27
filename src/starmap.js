/**
 * Celestial map component.
 * @constructor
 */
function StarMap (elt, size, stars, cnstltns, prop) {
    this.paper = document.getElementById(elt);
    this.ctx = this.paper.getContext("2d");
    this.prop = prop;

    this.size = size;
    var halfsize = Math.floor(size/2);

    // this.planets = (typeof prop.planets === 'undefined') ? true : prop.planets;
    this.bodies = {
        sun: new StarMap.Planet(StarJs.Solar.BODIES.Sun, 20, '#FF0'),
        moon: new StarMap.Moon(20, '#000'),
        mercury: new StarMap.Planet(StarJs.Solar.BODIES.Mercury, 1, '#888'),
        venus: new StarMap.Planet(StarJs.Solar.BODIES.Venus, 1.5, '#AAA'),
        mars: new StarMap.Planet(StarJs.Solar.BODIES.Mars, 1.5, '#F80'),
        // jupiter: new StarMap.Planet(StarJs.Solar.BODIES.Jupiter, 3, '#FB0'),
        // saturn: new StarMap.Planet(StarJs.Solar.BODIES.Saturn, 3, '#AA0'),
        // uranus: new StarMap.Planet(StarJs.Solar.BODIES.Uranus, 3, '#CAF'),
        // neptune: new StarMap.Planet(StarJs.Solar.BODIES.Neptune, 3, '#CAF')
    };

    this.stars = stars;
    this.cnstltns = cnstltns;

    this.drawBg();
}

function stereographicProjectPoints(arr, lam1, phi1, rad) {
    function sinSum(cosa, sina, cosb, sinb) {
        return cosa*sinb+sina*cosb;
    }

    function cosSum(cosa, sina, cosb, sinb) {
        return cosa*cosb-sina*sinb;
    }
    var len = arr.length, i;
    var res = Array(len);
    var cphi = Math.cos(phi1), sphi = Math.sin(phi1);
    var clam = Math.cos(lam1), slam = Math.sin(lam1);
    for (i = 0; i < len; ++i) {
        var star = arr[i];
        var mag = star[0], re = star[2], de = -star[1];
        var t2c = re*re, t2l = de*de, t2c1=1+t2c, t2l1=1+t2l;
        var cosc = (1-t2c)/t2c1, sinc = 2*re/t2c1;
        var cosl1 = (1-t2l)/t2l1, sinl1 = 2*de/t2l1;
        var cosl = cosSum(cosl1, sinl1, clam, slam), sinl = sinSum(cosl1, sinl1, clam, slam);
        var k = rad / (1.0 + sphi * sinc + cphi * cosc * cosl);
        var x = k * cosc * sinl, y = k * (cphi * sinc - sphi * cosc * cosl);
        res[i] = [mag,
                  x,
                  y,
                  x*x + y*y < rad*rad];
    }
    return res;
}

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


StarMap.prototype.drawBg = function () {
    var size = this.size;
    var halfsize = Math.floor(size/2);
    var ctx = this.ctx;

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle='rgba(0,0,0,0)';
    ctx.fillRect(0,0,size, size);
    ctx.beginPath();
    ctx.fillStyle = (this.prop.circleFill || "#000010");
    ctx.arc(halfsize, halfsize, halfsize, 0, 2*Math.PI, true);
    ctx.fill();
}    

StarMap.Planet = function (pl, size, color) {
    this.pl = pl;
    this.size = size;
    this.color = color;
}

StarMap.Planet.prototype.getCoord = function (jct, earthPos, equ2ecl) {
    var pos = this.pl.keplerCoord(jct);
    return new StarJs.Vector.Polar3(equ2ecl.apply(pos.sub(earthPos)))
}

StarMap.Moon = function (size, color) {
    this.size = size;
    this.color = color;
}

StarMap.Moon.prototype.pl = { name: 'Moon' };

StarMap.Moon.prototype.getCoord = function (jct, earthPos, equ2ecl) {
    // earthPos and equ2ecl are ignored
    var pos = StarJs.Solar.approxMoon(jct);
    return {'phi': pos.ra, 'theta': pos.dec};
}

StarMap.EARTH = StarJs.Solar.BODIES.Earth;

StarMap.prototype.setPos = function (lng, lat, time) {
    var Ti = StarJs.Time;

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

    var ortho = stereographicProjectPoints(this.stars, lng, lat, this.size/2);
    var cst = [], i, j, slen = ortho.length, co = this.cnstltns, clen = co.length, halfsize = Math.floor(this.size/2);
    
    this.drawBg();

    var ctx = this.ctx;

    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';

    // Draw Constelations
    for (j = clen; j--; ) {
        var s = co[j][0], e = co[j][1];
        var so = ortho[s], eo = ortho[e];
        if (so[3] || eo[3]) {
            ctx.moveTo((so[1]+halfsize), (halfsize-so[2]));
            ctx.lineTo((eo[1]+halfsize), (halfsize-eo[2]));
        }
    }
    
    // Draw 
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.fillStyle = '#FFF';
    for (i = 0; i < slen; ++i) {
        var s = ortho[i];
        if (s[3]) {
            ctx.beginPath();
            ctx.fillStyle = 'rgba(255,255,255,'+Math.abs(s[0]*.1)+')';
            ctx.arc(s[1]+halfsize, halfsize-s[2],
                    Math.abs(s[0]*.1),
                    0, 2*Math.PI, true);
            ctx.fill();
        }
    }

    // Draw Bodies
    if (Object.keys(this.bodies).length) {
        var jct = Ti.mjd2jct(mjd);
        var earthPos = StarMap.EARTH.keplerCoord(jct);
        var equ2ecl = StarJs.Coord.ecl2equMatrix(jct);
        for (var body_name in this.bodies) {
            var body = this.bodies[body_name];
            var cc = body.getCoord(jct, earthPos, equ2ecl);
            
            var cm = stereographicProjectObj(cc.theta, cc.phi, lng, lat, this.size/2);
            var xx = halfsize-cm[0];
            var yy = halfsize-cm[1];

            body['proj_pos'] = { x: xx/this.size, y: yy/this.size, visible: cm[2] };
            if (cm[2]) {
                {
                    ctx.beginPath();
                    ctx.fillStyle = body.color;
                    
                    ctx.arc(xx, yy, body.size/2,
                            0, 2*Math.PI, true);
                    ctx.fill();
                }
                
                // ctx.beginPath();
                // ctx.strokeStyle = body.color;
                // ctx.arc(xx, yy, body.size/2 + 2,
                //         0, 2*Math.PI, true);
                // ctx.stroke();
                
                // if (ctx.fillText) {
                //     ctx.fillText(body.pl.name,
                //                  Math.round(xx + body.size/2 + 1),
                //                  Math.round(yy - body.size/2 - 1));
                // }
            }
        }
    }
};

window['StarMap']=StarMap;
StarMap.prototype['setPos'] = StarMap.prototype.setPos;
