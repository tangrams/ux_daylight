# Ux Daylight for [Tangram](https://mapzen.com/products/tangram/)

[TangramJS](https://mapzen.com/products/tangram/) is an incredible 2D/3D Map engine that contain a felixble [lighting](https://mapzen.com/documentation/tangram/Lights-Overview/) and [material](https://mapzen.com/documentation/tangram/Materials-Overview/) system. This little addon automatically set the default lights to the actual position of the sun on a give place. At the same time allows you to add the current atmosphere scattering sphere as a [spheremap](https://mapzen.com/documentation/tangram/Materials-Overview/#mapping-spheremap) to the styles.

## how it works?

First you need to add the `ux_daylight.js` and `ux_daylight.css` to your HTML document

```html
<!-- DayLight Tangram -->
<link rel="stylesheet" href="ux_daylight.css" />
<script type="text/javascript" src="ux_daylight.js"></script>
```


Because [Tangram](https://mapzen.com/products/tangram/) is higly configurable this needs a little of wiring on you [`.yaml` scene file](https://mapzen.com/documentation/tangram/Scene-file/).

First you need to import the `ux_language.yaml` to your scene file like this:

```yaml
import:
    - https://tangrams.github.io/ux_language/ux_language.yaml

...

```

Once there you need to point your labels rules to the function `global.ux_language_text_source` on your `text_source:` nodes. Like this

```yaml
layers:
    roads:
        data: { source: mapzen }
        draw:
            text:
                text_source: global.ux_language_text_source
                font:
                    family: Helvetica
                    size: 14px
                    fill: black
                    stroke: { color: white, width: 6px }
```

Then is time to load the leaflet pluging it self. For that in the html of you map add:

```html
    <!-- Language Selector for Tangram -->
    <link rel="stylesheet" href="https://tangrams.github.io/ux_language/ux_language.css" />
    <script src="https://tangrams.github.io/ux_language/ux_language.js"></script>
```

And in the JavaScript section where you load the Leaflet and Tangram maps do:

```javascript
    // Leafleat Map
    var map = L.map('map', {maxZoom: 20});

    // Tangram Layer
    var layer = Tangram.leafletLayer({
        scene: 'https://tangrams.github.io/tron/tron.yaml',
        attribution: '&copy; OSM contributors | <a href="https://mapzen.com" target="_blank">Mapzen</a>'
    }).addTo(map);

    // Now the interesting stuff, the new UxLanguage !!
    map.addControl(L.uxLanguage({ scene: layer.scene }));
```

Enjoy!