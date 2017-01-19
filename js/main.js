(function () {
    if (!Detector.webgl) Detector.addGetWebGLMessage();

    var container = document.getElementById('threejs-container');

    function initScene() {
        container.innerHTML = "";
    }

    function animate() {
        render();
    }

    function render() {}
})();