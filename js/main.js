/**
 * 
 * @author wangjue / https://github.com/hanmag
 */

(function () {
    if (!Detector.webgl) Detector.addGetWebGLMessage();

    var json, heroes, relations, objects = {};

    var cssRenderer, webglRenderer, cssScene, webglScene, camera, group, group2;

    // line var
    var positions, colors, linesMesh;

    //point var
    var particlePositions, particleColors, particleSizes, pointCloud;
    var particlesData = [];

    var r = 800;
    var rHalf = r / 2;
    var time = 0;

    var raycaster, intersects;
    var INTERSECTED = null,
        NEIGHBOURSA = [],
        NEIGHBOURSB = [];

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

        // event
        SceneClicked = function () {
            INTERSECTED = null;
            NEIGHBOURSA = NEIGHBOURSB = [];
            group2.children = [];
        };
    }

    function onWindowResize() {
        camera.aspect = container.offsetWidth / container.offsetHeight;
        camera.updateProjectionMatrix();
        cssRenderer.setSize(container.offsetWidth, container.offsetHeight);
        webglRenderer.setSize(container.offsetWidth, container.offsetHeight);
    }

    function processData() {

        var particalCount = heroes.length;
        // max segments
        var segmentsCount = particalCount * particalCount;

        var uniforms = {
            color: {
                value: new THREE.Color(0xffffff)
            },
            texture: {
                value: new THREE.TextureLoader().load("images/sprites/spark1.png")
            }
        };

        var pMaterial = new THREE.ShaderMaterial({
            uniforms: uniforms,
            vertexShader: Shaders.point.vertexShader,
            fragmentShader: Shaders.point.fragmentShader,

            blending: THREE.AdditiveBlending,
            depthTest: false,
            transparent: true
        });

        var particles = new THREE.BufferGeometry();
        particlePositions = new Float32Array(particalCount * 3);
        particleColors = new Float32Array(particalCount * 3);
        particleSizes = new Float32Array(particalCount);

        for (var i = 0; i < particalCount; i++) {

            var x = Math.random() * r - r / 2;
            var y = Math.random() * r - r / 2;
            var z = Math.random() * r - r / 2;

            particlePositions[i * 3] = x;
            particlePositions[i * 3 + 1] = y;
            particlePositions[i * 3 + 2] = z;

            particlesData.push({
                velocity: new THREE.Vector3(-1 + Math.random() * 2, -1 + Math.random() * 2, -1 + Math.random() * 2),
                numConnections: 0
            });

            particleColors[i * 3] = 255;
            particleColors[i * 3 + 1] = 255;
            particleColors[i * 3 + 2] = 255;

            // marker: css object
            var element = document.createElement("div");
            element.className = "element";
            element.innerHTML = heroes[i].name;

            var cssObject = new THREE.CSS3DObject(element);

            heroes[i].marker = cssObject;
            heroes[i].index = i;

            cssScene.add(cssObject);
        }

        particles.addAttribute('position', new THREE.BufferAttribute(particlePositions, 3).setDynamic(true));
        particles.addAttribute('customColor', new THREE.BufferAttribute(particleColors, 3).setDynamic(true));
        particles.addAttribute('size', new THREE.BufferAttribute(particleSizes, 1).setDynamic(true));
        particles.computeBoundingSphere();

        // create the particle system
        pointCloud = new THREE.Points(particles, pMaterial);
        group.add(pointCloud);

        // lines
        positions = new Float32Array(segmentsCount * 3);
        colors = new Float32Array(segmentsCount * 3);

        var geometry = new THREE.BufferGeometry();
        geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3).setDynamic(true));
        geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3).setDynamic(true));
        geometry.setDrawRange(0, 0);
        geometry.computeBoundingSphere();

        var material = new THREE.LineBasicMaterial({
            vertexColors: THREE.VertexColors,
            blending: THREE.AdditiveBlending,
            transparent: true
        });

        linesMesh = new THREE.LineSegments(geometry, material);
        group.add(linesMesh);
    }

    function animate() {

        var vertexpos = 0;
        var colorpos = 0;
        var numConnected = 0;
        var cameraPosition = camera.position;
        var particalCount = heroes.length;
        var linesCount = relations.length;

        for (var i = 0; i < particalCount; i++)
            particlesData[i].numConnections = 0;

        for (var i = 0; i < particalCount; i++) {
            if (i !== INTERSECTED &&
                NEIGHBOURSA.indexOf(i) === -1 &&
                NEIGHBOURSB.indexOf(i) === -1) {
                // particle
                var particleData = particlesData[i];

                // free move
                particlePositions[i * 3] += 0.5 * particleData.velocity.x;
                particlePositions[i * 3 + 1] += 0.5 * particleData.velocity.y;
                particlePositions[i * 3 + 2] += 0.5 * particleData.velocity.z;

                if (particlePositions[i * 3 + 1] < -rHalf || particlePositions[i * 3 + 1] > rHalf)
                    particleData.velocity.y = -particleData.velocity.y;

                if (particlePositions[i * 3] < -rHalf || particlePositions[i * 3] > rHalf)
                    particleData.velocity.x = -particleData.velocity.x;

                if (particlePositions[i * 3 + 2] < -rHalf || particlePositions[i * 3 + 2] > rHalf)
                    particleData.velocity.z = -particleData.velocity.z;

                var dx = particlePositions[i * 3] - cameraPosition.x;
                var dy = particlePositions[i * 3 + 1] - cameraPosition.y;
                var dz = particlePositions[i * 3 + 2] - cameraPosition.z;
                var dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

                particleColors[i * 3] = 255;
                particleColors[i * 3 + 1] = 255;
                particleColors[i * 3 + 2] = 255;

                // distance to size and to opacity(in shader).
                var factor = 1.0;
                particleSizes[i] = (2500 - dist) * 0.04 + factor * heroes[i].numConnections + 10;
            }

            // marker, relative position and opacity
            var marker = heroes[i].marker;

            marker.element.style.opacity = particleSizes[i] / 70;
            marker.element.style.visibility = (marker.element.style.opacity < 0.65) ? "hidden" : "visible";

            marker.position.x = particlePositions[i * 3] / 2;
            marker.position.y = particlePositions[i * 3 + 1] / 2 - (5 + particleSizes[i] / 8);
            marker.position.z = particlePositions[i * 3 + 2];

            marker.lookAt(cameraPosition);
        }

        // lines
        for (var index = 0; index < linesCount; index++) {
            var lineData = relations[index];
            var i = objects[lineData.from].index;
            var j = objects[lineData.to].index;

            var particleDataA = particlesData[i];
            var particleDataB = particlesData[j];
            particleDataA.numConnections++;
            particleDataB.numConnections++;

            var dx = particlePositions[i * 3] - particlePositions[j * 3];
            var dy = particlePositions[i * 3 + 1] - particlePositions[j * 3 + 1];
            var dz = particlePositions[i * 3 + 2] - particlePositions[j * 3 + 2];
            var dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (dist < 600) {
                var alpha = (dist > 300) ? 0.005 : (0.2 - dist / 1500);

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
            if (i === INTERSECTED || j === INTERSECTED) {
                var path = new THREE.CatmullRomCurve3([
                    new THREE.Vector3(particlePositions[i * 3], particlePositions[i * 3 + 1], particlePositions[i * 3 + 2]),
                    new THREE.Vector3(particlePositions[j * 3], particlePositions[j * 3 + 1], particlePositions[j * 3 + 2])
                ]);
                var spGeometry = new THREE.TubeGeometry(path, 1, 5, 8, false);
                var spLine = new THREE.Mesh(spGeometry, Materials.specialLine);
                group2.add(spLine);
            }
        }

        linesMesh.geometry.setDrawRange(0, numConnected * 2);
        pointCloud.geometry.setDrawRange(0, particalCount);

        requestAnimationFrame(animate);

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

                NEIGHBOURSA = NEIGHBOURSB = [];
                relations.forEach(function (element) {
                    if (element.from === heroes[INTERSECTED].id) {
                        NEIGHBOURSB.push(objects[element.to].index);
                        particleSizes[objects[element.to].index] = 64;
                        particleColors[objects[element.to].index * 3] = 2;
                        particleColors[objects[element.to].index * 3 + 1] = 2;
                        particleColors[objects[element.to].index * 3 + 2] = 0;
                    } else if (element.to === heroes[INTERSECTED].id) {
                        NEIGHBOURSA.push(objects[element.from].index);
                        particleSizes[objects[element.from].index] = 64;
                        particleColors[objects[element.from].index * 3] = 2;
                        particleColors[objects[element.from].index * 3 + 1] = 2;
                        particleColors[objects[element.from].index * 3 + 2] = 0;
                    }
                }, this);
            }
        }

        target.x += 0.0015;

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
            particleSizes[i] += 4.5 * Math.sin(25 * time);
        }

        linesMesh.geometry.attributes.position.needsUpdate = true;
        linesMesh.geometry.attributes.color.needsUpdate = true;

        pointCloud.geometry.attributes.position.needsUpdate = true;
        pointCloud.geometry.attributes.customColor.needsUpdate = true;
        pointCloud.geometry.attributes.size.needsUpdate = true;

        cssRenderer.render(cssScene, camera);
        webglRenderer.render(webglScene, camera);
    }
})();