/**
 * 
 * @author wangjue / https://github.com/hanmag
 */

Globe = function (group, heroes) {

    // 粒子系统
    var particlePositions, particleColors, particleSizes;
    var pointCloud;
    var particlesData = [];

    // 球直径、半径
    var _r2 = 800;
    var _r = _r2 / 2;

    // 弹性系数，基础质量，临界长度, 摩擦系数
    var _k = 0.05,
        _m = 200,
        _l = 100,
        _f = 0.02;
    var _l2 = _l * _l;

    function init() {
        // all nodes count
        var particalCount = heroes.length;
        // particle attributes
        var particles = new THREE.BufferGeometry();
        particlePositions = new Float32Array(particalCount * 3);
        particleColors = new Float32Array(particalCount * 3);
        particleSizes = new Float32Array(particalCount);

        var color = new THREE.Color(0xffffff);
        var size = 20.0;

        for (var i = 0; i < particalCount; i++) {

            var hero = heroes[i];

            // position
            particlePositions[i * 3] = Math.random() * r - r / 2;
            particlePositions[i * 3 + 1] = Math.random() * r - r / 2;
            particlePositions[i * 3 + 2] = Math.random() * r - r / 2;

            // color
            switch (hero.flag) {
                case 1:
                    color = new THREE.Color(0xff0000);
                    break;
                case 2:
                    color = new THREE.Color(0x00ff00);
                    break;
                case 3:
                    color = new THREE.Color(0x0000ff);
                    break;
                case 4:
                    color = new THREE.Color(0x999999);
                    break;
                case 5:
                    color = new THREE.Color(0xffff00);
                    break;
                case 6:
                    color = new THREE.Color(0x00ffff);
                    break;
                case 7:
                    color = new THREE.Color(0xff00ff);
                    break;
                case 8:
                    color = new THREE.Color(0x0099ff);
                    break;
            }
            particleColors[i * 3] = color.r;
            particleColors[i * 3 + 1] = color.g;
            particleColors[i * 3 + 2] = color.b;

            // size
            switch (hero.level) {
                case "A":
                    size = 40.0;
                    break;
                case "B":
                    size = 30.0;
                    break;
                case "C":
                    size = 20.0;
                    break;
                case "D":
                    size = 10.0;
                    break;
            }
            particleSizes[i] = size;

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
        pointCloud.geometry.setDrawRange(0, particalCount);
        particles.computeBoundingSphere();

        // create the particle system
        pointCloud = new THREE.Points(particles, NodeMaterial);
        group.add(pointCloud);
    }

    function update() {
        pointCloud.geometry.attributes.position.needsUpdate = true;
    }

    return {
        Update: update
    };
};