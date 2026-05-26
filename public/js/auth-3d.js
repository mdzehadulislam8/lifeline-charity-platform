/**
 * Auth 3D Animation - Three.js
 * Creates animated 3D background for login/signup pages
 */

let authScene, authCamera, authRenderer;
let authAnimationFrameId;

function initAuth3D() {
    const canvas = document.getElementById('authCanvas');
    if (!canvas) return;

    // Scene setup
    authScene = new THREE.Scene();
    authScene.background = null;
    authScene.fog = new THREE.Fog(0x1a1f28, 100, 1000);

    // Camera
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    authCamera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    authCamera.position.z = 5;

    // Renderer
    authRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    authRenderer.setSize(width, height);
    authRenderer.setPixelRatio(window.devicePixelRatio);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    authScene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xff6b6b, 0.6);
    directionalLight.position.set(10, 20, 10);
    authScene.add(directionalLight);

    const pointLight = new THREE.PointLight(0xf39c12, 0.4);
    pointLight.position.set(-10, -10, 10);
    authScene.add(pointLight);

    // Create animated auth elements
    createAuthElements();

    // Handle window resize
    window.addEventListener('resize', onAuthWindowResize);

    // Mouse tracking for parallax
    document.addEventListener('mousemove', onAuthMouseMove);

    // Start animation loop
    authAnimate();
}

function createAuthElements() {
    // Create floating geometric shapes
    const group = new THREE.Group();

    // Rotating cube with gradient material
    const cubeGeometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    const cubeMaterial = new THREE.MeshPhongMaterial({
        color: 0xd32f2f,
        emissive: 0x8b0000,
        shininess: 100,
        wireframe: false
    });
    const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
    cube.position.set(-3, 0, 0);
    cube.userData = {
        rotationSpeed: { x: 0.005, y: 0.008, z: 0.003 },
        floatSpeed: 0.002,
        initialY: cube.position.y
    };
    group.add(cube);

    // Floating sphere
    const sphereGeometry = new THREE.IcosahedronGeometry(1, 4);
    const sphereMaterial = new THREE.MeshPhongMaterial({
        color: 0xf39c12,
        emissive: 0xb8860b,
        shininess: 100
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere.position.set(3, 1, -1);
    sphere.userData = {
        rotationSpeed: { x: -0.004, y: 0.006, z: -0.002 },
        floatSpeed: 0.0015,
        initialY: sphere.position.y
    };
    group.add(sphere);

    // Small orbiting particles
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const pGeometry = new THREE.SphereGeometry(0.3, 8, 8);
        const pMaterial = new THREE.MeshPhongMaterial({
            color: i % 2 === 0 ? 0xd32f2f : 0xf39c12,
            emissive: i % 2 === 0 ? 0x8b0000 : 0xb8860b,
            shininess: 100
        });
        const particle = new THREE.Mesh(pGeometry, pMaterial);
        particle.position.set(
            Math.cos(angle) * 4,
            Math.sin(angle) * 2,
            Math.cos(angle * 1.5) * 2
        );
        particle.userData = {
            angle: angle,
            radius: 4,
            speed: 0.01 + (i * 0.001)
        };
        group.add(particle);
    }

    authScene.add(group);

    // Create connecting lines between objects
    createParticleNetwork(group);
}

function createParticleNetwork(group) {
    const lineGeometry = new THREE.BufferGeometry();
    const linePositions = [];

    // Connect nearby objects
    const meshes = group.children;
    for (let i = 0; i < meshes.length; i++) {
        for (let j = i + 1; j < meshes.length; j++) {
            const dist = meshes[i].position.distanceTo(meshes[j].position);
            if (dist < 6) {
                linePositions.push(meshes[i].position.x, meshes[i].position.y, meshes[i].position.z);
                linePositions.push(meshes[j].position.x, meshes[j].position.y, meshes[j].position.z);
            }
        }
    }

    if (linePositions.length > 0) {
        lineGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePositions), 3));
        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0xf39c12,
            transparent: true,
            opacity: 0.2
        });
        const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
        authScene.add(lines);
    }
}

function authAnimate() {
    authAnimationFrameId = requestAnimationFrame(authAnimate);

    // Animate all meshes
    authScene.children.forEach(child => {
        if (child instanceof THREE.Group) {
            child.children.forEach((mesh, index) => {
                if (mesh.userData.rotationSpeed) {
                    mesh.rotation.x += mesh.userData.rotationSpeed.x;
                    mesh.rotation.y += mesh.userData.rotationSpeed.y;
                    mesh.rotation.z += mesh.userData.rotationSpeed.z;

                    mesh.position.y = mesh.userData.initialY + Math.sin(Date.now() * mesh.userData.floatSpeed) * 2;
                }

                if (mesh.userData.angle !== undefined) {
                    mesh.userData.angle += mesh.userData.speed;
                    mesh.position.x = Math.cos(mesh.userData.angle) * mesh.userData.radius;
                    mesh.position.z = Math.cos(mesh.userData.angle * 1.5) * mesh.userData.radius;
                }
            });
        }
    });

    authRenderer.render(authScene, authCamera);
}

function onAuthWindowResize() {
    const canvas = authRenderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    authCamera.aspect = width / height;
    authCamera.updateProjectionMatrix();
    authRenderer.setSize(width, height);
}

function onAuthMouseMove(event) {
    if (!authCamera) return;
    const x = (event.clientX / window.innerWidth) * 2 - 1;
    const y = -(event.clientY / window.innerHeight) * 2 + 1;

    authCamera.position.x += (x * 0.5 - authCamera.position.x) * 0.05;
    authCamera.position.y += (y * 0.5 - authCamera.position.y) * 0.05;
    authCamera.lookAt(authScene.position);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuth3D);
} else {
    initAuth3D();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (authAnimationFrameId) {
        cancelAnimationFrame(authAnimationFrameId);
    }
});
