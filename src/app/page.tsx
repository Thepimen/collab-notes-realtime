'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  GripVertical,
  ImagePlus,
  Layers,
  Moon,
  Sparkles,
  Sun,
  Users
} from 'lucide-react';
import { BrandMark } from '@/components/ui/BrandMark';
import { RevealOnScroll } from '@/components/ui/RevealOnScroll';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';

export default function LandingPage() {
  const { user, isLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [demoTasks, setDemoTasks] = useState([
    { id: 1, text: 'Organizar apuntes del proyecto', done: true },
    { id: 2, text: 'Pegar capturas del diseño con Ctrl+V', done: true },
    { id: 3, text: 'Revisar borrador con el equipo en directo', done: false }
  ]);

  return (
    <div className="min-h-screen bg-canvas text-ink selection:bg-terracotta-soft">
      {/* Floating Translucent Navigation */}
      <header className="sticky top-0 z-40 border-b border-hairline/80 bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandMark size="md" />
            <span className="font-serif text-2xl tracking-tight text-ink">CollabNotes</span>
          </Link>

          <nav
            aria-label="Secciones principales"
            className="hidden items-center gap-7 text-xs font-medium text-secondary md:flex"
          >
            <a href="#producto" className="transition hover:text-ink">
              Producto
            </a>
            <a href="#funciones" className="transition hover:text-ink">
              Funciones
            </a>
            <a href="#ventajas" className="transition hover:text-ink">
              Para quién es
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Cambiar tema de color"
              className="rounded-xl border border-hairline bg-elevated p-2 text-secondary transition hover:border-borderstrong hover:text-ink"
            >
              {theme === 'light' ? (
                <Moon className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Sun className="h-4 w-4 text-ochre" aria-hidden="true" />
              )}
            </button>

            {!isLoading && user ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 rounded-xl bg-terracotta px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-terracotta-hover active:scale-[0.98]"
              >
                <span>Ir a mis notas</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-xl px-3.5 py-2 text-xs font-semibold text-secondary transition hover:bg-surface hover:text-ink"
                >
                  Iniciar sesión
                </Link>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-terracotta px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-terracotta-hover active:scale-[0.98]"
                >
                  <span>Empezar gratis</span>
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* ================================================================
            SECTION 1: HERO BENTO (Fluted Orange Master Card + Crisp Interactive Card)
           ================================================================ */}
        <section id="producto" className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Left Master Fluted-Orange Showcase */}
          <div className="fluted-orange animate-reveal-up flex min-h-[430px] flex-col justify-between rounded-[28px] p-7 text-white shadow-xl sm:p-10 lg:col-span-7">
            <div className="relative z-10 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
              <span>CollabNotes · Espacio Vivo</span>
              <span className="rounded-full bg-white/15 px-3 py-1 backdrop-blur-sm">
                Tiempo real
              </span>
            </div>

            <div className="relative z-10 my-8 max-w-xl">
              <p className="text-sm font-medium text-white/90 sm:text-base">
                Mantén todas tus ideas y documentos en orden…
              </p>
              <h1 className="mt-3 text-4xl font-bold leading-[1.03] tracking-tight sm:text-6xl">
                ESCRIBE Y COLABORA SIN FRICCIÓN.
              </h1>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-white/90">
                Crea notas limpias, pega fotos al instante, reordena bloques a tu gusto y edita en
                equipo desde cualquier dispositivo.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  href={user ? '/dashboard' : '/register'}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-[#171614] shadow-lg transition hover:-translate-y-0.5 hover:bg-white/95 active:scale-[0.98]"
                >
                  <span>{user ? 'Abrir mi espacio' : 'Crear cuenta gratis'}</span>
                  <ArrowRight className="h-4 w-4 text-[#F45B1E]" aria-hidden="true" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/35 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
                >
                  <span>Entrar a mi cuenta</span>
                </Link>
              </div>
            </div>

            <div className="relative z-10 flex items-end justify-between border-t border-white/20 pt-5">
              <span className="text-3xl font-black tracking-tight text-white/95 sm:text-5xl">
                COLLABNOTES<span className="text-white/70">+</span>
              </span>
              <span className="text-xs font-medium text-white/75">2026</span>
            </div>
          </div>

          {/* Right Crisp Editorial Card with Soft Orange Aura & Live Interactive Preview */}
          <div
            style={{ animationDelay: '90ms' }}
            className="animate-reveal-up relative flex flex-col justify-between overflow-hidden rounded-[28px] border border-hairline bg-elevated p-7 shadow-sm sm:p-9 lg:col-span-5"
          >
            {/* Soft warm glow behind bottom-right */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-16 -right-16 h-64 w-64 rounded-full bg-[#FF6B2E]/20 blur-3xl"
            />

            <div className="relative z-10 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-terracotta-soft px-3 py-1 text-xs font-semibold text-terracotta">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Prueba la sensación
              </span>
              <div className="flex -space-x-1.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F45B1E] text-[10px] font-bold text-white ring-2 ring-elevated">
                  LL
                </span>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#246A49] text-[10px] font-bold text-white ring-2 ring-elevated">
                  ER
                </span>
              </div>
            </div>

            {/* Interactive Miniature Live Note */}
            <div className="relative z-10 my-6 rounded-2xl border border-hairline bg-canvas p-5 shadow-sm">
              <div className="flex items-center justify-between border-b border-hairline pb-3">
                <span className="font-serif text-xl text-ink">🚀 Plan de la semana</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-sage-soft px-2 py-0.5 text-[11px] font-medium text-sage">
                  <Check className="h-3 w-3" aria-hidden="true" />
                  Guardado
                </span>
              </div>

              <ul className="mt-3.5 space-y-2">
                {demoTasks.map((task) => (
                  <li key={task.id}>
                    <button
                      type="button"
                      onClick={() =>
                        setDemoTasks((prev) =>
                          prev.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t))
                        )
                      }
                      className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left text-xs transition hover:bg-surface"
                    >
                      <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                          task.done
                            ? 'border-terracotta bg-terracotta text-white'
                            : 'border-borderstrong bg-elevated'
                        }`}
                      >
                        {task.done && <Check className="h-3 w-3" aria-hidden="true" />}
                      </span>
                      <span className={task.done ? 'text-muted line-through' : 'text-ink'}>
                        {task.text}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative z-10 flex items-end justify-between">
              <div>
                <p className="text-xs text-secondary">Haz clic en cualquier tarea arriba</p>
                <p className="mt-1 text-2xl font-black tracking-tight text-ink sm:text-3xl">
                  EQUIPO<span className="text-terracotta">+</span>
                </p>
              </div>
              <Link
                href={user ? '/dashboard' : '/register'}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-ink text-canvas transition hover:scale-105 hover:bg-terracotta hover:text-white"
                aria-label="Empezar ahora"
              >
                <ArrowUpRight className="h-5 w-5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        {/* ================================================================
            SECTION 2: 3-CARD EDITORIAL ROW (White Glow + Deep Orange + Peach Preview)
           ================================================================ */}
        <section id="funciones" className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {/* Card 1: Crisp White + Vertical Orange Glow Bars */}
          <RevealOnScroll delayMs={0}>
            <article className="relative flex h-full min-h-[270px] flex-col justify-between overflow-hidden rounded-[26px] border border-hairline bg-elevated p-7 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md">
              {/* Rising orange glow columns motif */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute bottom-0 left-1/2 flex h-36 w-56 -translate-x-1/2 items-end gap-1.5 opacity-80"
              >
                <div className="h-20 flex-1 rounded-t-xl bg-gradient-to-t from-[#F45B1E] to-[#FF8A47]/20 blur-[1px]" />
                <div className="h-32 flex-1 rounded-t-xl bg-gradient-to-t from-[#F45B1E] to-[#FF9B5E]/30 blur-[1px]" />
                <div className="h-24 flex-1 rounded-t-xl bg-gradient-to-t from-[#F45B1E] to-[#FF8A47]/20 blur-[1px]" />
              </div>

              <div className="relative z-10 flex items-start justify-between gap-3">
                <ul className="space-y-1.5 text-xs text-secondary">
                  <li>• Escritura sin distracciones</li>
                  <li>• Saltos de línea naturales</li>
                  <li>• Modo claro y oscuro</li>
                  <li>• Índice automático</li>
                </ul>
                <h2 className="text-right text-lg font-extrabold leading-tight tracking-tight text-ink">
                  MENOS RUIDO,
                  <br />
                  MÁS FOCO:
                </h2>
              </div>

              <div className="relative z-10 mt-10 flex items-end justify-between">
                <span className="text-3xl font-black tracking-tight text-ink">VALOR:</span>
                <span className="rounded-full bg-elevated/90 px-2.5 py-0.5 text-[11px] font-semibold text-terracotta">
                  Fluido
                </span>
              </div>
            </article>
          </RevealOnScroll>

          {/* Card 2: Deep Sunset Orange Fluted Glass */}
          <RevealOnScroll delayMs={90}>
            <article className="fluted-orange-deep flex h-full min-h-[270px] flex-col justify-between rounded-[26px] p-7 text-white shadow-md transition duration-300 hover:-translate-y-1 hover:shadow-lg">
              <div className="relative z-10 flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-white/70">
                <span>CollabNotes</span>
                <Users className="h-4 w-4 text-white/85" aria-hidden="true" />
              </div>

              <div className="relative z-10 my-auto py-4 text-center">
                <h2 className="text-2xl font-extrabold tracking-tight">COLABORACIÓN REAL</h2>
                <p className="mx-auto mt-3 max-w-xs text-xs leading-relaxed text-white/90">
                  Invita a tus compañeros por correo como editores o lectores. Ve quién está
                  conectado y edita el mismo documento a la vez sin sobrescribir cambios.
                </p>
              </div>

              <div className="relative z-10 flex items-center justify-center gap-2 text-[11px] text-white/80">
                <span className="h-2 w-2 rounded-full bg-[#4CA97C]" />
                <span>Sincronización instantánea entre dispositivos</span>
              </div>
            </article>
          </RevealOnScroll>

          {/* Card 3: Warm Peach Fluted Card + Key Features */}
          <RevealOnScroll delayMs={180}>
            <article className="fluted-peach relative flex h-full min-h-[270px] flex-col justify-between rounded-[26px] p-7 text-white shadow-md transition duration-300 hover:-translate-y-1 hover:shadow-lg">
              <div className="relative z-10">
                <h2 className="text-xl font-extrabold tracking-tight text-white">
                  FUNCIONES CLAVE:
                </h2>
                <ul className="mt-4 space-y-2 text-xs font-medium text-white/95">
                  <li className="flex items-center gap-2">
                    <ImagePlus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>Copia y pega fotos con Ctrl+V</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <GripVertical className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>Mueve bloques arriba y abajo</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Layers className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>Plantillas opcionales y etiquetas</span>
                  </li>
                </ul>
              </div>

              {/* Tilted Mini Floating Preview Card */}
              <div className="animate-float-slow relative z-10 mt-5 ml-auto w-44 rotate-2 rounded-xl bg-white/95 p-3 text-[#171614] shadow-xl">
                <div className="flex items-center justify-between text-[10px] font-bold">
                  <span>Nota rápida</span>
                  <span className="text-[#F45B1E]">● En vivo</span>
                </div>
                <div className="mt-2 space-y-1.5">
                  <div className="h-2 w-4/5 rounded-full bg-[#171614]/15" />
                  <div className="h-2 w-full rounded-full bg-[#F45B1E]/30" />
                  <div className="h-2 w-3/5 rounded-full bg-[#171614]/15" />
                </div>
              </div>
            </article>
          </RevealOnScroll>
        </section>

        {/* ================================================================
            SECTION 3: OBSIDIAN & GLOWING NUMERAL BENTO ROW (01, 02, 03, CTA)
           ================================================================ */}
        <section id="ventajas" className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {/* Dark Card 01 */}
          <RevealOnScroll delayMs={0}>
            <article className="fluted-obsidian relative flex min-h-[220px] flex-col justify-between rounded-[24px] p-6 text-white shadow-lg transition duration-300 hover:-translate-y-1">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-5 right-3 select-none text-[110px] font-black leading-none text-[#FF6B2E]/35 blur-[2px]"
              >
                01
              </span>
              <h3 className="relative z-10 text-base font-extrabold tracking-tight">
                SIN CORTES AL ESCRIBIR
              </h3>
              <p className="relative z-10 mt-3 text-xs leading-relaxed text-white/80">
                Pulsa Enter para saltar de línea con naturalidad y deja que tus cambios se guarden
                en silencio mientras escribes.
              </p>
              <span className="relative z-10 mt-6 text-[11px] font-semibold text-[#FF8A47]">
                Guardado silencioso
              </span>
            </article>
          </RevealOnScroll>

          {/* Dark Card 02 */}
          <RevealOnScroll delayMs={80}>
            <article className="fluted-obsidian relative flex min-h-[220px] flex-col justify-between rounded-[24px] p-6 text-white shadow-lg transition duration-300 hover:-translate-y-1">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-5 right-3 select-none text-[110px] font-black leading-none text-[#FF6B2E]/35 blur-[2px]"
              >
                02
              </span>
              <h3 className="relative z-10 text-base font-extrabold tracking-tight">
                BLOQUES Y FOTOS LIBRES
              </h3>
              <p className="relative z-10 mt-3 text-xs leading-relaxed text-white/80">
                Pega capturas directamente desde el portapapeles, amplíalas con un clic y reordena
                cada sección arrastrando.
              </p>
              <span className="relative z-10 mt-6 text-[11px] font-semibold text-[#FF8A47]">
                Control visual total
              </span>
            </article>
          </RevealOnScroll>

          {/* Warm Orange Card 03 */}
          <RevealOnScroll delayMs={160}>
            <article className="fluted-peach relative flex min-h-[220px] flex-col justify-between rounded-[24px] p-6 text-white shadow-lg transition duration-300 hover:-translate-y-1">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-4 right-2 select-none text-[104px] font-black leading-none text-white/25"
              >
                03
              </span>
              <div className="relative z-10">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/85">
                  Pensado para
                </p>
                <ul className="mt-2 space-y-1 text-xs font-medium text-white">
                  <li>• Estudiantes y apuntes</li>
                  <li>• Equipos de proyecto</li>
                  <li>• Notas personales y guías</li>
                </ul>
              </div>
              <h3 className="relative z-10 mt-6 text-xl font-black leading-none tracking-tight">
                TU ESPACIO
                <br />
                DIARIO
              </h3>
            </article>
          </RevealOnScroll>

          {/* Final CTA Card */}
          <RevealOnScroll delayMs={240}>
            <article className="fluted-orange-deep relative flex min-h-[220px] flex-col justify-between rounded-[24px] p-6 text-white shadow-lg transition duration-300 hover:-translate-y-1">
              <div className="relative z-10">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-white/75">
                  Listo en segundos
                </p>
                <h3 className="mt-2 text-2xl font-black leading-tight tracking-tight">
                  EMPIEZA TU PRIMERA NOTA
                </h3>
              </div>

              <div className="relative z-10 mt-6 flex flex-col gap-2">
                <Link
                  href={user ? '/dashboard' : '/register'}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 text-xs font-bold text-[#171614] shadow transition hover:bg-white/95 active:scale-[0.98]"
                >
                  <span>{user ? 'Ir a mis notas' : 'Crear cuenta gratis'}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-[#F45B1E]" aria-hidden="true" />
                </Link>
              </div>
            </article>
          </RevealOnScroll>
        </section>
      </main>

      <footer className="mx-auto mt-6 flex max-w-7xl flex-wrap items-center justify-between gap-4 border-t border-hairline px-4 py-7 text-xs text-muted sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <BrandMark size="sm" />
          <span className="font-semibold text-ink">CollabNotes</span>
          <span>· Notas colaborativas en tiempo real</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="transition hover:text-ink">
            Iniciar sesión
          </Link>
          <Link href="/register" className="transition hover:text-ink">
            Crear cuenta
          </Link>
        </div>
      </footer>
    </div>
  );
}
