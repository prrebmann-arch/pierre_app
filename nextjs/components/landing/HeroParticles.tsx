'use client'

import { useRef, useEffect } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  a: number
}

export default function HeroParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
    const COUNT = 90
    const CONNECT_DIST = 160
    const MOUSE_DIST = 200

    let W = 0
    let H = 0
    let particles: Particle[] = []
    const mouse = { x: -999, y: -999 }
    let raf: number

    function resize() {
      const parent = canvas!.parentElement
      if (!parent) return
      const rect = parent.getBoundingClientRect()
      W = canvas!.width = rect.width * devicePixelRatio
      H = canvas!.height = rect.height * devicePixelRatio
      canvas!.style.width = rect.width + 'px'
      canvas!.style.height = rect.height + 'px'
      ctx!.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
    }

    function init() {
      resize()
      particles = []
      const w = W / devicePixelRatio
      const h = H / devicePixelRatio
      for (let i = 0; i < COUNT; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          r: Math.random() * 2.5 + 1.5,
          a: Math.random() * 0.4 + 0.4,
        })
      }
    }

    function draw() {
      const w = W / devicePixelRatio
      const h = H / devicePixelRatio
      ctx!.clearRect(0, 0, w, h)

      for (const p of particles) {
        const dx = p.x - mouse.x
        const dy = p.y - mouse.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < MOUSE_DIST && dist > 0) {
          const force = ((MOUSE_DIST - dist) / MOUSE_DIST) * 1.2
          p.vx += (dx / dist) * force
          p.vy += (dy / dist) * force
        }
        p.vx *= 0.97
        p.vy *= 0.97
        p.x += p.vx
        p.y += p.vy
        if (p.x < -10) p.x = w + 10
        if (p.x > w + 10) p.x = -10
        if (p.y < -10) p.y = h + 10
        if (p.y > h + 10) p.y = -10

        if (!isSafari) {
          ctx!.shadowBlur = 12
          ctx!.shadowColor = 'rgba(255,80,80,0.6)'
        }
        ctx!.beginPath()
        ctx!.arc(p.x, p.y, isSafari ? p.r + 1 : p.r, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(255,100,100,${isSafari ? Math.min(p.a + 0.2, 0.9) : p.a})`
        ctx!.fill()
        if (!isSafari) ctx!.shadowBlur = 0
      }

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < CONNECT_DIST) {
            ctx!.beginPath()
            ctx!.moveTo(particles[i].x, particles[i].y)
            ctx!.lineTo(particles[j].x, particles[j].y)
            ctx!.strokeStyle = `rgba(255,80,80,${(1 - dist / CONNECT_DIST) * 0.25})`
            ctx!.lineWidth = 1
            ctx!.stroke()
          }
        }
      }

      raf = requestAnimationFrame(draw)
    }

    const hero = canvas.parentElement
    if (!hero) return

    const handleMouseMove = (e: MouseEvent) => {
      const r = hero.getBoundingClientRect()
      mouse.x = e.clientX - r.left
      mouse.y = e.clientY - r.top
    }

    const handleMouseLeave = () => {
      mouse.x = -999
      mouse.y = -999
    }

    const handleResize = () => {
      cancelAnimationFrame(raf)
      init()
      draw()
    }

    hero.addEventListener('mousemove', handleMouseMove)
    hero.addEventListener('mouseleave', handleMouseLeave)
    window.addEventListener('resize', handleResize)

    function tryInit() {
      const rect = canvas!.parentElement?.getBoundingClientRect()
      if (!rect || rect.width < 10 || rect.height < 10) {
        setTimeout(tryInit, 200)
        return
      }
      init()
      draw()
    }
    tryInit()

    return () => {
      cancelAnimationFrame(raf)
      hero.removeEventListener('mousemove', handleMouseMove)
      hero.removeEventListener('mouseleave', handleMouseLeave)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 2,
      }}
    />
  )
}
