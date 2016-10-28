// 3er Parties
import { StarJs } from './vendor/starjs.min.js';

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

export function stereoProject(body, size, lng, lat, time) {
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

