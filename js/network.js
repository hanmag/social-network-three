
var NETWORK = NETWORK || {};

// define Shaders and Materials
(function () {
    var node_uniforms = {
        color: {
            value: new THREE.Color(0xffffff)
        },
        texture: {
            value: new THREE.TextureLoader().load("../css/images/spark1.png")
        },
        texture2: {
            value: new THREE.TextureLoader().load("../css/images/spark2.png")
        }
    };

    var particle_uniforms = {
        color: {
            value: new THREE.Color(0xffffff)
        },
        texture: {
            value: new THREE.TextureLoader().load("../css/images/particleA.png")
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
            'opacity = scale * 1.1;',
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

NETWORK.Globe = function (webglGroup, cssGroup, camera, raycaster, target) {

    // 数据
    var nodes, edges;
    var objects = {};

    // 粒子系统
    var particlePositions, particleColors, particleSizes, particleScales, particleImportances;
    var pointCloud;
    var particlesData = [];

    // 线段相关
    var linePositions, lineColors;
    var linesMesh;

    // 球直径、半径
    var _r2 = 800;
    var _r = _r2 / 2;
    var PI_HALF = Math.PI / 2;

    // 弹性系数，基础质量，临界长度, 摩擦系数
    var _k = 0.15,
        _m = 200,
        _l = 50,
        _f = 0.15;

    // 相机位置与旋转
    var camera_r = camera.position.length();
    var rotation = {
        x: 0,
        y: 0
    };

    var INTERSECTED = null,
        CURSELECTED = null,
        FIXED = [];

    var ps, fp, particleGroup, floatGroup;

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
        cssGroup.children.forEach(function (child) {
            if (child !== floatGroup)
                cs.push(child);
        }, this);
        cs.forEach(function (child) {
            cssGroup.remove(child);
        }, this);

        if (ps !== undefined)
            ps.Clear();
        if (fp !== undefined)
            fp.Clear();

        if (pointCloud !== undefined) {
            pointCloud.geometry.setDrawRange(0, 0);
            pointCloud = undefined;
        }
    }

    function init(heroes, relations) {

        clear();

        nodes = heroes;
        edges = relations;

        particleGroup = new THREE.Group();
        webglGroup.add(particleGroup);
        ps = new NETWORK.ParticleSystem(particleGroup);
        floatGroup = new THREE.Group();
        cssGroup.add(floatGroup);
        fp = new NETWORK.FloatPanel(floatGroup, camera, heroes);

        initData(nodes, edges);

        initScene();
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
            cssObject.anchor = new THREE.Vector3(0, 0, 0);
            nodes[i].marker = cssObject;
            cssGroup.add(cssObject);
        }

        edges.forEach(function (element) {
            objects[element.source].numConnections++;
            objects[element.target].numConnections++;
            element.type = element.isTarget ? 1 : 2;
        }, this);
    }

    function initScene() {
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
        particleImportances = new Float32Array(particalCount);

        var color = new THREE.Color(0xffffff);
        var size = 30.0;

        for (var i = 0; i < particalCount; i++) {
            // position
            particlePositions[i * 3] = Math.random() * _r2 - _r;
            particlePositions[i * 3 + 1] = Math.random() * _r2 - _r;
            particlePositions[i * 3 + 2] = Math.random() * _r2 - _r;

            // color
            particleColors[i * 3] = 0.6;
            particleColors[i * 3 + 1] = 1.2;
            particleColors[i * 3 + 2] = 1.25;

            // size
            particleSizes[i] = size;
            particleScales[i] = 1.0;
            particleImportances[i] = nodes[i].isTarget ? 1 : -1;

            // extra attributes
            particlesData.push({
                force: new THREE.Vector3(0, 0, 0),
                speed: new THREE.Vector3(0, 0, 0),
                numConnections: 0
            });
        }

        //add Attribute
        particles.addAttribute('position', new THREE.BufferAttribute(particlePositions, 3).setDynamic(true));
        particles.addAttribute('customColor', new THREE.BufferAttribute(particleColors, 3).setDynamic(true));
        particles.addAttribute('size', new THREE.BufferAttribute(particleSizes, 1));
        particles.addAttribute('scale', new THREE.BufferAttribute(particleScales, 1).setDynamic(true));
        particles.addAttribute('importance', new THREE.BufferAttribute(particleImportances, 1));
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

        if (CURSELECTED != null) {
            particleColors[CURSELECTED * 3] = 0.6;
            particleColors[CURSELECTED * 3 + 1] = 1.2;
            particleColors[CURSELECTED * 3 + 2] = 1.25;

            fp.Clear();
        }

        CURSELECTED = INTERSECTED;

        locate(CURSELECTED);
    }

    function update() {
        if (pointCloud === undefined) return;

        var intersects = raycaster.intersectObject(pointCloud);
        if (intersects.length > 0) {
            if (INTERSECTED != intersects[0].index) {
                if (INTERSECTED !== null && CURSELECTED !== INTERSECTED) {
                    particleColors[INTERSECTED * 3] = 0.6;
                    particleColors[INTERSECTED * 3 + 1] = 1.2;
                    particleColors[INTERSECTED * 3 + 2] = 1.25;
                }
                INTERSECTED = intersects[0].index;
                particleColors[INTERSECTED * 3] = 2;
                particleColors[INTERSECTED * 3 + 1] = 2;
                particleColors[INTERSECTED * 3 + 2] = 0;
            }
        } else {
            if (CURSELECTED !== INTERSECTED) {
                particleColors[INTERSECTED * 3] = 0.6;
                particleColors[INTERSECTED * 3 + 1] = 1.2;
                particleColors[INTERSECTED * 3 + 2] = 1.25;
            }
            INTERSECTED = null;
        }

        renderPoints();
        renderLines();
        renderMarkers();

        ps.Update();
        fp.Update();

        moveCamera();

        pointCloud.geometry.attributes.position.needsUpdate = true;
        pointCloud.geometry.attributes.customColor.needsUpdate = true;
        pointCloud.geometry.attributes.scale.needsUpdate = true;
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
            if (particleData.speed.length() > 1)
                particleData.force.add(particleData.speed.clone().normalize().multiplyScalar(-1 * _f * _m));
        }

        for (var i = 0; i < particlesData.length; i++) {
            var particleDataA = particlesData[i];
            var ax = particlePositions[i * 3];
            var ay = particlePositions[i * 3 + 1];
            var az = particlePositions[i * 3 + 2];

            var dist = Math.sqrt(ax * ax + ay * ay + az * az);

            // 计算中心点的弹力
            var elastic = (dist - _r) * _k * 20;
            particleDataA.force.add(new THREE.Vector3(-ax, -ay, -az).normalize().multiplyScalar(elastic));

            // 不得超出球面太远
            if (dist > 1.2 * _r) {
                particleDataA.speed.set(0, 0, 0);
            }

            // 计算所有节点之间的默认斥力
            for (var j = i + 1; j < particlesData.length; j++) {
                var particleDataB = particlesData[j];
                var dx = ax - particlePositions[j * 3];
                var dy = ay - particlePositions[j * 3 + 1];
                var dz = az - particlePositions[j * 3 + 2];
                var distp = dx * dx + dy * dy + dz * dz;
                var push = 50000 / distp;
                particleDataA.force.add(new THREE.Vector3(dx, dy, dz).normalize().multiplyScalar(push));
                particleDataB.force.add(new THREE.Vector3(-dx, -dy, -dz).normalize().multiplyScalar(push));
            }
        }

        // 计算节点间边的弹力
        for (var k = 0; k < edges.length; k++) {
            var lineData = edges[k];
            var i = objects[lineData.source].index;
            var j = objects[lineData.target].index;

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
            var scale_rate = 1.2;
            if (FIXED.indexOf(i) != -1) {
                selectedNodes.push(nodes[i]);
                scale_rate = 1.5;
            } else if (i == CURSELECTED) {
                selectedNodes.push(nodes[i]);
                scale_rate = 1.8;
            } else {
                var particleData = particlesData[i];
                particleData.speed.add(particleData.force.clone().divideScalar(_m));

                particlePositions[i * 3] += particleData.speed.x;
                particlePositions[i * 3 + 1] += particleData.speed.y;
                particlePositions[i * 3 + 2] += particleData.speed.z;

                if (CURSELECTED !== null)
                    scale_rate = 0.75;
            }

            var p1 = new THREE.Vector3(particlePositions[i * 3], particlePositions[i * 3 + 1], particlePositions[i * 3 + 2]);
            var p2 = camera.position;
            var dist = p1.sub(p2).length();

            particleScales[i] = scale_rate * _r2 * _r2 / dist / dist;
        }

        // float panels
        if (selectedNodes.length > 0)
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
            var i = objects[lineData.source].index;
            var j = objects[lineData.target].index;

            var color_r = 0.25 * 1.42;
            var color_g = 0.25 * 2.44;
            var color_b = 0.25 * 1.76;

            if (lineData.type != 1) {
                color_r = 0.25 * 2.49;
                color_g = 0.25 * 0.88;
                color_b = 0.25 * 0.79;
            }

            var p1 = new THREE.Vector3(particlePositions[i * 3], particlePositions[i * 3 + 1], particlePositions[i * 3 + 2]);
            var p2 = new THREE.Vector3(particlePositions[j * 3], particlePositions[j * 3 + 1], particlePositions[j * 3 + 2]);

            if (CURSELECTED !== null && notSelected && (i === CURSELECTED || j === CURSELECTED)) {
                if (FIXED.indexOf(i) == -1 && i != CURSELECTED)
                    FIXED.push(i);
                if (FIXED.indexOf(j) == -1 && j != CURSELECTED)
                    FIXED.push(j);

                var points, spGeometry;
                var normal = (new THREE.Vector3()).subVectors(p1, p2);
                var pDistance = normal.length();
                if (pDistance < _r / 2) {
                    var path = new THREE.CatmullRomCurve3([p1, p2]);
                    points = path.points;
                    spGeometry = new THREE.TubeGeometry(path, 1, 8, 8, false);
                }
                else {
                    var mid = p1.clone().lerp(p2, 0.5);
                    var midLength = mid.length();
                    mid.normalize();
                    mid.multiplyScalar(midLength + pDistance * 0.5);
                    normal.normalize();
                    var midStart = mid.clone().add(normal.clone().multiplyScalar(pDistance / 2));
                    var midEnd = mid.clone().add(normal.clone().multiplyScalar(-pDistance / 2));
                    var curveA = new THREE.CubicBezierCurve3(p1, p1, midStart, mid);
                    var curveB = new THREE.CubicBezierCurve3(mid, midEnd, p2, p2);
                    var points = curveA.getPoints(8);
                    points = points.splice(0, points.length - 1);
                    points = points.concat(curveB.getPoints(8));
                    spGeometry = new THREE.CurvePath().createGeometry(points);
                }

                var meterial = NETWORK.Materials.SpecialLine.clone();
                meterial.color = new THREE.Color(color_r, color_g, color_b);
                var spLine = new THREE.Mesh(spGeometry, meterial);
                particleGroup.add(spLine);

                pointsArray.push({ "points": points, "colors": [color_r, color_g, color_b] });
            }

            var alpha = (dist > 600) ? 0.1 : (0.28 - dist / 6000);
            alpha *= (particleScales[i] + particleScales[j]) / 2;
            if (alpha < 0.12) continue;

            linePositions[vertexpos++] = p1.x;
            linePositions[vertexpos++] = p1.y;
            linePositions[vertexpos++] = p1.z;

            linePositions[vertexpos++] = p2.x;
            linePositions[vertexpos++] = p2.y;
            linePositions[vertexpos++] = p2.z;

            lineColors[colorpos++] = 4 * alpha * color_r;
            lineColors[colorpos++] = 4 * alpha * color_g;
            lineColors[colorpos++] = 4 * alpha * color_b;
            lineColors[colorpos++] = 4 * alpha * color_r;
            lineColors[colorpos++] = 4 * alpha * color_g;
            lineColors[colorpos++] = 4 * alpha * color_b;

            numConnected++;
        }

        // special lines
        if (pointsArray.length > 0) {
            ps.Init(pointsArray);
        }

        linesMesh.geometry.setDrawRange(0, numConnected * 2);
    }

    function renderMarkers() {
        var seeableScale = 1200 / camera_r;
        // marker, relative position and opacity
        for (var i = 0; i < nodes.length; i++) {
            var marker = nodes[i].marker;
            marker.element.style.opacity = particleScales[i];
            marker.element.style.visibility = (particleScales[i] < seeableScale) ? "hidden" : "visible";

            marker.position.x = particlePositions[i * 3];
            marker.position.y = particlePositions[i * 3 + 1] - (5 + particleSizes[i]);
            marker.position.z = particlePositions[i * 3 + 2];
            marker.anchor.set(particlePositions[i * 3], particlePositions[i * 3 + 1], particlePositions[i * 3 + 2]);

            marker.lookAt(camera.position);
        }
    }

    function moveCamera() {
        if (INTERSECTED == null && CURSELECTED == null)
            target.x += 0.01;
        rotation.x += (target.x - rotation.x) * 0.1;
        rotation.y += (target.y - rotation.y) * 0.1;

        camera.position.x = camera_r * Math.sin(rotation.x) * Math.cos(rotation.y);
        camera.position.y = camera_r * Math.sin(rotation.y);
        camera.position.z = camera_r * Math.cos(rotation.x) * Math.cos(rotation.y);
        camera.lookAt(new THREE.Vector3(0, 0, 0));
    }

    function locate(targetId) {
        if (targetId === null || targetId === undefined)
            return;

        var p = new THREE.Vector3(particlePositions[targetId * 3], particlePositions[targetId * 3 + 1], particlePositions[targetId * 3 + 2]);
        p.normalize();

        var y = Math.asin(p.y);
        var x = Math.atan(p.x / p.z);

        console.log(target.x, target.y, x, y);
        if (target.x < 0)
            x += Math.PI;
        if (x < 0 || y < 0)
            x += Math.PI;

        target.x = x;
        target.y = y;


    }

    function handleWheel(delta) {
        camera_r -= delta * 10;
        if (camera_r > 1400)
            camera_r = 1400;
        if (camera_r < 1200)
            camera_r = 1200;
    }

    return {
        Init: init,
        Select: select,
        Update: update,
        HandleWheel: handleWheel
    };
};

/**
 * 用于显示选中线上的粒子效果，输入各条边的节点和颜色
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
            if (element.points.length < 2) return;

            for (var k = 0; k < element.points.length - 1; k++) {
                var dx = element.points[k + 1].x - element.points[k].x;
                var dy = element.points[k + 1].y - element.points[k].y;
                var dz = element.points[k + 1].z - element.points[k].z;
                var dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

                var insertCount = Math.floor(dist / 20);
                points.push({ "position": element.points[k].clone(), "colors": element.colors });
                for (var i = 0; i < insertCount; i++) {
                    var x = element.points[k].x + (i + 1) * (dx / (insertCount + 1));
                    var y = element.points[k].y + (i + 1) * (dy / (insertCount + 1));
                    var z = element.points[k].z + (i + 1) * (dz / (insertCount + 1));

                    points.push({ "position": new THREE.Vector3(x, y, z), "colors": element.colors });
                    currentIndex++;
                    pathLink.push(currentIndex);
                }

                points.push({ "position": element.points[k + 1].clone(), "colors": element.colors });
                currentIndex++;
                pathLink.push(currentIndex);

                currentIndex++;
                pathLink.push(pathStartIndex);
                pathStartIndex = currentIndex;

                particalCount += insertCount + 2;
            }
        }, this);

        var particles = new THREE.BufferGeometry();
        particlePositions = new Float32Array(particalCount * 3);
        particleColors = new Float32Array(particalCount * 3);
        particleSizes = new Float32Array(particalCount);
        particleScales = new Float32Array(particalCount);

        for (var i = 0; i < particalCount; i++) {
            particlePositions[i * 3] = points[i].position.x;
            particlePositions[i * 3 + 1] = points[i].position.y;
            particlePositions[i * 3 + 2] = points[i].position.z;

            particleColors[i * 3] = points[i].colors[0];
            particleColors[i * 3 + 1] = points[i].colors[1];
            particleColors[i * 3 + 2] = points[i].colors[2];

            particleSizes[i] = 10.0;
            particleScales[i] = 1.0;
        }

        particles.addAttribute('position', new THREE.BufferAttribute(particlePositions, 3).setDynamic(true));
        particles.addAttribute('customColor', new THREE.BufferAttribute(particleColors, 3));
        particles.addAttribute('size', new THREE.BufferAttribute(particleSizes, 1));
        particles.addAttribute('scale', new THREE.BufferAttribute(particleScales, 1).setDynamic(true));
        particles.computeBoundingSphere();
        particles.setDrawRange(0, particalCount);

        particleSystem = new THREE.Points(particles, NETWORK.Materials.Particle);
        group.add(particleSystem);
    }

    function update() {
        if (group.children.length === 0 || particleSystem === undefined) return;

        lerpN += 0.15;
        if (lerpN > 1)
            lerpN = 0;

        for (var i = 0; i < particalCount; i++) {
            var currentPoint = points[i].position.clone();
            if (pathLink[i] > i)
                currentPoint.lerp(points[pathLink[i]].position, lerpN);

            particlePositions[i * 3] = currentPoint.x;
            particlePositions[i * 3 + 1] = currentPoint.y;
            particlePositions[i * 3 + 2] = currentPoint.z;

            particleScales[i] = 1.5;
        }

        particleSystem.geometry.attributes.position.needsUpdate = true;
        particleSystem.geometry.attributes.scale.needsUpdate = true;
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
NETWORK.FloatPanel = function (group, camera, heroes) {

    var targets;
    var freeTime = 0;

    var tmpVec1 = new THREE.Vector3();
    var tmpVec2 = new THREE.Vector3();
    var tmpVec3 = new THREE.Vector3();
    var tmpVec4 = new THREE.Vector3();

    function clear() {
        freeTime = 0;
        targets = [];
        var cs = [];
        group.children.forEach(function (child) {
            cs.push(child);
        }, this);
        cs.forEach(function (child) {
            group.remove(child);
        }, this);
    }

    function select(objects) {
        clear();

        objects.forEach(function (e) {
            var element = document.createElement("div");
            element.className = "panel";

            var img = document.createElement("img");
            img.src = "../css/images/th.jpg";
            element.appendChild(img);

            var span = document.createElement("span");
            span.innerText = e.name;
            element.appendChild(span);

            var cssObject = new THREE.CSS3DObject(element);
            group.add(cssObject);

            var bond = document.createElement('div');
            bond.className = "bond2";
            bond.style.height = "1px";

            var object2 = new THREE.CSS3DObject(bond);
            group.add(object2);

            targets.push({
                point: e.marker.anchor,
                object: cssObject,
                bond: object2,
                isTarget: e.isTarget
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

            if (freeTime > 100) {
                var n = Math.floor(Math.random() * 5 + 4);
                var arrays = [];
                for (var i = 0; i < n; i++) {
                    var index = Math.floor(heroes.length * Math.random()) % heroes.length;
                    arrays.push(heroes[index]);
                }
                select(arrays);

                freeTime = -200;
            }
            return;
        }

        targets.forEach(function (element) {
            var point = element.point.clone();
            var len = point.length();
            var dis = point.clone().sub(camera.position).length();
            var projectP = point.clone().normalize().multiplyScalar(len + (dis * 0.2));

            var cssObject = element.object;
            cssObject.position.x = projectP.x;
            // if (cssObject.position.x > 500) cssObject.position.x = 500;
            // else if (cssObject.position.x < -500) cssObject.position.x = -500;
            cssObject.position.y = projectP.y;
            // if (cssObject.position.y > 300) cssObject.position.y = 300;
            // else if (cssObject.position.y < -300) cssObject.position.y = -300;
            cssObject.position.z = projectP.z;
            cssObject.lookAt(camera.position);

            var object2 = element.bond;
            var end = new THREE.Vector3(point.x, point.y, point.z);
            var start = new THREE.Vector3(cssObject.position.x, cssObject.position.y, cssObject.position.z - 10);

            tmpVec1.subVectors(start, end);
            var bondLength = tmpVec1.length() - 5;
            object2.element.style.height = bondLength + "px";
            object2.position.copy(start);
            object2.position.lerp(end, 0.5);

            if (dis > 1200) {
                cssObject.element.style.opacity = 0.5;
                object2.element.style.opacity = 0.3;
            }
            else {
                cssObject.element.style.opacity = 1.0;
                object2.element.style.opacity = 0.6;
            }

            if (element.isTarget) {
                cssObject.element.className = "important";
                object2.element.className = "bond1"
            } else {
                cssObject.element.className = "panel";
                object2.element.className = "bond2"
            }

            var axis = tmpVec2.set(0, 1, 0).cross(tmpVec1);
            var radians = Math.acos(tmpVec3.set(0, 1, 0).dot(tmpVec4.copy(tmpVec1).normalize()));

            var objMatrix = new THREE.Matrix4().makeRotationAxis(axis.normalize(), radians);
            object2.matrix = objMatrix;
            object2.rotation.setFromRotationMatrix(object2.matrix, object2.rotation.order);

            object2.matrixAutoUpdate = false;
            object2.updateMatrix();
        }, this);
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

    var history, heroes, relations;

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

    loadData(servers + "telConn", function (json1) {

        history = json1;

        preprocess();
        initScene();
        animate();
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
        heroes = history["nodes"];
        relations = history["links"]
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
        camera.position.z = 1300;

        //mouse
        raycaster = new THREE.Raycaster();
        raycaster.params.Points.threshold = 10;

        // globe
        globe = new NETWORK.Globe(webglGroup1, cssGroup1, camera, raycaster, target);
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
        container.addEventListener("mousewheel", onMouseWheel, false);
        window.addEventListener('resize', onWindowResize, false);
        document.addEventListener('mousemove', onDocumentMouseMove, false);
    }

    function onDocumentMouseMove(event) {
        mouse.x = ((event.clientX - $('#threejs-container').offset().left) / container.offsetWidth) * 2 - 1;
        mouse.y = -((event.clientY - $('#threejs-container').offset().top) / container.offsetHeight) * 2 + 1;
    }

    function onMouseWheel(event) {
        var delta = 0;
        if (event.wheelDelta) {
            delta = event.wheelDelta / 120;
        }
        else if (event.detail) {
            delta = -event.wheelDelta / 3;
        }
        if (delta) {
            globe.HandleWheel(delta);
        }
        event.returnValue = false;
    }

    function onMouseDown(event) {
        event.preventDefault();

        document.addEventListener('mousemove', onMouseMove, false);
        document.addEventListener('mouseup', onMouseUp, false);
        document.addEventListener('mouseout', onMouseOut, false);

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

        target.x = targetOnDown.x + (controller.x - mouseOnDown.x) * 0.01;
        target.y = targetOnDown.y + (controller.y - mouseOnDown.y) * 0.01;

        target.y = target.y > PI_HALF ? PI_HALF : target.y;
        target.y = target.y < -PI_HALF ? -PI_HALF : target.y;
    }

    function onMouseUp(event) {
        if (Math.abs(mouseOnDown.x - controller.x) < 1 && Math.abs(mouseOnDown.y - controller.y) < 1)
            globe.Select();

        document.removeEventListener('mousemove', onMouseMove, false);
        document.removeEventListener('mouseup', onMouseUp, false);
        document.removeEventListener('mouseout', onMouseOut, false);
    }

    function onMouseOut(event) {
        document.removeEventListener('mousemove', onMouseMove, false);
        document.removeEventListener('mouseup', onMouseUp, false);
        document.removeEventListener('mouseout', onMouseOut, false);
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

        globe.Update();

        cssRenderer.render(cssScene, camera);
        webglRenderer.render(webglScene, camera);
    }
})();