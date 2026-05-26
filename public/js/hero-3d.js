/**
 * Hero 3D Animation - Three.js
 * Creates animated 3D background for hero section
 */

let scene, camera, renderer;
let animationFrameId;

function initHero3D() {
    const canvas = document.getElementById('heroCanvas');
    if (!canvas) return;

    // Scene setup
    scene = new THREE.Scene();
    scene.background = null;

    // Camera
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 5;

    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xff6b6b, 0.8);
    directionalLight.position.set(5, 10, 7);
    scene.add(directionalLight);

    // Create animated geometry
    createAnimatedGeometry();

    // Handle window resize
    window.addEventListener('resize', onWindowResize);

    // Start animation loop
    animate();
}

function createAnimatedGeometry() {
    // Create multiple floating particles/elements
    const particleGeometry = new THREE.IcosahedronGeometry(0.5, 4);
    const particleMaterial = new THREE.MeshPhongMaterial({
        color: 0xd32f2f,
        emissive: 0x8b0000,
        shininess: 100
    });

    const particles = new THREE.Group();
    for (let i = 0; i < 5; i++) {
        const particle = new THREE.Mesh(particleGeometry, particleMaterial.clone());
        particle.position.set(
            (Math.random() - 0.5) * 8,
            (Math.random() - 0.5) * 8,
            (Math.random() - 0.5) * 8
        );
        particle.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
        );
        particle.scale.set(Math.random() * 0.8 + 0.4, Math.random() * 0.8 + 0.4, Math.random() * 0.8 + 0.4);
        particle.userData = {
            rotationSpeed: {
                x: (Math.random() - 0.5) * 0.01,
                y: (Math.random() - 0.5) * 0.01,
                z: (Math.random() - 0.5) * 0.01
            },
            floatSpeed: Math.random() * 0.002 + 0.001,
            initialY: particle.position.y
        };
        particles.add(particle);
    }
    scene.add(particles);

    // Create connecting lines
    const lineGeometry = new THREE.BufferGeometry();
    const linePositions = [];
    const lineColor = new THREE.Color(0xf39c12);

    particles.children.forEach((particle, i) => {
        for (let j = i + 1; j < particles.children.length; j++) {
            const otherParticle = particles.children[j];
            const dist = particle.position.distanceTo(otherParticle.position);
            if (dist < 5) {
                linePositions.push(particle.position.x, particle.position.y, particle.position.z);
                linePositions.push(otherParticle.position.x, otherParticle.position.y, otherParticle.position.z);
            }
        }
    });

    if (linePositions.length > 0) {
        lineGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePositions), 3));
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0xf39c12, transparent: true, opacity: 0.3 });
        const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
        scene.add(lines);
    }
}

function animate() {
    animationFrameId = requestAnimationFrame(animate);

    // Rotate and animate particles
    scene.children.forEach(child => {
        if (child instanceof THREE.Group) {
            child.children.forEach(particle => {
                if (particle.userData.rotationSpeed) {
                    particle.rotation.x += particle.userData.rotationSpeed.x;
                    particle.rotation.y += particle.userData.rotationSpeed.y;
                    particle.rotation.z += particle.userData.rotationSpeed.z;

                    // Floating animation
                    particle.position.y = particle.userData.initialY + Math.sin(Date.now() * particle.userData.floatSpeed) * 2;
                }
            });
        }
    });

    renderer.render(scene, camera);
}

function onWindowResize() {
    const canvas = renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHero3D);
} else {
    initHero3D();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
});
