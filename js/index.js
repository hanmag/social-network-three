/**
 * 
 * @author wangjue / https://github.com/hanmag
 */

(function () {

    var cssRenderer, cssScene, cssGroup1, cssGroup2;

    var webglRenderer, webglScene, webglGroup1, webglGroup2;

    var camera;

    var history, allHeroes, heroes, relations;

    var currentYear = "165";

    var globe;

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

        // globe
        globe = new Globe(webglGroup1, cssGroup1, camera);
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

        globe.Update();

        cssRenderer.render(cssScene, camera);
        webglRenderer.render(webglScene, camera);
    }
})();