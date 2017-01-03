/**
 * 
 * @author wangjue / https://github.com/hanmag
 */

(function () {

    var cssRenderer, cssScene, cssGroup;

    var webglRenderer, webglScene, webglGroup1, webglGroup2;

    var camera;

    var history, allHeroes, heroes, relations;

    var currentYear = "165";

    var container = document.getElementById("threejs-container");

    if (!Detector.webgl) Detector.addGetWebGLMessage();
    initScene();
    buildChina();
    animate();

    function initScene() {

        // container
        container.innerHTML = "";

        // css scene
        cssScene = new THREE.Scene();
        cssGroup = new THREE.Group();
        cssScene.add(cssGroup);

        webglScene = new THREE.Scene();
        webglGroup1 = new THREE.Group();
        webglGroup2 = new THREE.Group();
        webglScene.add(webglGroup1);
        webglScene.add(webglGroup2);

        // light
        webglScene.add(new THREE.AmbientLight(0x444444));

        //camera
        camera = new THREE.PerspectiveCamera(45, container.offsetWidth / container.offsetHeight, 1, 4000);
        camera.position.set(0, -500, 3500);
        camera.lookAt(new THREE.Vector3(0, 0, 0));

        // webgl renderer
        webglRenderer = new THREE.WebGLRenderer({
            antialias: true
        });
        webglRenderer.gammaInput = true;
        webglRenderer.gammaOutput = true;
        webglRenderer.setClearColor(0x101010);
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

    function animate() {

        requestAnimationFrame(animate);

        render();
    }

    function render() {

        cssRenderer.render(cssScene, camera);
        webglRenderer.render(webglScene, camera);
    }

    function lonlat2mercator(lonlat) {
        var mercator = {
            x: 0,
            y: 0
        };
        var x = lonlat.x * 20037508.34 / 180;
        var y = Math.log(Math.tan((90 + lonlat.y) * Math.PI / 360)) / (Math.PI / 180);
        y = y * 20037508.34 / 180;
        mercator.x = (x - 12500000) / 800;
        mercator.y = (y - 4000000) / 1000;
        return mercator;
    }

    function buildChina() {
        var cityCount = NETWORK.China.Cities.length;
        var pathCount = NETWORK.China.Paths.length;
        var cityPositions = {};
        // particle attributes
        var particles = new THREE.BufferGeometry();
        var particlePositions = new Float32Array(cityCount * 3);
        var particleColors = new Float32Array(cityCount * 3);
        var particleSizes = new Float32Array(cityCount);
        var particleScales = new Float32Array(cityCount);
        var particleImportances = new Float32Array(cityCount);

        var color = new THREE.Color(0xffffff);

        console.log(cityCount);
        console.log(pathCount);
        for (var i = 0; i < cityCount; i++) {
            var position = lonlat2mercator(NETWORK.China.Cities[i].lonlat);
            cityPositions[NETWORK.China.Cities[i].name] = position
                // position
            particlePositions[i * 3] = position.x;
            particlePositions[i * 3 + 1] = position.y;
            particlePositions[i * 3 + 2] = 0.0;

            // color
            particleColors[i * 3] = color.r * 2;
            particleColors[i * 3 + 1] = color.g * 2;
            particleColors[i * 3 + 2] = color.b * 2;

            // orther
            particleSizes[i] = 30.0;
            particleScales[i] = 0.9;
            particleImportances[i] = -1.0;
        }

        //add Attribute
        particles.addAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
        particles.addAttribute('customColor', new THREE.BufferAttribute(particleColors, 3));
        particles.addAttribute('size', new THREE.BufferAttribute(particleSizes, 1));
        particles.addAttribute('scale', new THREE.BufferAttribute(particleScales, 1));
        particles.addAttribute('importance', new THREE.BufferAttribute(particleImportances, 1));
        particles.setDrawRange(0, cityCount);
        particles.computeBoundingSphere();

        // create the particle system
        var pointCloud = new THREE.Points(particles, NETWORK.Materials.Node);
        webglGroup1.add(pointCloud);

        // lines attributes
        linePositions = new Float32Array(pathCount * 6);
        lineColors = new Float32Array(pathCount * 6);

        for (var i = 0; i < pathCount; i++) {
            var position1 = cityPositions[NETWORK.China.Paths[i][0]];
            var position2 = cityPositions[NETWORK.China.Paths[i][1]];
            // position
            linePositions[i * 6] = position1.x;
            linePositions[i * 6 + 1] = position1.y;
            linePositions[i * 6 + 2] = 0.0;
            linePositions[i * 6 + 3] = position2.x;
            linePositions[i * 6 + 4] = position2.y;
            linePositions[i * 6 + 5] = 0.0;

            // color
            lineColors[i * 6] = color.r * 2;
            lineColors[i * 6 + 1] = color.g * 2;
            lineColors[i * 6 + 2] = color.b * 2;
            lineColors[i * 6 + 3] = color.r * 2;
            lineColors[i * 6 + 4] = color.g * 2;
            lineColors[i * 6 + 5] = color.b * 2;
        }

        var lines = new THREE.BufferGeometry();
        lines.addAttribute('position', new THREE.BufferAttribute(linePositions, 3));
        lines.addAttribute('color', new THREE.BufferAttribute(lineColors, 3));
        lines.setDrawRange(0, pathCount * 2);
        lines.computeBoundingSphere();

        linesMesh = new THREE.LineSegments(lines, NETWORK.Materials.Line);
        webglGroup1.add(linesMesh);
    }
})();