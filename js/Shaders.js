var Shaders = {
    'atmosphere': {
        uniforms: {},
        vertexShader: [
            'varying vec3 vNormal;',
            'void main() {',
            'vNormal = normalize( normalMatrix * normal );',
            'gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',
            '}'
        ].join('\n'),
        fragmentShader: [
            'varying vec3 vNormal;',
            'void main() {',
            'float intensity = pow( 1.3 + dot( vNormal, vec3( 0, 0, 1.0 ) ), 2.9 );',
            'gl_FragColor = vec4( 0.3, 0.5, 1.0, 0.4 ) * intensity;',
            '}'
        ].join('\n')
    },
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
            'gl_PointSize = size * ( 300.0 / -mvPosition.z );',
            'gl_Position = projectionMatrix * mvPosition;',
            'opacity = (gl_PointSize - 12.0) / 24.0;',
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