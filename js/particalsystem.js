/**
 * 用于显示选中线上的粒子效果，输入各条边的起点与终点
 * 
 * @author wangjue / https://github.com/hanmag
 */

ParticalSystem = function (group) {

    var points;
    var lerpN;
    var particalCount;

    // moveIndex -> nextIndex
    var pathLink;

    var particlePositions, particleColors, particleSizes, particalSystem;

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

            var insertCount = Math.floor(dist / 60);
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

        for (var i = 0; i < particalCount; i++) {
            particlePositions[i * 3] = points[i].x;
            particlePositions[i * 3 + 1] = points[i].y;
            particlePositions[i * 3 + 2] = points[i].z;

            particleColors[i * 3] = 2;
            particleColors[i * 3 + 1] = 2;
            particleColors[i * 3 + 2] = 0;

            particleSizes[i] = 30.0;
        }

        particles.addAttribute('position', new THREE.BufferAttribute(particlePositions, 3).setDynamic(true));
        particles.addAttribute('customColor', new THREE.BufferAttribute(particleColors, 3).setDynamic(true));
        particles.addAttribute('size', new THREE.BufferAttribute(particleSizes, 1).setDynamic(true));
        particles.computeBoundingSphere();
        particles.setDrawRange(0, particalCount);

        var uniforms = {
            color: {
                value: new THREE.Color(0xffffff)
            },
            texture: {
                value: new THREE.TextureLoader().load("images/sprites/particleA.png")
            }
        };

        var shaderMaterial = new THREE.ShaderMaterial({
            uniforms: uniforms,
            vertexShader: Shaders.point.vertexShader,
            fragmentShader: Shaders.point.fragmentShader,

            blending: THREE.AdditiveBlending,
            depthTest: false,
            transparent: true,
            // sizeAttenuation: true,
        });

        particalSystem = new THREE.Points(particles, shaderMaterial);
        group.add(particalSystem);
    }

    function update() {
        if (group.children.length === 0 || particalSystem === undefined) return;

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

            particleSizes[i] = 40.0;
        }

        particalSystem.geometry.attributes.position.needsUpdate = true;
        particalSystem.geometry.attributes.customColor.needsUpdate = true;
        particalSystem.geometry.attributes.size.needsUpdate = true;
    }

    return {
        Init: init,
        Update: update,
        Clear: clear
    };
};