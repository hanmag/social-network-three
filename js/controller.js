/**
 * 
 * @author wangjue / https://github.com/hanmag
 */

var mouse = {
        x: -1000,
        y: -1000
    },
    mouseOnDown = {
        x: 0,
        y: 0
    };
var rotation = {
        x: 0,
        y: 0
    },
    target = {
        x: Math.PI * 3 / 2,
        y: 0
    },
    targetOnDown = {
        x: 0,
        y: 0
    };

var PI_HALF = Math.PI / 2;

var SceneClicked;

var container = document.getElementById('threejs-container');
container.addEventListener("mousedown", onMouseDown, false);


function onMouseDown(event) {
    event.preventDefault();

    container.addEventListener('mousemove', onMouseMove, false);
    container.addEventListener('mouseup', onMouseUp, false);
    container.addEventListener('mouseout', onMouseOut, false);

    mouseOnDown.x = -event.clientX;
    mouseOnDown.y = event.clientY;

    mouse.x = -event.clientX;
    mouse.y = event.clientY;

    targetOnDown.x = target.x;
    targetOnDown.y = target.y;
}

function onMouseMove(event) {
    event.preventDefault();

    mouse.x = -event.clientX;
    mouse.y = event.clientY;

    target.x = targetOnDown.x + (mouse.x - mouseOnDown.x) * 0.005;
    target.y = targetOnDown.y + (mouse.y - mouseOnDown.y) * 0.005;

    target.y = target.y > PI_HALF ? PI_HALF : target.y;
    target.y = target.y < -PI_HALF ? -PI_HALF : target.y;
}

function onMouseUp(event) {
    container.removeEventListener('mousemove', onMouseMove, false);
    container.removeEventListener('mouseup', onMouseUp, false);
    container.removeEventListener('mouseout', onMouseOut, false);

    if (Math.abs(mouseOnDown.x - mouse.x) < 1 && Math.abs(mouseOnDown.y - mouse.y) < 1)
        SceneClicked();
}

function onMouseOut(event) {
    container.removeEventListener('mousemove', onMouseMove, false);
    container.removeEventListener('mouseup', onMouseUp, false);
    container.removeEventListener('mouseout', onMouseOut, false);
}

function onDocumentMouseMove(event) {
    mouse.x = (event.clientX / container.offsetWidth) * 2 - 1;
    mouse.y = -(event.clientY / container.offsetHeight) * 2 + 1;
}