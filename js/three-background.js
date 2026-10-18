
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

console.log('THREE fonctionne !');

// ========================================
// 1. SCÈNE, CAMÉRA ET RENDERER
// ========================================

const canvas = document.querySelector('#three-background');

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    100
);

camera.position.z = 5;

const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

// ========================================
// 2. CRÉATION DES PARTICULES
// ========================================

const particleCount = 1000;

const positions = new Float32Array(particleCount * 3);
const sizes = new Float32Array(particleCount);

for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3;
    const layer = Math.random();

    let spreadX;
    let spreadY;
    let spreadZ;
    let particleSize;

    if (layer < 0.60) {
        // Arrière-plan : petites particules
        spreadX = 14;
        spreadY = 9;
        spreadZ = 14;
        particleSize = 2.0 + Math.random() * 1.5;
    } else if (layer < 0.92) {
        // Couche intermédiaire
        spreadX = 10;
        spreadY = 7;
        spreadZ = 8;
        particleSize = 3.0 + Math.random() * 2.0;
    } else {
        // Premier plan : particules plus grandes
        spreadX = 8;
        spreadY = 6;
        spreadZ = 4;
        particleSize = 5.0 + Math.random() * 2.5;
    }

    positions[i3] = (Math.random() - 0.5) * spreadX;
    positions[i3 + 1] = (Math.random() - 0.5) * spreadY;
    positions[i3 + 2] = (Math.random() - 0.5) * spreadZ;

    sizes[i] = particleSize;
}

// ========================================
// 3. GÉOMÉTRIE
// ========================================

const particleGeometry = new THREE.BufferGeometry();

particleGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(positions, 3)
);

particleGeometry.setAttribute(
    'aSize',
    new THREE.BufferAttribute(sizes, 1)
);

// Garder une copie des positions initiales
const originalPositions = positions.slice();

// ========================================
// 4. MATÉRIAU SHADER
// ========================================

const particleMaterial = new THREE.ShaderMaterial({
    uniforms: {
        uTime: { value: 0.0 }
    },

    vertexShader: `
        attribute float aSize;

        uniform float uTime;

        varying float vTwinkle;

        void main() {
            vec4 viewPosition =
                modelViewMatrix * vec4(position, 1.0);

            gl_Position =
                projectionMatrix * viewPosition;

            // Taille individuelle avec perspective
            gl_PointSize = aSize * (
                12.0 / max(1.0, -viewPosition.z)
            );

            // Scintillement subtil
            float phase = position.x * 12.0
                        + position.y * 8.0
                        + position.z * 5.0;

            vTwinkle = 0.78
                     + 0.22 * sin(uTime * 1.8 + phase);
        }
    `,

    fragmentShader: `
        varying float vTwinkle;

        void main() {
            vec2 uv = gl_PointCoord - vec2(0.5);
            float distanceToCenter = length(uv);

            // Halo doux
            float glow = exp(
                -distanceToCenter * distanceToCenter * 24.0
            );

            // Cœur lumineux
            float core = 1.0 - smoothstep(
                0.0,
                0.16,
                distanceToCenter
            );

            float alpha = (glow * 0.75 + core * 0.25)
                        * vTwinkle;

            if (alpha < 0.01) {
                discard;
            }

            gl_FragColor = vec4(vec3(1.0), alpha);
        }
    `,

    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
});

const particles = new THREE.Points(
    particleGeometry,
    particleMaterial
);

scene.add(particles);

// ========================================
// 5. SOURIS ET INTERACTION 3D
// ========================================

const mouse = { x: 0, y: 0 };
const targetMouse = { x: 0, y: 0 };

const mouseVector = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

const mouse3D = new THREE.Vector3();
const interactionPlane = new THREE.Plane(
    new THREE.Vector3(0, 0, 1),
    0
);

let pointerInside = false;

window.addEventListener('pointermove', (event) => {
    pointerInside = true;

    targetMouse.x =
        (event.clientX / window.innerWidth) * 2 - 1;

    targetMouse.y =
        -(event.clientY / window.innerHeight) * 2 + 1;

    mouseVector.set(targetMouse.x, targetMouse.y);

    raycaster.setFromCamera(mouseVector, camera);

    raycaster.ray.intersectPlane(
        interactionPlane,
        mouse3D
    );
});

window.addEventListener('pointerleave', () => {
    pointerInside = false;
});

// ========================================
// 6. ANIMATION
// ========================================

const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const elapsed = clock.getElapsedTime();

    particleMaterial.uniforms.uTime.value = elapsed;

    // Lissage du mouvement de la souris
    mouse.x += (targetMouse.x - mouse.x) * 0.03;
    mouse.y += (targetMouse.y - mouse.y) * 0.03;

    // Rotation lente du nuage
    particles.rotation.y =
        elapsed * 0.015 + mouse.x * 0.08;

    particles.rotation.x =
        Math.sin(elapsed * 0.1) * 0.03
        + mouse.y * 0.04;

    // Répulsion des particules autour du curseur
    const positionAttribute =
        particleGeometry.attributes.position;

    const animatedPositions = positionAttribute.array;

    const influenceRadius = 1.2;
    const repulsionStrength = 0.45;

    // Convertir le curseur dans l'espace local du nuage,
    // pour tenir compte de sa rotation.
    const localMouse = mouse3D.clone();
    particles.worldToLocal(localMouse);

    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;

        const originalX = originalPositions[i3];
        const originalY = originalPositions[i3 + 1];
        const originalZ = originalPositions[i3 + 2];

        const dx = originalX - localMouse.x;
        const dy = originalY - localMouse.y;

        const distance = Math.sqrt(dx * dx + dy * dy);

        let offsetX = 0;
        let offsetY = 0;

        if (
            pointerInside &&
            distance < influenceRadius &&
            distance > 0.001
        ) {
            const influence = 1 - distance / influenceRadius;

            const force =
                influence * influence * repulsionStrength;

            offsetX = (dx / distance) * force;
            offsetY = (dy / distance) * force;
        }

        const targetX = originalX + offsetX;
        const targetY = originalY + offsetY;

        animatedPositions[i3] +=
            (targetX - animatedPositions[i3]) * 0.08;

        animatedPositions[i3 + 1] +=
            (targetY - animatedPositions[i3 + 1]) * 0.08;

        animatedPositions[i3 + 2] +=
            (originalZ - animatedPositions[i3 + 2]) * 0.08;
    }

    positionAttribute.needsUpdate = true;

    // Rendu final
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
}

animate();

// ========================================
// 7. RESPONSIVE
// ========================================

function handleResize() {
    camera.aspect =
        window.innerWidth / window.innerHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );

    renderer.setPixelRatio(
        Math.min(window.devicePixelRatio, 2)
    );
}

window.addEventListener('resize', handleResize);