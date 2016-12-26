/**
 * 立方体外的悬浮面板
 * 
 * @author wangjue / https://github.com/hanmag
 */

PanelGalaxy = function (container, mainCamera, heroes) {

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
    camera.position.z = 1800;

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