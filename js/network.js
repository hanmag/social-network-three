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

NETWORK.Globe = function (container, webglGroup, cssGroup, camera, raycaster) {

    // 数据
    var nodes, edges;
    var objects = {};

    // 粒子系统
    var particlePositions, particleColors, particleSizes, particleScales;
    var pointCloud;
    var particlesData = [];

    // 线段相关
    var linePositions, lineColors;
    var linesMesh;

    // 球直径、半径
    var _r2 = 800;
    var _r = _r2 / 2;

    // 弹性系数，基础质量，临界长度, 摩擦系数
    var _k = 0.06,
        _m = 100,
        _l = 50,
        _f = 0.08;

    // 相机位置与旋转
    var camera_r = camera.position.length();
    var rotation = {
        x: 0,
        y: 0
    };

    var INTERSECTED = null,
        CURSELECTED = null,
        FIXED = [];

    var particleGroup = new THREE.Group();
    webglGroup.add(particleGroup);
    var ps = new NETWORK.ParticleSystem(particleGroup);

    var fp;

    function clear() {
        var cs = [];
        webglGroup.children.forEach(function (child) {
            if (child !== particleGroup)
                cs.push(child);
        }, this);
        cs.forEach(function (child) {
            webglGroup.remove(child);
        }, this);

        cs = [];
        particleGroup.children.forEach(function (child) {
            cs.push(child);
        }, this);
        cs.forEach(function (child) {
            particleGroup.remove(child);
        }, this);

        if (pointCloud !== undefined) {
            pointCloud.geometry.setDrawRange(0, 0);
            pointCloud = undefined;
        }
    }

    function init(heroes, relations) {

        clear();

        nodes = heroes;
        edges = relations;

        initData(nodes, edges);

        fp = new NETWORK.FloatPanel(container, camera, nodes);

        // all nodes count
        var particalCount = nodes.length;
        // all possible segments count
        var segmentsCount = particalCount * particalCount;
        // particle attributes
        var particles = new THREE.BufferGeometry();
        particlePositions = new Float32Array(particalCount * 3);
        particleColors = new Float32Array(particalCount * 3);
        particleSizes = new Float32Array(particalCount);
        particleScales = new Float32Array(particalCount);

        var color = new THREE.Color(0xffffff);
        var size = 50.0;

        for (var i = 0; i < particalCount; i++) {
            // position
            particlePositions[i * 3] = Math.random() * _r2 - _r;
            particlePositions[i * 3 + 1] = Math.random() * _r2 - _r;
            particlePositions[i * 3 + 2] = Math.random() * _r2 - _r;

            // color
            particleColors[i * 3] = color.r * 2;
            particleColors[i * 3 + 1] = color.g * 2;
            particleColors[i * 3 + 2] = color.b * 2;

            // size
            particleSizes[i] = size;
            particleScales[i] = 1.0;

            // extra attributes
            particlesData.push({
                force: new THREE.Vector3(0, 0, 0),
                speed: new THREE.Vector3(0, 0, 0),
                numConnections: 0
            });
        }

        //add Attribute
        particles.addAttribute('position', new THREE.BufferAttribute(particlePositions, 3).setDynamic(true));
        particles.addAttribute('customColor', new THREE.BufferAttribute(particleColors, 3));
        particles.addAttribute('size', new THREE.BufferAttribute(particleSizes, 1));
        particles.addAttribute('scale', new THREE.BufferAttribute(particleScales, 1).setDynamic(true));
        particles.setDrawRange(0, particalCount);
        particles.computeBoundingSphere();

        // create the particle system
        pointCloud = new THREE.Points(particles, NETWORK.Materials.Node);
        webglGroup.add(pointCloud);

        // lines attributes
        linePositions = new Float32Array(segmentsCount * 3);
        lineColors = new Float32Array(segmentsCount * 3);

        var lines = new THREE.BufferGeometry();
        lines.addAttribute('position', new THREE.BufferAttribute(linePositions, 3).setDynamic(true));
        lines.addAttribute('color', new THREE.BufferAttribute(lineColors, 3).setDynamic(true));
        lines.setDrawRange(0, 0);
        lines.computeBoundingSphere();

        linesMesh = new THREE.LineSegments(lines, NETWORK.Materials.Line);
        webglGroup.add(linesMesh);
    }

    function initData(nodes, edges) {
        for (var i = 0; i < nodes.length; i++) {
            nodes[i].numConnections = 0;
            nodes[i].index = i;
            objects[nodes[i].id] = nodes[i];

            //marker
            var element = document.createElement("div");
            element.className = "element";
            element.innerHTML = nodes[i].name;

            var cssObject = new THREE.CSS3DObject(element);
            nodes[i].marker = cssObject;
            cssGroup.add(cssObject);
        }

        edges.forEach(function (element) {
            objects[element.from].numConnections++;
            objects[element.to].numConnections++;
        }, this);
    }

    function select() {
        if (CURSELECTED !== INTERSECTED) {
            var cs = [];
            particleGroup.children.forEach(function (child) {
                cs.push(child);
            }, this);
            cs.forEach(function (child) {
                particleGroup.remove(child);
            }, this);

            FIXED = [];
        }

        CURSELECTED = INTERSECTED;
    }

    function update(target) {
        if (pointCloud === undefined) return;

        var intersects = raycaster.intersectObject(pointCloud);
        if (intersects.length > 0) {
            if (INTERSECTED != intersects[0].index) {
                if (INTERSECTED !== null && CURSELECTED !== INTERSECTED) {
                    particleColors[INTERSECTED * 3] = 2;
                    particleColors[INTERSECTED * 3 + 1] = 2;
                    particleColors[INTERSECTED * 3 + 2] = 2;
                }
                INTERSECTED = intersects[0].index;
                particleColors[INTERSECTED * 3] = 2;
                particleColors[INTERSECTED * 3 + 1] = 2;
                particleColors[INTERSECTED * 3 + 2] = 0;
            }
        } else {
            if (CURSELECTED !== INTERSECTED) {
                particleColors[INTERSECTED * 3] = 2;
                particleColors[INTERSECTED * 3 + 1] = 2;
                particleColors[INTERSECTED * 3 + 2] = 2;
            }
            INTERSECTED = null;
        }

        renderPoints();
        renderLines();
        renderMarkers();

        ps.Update();
        fp.Update();

        moveCamera(target);

        pointCloud.geometry.attributes.position.needsUpdate = true;
        pointCloud.geometry.attributes.scale.needsUpdate = true;
        pointCloud.geometry.attributes.customColor.needsUpdate = true;
        linesMesh.geometry.attributes.position.needsUpdate = true;
        linesMesh.geometry.attributes.color.needsUpdate = true;
    }

    function renderPoints() {

        var selectedNodes = [];

        // 清空上一轮计算结果，保留当前速度
        for (var i = 0; i < particlesData.length; i++) {
            var particleData = particlesData[i];
            particlesData[i].numConnections = 0;
            particlesData[i].force = new THREE.Vector3(0, 0, 0);

            // 计算阻力，速度很慢时不考虑
            if (particleData.speed.length() > 0.2)
                particleData.force.add(particleData.speed.clone().normalize().multiplyScalar(-1 * _f * _m));
        }

        for (var i = 0; i < particlesData.length; i++) {
            var particleDataA = particlesData[i];
            var ax = particlePositions[i * 3];
            var ay = particlePositions[i * 3 + 1];
            var az = particlePositions[i * 3 + 2];

            var dist = Math.sqrt(ax * ax + ay * ay + az * az);

            // 计算中心点的弹力
            var elastic = (dist - _r) * _k * 10;
            particleDataA.force.add(new THREE.Vector3(-ax, -ay, -az).normalize().multiplyScalar(elastic));

            // 计算所有节点之间的默认斥力
            for (var j = i + 1; j < particlesData.length; j++) {
                var particleDataB = particlesData[j];
                var dx = ax - particlePositions[j * 3];
                var dy = ay - particlePositions[j * 3 + 1];
                var dz = az - particlePositions[j * 3 + 2];
                var distp = dx * dx + dy * dy + dz * dz;
                var push = 10 / distp;
                particleDataA.force.add(new THREE.Vector3(dx, dy, dz).normalize().multiplyScalar(push));
                particleDataB.force.add(new THREE.Vector3(-dx, -dy, -dz).normalize().multiplyScalar(push));
            }
        }

        // 计算节点间边的弹力
        for (var k = 0; k < edges.length; k++) {
            var lineData = edges[k];
            var i = objects[lineData.from].index;
            var j = objects[lineData.to].index;

            var dx = particlePositions[i * 3] - particlePositions[j * 3];
            var dy = particlePositions[i * 3 + 1] - particlePositions[j * 3 + 1];
            var dz = particlePositions[i * 3 + 2] - particlePositions[j * 3 + 2];
            var dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            lineData.distance = dist;

            var particleDataA = particlesData[i];
            var particleDataB = particlesData[j];
            particleDataA.numConnections++;
            particleDataB.numConnections++;

            var elastic = (dist - _l) * _k;
            particleDataA.force.add(new THREE.Vector3(-dx, -dy, -dz).normalize().multiplyScalar(elastic));
            particleDataB.force.add(new THREE.Vector3(dx, dy, dz).normalize().multiplyScalar(elastic));
        }

        // 计算当前轮的速度、位移和样式
        for (var i = 0; i < particlesData.length; i++) {

            if (FIXED.indexOf(i) != -1) {
                particleColors[i * 3] = 2;
                particleColors[i * 3 + 1] = 1.5;
                particleColors[i * 3 + 2] = 0;

                selectedNodes.push(nodes[i]);
            } else if (i == CURSELECTED) {
                particleColors[i * 3] = 2;
                particleColors[i * 3 + 1] = 2;
                particleColors[i * 3 + 2] = 0;

                selectedNodes.push(nodes[i]);
            } else {
                var particleData = particlesData[i];
                particleData.speed.add(particleData.force.clone().divideScalar(_m));

                particlePositions[i * 3] += particleData.speed.x;
                particlePositions[i * 3 + 1] += particleData.speed.y;
                particlePositions[i * 3 + 2] += particleData.speed.z;

                particleColors[i * 3] = 2;
                particleColors[i * 3 + 1] = 2;
                particleColors[i * 3 + 2] = 2;
            }

            var p1 = new THREE.Vector3(particlePositions[i * 3], particlePositions[i * 3 + 1], particlePositions[i * 3 + 2]);
            var p2 = camera.position;
            var dist = p1.sub(p2).length();

            particleScales[i] = 1.3 * _r2 * _r2 / dist / dist;
        }

        // float panels
        fp.Select(selectedNodes);
    }

    function renderLines() {
        var vertexpos = 0;
        var numConnected = 0;
        var colorpos = 0;
        var notSelected = particleGroup.children.length == 0;
        var pointsArray = [];

        for (var k = 0; k < edges.length; k++) {
            var lineData = edges[k];
            var dist = lineData.distance;
            var i = objects[lineData.from].index;
            var j = objects[lineData.to].index;

            var alpha = (dist > 300) ? 0.01 : (0.1 - dist / 3000);
            alpha *= (particleScales[i] + particleScales[j]) / 2;
            if (alpha < 0.01) continue;

            linePositions[vertexpos++] = particlePositions[i * 3];
            linePositions[vertexpos++] = particlePositions[i * 3 + 1];
            linePositions[vertexpos++] = particlePositions[i * 3 + 2];

            linePositions[vertexpos++] = particlePositions[j * 3];
            linePositions[vertexpos++] = particlePositions[j * 3 + 1];
            linePositions[vertexpos++] = particlePositions[j * 3 + 2];

            lineColors[colorpos++] = alpha;
            lineColors[colorpos++] = alpha;
            lineColors[colorpos++] = alpha;

            lineColors[colorpos++] = alpha;
            lineColors[colorpos++] = alpha;
            lineColors[colorpos++] = alpha;

            numConnected++;

            if (CURSELECTED !== null && notSelected && (i === CURSELECTED || j === CURSELECTED)) {
                if (FIXED.indexOf(i) == -1 && i != CURSELECTED)
                    FIXED.push(i);
                if (FIXED.indexOf(j) == -1 && j != CURSELECTED)
                    FIXED.push(j);

                var path = new THREE.CatmullRomCurve3([
                    new THREE.Vector3(particlePositions[i * 3], particlePositions[i * 3 + 1], particlePositions[i * 3 + 2]),
                    new THREE.Vector3(particlePositions[j * 3], particlePositions[j * 3 + 1], particlePositions[j * 3 + 2])
                ]);
                var spGeometry = new THREE.TubeGeometry(path, 1, 2, 4, false);
                var spLine = new THREE.Mesh(spGeometry, NETWORK.Materials.SpecialLine);
                particleGroup.add(spLine);

                pointsArray.push(path.points);
            }
        }

        // special lines
        if (pointsArray.length > 0) {
            ps.Init(pointsArray);
        }


        linesMesh.geometry.setDrawRange(0, numConnected * 2);
    }

    function renderMarkers() {
        // marker, relative position and opacity
        for (var i = 0; i < nodes.length; i++) {
            var marker = nodes[i].marker;
            marker.element.style.opacity = particleScales[i];
            marker.element.style.visibility = (particleScales[i] < 0.65) ? "hidden" : "visible";

            marker.position.x = particlePositions[i * 3];
            marker.position.y = particlePositions[i * 3 + 1] - (5 + particleSizes[i] / 4);
            marker.position.z = particlePositions[i * 3 + 2];

            marker.lookAt(camera.position);
        }
    }

    function moveCamera(target) {
        target.x += 0.001;
        rotation.x += (target.x - rotation.x) * 0.1;
        rotation.y += (target.y - rotation.y) * 0.1;

        camera.position.x = camera_r * Math.sin(rotation.x) * Math.cos(rotation.y);
        camera.position.y = camera_r * Math.sin(rotation.y);
        camera.position.z = camera_r * Math.cos(rotation.x) * Math.cos(rotation.y);
        camera.lookAt(new THREE.Vector3(0, 0, 0));
    }

    return {
        Init: init,
        Select: select,
        Update: update
    };
};

/**
 * 用于显示选中线上的粒子效果，输入各条边的所有节点
 */
NETWORK.ParticleSystem = function (group) {

    var points;
    var lerpN;
    var particalCount;

    // moveIndex -> nextIndex
    var pathLink;

    var particlePositions, particleColors, particleSizes, particleScales, particleSystem;

    function clear() {
        points = [];
        pathLink = [];
        lerpN = 0;
        particalCount = 0;
    }

    function init(pointsArray) {

        clear();

        var pathStartIndex = 0,
            currentIndex = 0;

        // 插值
        pointsArray.forEach(function (element) {
            if (element.length != 2) return;

            var dx = element[1].x - element[0].x;
            var dy = element[1].y - element[0].y;
            var dz = element[1].z - element[0].z;
            var dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

            var insertCount = Math.floor(dist / 20);
            points.push(element[0].clone());
            for (var i = 0; i < insertCount; i++) {
                var x = element[0].x + (i + 1) * (dx / (insertCount + 1));
                var y = element[0].y + (i + 1) * (dy / (insertCount + 1));
                var z = element[0].z + (i + 1) * (dz / (insertCount + 1));

                points.push(new THREE.Vector3(x, y, z));
                currentIndex++;
                pathLink.push(currentIndex);
            }

            points.push(element[1].clone());
            currentIndex++;
            pathLink.push(currentIndex);

            currentIndex++;
            pathLink.push(pathStartIndex);
            pathStartIndex = currentIndex;

            particalCount += insertCount + 2;
        }, this);

        var particles = new THREE.BufferGeometry();
        particlePositions = new Float32Array(particalCount * 3);
        particleColors = new Float32Array(particalCount * 3);
        particleSizes = new Float32Array(particalCount);
        particleScales = new Float32Array(particalCount);

        for (var i = 0; i < particalCount; i++) {
            particlePositions[i * 3] = points[i].x;
            particlePositions[i * 3 + 1] = points[i].y;
            particlePositions[i * 3 + 2] = points[i].z;

            particleColors[i * 3] = 1;
            particleColors[i * 3 + 1] = 1;
            particleColors[i * 3 + 2] = 1;

            particleSizes[i] = 20.0;
            particleScales[i] = 1.0;
        }

        particles.addAttribute('position', new THREE.BufferAttribute(particlePositions, 3).setDynamic(true));
        particles.addAttribute('customColor', new THREE.BufferAttribute(particleColors, 3).setDynamic(true));
        particles.addAttribute('size', new THREE.BufferAttribute(particleSizes, 1).setDynamic(true));
        particles.addAttribute('scale', new THREE.BufferAttribute(particleScales, 1).setDynamic(true));
        particles.computeBoundingSphere();
        particles.setDrawRange(0, particalCount);

        particleSystem = new THREE.Points(particles, NETWORK.Materials.Particle);
        group.add(particleSystem);
    }

    function update() {
        if (group.children.length === 0 || particleSystem === undefined) return;

        lerpN += 0.05;
        if (lerpN > 1)
            lerpN = 0;

        for (var i = 0; i < particalCount; i++) {
            var currentPoint = points[i].clone();
            if (pathLink[i] > i)
                currentPoint.lerp(points[pathLink[i]], lerpN);

            particlePositions[i * 3] = currentPoint.x;
            particlePositions[i * 3 + 1] = currentPoint.y;
            particlePositions[i * 3 + 2] = currentPoint.z;

            particleColors[i * 3] = 2;
            particleColors[i * 3 + 1] = 2;
            particleColors[i * 3 + 2] = 0;

            particleSizes[i] = 10.0;
        }

        particleSystem.geometry.attributes.position.needsUpdate = true;
        particleSystem.geometry.attributes.customColor.needsUpdate = true;
        particleSystem.geometry.attributes.size.needsUpdate = true;
    }

    return {
        Init: init,
        Update: update,
        Clear: clear
    };
};

/**
 * 外层悬浮面板布局
 */
NETWORK.FloatPanel = function (container, mainCamera, heroes) {

    var camera, scene, renderer, group1, group2;
    var targets;
    var freeTime = 0;

    var tmpVec1 = new THREE.Vector3();
    var tmpVec2 = new THREE.Vector3();
    var tmpVec3 = new THREE.Vector3();
    var tmpVec4 = new THREE.Vector3();

    scene = new THREE.Scene();
    group1 = new THREE.Group();
    group2 = new THREE.Group();
    scene.add(group1);
    scene.add(group2);
    camera = new THREE.PerspectiveCamera(45, container.offsetWidth / container.offsetHeight, 1, 4000);
    camera.position.z = 1200;

    renderer = new THREE.CSS3DRenderer();
    renderer.setSize(container.offsetWidth, container.offsetHeight);
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = 0;
    container.appendChild(renderer.domElement);

    function clear() {
        freeTime = 0;
        targets = [];
        var cs = [];
        group1.children.forEach(function (child) {
            cs.push(child);
        }, this);
        cs.forEach(function (child) {
            group1.remove(child);
        }, this);
        cs = [];
        group2.children.forEach(function (child) {
            cs.push(child);
        }, this);
        cs.forEach(function (child) {
            group2.remove(child);
        }, this);
    }

    function select(objects) {
        clear();

        objects.forEach(function (e) {
            var element = document.createElement("div");
            element.className = "panel";

            var img = document.createElement("img");
            img.src = "images/th.jpg";
            element.appendChild(img);

            var span = document.createElement("span");
            span.innerText = e.name;
            element.appendChild(span);

            var cssObject = new THREE.CSS3DObject(element);
            group1.add(cssObject);

            var bond = document.createElement('div');
            bond.className = "bond";
            bond.style.height = "1px";

            var object2 = new THREE.CSS3DObject(bond);
            group2.add(object2);

            targets.push({
                point: e.marker.position,
                object: cssObject,
                bond: object2
            });
        }, this);
    }

    function update() {
        if (freeTime < 0) {
            freeTime++;

            if (freeTime == 0)
                clear();
        }
        if (targets === undefined || targets.length == 0) {
            freeTime++;

            if (freeTime > 500) {
                var index = Math.floor(heroes.length * Math.random()) % heroes.length;
                var index2 = Math.floor(heroes.length * Math.random()) % heroes.length;
                select([heroes[index], heroes[index2]]);

                freeTime = -250;
            }
            return;
        }
        targets.forEach(function (element) {
            var point = element.point.clone();
            point.project(mainCamera);

            var cssObject = element.object;
            cssObject.position.x = (point.x < 0) ? (-400 + 400 * point.x) : (400 + 400 * point.x);
            cssObject.position.y = 800 * point.y;
            if (cssObject.position.y > 320) cssObject.position.y = 320;
            else if (cssObject.position.y < -320) cssObject.position.y = -320;
            cssObject.position.z = 0.0;
            cssObject.lookAt(camera.position);

            var object2 = element.bond;
            var end = new THREE.Vector3(point.x * 600, point.y * 600, -10);
            var start = new THREE.Vector3(cssObject.position.x, cssObject.position.y, -50);
            tmpVec1.subVectors(start, end);
            var bondLength = tmpVec1.length() - 100;
            object2.element.style.height = bondLength + "px";

            object2.position.copy(start);
            object2.position.lerp(end, 0.5);

            var axis = tmpVec2.set(0, 1, 0).cross(tmpVec1);
            var radians = Math.acos(tmpVec3.set(0, 1, 0).dot(tmpVec4.copy(tmpVec1).normalize()));

            var objMatrix = new THREE.Matrix4().makeRotationAxis(axis.normalize(), radians);
            object2.matrix = objMatrix;
            object2.rotation.setFromRotationMatrix(object2.matrix, object2.rotation.order);

            object2.matrixAutoUpdate = false;
            object2.updateMatrix();
        }, this);

        renderer.render(scene, camera);
    }

    return {
        Clear: clear,
        Select: select,
        Update: update
    };
};

// main
(function () {
    var cssRenderer, cssScene, cssGroup1, cssGroup2;

    var webglRenderer, webglScene, webglGroup1, webglGroup2;

    var camera;

    var history, allHeroes, heroes, relations;

    var currentYear = "165";

    var globe;

    var controller = {
            x: -1000,
            y: -1000
        },
        mouse = {
            x: -1000,
            y: -1000
        },
        mouseOnDown = {
            x: 0,
            y: 0
        };

    var target = {
            x: Math.PI * 3 / 2,
            y: 0
        },
        targetOnDown = {
            x: 0,
            y: 0
        };

    var PI_HALF = Math.PI / 2;

    var raycaster;

    var container = document.getElementById('threejs-container');

    if (!Detector.webgl) Detector.addGetWebGLMessage();

    loadData("data/history.json", function (json1) {

        history = json1;
        loadData("data/heroes.json", function (json2) {

            allHeroes = json2;

            preprocess();
            initScene();
            animate();
        }, function (error2) {
            console.error(error2);
        });
    }, function (error1) {
        console.error(error1);
    });

    function loadData(url, success, fail) {
        var xmlHttp = new XMLHttpRequest();
        xmlHttp.open("GET", url);
        xmlHttp.send(null);
        xmlHttp.onreadystatechange = function () {
            if ((xmlHttp.readyState == 4)) {
                if (xmlHttp.status == 200) {
                    success(JSON.parse(xmlHttp.responseText));
                } else
                    fail(xmlHttp.status);
            }
        };
    }

    function preprocess() {
        var data = history[currentYear];
        if (data === undefined) {
            console.error(currentYear + "年不存在。");
        }

        heroes = data["heroes"];
        relations = data["relations"]
    }

    function initScene() {

        // container
        container.innerHTML = "";

        // css scene
        cssScene = new THREE.Scene();
        cssGroup1 = new THREE.Group();
        cssGroup2 = new THREE.Group();
        cssScene.add(cssGroup1);
        cssScene.add(cssGroup2);

        webglScene = new THREE.Scene();
        webglGroup1 = new THREE.Group();
        webglGroup2 = new THREE.Group();
        webglScene.add(webglGroup1);
        webglScene.add(webglGroup2);

        // light
        webglScene.add(new THREE.AmbientLight(0x444444));

        //camera
        camera = new THREE.PerspectiveCamera(45, container.offsetWidth / container.offsetHeight, 1, 4000);
        camera.position.z = 1200;

        //mouse
        raycaster = new THREE.Raycaster();
        raycaster.params.Points.threshold = 10;

        // globe
        globe = new NETWORK.Globe(container, webglGroup1, cssGroup1, camera, raycaster);
        globe.Init(heroes, relations);

        // webgl renderer
        webglRenderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });
        webglRenderer.gammaInput = true;
        webglRenderer.gammaOutput = true;
        webglRenderer.setPixelRatio(window.devicePixelRatio);
        webglRenderer.setSize(container.offsetWidth, container.offsetHeight);
        container.appendChild(webglRenderer.domElement);

        // css renderer
        cssRenderer = new THREE.CSS3DRenderer();
        cssRenderer.setSize(container.offsetWidth, container.offsetHeight);
        cssRenderer.domElement.style.position = 'absolute';
        cssRenderer.domElement.style.top = 0;
        container.appendChild(cssRenderer.domElement);

        // event
        container.addEventListener("mousedown", onMouseDown, false);
        window.addEventListener('resize', onWindowResize, false);
        document.addEventListener('mousemove', onDocumentMouseMove, false);
    }

    function onDocumentMouseMove(event) {
        mouse.x = (event.clientX / container.offsetWidth) * 2 - 1;
        mouse.y = -(event.clientY / container.offsetHeight) * 2 + 1;
    }

    function onMouseDown(event) {
        event.preventDefault();

        container.addEventListener('mousemove', onMouseMove, false);
        container.addEventListener('mouseup', onMouseUp, false);
        container.addEventListener('mouseout', onMouseOut, false);

        mouseOnDown.x = -event.clientX;
        mouseOnDown.y = event.clientY;

        controller.x = -event.clientX;
        controller.y = event.clientY;

        targetOnDown.x = target.x;
        targetOnDown.y = target.y;
    }

    function onMouseMove(event) {
        event.preventDefault();

        controller.x = -event.clientX;
        controller.y = event.clientY;

        target.x = targetOnDown.x + (controller.x - mouseOnDown.x) * 0.005;
        target.y = targetOnDown.y + (controller.y - mouseOnDown.y) * 0.005;

        target.y = target.y > PI_HALF ? PI_HALF : target.y;
        target.y = target.y < -PI_HALF ? -PI_HALF : target.y;
    }

    function onMouseUp(event) {
        if (Math.abs(mouseOnDown.x - controller.x) < 1 && Math.abs(mouseOnDown.y - controller.y) < 1)
            globe.Select();

        container.removeEventListener('mousemove', onMouseMove, false);
        container.removeEventListener('mouseup', onMouseUp, false);
        container.removeEventListener('mouseout', onMouseOut, false);
    }

    function onMouseOut(event) {
        container.removeEventListener('mousemove', onMouseMove, false);
        container.removeEventListener('mouseup', onMouseUp, false);
        container.removeEventListener('mouseout', onMouseOut, false);
    }

    function onWindowResize() {
        camera.aspect = container.offsetWidth / container.offsetHeight;
        camera.updateProjectionMatrix();
        cssRenderer.setSize(container.offsetWidth, container.offsetHeight);
        webglRenderer.setSize(container.offsetWidth, container.offsetHeight);
    }

    function animate() {

        raycaster.setFromCamera(mouse, camera);

        requestAnimationFrame(animate);

        render();
    }

    function render() {

        globe.Update(target);

        cssRenderer.render(cssScene, camera);
        webglRenderer.render(webglScene, camera);
    }
})();