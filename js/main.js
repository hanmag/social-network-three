/**
 * 
 * @author wangjue / https://github.com/hanmag
 */

(function () {
    if (!Detector.webgl) Detector.addGetWebGLMessage();

    var heroes, objects = {};

    var container, cssRenderer, webglRenderer, cssScene, webglScene, camera;

    var positions, colors, particles, pointCloud, particlePositions, linesMesh;

    loadData(function () {
        initScene();
        processData();
        animate();
    }, function () {});


    function loadData(success, fail) {
        var xmlHttp = new XMLHttpRequest();
        xmlHttp.open("GET", "data/heroes.json");
        xmlHttp.send(null);
        xmlHttp.onreadystatechange = function () {
            if ((xmlHttp.readyState == 4)) {
                if (xmlHttp.status == 200) {
                    heroes = JSON.parse(xmlHttp.responseText);
                    success();
                } else
                    fail(xmlHttp.status);
            }
        };
    }

    function initScene() {

        // container
        container = document.getElementById('threejs-container');
        container.innerHTML = "";

        // scene
        cssScene = new THREE.Scene();
        webglScene = new THREE.Scene();

        //camera
        camera = new THREE.PerspectiveCamera(45, container.offsetWidth / container.offsetHeight, 1, 999999);
        camera.position.set(0, 0, 1000);

        // webgl renderer
        webglRenderer = new THREE.WebGLRenderer({
            antialias: true
        });
        webglRenderer.setClearColor(0x333333);
        webglRenderer.setPixelRatio(window.devicePixelRatio);
        webglRenderer.setSize(container.offsetWidth, container.offsetHeight);
        container.appendChild(webglRenderer.domElement);

        // css renderer
        cssRenderer = new THREE.CSS3DRenderer();
        cssRenderer.setSize(container.offsetWidth, container.offsetHeight);
        cssRenderer.domElement.style.position = 'absolute';
        cssRenderer.domElement.style.top = 0;
        container.appendChild(cssRenderer.domElement);

        // window
        window.addEventListener('resize', onWindowResize, false);
    }

    function onWindowResize() {
        camera.aspect = container.offsetWidth / container.offsetHeight;
        camera.updateProjectionMatrix();
        cssRenderer.setSize(container.offsetWidth, container.offsetHeight);
        webglRenderer.setSize(container.offsetWidth, container.offsetHeight);
    }

    function processData() {
        var segments = 100;
        var particleCount = 500;
        var r = 800;
        var rHalf = r / 2;
        var particlesData = [];

        positions = new Float32Array(segments * 3);
        colors = new Float32Array(segments * 3);

        var pMaterial = new THREE.PointsMaterial({
            color: 0xFFFFFF,
            size: 3,
            blending: THREE.AdditiveBlending,
            transparent: true,
            sizeAttenuation: false
        });

        particles = new THREE.BufferGeometry();
        particlePositions = new Float32Array(500 * 3);

        for (var i = 0; i < 500; i++) {

            var x = Math.random() * r - r / 2;
            var y = Math.random() * r - r / 2;
            var z = Math.random() * r - r / 2;

            particlePositions[i * 3] = x;
            particlePositions[i * 3 + 1] = y;
            particlePositions[i * 3 + 2] = z;

            // add it to the geometry
            particlesData.push({
                velocity: new THREE.Vector3(-1 + Math.random() * 2, -1 + Math.random() * 2, -1 + Math.random() * 2),
                numConnections: 0
            });

        }

        particles.setDrawRange(0, particleCount);
        particles.addAttribute('position', new THREE.BufferAttribute(particlePositions, 3).setDynamic(true));

        // create the particle system
        pointCloud = new THREE.Points(particles, pMaterial);
        webglScene.add(pointCloud);

        var geometry = new THREE.BufferGeometry();

        geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3).setDynamic(true));
        geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3).setDynamic(true));

        geometry.computeBoundingSphere();

        geometry.setDrawRange(0, 0);

        var material = new THREE.LineBasicMaterial({
            vertexColors: THREE.VertexColors,
            blending: THREE.AdditiveBlending,
            transparent: true
        });

        linesMesh = new THREE.LineSegments(geometry, material);
        webglScene.add(linesMesh);
    }

    function animate() {
        requestAnimationFrame(animate);

        render();
    }

    function render() {
        cssRenderer.render(cssScene, camera);
        webglRenderer.render(webglScene, camera);
    }

    function convertVector(vector, scale, transform) {
        var v = vector.clone();
        v.x = v.x * scale;
        v.y = v.y * scale + transform;
        return v;
    }
})();