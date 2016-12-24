/**
 * 
 * @author wangjue / https://github.com/hanmag
 */

var Shaders = {
    'point': {
        uniforms: {},
        vertexShader: [
            'attribute float size;',
            'attribute vec3 customColor;',
            'varying vec3 vColor;',
            'varying float opacity;',
            'void main() {',
            'vColor = customColor;',
            'vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );',
            'gl_PointSize = size;',
            'gl_Position = projectionMatrix * mvPosition;',
            'opacity = (gl_PointSize - 20.0) / 25.0;',
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