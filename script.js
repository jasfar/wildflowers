var container, scene, camera, renderer;
var plants, prev, stemDir, stemIndex, numStemSegments, branchFactor, endCandidates, largestEnd, smallestEnd;

var material = new THREE.ShaderMaterial({
    vertexShader: document.getElementById('vertexShader').text,
    fragmentShader: document.getElementById('fragmentShader').text
});
var glowMaterial = new THREE.MeshBasicMaterial();
var materials = [material, glowMaterial];

var numPlants = 20;
var plantRange = 200;

var minStemSegments = 3;
var maxStemSegments = 18;
var startStemLen = 8;
var endStemLen = 0.6;
var startStemRadius = 0.3;
var endStemRadius = 2.5;
var stemAngle = 0.25;

var maxDepth = 3;
var branchChance = 0.65;
var doubleBranchChance = 0.5;
var startBranchLen = 0.8;
var endBranchLen = 0.5;
var startBranchRadius = 0.3;
var endBranchRadius = 0.1;
var startBranchAngle = 0.7;
var branchAngle = 0.3;

var flowerChance = 1;
var startFlowerLen = 2;
var endFlowerLen = 6;
var startFlowerAngle = 1;
var endFlowerAngle = 4;

var count = 0;
var windAngle = 0;
var camPosY = 30;
var camFocusY = 0;
var camRangeY = 30;
var camRangeZ = 30;
var newCamY = camPosY;
var newCamZ = 0;

var Controls = function() {
    this.numPlants = numPlants;
    this.reset = reset;
};

var StemControls = function() {
    this.maxSegments = maxStemSegments;
    this.startLength = startStemLen;
    this.endLength = endStemLen;
    this.startRadius = startStemRadius;
    this.endRadius = endStemRadius;
    this.angle = stemAngle;
};

var BranchControls = function() {
    this.maxDepth = maxDepth;
    this.chance = branchChance;
    this.doubleChance = doubleBranchChance;
    this.startLength = startBranchLen;
    this.endLength = endBranchLen;
    this.startRadius = startBranchRadius;
    this.endRadius = endBranchRadius;
    this.startAngle = Math.abs(startBranchAngle);
    this.angle = Math.abs(branchAngle);
};

var FlowerControls = function() {
    this.chance = flowerChance;
    this.startLength = startFlowerLen;
    this.endLength = endFlowerLen;
    this.startAngle = startFlowerAngle;
    this.endAngle = endFlowerAngle;
};

function init() {
    // CONTAINER
    container = document.createElement('div');
    document.body.appendChild(container);

    // SCENE
    scene = new THREE.Scene();

    // CAMERA
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 1000);
    camera.position.set(-115, camPosY, 0);

    // RENDERER
    renderer = new THREE.WebGLRenderer({
        antialias: true
    });
    renderer.setClearColor(0x000000);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    // GEOMETRY
    reset();

    // EVENT HANDLERS
    window.addEventListener('resize', onWindowResize, false);
    document.addEventListener('mousemove', onDocumentMouseMove, false);

    // GUI
    setupGUI();
}

function reset() {
    for (var i = scene.children.length - 1; i >= 0; i--) {
        var finished = scene.children[i];
        scene.remove(finished);
        finished.geometry.dispose();
        if (finished.material.materials) {
            finished.material.materials[0].dispose();
            finished.material.materials[1].dispose();
        } else {
            finished.material.dispose();
        }
    }

    plants = [];

    branchFactor = convertRange(maxDepth, 0, 10, 1.7, 1.2);

    endCandidates = [];
    largestEnd = smallestEnd = endStemRadius;
    endCandidates.push(endStemRadius);

    for (i = 0; i < numPlants; i++) {
        plants[i] = new Plant();
        plants[i].build();
    }
}

function convertRange(value, lower1, upper1, lower2, upper2) {
    return (value - lower1) * (upper2 - lower2) / (upper1 - lower1) + lower2;
}

function Plant() {
    this.build = function() {
        this.plant = [];
        this.plant[0] = new Segment(getStemAngle(), startStemLen, startStemRadius, null);

        var stemLenInc = (endStemLen - startStemLen) / (maxStemSegments - 1);
        var stemRadiusInc = (endStemRadius - startStemRadius) / (maxStemSegments - 1);
        numStemSegments = Math.round(random(minStemSegments - 1, maxStemSegments - 1));
        stemIndex = 0;

        while (stemIndex < numStemSegments) {
            for (var i = this.plant.length - 1; i >= 0; i--) {
                prev = this.plant[i];

                if (Math.random() < 0.5) {
                    startBranchAngle = -startBranchAngle;
                    branchAngle = -branchAngle;
                }

                if (!prev.isFinished) {
                    if (!prev.isStem && prev.depth <= maxDepth) {
                        if (Math.random() < branchChance) {
                            var branchLenInc = (endBranchLen - startBranchLen) / maxDepth * prev.parentStem.len;
                            var branchRadiusInc = (endBranchRadius - startBranchRadius) / maxDepth * prev.parentStem.radius;
                            var branch = prev.grow(branchAngle, branchLenInc, branchRadiusInc, checkIfFlower(true));
                            this.plant.push(branch);
                            branch.isStem = false;
                            branch.parentStem = prev.parentStem;
                            branch.depth = prev.depth + 1;
                            if (Math.random() < doubleBranchChance) {
                                var branch = prev.grow(-branchAngle, branchLenInc, 0, checkIfFlower(true));
                                this.plant.push(branch);
                                branch.isStem = false;
                                branch.parentStem = prev.parentStem;
                                branch.depth = prev.depth + 1;
                            }
                        } else {
                            if (Math.random() < flowerChance) {
                                prev.flower();
                            }
                        }
                    } else if (prev.isStem) {
                        var stem = prev.grow(getStemAngle(), stemLenInc, stemRadiusInc, checkIfFlower(false));
                        this.plant.push(stem);
                        if (Math.random() < branchChance) {
                            var startBranchLenInc = (prev.len * startBranchLen) - prev.len;
                            var startBranchRadiusInc = (prev.radius * startBranchRadius) - prev.radius;
                            var branch = prev.grow(startBranchAngle, startBranchLenInc, startBranchRadiusInc, checkIfFlower(true));
                            this.plant.push(branch);
                            branch.isStem = false;
                            branch.parentStem = prev;
                            branch.depth = prev.depth + 1;
                        }
                    }
                    prev.isFinished = true;
                }
            }
            stemIndex++;
        }
    };
}

function checkIfFlower(isBranch) {
    if (((prev.depth + 1 > maxDepth && isBranch) || stemIndex == numStemSegments - 1) && Math.random() < flowerChance) {
        return true;
    }
}

function random(a, b) {
    return THREE.Math.randFloat(a, b);
}

function getStemAngle() {
    count--;

    if (count <= 0) {
        count = 3;
        stemDir = Math.random();
    }

    if (stemDir > 0.5) {
        return stemAngle;
    } else {
        return -stemAngle;
    }
}

function Segment(angle, len, radius, isFlower, parent) {
    this.pos = new THREE.Vector3(random(-plantRange * 0.5, plantRange * 0.5), 0, random(-plantRange * 0.5, plantRange * 0.5));
    this.rot = 0;
    this.angle = angle;
    this.len = len;
    this.radius = radius;
    this.isFlower = isFlower;
    this.parent = parent;
    this.isFinished = false;
    this.isStem = true;
    this.parentStem = null;
    this.depth = 0;
    this.windForce = 0;
    this.blastForce = 0;

    var numPolys = Math.max(Math.round(this.radius * 5), 3);
    var mesh;

    this.build = function() {
        var meshes = [];

        var geometry = new THREE.SphereGeometry(this.radius, numPolys, numPolys, Math.PI, Math.PI, 2 * Math.PI);
        var childMesh = new THREE.Mesh(geometry);
        childMesh.rotation.x = Math.PI / 2;
        childMesh.position.set(0, len, 0);
        meshes.push(childMesh);

        geometry = new THREE.CylinderGeometry(this.radius, this.radius, this.len, numPolys * 2, 1);
        childMesh = new THREE.Mesh(geometry);
        childMesh.position.set(0, len / 2, 0);
        meshes.push(childMesh);

        geometry = new THREE.SphereGeometry(this.radius, numPolys, numPolys, Math.PI, Math.PI, 2 * Math.PI);
        childMesh = new THREE.Mesh(geometry);
        childMesh.rotation.x = Math.PI / 2;
        childMesh.rotation.y = Math.PI;
        meshes.push(childMesh);

        geometry = mergeMeshes(meshes);
        for (var i = 0; i < geometry.faces.length; i++) {
            geometry.faces[i].materialIndex = 0;
        }
        mesh = new THREE.Mesh(geometry, new THREE.MultiMaterial(materials));
        scene.add(mesh);

        if (this.isFlower) {
            this.flower();
        }
    };

    this.flower = function() {
        endCandidates.push(this.radius);

        for (var i = 0; i < endCandidates.length; i++) {
            if (endCandidates[i] > largestEnd) {
                largestEnd = endCandidates[i];
            }
            if (endCandidates[i] < smallestEnd) {
                smallestEnd = endCandidates[i];
            }
        }

        endCandidates = [smallestEnd, largestEnd];

        var progress = (this.radius - smallestEnd) / (largestEnd - smallestEnd);

        var flowerLen = startFlowerLen + ((endFlowerLen - startFlowerLen) * progress);
        var arcAngle = startFlowerAngle + ((endFlowerAngle - startFlowerAngle) * progress);

        var gap = this.radius * 0.75;
        var petalWidth = 0.25;
        var numPetals = Math.round((2 * Math.PI * (this.radius + gap + flowerLen)) * (arcAngle / (2 * Math.PI)) / (petalWidth * 3));

        if (numPetals > 0) {
            var startPetalWidth = ((2 * Math.PI * this.radius + gap) * (arcAngle / (2 * Math.PI)) / numPetals) * 0.8;

            var petalStart = random(0, Math.PI * 2);

            var meshes = [];

            for (i = 0; i <= numPetals; i++) {
                var petalLen = flowerLen + (Math.sin(petalStart + (i * 1.6)) * (flowerLen * 0.1));

                var geometry = new THREE.Geometry();

                geometry.merge(buildQuad(startPetalWidth, 0, petalWidth * 0.5, petalLen * 0.85));
                geometry.merge(buildQuad(petalWidth * 0.5, petalLen * 0.85, petalWidth, (petalLen * 0.85) + petalWidth));
                geometry.merge(buildQuad(petalWidth, (petalLen * 0.85) + petalWidth, petalWidth, petalLen + petalWidth));
                geometry.merge(buildQuad(petalWidth, petalLen + petalWidth, petalWidth * 0.5, petalLen + petalWidth + petalWidth));

                geometry.faces[2].materialIndex = 1;
                geometry.faces[3].materialIndex = 1;
                geometry.faces[6].materialIndex = 1;
                geometry.faces[7].materialIndex = 1;

                geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, this.radius + gap, 0));
                geometry.applyMatrix(new THREE.Matrix4().makeRotationY(3 * Math.PI / 2));
                geometry.applyMatrix(new THREE.Matrix4().makeRotationX((arcAngle / numPetals * i) - (arcAngle * 0.5)));

                var childMesh = new THREE.Mesh(geometry);
                childMesh.position.set(0, this.len, 0);
                meshes.push(childMesh);
            }

            var geometry = mergeMeshes(meshes);
            geometry.sortFacesByMaterialIndex();
            mesh.geometry.merge(geometry);
        }
    };

    this.grow = function(angleInc, lenInc, radiusInc, isFlower) {
        var newAngle = this.angle + angleInc;
        var newLen = this.len + lenInc;
        var newRadius = this.radius + radiusInc;
        var newSegment = new Segment(newAngle, newLen, newRadius, isFlower, this);
        return newSegment;
    };

    this.update = function() {
        this.blastForce += Math.sin(this.pos.x + windAngle) * (Math.sin(windAngle * 0.08) * 0.004);

        if (this.parent != null) {
            this.pos.x = this.parent.pos.x;
            this.pos.y = this.parent.pos.y + Math.cos(this.parent.rot) * this.parent.len;
            this.pos.z = this.parent.pos.z + Math.sin(this.parent.rot) * this.parent.len;

            if (!this.isStem) {
                this.windForce = this.parent.windForce * branchFactor;
            } else {
                this.windForce = this.parent.windForce;
            }
        }
        this.rot = this.angle + this.windForce + this.blastForce;

        mesh.position.set(this.pos.x, this.pos.y, this.pos.z);
        mesh.rotation.x = this.rot;
    };

    this.build();
}

function buildQuad(x1, y1, x2, y2) {
    var points = new THREE.Shape();
    points.moveTo(x1, y1);
    points.lineTo(-x1, y1);
    points.lineTo(-x2, y2);
    points.lineTo(x2, y2);
    return new THREE.ShapeGeometry(points);
}

function mergeMeshes(meshes) {
    var combined = new THREE.Geometry();

    for (var i = 0; i < meshes.length; i++) {
        meshes[i].updateMatrix();
        combined.merge(meshes[i].geometry, meshes[i].matrix);
    }

    return combined;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onDocumentMouseMove(event) {
    event.preventDefault();

    newCamY = camPosY + (event.clientY / window.innerHeight * camRangeY) - (camRangeY * 0.5);
    newCamZ = (event.clientX / window.innerWidth * camRangeZ) - (camRangeZ * 0.5);
}

function setupGUI() {
    var gui = new dat.GUI({
        load: {
            "numPlants": 10
        }
    });

    var controller = new Controls();
    gui.remember(controller);
    gui.add(controller, 'numPlants', 1, 50).step(1);

    var stemController = new StemControls();
    gui.remember(stemController);
    var f1 = gui.addFolder('Stem');
    f1.add(stemController, 'maxSegments', 3, 40);
    f1.add(stemController, 'startLength', 0.1, 15);
    f1.add(stemController, 'endLength', 0.1, 15);
    f1.add(stemController, 'startRadius', 0.1, 3);
    f1.add(stemController, 'endRadius', 0.1, 3);
    f1.add(stemController, 'angle', 0, Math.PI * 0.25);

    var branchController = new BranchControls();
    gui.remember(branchController);
    var f2 = gui.addFolder('Branch');
    f2.add(branchController, 'maxDepth', 0, 10).step(1);
    f2.add(branchController, 'chance', 0, 1);
    f2.add(branchController, 'doubleChance', 0, 1);
    f2.add(branchController, 'startLength', 0.1, 1);
    f2.add(branchController, 'endLength', 0.1, 1);
    f2.add(branchController, 'startRadius', 0.1, 1);
    f2.add(branchController, 'endRadius', 0.1, 1);
    f2.add(branchController, 'startAngle', 0, Math.PI * 0.5);
    f2.add(branchController, 'angle', 0, Math.PI * 0.25);

    var flowerController = new FlowerControls();
    gui.remember(flowerController);
    var f3 = gui.addFolder('Flower');
    f3.add(flowerController, 'chance', 0, 1);
    f3.add(flowerController, 'startLength', 0.1, 10);
    f3.add(flowerController, 'endLength', 0.1, 10);
    f3.add(flowerController, 'startAngle', 0.1, Math.PI * 2);
    f3.add(flowerController, 'endAngle', 0.1, Math.PI * 2);

    gui.add(controller, 'reset').onChange(function() {
        numPlants = controller.numPlants;

        maxStemSegments = stemController.maxSegments;
        startStemLen = stemController.startLength;
        endStemLen = stemController.endLength;
        startStemRadius = stemController.startRadius;
        endStemRadius = stemController.endRadius;
        stemAngle = stemController.angle;

        maxDepth = branchController.maxDepth;
        branchChance = branchController.chance;
        doubleBranchChance = branchController.doubleChance;
        startBranchLen = branchController.startLength;
        endBranchLen = branchController.endLength;
        startBranchRadius = branchController.startRadius;
        endBranchRadius = branchController.endRadius;
        startBranchAngle = branchController.startAngle;
        branchAngle = branchController.angle;

        flowerChance = flowerController.chance;
        startFlowerLen = flowerController.startLength;
        endFlowerLen = flowerController.endLength;
        startFlowerAngle = flowerController.startAngle;
        endFlowerAngle = flowerController.endAngle;
    });
}

function animate() {
    requestAnimationFrame(animate);

    render();
}

function render() {
    setCamera();

    windAngle += 0.045;

    for (var i = 0; i < plants.length; i++) {
        plants[i].plant[0].windForce = Math.sin(plants[i].plant[0].pos.x + windAngle) * ((0.4 + Math.sin(windAngle * 0.08)) * 0.06);
        for (var j = 0; j < plants[i].plant.length; j++) {
            plants[i].plant[j].update();
        }
    }

    renderer.render(scene, camera);
}

function setCamera() {
    camera.position.y += (newCamY - camera.position.y) * 0.2;
    camera.position.z += (newCamZ - camera.position.z) * 0.2;

    camera.rotation.y = 3 * Math.PI / 2;
    camera.lookAt(new THREE.Vector3(0, camFocusY, 0));
}

init();
animate();
