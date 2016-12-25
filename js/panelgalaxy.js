/**
 * 立方体外的悬浮面板
 * 
 * @author wangjue / https://github.com/hanmag
 */

PanelGalaxy = function (container, mainCamera) {

    var camera, scene, renderer;
    var targets;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, container.offsetWidth / container.offsetHeight, 1, 4000);
    camera.position.z = 1800;

    renderer = new THREE.CSS3DRenderer();
    renderer.setSize(container.offsetWidth, container.offsetHeight);
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = 0;
    container.appendChild(renderer.domElement);

    function clear() {
        targets = [];
        var cs = [];
        scene.children.forEach(function (child) {
            cs.push(child);
        }, this);
        cs.forEach(function (child) {
            scene.remove(child);
        }, this);
    }

    function select(objects) {
        clear();

        objects.forEach(function (e) {
            var element = document.createElement("div");
            element.className = "panel";
            element.innerHTML = e.name;

            var cssObject = new THREE.CSS3DObject(element);
            scene.add(cssObject);

            targets.push({
                point: e.marker.position,
                object: cssObject
            });
        }, this);
    }

    function update() {
        if (targets === undefined || targets.length == 0) return;
        targets.forEach(function (element) {
            var point = element.point.clone();
            point.sub(mainCamera.position);

            var cssObject = element.object;
            cssObject.position.x = point.x / 2;
            cssObject.position.y = point.y / 2;
            cssObject.position.z = 0.0;

            cssObject.lookAt(camera.position);
        }, this);

        renderer.render(scene, camera);
    }

    // select([new THREE.Vector3(90, 90, 90)]);

    return {
        Clear: clear,
        Select: select,
        Update: update
    };
};