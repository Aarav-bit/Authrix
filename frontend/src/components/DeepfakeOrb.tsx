import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Sphere, MeshDistortMaterial, Float, Stars } from '@react-three/drei'
import * as THREE from 'three'
import type { AppState, Verdict } from '../store'

// ── Inner animated orb ────────────────────────────────────────────────────────
function Orb({ state, verdict }: { state: AppState; verdict: Verdict }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const ring2Ref = useRef<THREE.Mesh>(null)

  const isFake = verdict === 'FAKE'
  const isReal = verdict === 'REAL'
  const isLoading = state === 'loading'

  const color = isFake ? '#ff3355' : isReal ? '#00ff88' : '#00aaff'
  const emissive = isFake ? '#ff0033' : isReal ? '#00cc66' : '#0066ff'

  useFrame((_, delta) => {
    if (!meshRef.current) return
    meshRef.current.rotation.y += delta * (isLoading ? 1.5 : 0.4)
    meshRef.current.rotation.x += delta * (isLoading ? 0.8 : 0.15)
    if (ringRef.current) ringRef.current.rotation.z += delta * 0.6
    if (ring2Ref.current) ring2Ref.current.rotation.x += delta * 0.4
  })

  // Particle ring
  const particles = useMemo(() => {
    const count = 120
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      const radius = 1.8 + Math.random() * 0.4
      positions[i * 3]     = Math.cos(angle) * radius
      positions[i * 3 + 1] = (Math.random() - 0.5) * 0.3
      positions[i * 3 + 2] = Math.sin(angle) * radius
    }
    return positions
  }, [])

  return (
    <group>
      {/* Stars background */}
      <Stars radius={8} depth={4} count={300} factor={1} fade speed={isLoading ? 3 : 0.5} />

      {/* Main orb */}
      <Float speed={isLoading ? 4 : 1.5} rotationIntensity={isLoading ? 1 : 0.3} floatIntensity={isLoading ? 1.5 : 0.5}>
        <Sphere ref={meshRef} args={[1, 64, 64]}>
          <MeshDistortMaterial
            color={color}
            emissive={emissive}
            emissiveIntensity={isLoading ? 0.8 : 0.4}
            distort={isLoading ? 0.6 : isFake ? 0.45 : 0.25}
            speed={isLoading ? 4 : 2}
            roughness={0.1}
            metalness={0.8}
            transparent
            opacity={0.9}
          />
        </Sphere>
      </Float>

      {/* Orbit ring 1 */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.6, 0.015, 8, 100]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} />
      </mesh>

      {/* Orbit ring 2 */}
      <mesh ref={ring2Ref} rotation={[Math.PI / 3, Math.PI / 4, 0]}>
        <torusGeometry args={[1.9, 0.008, 8, 100]} />
        <meshBasicMaterial color={color} transparent opacity={0.25} />
      </mesh>

      {/* Particle ring */}
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[particles, 3]} />
        </bufferGeometry>
        <pointsMaterial color={color} size={0.025} transparent opacity={0.6} />
      </points>

      {/* Ambient + point lights */}
      <ambientLight intensity={0.2} />
      <pointLight position={[3, 3, 3]} intensity={2} color={color} />
      <pointLight position={[-3, -3, -3]} intensity={1} color={emissive} />
    </group>
  )
}

// ── Exported canvas wrapper ───────────────────────────────────────────────────
export default function DeepfakeOrb({ state, verdict }: { state: AppState; verdict: Verdict }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 4], fov: 50 }}
      style={{ width: '100%', height: '100%' }}
      gl={{ antialias: true, alpha: true }}
    >
      <Orb state={state} verdict={verdict} />
    </Canvas>
  )
}
