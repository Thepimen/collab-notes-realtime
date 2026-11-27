import type { DocumentContentDTO } from '@/types/domain.types';

export interface NoteTemplate {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly icon: string;
  readonly defaultTitle: string;
  readonly buildContent: (authorEmail: string) => DocumentContentDTO;
}

function blk(
  type: DocumentContentDTO['blocks'][number]['type'],
  text: string,
  authorEmail: string,
  checked?: boolean
) {
  return {
    id: `blk-${Math.random().toString(36).slice(2, 9)}`,
    type,
    text,
    checked,
    updatedBy: authorEmail,
    updatedAt: new Date().toISOString()
  };
}

export const NOTE_TEMPLATES: readonly NoteTemplate[] = [
  {
    id: 'blank',
    name: 'Nota en blanco',
    description: 'Lienzo limpio listo para escribir sin distracciones.',
    icon: '📝',
    defaultTitle: 'Nota sin título',
    buildContent: (email) => ({
      blocks: [blk('paragraph', '', email)],
      metadata: { tags: [], icon: '📝', lastEditedBy: email }
    })
  },
  {
    id: 'meeting',
    name: 'Acta de reunión',
    description: 'Agenda, decisiones clave y lista de próximos pasos.',
    icon: '🤝',
    defaultTitle: 'Reunión de equipo',
    buildContent: (email) => ({
      blocks: [
        blk('callout', 'Fecha: Hoy · Participantes: Equipo de producto', email),
        blk('heading-2', 'Puntos de la agenda', email),
        blk('bullet', 'Revisión de objetivos de la semana', email),
        blk('bullet', 'Bloqueos actuales y dependencias', email),
        blk('heading-2', 'Decisiones acordadas', email),
        blk('paragraph', 'Resume aquí los acuerdos principales alcanzados en la sesión.', email),
        blk('heading-2', 'Próximos pasos', email),
        blk('checklist', 'Compartir resumen con el equipo', email, false),
        blk('checklist', 'Definir fechas de entrega del siguiente hito', email, false)
      ],
      metadata: { tags: ['Reuniones', 'Equipo'], icon: '🤝', lastEditedBy: email }
    })
  },
  {
    id: 'project',
    name: 'Plan de proyecto',
    description: 'Objetivos, alcance, hitos y tareas accionables.',
    icon: '🚀',
    defaultTitle: 'Plan de lanzamiento',
    buildContent: (email) => ({
      blocks: [
        blk('heading-1', 'Objetivo principal', email),
        blk(
          'paragraph',
          'Describe en dos líneas qué problema resuelve este proyecto y cuál será el resultado esperado.',
          email
        ),
        blk('divider', '', email),
        blk('heading-2', 'Hitos clave', email),
        blk('checklist', 'Definición de requisitos y diseño inicial', email, true),
        blk('checklist', 'Desarrollo de funcionalidades principales', email, false),
        blk('checklist', 'Revisión final y publicación', email, false),
        blk('heading-2', 'Notas y riesgos', email),
        blk('callout', 'Añade aquí cualquier dependencia externa o fecha crítica.', email)
      ],
      metadata: { tags: ['Proyecto', 'Planificación'], icon: '🚀', lastEditedBy: email }
    })
  },
  {
    id: 'study',
    name: 'Apuntes y resumen',
    description: 'Estructura clara con conceptos, citas y ejemplos.',
    icon: '📚',
    defaultTitle: 'Apuntes de clase',
    buildContent: (email) => ({
      blocks: [
        blk('heading-2', 'Ideas principales', email),
        blk('bullet', 'Concepto clave #1: explica la definición con tus propias palabras.', email),
        blk('bullet', 'Concepto clave #2: relaciona con ejemplos prácticos.', email),
        blk('quote', 'Una buena síntesis resume el porqué, no solo el qué.', email),
        blk('heading-2', 'Ejemplo o fragmento', email),
        blk('code', '// Escribe aquí un ejemplo, fórmula o esquema rápido', email),
        blk('heading-2', 'Preguntas para repasar', email),
        blk('checklist', 'Repasar ejercicios antes del viernes', email, false)
      ],
      metadata: { tags: ['Estudio', 'Resumen'], icon: '📚', lastEditedBy: email }
    })
  }
];
