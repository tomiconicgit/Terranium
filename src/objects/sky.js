// src/objects/sky.js: Creates night sky

export function createSky() {
    const stars = new THREE.Group();
    for (let i = 0; i < 1000; i++) {
        const star = new THREE.Mesh(
            new THREE.SphereGeometry(0.1, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xffffff })
        );
        star.position.set(
            Math.random() * 200 - 100,
            Math.random() * 100 + 50,
            Math.random() * 200 - 100
        );
        stars.add(star);
    }
    return stars;
}