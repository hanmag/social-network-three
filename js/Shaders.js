/**
 * 
 * @author wangjue / https://github.com/hanmag
 */

var Shaders = {
    'point': {
        uniforms: {},
        vertexShader: [
            'attribute float size;',
            'attribute float scale;',
            'attribute vec3 customColor;',
            'varying vec3 vColor;',
            'varying float opacity;',
            'void main() {',
            'vColor = customColor;',
            'vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );',
            'gl_PointSize = size * scale;',
            'gl_Position = projectionMatrix * mvPosition;',
            'opacity = scale;',
            '}'
        ].join('\n'),
        fragmentShader: [
            'uniform vec3 color;',
            'uniform sampler2D texture;',
            'varying vec3 vColor;',
            'varying float opacity;',
            'void main() {',
            'gl_FragColor = vec4( color * vColor, opacity);',
            'gl_FragColor = gl_FragColor * texture2D( texture, gl_PointCoord );',
            '}'
        ].join('\n')
    }
};

var Materials = {
    'specialLine': new THREE.MeshPhongMaterial({
        color: 0xffff00,
        specular: 0x333333,
        shininess: 150,
        side: THREE.FrontSide,
        vertexColors: THREE.VertexColors,
        shading: THREE.SmoothShading
    })
};

var node_uniforms = {
    color: {
        value: new THREE.Color(0xffffff)
    },
    texture: {
        value: new THREE.TextureLoader().load("images/sprites/spark1.png")
    }
};

var NodeMaterial = new THREE.ShaderMaterial({
    uniforms: node_uniforms,
    vertexShader: Shaders.point.vertexShader,
    fragmentShader: Shaders.point.fragmentShader,

    blending: THREE.AdditiveBlending,
    depthTest: false,
    transparent: true
});

var LineMaterial = new THREE.LineBasicMaterial({
    vertexColors: THREE.VertexColors,
    blending: THREE.AdditiveBlending,
    transparent: true
});