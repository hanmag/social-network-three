/**
 * 
 * @author wangjue / https://github.com/hanmag
 */

(function () {
    if (!Detector.webgl) Detector.addGetWebGLMessage();

    var json, heroes, relations, objects = {};

    var cssRenderer, webglRenderer, cssScene, webglScene, camera, group, group2;

    // special line 
    var particalSystem;

    // Suspending panel
    var panelGalaxy;

    // line var
    var positions, colors, linesMesh;

    //point var
    var particlePositions, particleColors, particleSizes, pointCloud;
    var particlesData = [];

    var r = 800;
    var rHalf = r / 2;
    var time = 0;

    var raycaster, intersects;
    var LASTINTERSECTED,
        INTERSECTED = null,
        NEIGHBOURSA = [],
        NEIGHBOURSB = [];

    //弹性系数，基础质量，临界长度, 摩擦系数
    var _k = 0.05,
        _m = 200,
        _l = 100,
        _f = 0.02;

    var _l2 = _l * _l;

    loadData(function () {
        initScene();
        processData();
        animate();
    }, function () {});


    function loadData(success, fail) {
        var xmlHttp = new XMLHttpRequest();
        xmlHttp.open("GET", "data/data.json");
        xmlHttp.send(null);
        xmlHttp.onreadystatechange = function () {
            if ((xmlHttp.readyState == 4)) {
                if (xmlHttp.status == 200) {
                    json = JSON.parse(xmlHttp.responseText);
                    heroes = json.heroes;
                    relations = json.relations;

                    heroes.forEach(function (element) {
                        element.numConnections = 0;
                        objects[element.id] = element;
                    }, this);

                    relations.forEach(function (element) {
                        objects[element.from].numConnections++;
                        objects[element.to].numConnections++;
                        element.force = 0.0;
                    }, this);

                    success();
                } else
                    fail(xmlHttp.status);
            }
        };
    }

    function initScene() {

        // container
        container.innerHTML = "";

        // scene
        cssScene = new THREE.Scene();
        webglScene = new THREE.Scene();
        group = new THREE.Group();
        group2 = new THREE.Group();
        webglScene.add(group);
        webglScene.add(group2);

        // light
        webglScene.add(new THREE.AmbientLight(0x444444));

        //camera
        camera = new THREE.PerspectiveCamera(45, container.offsetWidth / container.offsetHeight, 1, 4000);
        camera.position.z = 1800;

        // particalSystem
        particalSystem = new ParticalSystem(group2);

        // panelGalaxy
        panelGalaxy = new PanelGalaxy(container, camera, heroes);

        // webgl renderer
        webglRenderer = new THREE.WebGLRenderer({
            antialias: true
        });
        webglRenderer.gammaInput = true;
        webglRenderer.gammaOutput = true;
        webglRenderer.setClearColor(0x191919);
        webglRenderer.setPixelRatio(window.devicePixelRatio);
        webglRenderer.setSize(container.offsetWidth, container.offsetHeight);
        container.appendChild(webglRenderer.domElement);

        // css renderer
        cssRenderer = new THREE.CSS3DRenderer();
        cssRenderer.setSize(container.offsetWidth, container.offsetHeight);
        cssRenderer.domElement.style.position = 'absolute';
        cssRenderer.domElement.style.top = 0;
        container.appendChild(cssRenderer.domElement);

        // box helper
        var helper = new THREE.BoxHelper(new THREE.Mesh(new THREE.BoxGeometry(r, r, r)));
        helper.material.color.setHex(0x080808);
        helper.material.blending = THREE.AdditiveBlending;
        helper.material.transparent = true;
        group.add(helper);

        // mouse
        raycaster = new THREE.Raycaster();
        raycaster.params.Points.threshold = 10;

        // window
        window.addEventListener('resize', onWindowResize, false);
        document.addEventListener('mousemove', onDocumentMouseMove, false);

        // click event
        SceneClicked = function () {
            INTERSECTED = null;
            NEIGHBOURSA = NEIGHBOURSB = [];
            group2.children = [];
            panelGalaxy.Clear();
        };
    }

    function onWindowResize() {
        camera.aspect = container.offsetWidth / container.offsetHeight;
        camera.updateProjectionMatrix();
        cssRenderer.setSize(container.offsetWidth, container.offsetHeight);
        webglRenderer.setSize(container.offsetWidth, container.offsetHeight);
    }

    function processData() {
        // all nodes count
        var particalCount = heroes.length;
        // max segments
        var segmentsCount = particalCount * particalCount;
        // particle attributes
        var particles = new THREE.BufferGeometry();
        particlePositions = new Float32Array(particalCount * 3);
        particleColors = new Float32Array(particalCount * 3);
        particleSizes = new Float32Array(particalCount);

        for (var i = 0; i < particalCount; i++) {
            particlePositions[i * 3] = Math.random() * r - r / 2;
            particlePositions[i * 3 + 1] = Math.random() * r - r / 2;
            particlePositions[i * 3 + 2] = Math.random() * r - r / 2;
            particleColors[i * 3] = 255;
            particleColors[i * 3 + 1] = 255;
            particleColors[i * 3 + 2] = 255;

            // extra attributes
            particlesData.push({
                velocity: new THREE.Vector3(-1 + Math.random() * 2, -1 + Math.random() * 2, -1 + Math.random() * 2),
                force: new THREE.Vector3(0, 0, 0),
                speed: new THREE.Vector3(0, 0, 0),
                numConnections: 0
            });

            // marker: css object
            var element = document.createElement("div");
            element.className = "element";
            element.innerHTML = heroes[i].name;

            var cssObject = new THREE.CSS3DObject(element);
            heroes[i].marker = cssObject;
            heroes[i].index = i;
            cssScene.add(cssObject);
        }

        //add Attribute
        particles.addAttribute('position', new THREE.BufferAttribute(particlePositions, 3).setDynamic(true));
        particles.addAttribute('customColor', new THREE.BufferAttribute(particleColors, 3).setDynamic(true));
        particles.addAttribute('size', new THREE.BufferAttribute(particleSizes, 1).setDynamic(true));
        particles.computeBoundingSphere();

        // create the particle system
        pointCloud = new THREE.Points(particles, NodeMaterial);
        group.add(pointCloud);

        // lines
        positions = new Float32Array(segmentsCount * 3);
        colors = new Float32Array(segmentsCount * 3);

        var geometry = new THREE.BufferGeometry();
        geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3).setDynamic(true));
        geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3).setDynamic(true));
        geometry.setDrawRange(0, 0);
        geometry.computeBoundingSphere();

        linesMesh = new THREE.LineSegments(geometry, LineMaterial);
        group.add(linesMesh);
    }

    function animate() {

        var vertexpos = 0;
        var colorpos = 0;
        var numConnected = 0;
        var cameraPosition = camera.position;
        var particalCount = heroes.length;
        var linesCount = relations.length;
        // special line partical
        var pointsArray = [];
        // force speed
        var sx, sy, sz;

        // nodes
        for (var i = 0; i < particalCount; i++) {
            for (var j = i + 1; j < particalCount; j++) {
                var particleDataA = particlesData[i];
                var particleDataB = particlesData[j];
                var dx = particlePositions[i * 3] - particlePositions[j * 3];
                var dy = particlePositions[i * 3 + 1] - particlePositions[j * 3 + 1];
                var dz = particlePositions[i * 3 + 2] - particlePositions[j * 3 + 2];
                var distp = dx * dx + dy * dy + dz * dz;
                if (distp < _l2) {
                    var push = _m / Math.sqrt(distp);
                    particleDataA.force.add(new THREE.Vector3(dx, dy, dz).normalize().multiplyScalar(push));
                    particleDataB.force.add(new THREE.Vector3(-dx, -dy, -dz).normalize().multiplyScalar(push));
                }
            }

            var len = particlePositions[i * 3] * particlePositions[i * 3] +
                particlePositions[i * 3 + 1] * particlePositions[i * 3 + 1] +
                particlePositions[i * 3 + 2] * particlePositions[i * 3 + 2];

            if (len < _l2) {
                var gp = _m / Math.sqrt(len);
                particlesData[i].force.add(new THREE.Vector3(particlePositions[i * 3], particlePositions[i * 3 + 1], particlePositions[i * 3 + 2]).normalize().multiplyScalar(gp));
            }
            if (particlesData[i].speed.length() > 0.5)
                particlesData[i].force.add(particlesData[i].speed.clone().normalize().multiplyScalar(-1 * _f * _m));
        }

        for (var i = 0; i < particalCount; i++) {
            if (i !== INTERSECTED &&
                NEIGHBOURSA.indexOf(i) === -1 &&
                NEIGHBOURSB.indexOf(i) === -1) {
                // particle
                var particleData = particlesData[i];

                // free move in force
                particleData.speed.add(particleData.force.clone().divideScalar(_m));
                particlePositions[i * 3] += particleData.speed.x;
                particlePositions[i * 3 + 1] += particleData.speed.y;
                particlePositions[i * 3 + 2] += particleData.speed.z;

                if (particlePositions[i * 3 + 1] < -rHalf || particlePositions[i * 3 + 1] > rHalf)
                    particleData.speed.y = -particleData.speed.y;

                if (particlePositions[i * 3] < -rHalf || particlePositions[i * 3] > rHalf)
                    particleData.speed.x = -particleData.speed.x;

                if (particlePositions[i * 3 + 2] < -rHalf || particlePositions[i * 3 + 2] > rHalf)
                    particleData.speed.z = -particleData.speed.z;

                var dx = particlePositions[i * 3] - cameraPosition.x;
                var dy = particlePositions[i * 3 + 1] - cameraPosition.y;
                var dz = particlePositions[i * 3 + 2] - cameraPosition.z;
                var dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

                particleColors[i * 3] = 255;
                particleColors[i * 3 + 1] = 255;
                particleColors[i * 3 + 2] = 255;

                // distance to size and to opacity(in shader).
                var factor = 0.2;
                var size = (2500 - dist) * 0.03 + factor * heroes[i].numConnections + 10;
                if (size > 55)
                    size = 55;
                particleSizes[i] = size;
            }

            // marker, relative position and opacity
            var marker = heroes[i].marker;

            marker.element.style.opacity = particleSizes[i] / 60;
            marker.element.style.visibility = (marker.element.style.opacity < 0.65) ? "hidden" : "visible";

            marker.position.x = particlePositions[i * 3] / Detector.getScale();
            marker.position.y = particlePositions[i * 3 + 1] / Detector.getScale() - (5 + particleSizes[i] / 4 / Detector.getScale());
            marker.position.z = particlePositions[i * 3 + 2];

            marker.lookAt(cameraPosition);
        }

        // lines
        for (var i = 0; i < particalCount; i++) {
            particlesData[i].numConnections = 0;
            particlesData[i].force = new THREE.Vector3(0, 0, 0);
        }

        for (var index = 0; index < linesCount; index++) {
            var lineData = relations[index];
            var i = objects[lineData.from].index;
            var j = objects[lineData.to].index;

            var dx = particlePositions[i * 3] - particlePositions[j * 3];
            var dy = particlePositions[i * 3 + 1] - particlePositions[j * 3 + 1];
            var dz = particlePositions[i * 3 + 2] - particlePositions[j * 3 + 2];
            var dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

            var particleDataA = particlesData[i];
            var particleDataB = particlesData[j];
            particleDataA.numConnections++;
            particleDataB.numConnections++;

            if (dist < _l / 2)
                lineData.force = -50;
            else if (dist > _l * 2)
                lineData.force = 50;
            else lineData.force = (dist - _l) * _k;
            particleDataA.force.add(new THREE.Vector3(-dx, -dy, -dz).normalize().multiplyScalar(lineData.force));
            particleDataB.force.add(new THREE.Vector3(dx, dy, dz).normalize().multiplyScalar(lineData.force));

            if (dist < 600) {
                var alpha = (dist > 300) ? 0.005 : (0.1 - dist / 3000);

                positions[vertexpos++] = particlePositions[i * 3];
                positions[vertexpos++] = particlePositions[i * 3 + 1];
                positions[vertexpos++] = particlePositions[i * 3 + 2];

                positions[vertexpos++] = particlePositions[j * 3];
                positions[vertexpos++] = particlePositions[j * 3 + 1];
                positions[vertexpos++] = particlePositions[j * 3 + 2];

                colors[colorpos++] = alpha;
                colors[colorpos++] = alpha;
                colors[colorpos++] = alpha;

                colors[colorpos++] = alpha;
                colors[colorpos++] = alpha;
                colors[colorpos++] = alpha;

                numConnected++;
            }

            // special lines when selected
            if (INTERSECTED !== LASTINTERSECTED && (i === INTERSECTED || j === INTERSECTED)) {
                var path = new THREE.CatmullRomCurve3([
                    new THREE.Vector3(particlePositions[i * 3], particlePositions[i * 3 + 1], particlePositions[i * 3 + 2]),
                    new THREE.Vector3(particlePositions[j * 3], particlePositions[j * 3 + 1], particlePositions[j * 3 + 2])
                ]);
                var spGeometry = new THREE.TubeGeometry(path, 1, 5, 8, false);
                var spLine = new THREE.Mesh(spGeometry, Materials.specialLine);
                group2.add(spLine);

                pointsArray.push(path.points);
            }
        }

        // special lines
        if (pointsArray.length > 0) {
            particalSystem.Init(pointsArray);
        }

        linesMesh.geometry.setDrawRange(0, numConnected * 2);
        pointCloud.geometry.setDrawRange(0, particalCount);

        requestAnimationFrame(animate);

        if (LASTINTERSECTED !== INTERSECTED)
            LASTINTERSECTED = INTERSECTED;

        render();
    }

    function render() {

        raycaster.setFromCamera(mouse, camera);
        intersects = raycaster.intersectObject(pointCloud);

        if (intersects.length == 2 && INTERSECTED == intersects[1].index) {
            // overlay
        } else if (intersects.length > 0) {
            if (INTERSECTED != intersects[0].index) {
                group2.children = [];
                INTERSECTED = intersects[0].index;
                particleSizes[INTERSECTED] = 128;
                particleColors[INTERSECTED * 3] = 255;
                particleColors[INTERSECTED * 3 + 1] = 255;
                particleColors[INTERSECTED * 3 + 2] = 0;
                var points = [heroes[INTERSECTED]];

                NEIGHBOURSA = NEIGHBOURSB = [];
                relations.forEach(function (element) {
                    if (element.from === heroes[INTERSECTED].id) {
                        NEIGHBOURSB.push(objects[element.to].index);
                        particleSizes[objects[element.to].index] = 64;
                        particleColors[objects[element.to].index * 3] = 2;
                        particleColors[objects[element.to].index * 3 + 1] = 2;
                        particleColors[objects[element.to].index * 3 + 2] = 0;

                        points.push(objects[element.to]);
                    } else if (element.to === heroes[INTERSECTED].id) {
                        NEIGHBOURSA.push(objects[element.from].index);
                        particleSizes[objects[element.from].index] = 64;
                        particleColors[objects[element.from].index * 3] = 2;
                        particleColors[objects[element.from].index * 3 + 1] = 2;
                        particleColors[objects[element.from].index * 3 + 2] = 0;

                        points.push(objects[element.from]);
                    }
                }, this);

                panelGalaxy.Select(points);
            }
        }

        if (INTERSECTED === null) {
            target.x += 0.0015;
        }

        rotation.x += (target.x - rotation.x) * 0.1;
        rotation.y += (target.y - rotation.y) * 0.1;

        camera.position.x = 1800 * Math.sin(rotation.x) * Math.cos(rotation.y);
        camera.position.y = 1800 * Math.sin(rotation.y);
        camera.position.z = 1800 * Math.cos(rotation.x) * Math.cos(rotation.y);
        camera.lookAt(new THREE.Vector3(0, 0, 0));

        time += 0.002;
        for (var i = 0; i < heroes.length; i++) {
            if (particleSizes[i] > 60)
                continue;
            particleSizes[i] += 5 * Math.sin(25 * time);
        }

        linesMesh.geometry.attributes.position.needsUpdate = true;
        linesMesh.geometry.attributes.color.needsUpdate = true;
        pointCloud.geometry.attributes.position.needsUpdate = true;
        pointCloud.geometry.attributes.customColor.needsUpdate = true;
        pointCloud.geometry.attributes.size.needsUpdate = true;

        particalSystem.Update();
        panelGalaxy.Update();

        cssRenderer.render(cssScene, camera);
        webglRenderer.render(webglScene, camera);
    }
})();