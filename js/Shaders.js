/**
 * 
 * @author wangjue / https://github.com/hanmag
 */

var NETWORK = NETWORK || {};

// define Shaders and Materials
(function () {
    var node_uniforms = {
        color: {
            value: new THREE.Color(0xffffff)
        },
        texture: {
            value: new THREE.TextureLoader().load("images/sprites/spark1.png")
        },
        texture2: {
            value: new THREE.TextureLoader().load("images/sprites/spark2.png")
        }
    };

    var particle_uniforms = {
        color: {
            value: new THREE.Color(0xffffff)
        },
        texture: {
            value: new THREE.TextureLoader().load("images/sprites/particleA.png")
        }
    };

    var shader = {
        vertexShader: [
            'attribute float size;',
            'attribute float scale;',
            'attribute vec3 customColor;',
            'attribute float importance;',
            'varying vec3 vColor;',
            'varying float opacity;',
            'varying float type;',
            'void main() {',
            'vColor = customColor;',
            'vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );',
            'gl_PointSize = size * scale;',
            'gl_Position = projectionMatrix * mvPosition;',
            'opacity = scale;',
            'type = importance;',
            '}'
        ].join('\n'),
        fragmentShader: [
            'uniform vec3 color;',
            'uniform sampler2D texture;',
            'uniform sampler2D texture2;',
            'varying vec3 vColor;',
            'varying float opacity;',
            'varying float type;',
            'void main() {',
            'gl_FragColor = vec4( color * vColor, opacity);',
            'if(type>0.0)',
            'gl_FragColor = gl_FragColor * texture2D( texture, gl_PointCoord );',
            'else',
            'gl_FragColor = gl_FragColor * texture2D( texture2, gl_PointCoord );',
            'if(opacity<0.2) discard;',
            '}'
        ].join('\n')
    };

    var materials = {
        "Node": new THREE.ShaderMaterial({
            uniforms: node_uniforms,
            vertexShader: shader.vertexShader,
            fragmentShader: shader.fragmentShader,
            blending: THREE.AdditiveBlending,
            depthTest: false,
            transparent: true
        }),
        "Line": new THREE.LineBasicMaterial({
            vertexColors: THREE.VertexColors,
            blending: THREE.AdditiveBlending,
            transparent: true
        }),
        "Particle": new THREE.ShaderMaterial({
            uniforms: particle_uniforms,
            vertexShader: shader.vertexShader,
            fragmentShader: shader.fragmentShader,
            blending: THREE.AdditiveBlending,
            depthTest: false,
            transparent: true
        }),
        "SpecialLine": new THREE.MeshPhongMaterial({
            color: 0xffff00,
            specular: 0x333333,
            shininess: 150,
            side: THREE.FrontSide,
            vertexColors: THREE.VertexColors,
            shading: THREE.SmoothShading
        })
    };

    NETWORK.Materials = materials;
})();