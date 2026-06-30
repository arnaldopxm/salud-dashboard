import { describe, it, expect } from 'vitest';
import {
  parseSessionMarkdown,
  tryParseAlternativas,
  tryParseSesion,
  sesionGeneradaToParseada,
  filtrarArchivosSession,
} from '../../domain/rehab';
import type { DriveFileRef } from '../../domain/rehab';

// ---------------------------------------------------------------------------
// parseSessionMarkdown
// ---------------------------------------------------------------------------

const FILE = { title: '20250630_0900_sesion_hombro.md', viewUrl: 'https://drive.google.com/x' };

describe('parseSessionMarkdown', () => {
  it('extrae el título del h1 si contiene "sesi"', () => {
    const md = `# Sesión de hoy\n## Bloque 1\n**[[remo-con-banda|Remo con banda]]** — 3×10`;
    const s = parseSessionMarkdown(md, FILE);
    expect(s.titulo).toBe('Sesión de hoy');
  });

  it('usa el nombre del archivo como título si no hay h1 con sesi', () => {
    const md = `## Bloque 1\n**[[remo|Remo]]** — 3×10`;
    const s = parseSessionMarkdown(md, FILE);
    expect(s.titulo).toBe('20250630_0900_sesion_hombro');
  });

  it('parsea un ejercicio con alias y detalle', () => {
    const md = `## Bloque A\n**[[remo-con-banda|Remo con banda]]** — 3×10 rep`;
    const s = parseSessionMarkdown(md, FILE);
    expect(s.bloques).toHaveLength(1);
    const ej = s.bloques[0]!.ejercicios[0]!;
    expect(ej.nombre).toBe('Remo con banda');
    expect(ej.slug).toBe('remo-con-banda');
    expect(ej.detalle).toBe('3×10 rep');
  });

  it('parsea un ejercicio sin alias (slug = nombre)', () => {
    const md = `## Bloque A\n**[[remo]]**`;
    const s = parseSessionMarkdown(md, FILE);
    const ej = s.bloques[0]!.ejercicios[0]!;
    expect(ej.nombre).toBe('remo');
    expect(ej.slug).toBe('remo');
  });

  it('extrae la nota del ejercicio desde línea blockquote', () => {
    const md = `## B\n**[[press]]** — 3×8\n> Codo a 90°`;
    const s = parseSessionMarkdown(md, FILE);
    expect(s.bloques[0]!.ejercicios[0]!.nota).toBe('Codo a 90°');
  });

  it('extrae el video del ejercicio', () => {
    const md = `## B\n**[[press]]**\n> Vídeo: [Ver](https://youtube.com/x)`;
    const s = parseSessionMarkdown(md, FILE);
    const ej = s.bloques[0]!.ejercicios[0]!;
    expect(ej.video?.url).toBe('https://youtube.com/x');
  });

  it('ignora bloques con headers de metadatos', () => {
    const md = `## Relación con el plan\nTexto ignorado\n## Bloque A\n**[[remo]]**`;
    const s = parseSessionMarkdown(md, FILE);
    expect(s.bloques).toHaveLength(1);
    expect(s.bloques[0]!.titulo).toBe('Bloque A');
  });

  it('agrupa ejercicios sin h2 en bloque "Ejercicios"', () => {
    const md = `**[[remo]]** — 3×10`;
    const s = parseSessionMarkdown(md, FILE);
    expect(s.bloques[0]!.titulo).toBe('Ejercicios');
  });

  it('excluye bloques sin ejercicios del resultado', () => {
    const md = `## Bloque vacío\nSolo texto\n## Bloque con ej\n**[[press]]**`;
    const s = parseSessionMarkdown(md, FILE);
    expect(s.bloques).toHaveLength(1);
    expect(s.bloques[0]!.titulo).toBe('Bloque con ej');
  });

  it('varios ejercicios en el mismo bloque', () => {
    const md = `## Bloque\n**[[a]]** — 3×8\n**[[b]]** — 2×12`;
    const s = parseSessionMarkdown(md, FILE);
    expect(s.bloques[0]!.ejercicios).toHaveLength(2);
  });

  it('propaga viewUrl y fileName', () => {
    const md = `## B\n**[[x]]**`;
    const s = parseSessionMarkdown(md, FILE);
    expect(s.viewUrl).toBe(FILE.viewUrl);
    expect(s.fileName).toBe(FILE.title);
  });
});

// ---------------------------------------------------------------------------
// tryParseAlternativas
// ---------------------------------------------------------------------------

describe('tryParseAlternativas', () => {
  it('parsea JSON válido con campo alternativas', () => {
    const json = JSON.stringify({ alternativas: [{ nombre: 'Remo', descripcion: 'x', recomendado: true }] });
    const result = tryParseAlternativas(json);
    expect(result).toHaveLength(1);
    expect(result![0]!.nombre).toBe('Remo');
  });

  it('extrae JSON envuelto en markdown code block', () => {
    const text = '```json\n{"alternativas":[{"nombre":"A","descripcion":"b","recomendado":false}]}\n```';
    expect(tryParseAlternativas(text)).toHaveLength(1);
  });

  it('extrae JSON con texto alrededor', () => {
    const text = 'Aquí tienes:\n{"alternativas":[{"nombre":"X","descripcion":"y","recomendado":true}]}';
    expect(tryParseAlternativas(text)![0]!.nombre).toBe('X');
  });

  it('devuelve null para texto sin JSON válido', () => {
    expect(tryParseAlternativas('Lo siento, no puedo ayudarte.')).toBeNull();
  });

  it('devuelve null para string vacío', () => {
    expect(tryParseAlternativas('')).toBeNull();
  });

  it('acepta array directo sin wrapper', () => {
    const json = JSON.stringify([{ nombre: 'A', descripcion: 'x', recomendado: false }]);
    expect(tryParseAlternativas(json)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// tryParseSesion
// ---------------------------------------------------------------------------

describe('tryParseSesion', () => {
  const SESION_JSON = JSON.stringify({
    titulo: 'Sesión de hoy',
    bloques: [{ titulo: 'Bloque A', ejercicios: [{ nombre: 'Remo', detalle: '3×10', nota: '' }] }],
  });

  it('parsea sesión JSON válida', () => {
    const s = tryParseSesion(SESION_JSON);
    expect(s?.titulo).toBe('Sesión de hoy');
    expect(s?.bloques).toHaveLength(1);
  });

  it('devuelve null para JSON sin campo bloques', () => {
    expect(tryParseSesion('{"titulo":"x"}')).toBeNull();
  });

  it('devuelve null para texto vacío', () => {
    expect(tryParseSesion('')).toBeNull();
  });

  it('extrae desde markdown code block', () => {
    const text = '```json\n' + SESION_JSON + '\n```';
    expect(tryParseSesion(text)?.titulo).toBe('Sesión de hoy');
  });
});

// ---------------------------------------------------------------------------
// sesionGeneradaToParseada
// ---------------------------------------------------------------------------

describe('sesionGeneradaToParseada', () => {
  it('convierte correctamente al formato interno', () => {
    const s = sesionGeneradaToParseada({
      titulo: 'Test',
      bloques: [{
        titulo: 'Bloque',
        ejercicios: [{ nombre: 'Press', detalle: '3×8', nota: 'Nota', video: 'https://yt.com' }],
      }],
    });
    expect(s.titulo).toBe('Test');
    expect(s.bloques[0]!.ejercicios[0]!.video?.url).toBe('https://yt.com');
    expect(s.bloques[0]!.ejercicios[0]!.sustituto).toBeNull();
  });

  it('excluye bloques sin ejercicios', () => {
    const s = sesionGeneradaToParseada({
      titulo: 'T',
      bloques: [{ titulo: 'Vacío', ejercicios: [] }],
    });
    expect(s.bloques).toHaveLength(0);
  });

  it('usa "Sesión de hoy" si el título está vacío', () => {
    const s = sesionGeneradaToParseada({ titulo: '', bloques: [] });
    expect(s.titulo).toBe('Sesión de hoy');
  });
});

// ---------------------------------------------------------------------------
// filtrarArchivosSession
// ---------------------------------------------------------------------------

describe('filtrarArchivosSession', () => {
  const files: DriveFileRef[] = [
    { id: '1', title: '20250630_0900_sesion_hombro.md', modifiedTime: '2025-06-30T09:00:00Z' },
    { id: '2', title: '20250629_0900_sesion_core.md', modifiedTime: '2025-06-29T09:00:00Z' },
    { id: '3', title: 'plantilla_sesion.md', modifiedTime: '2025-06-28T09:00:00Z' },
    { id: '4', title: 'contexto_general.md', modifiedTime: '2025-06-27T09:00:00Z' },
    { id: '5', title: 'notas_varias.md', modifiedTime: '2025-06-26T09:00:00Z' },
  ];

  it('filtra plantillas y contextos', () => {
    const result = filtrarArchivosSession(files);
    expect(result.map(f => f.id)).not.toContain('3');
    expect(result.map(f => f.id)).not.toContain('4');
  });

  it('filtra archivos sin patrón de sesión', () => {
    const result = filtrarArchivosSession(files);
    expect(result.map(f => f.id)).not.toContain('5');
  });

  it('ordena por fecha descendente (más reciente primero)', () => {
    const result = filtrarArchivosSession(files);
    expect(result[0]!.id).toBe('1');
    expect(result[1]!.id).toBe('2');
  });

  it('devuelve array vacío si no hay sesiones válidas', () => {
    expect(filtrarArchivosSession([{ id: 'x', title: 'plantilla.md' }])).toHaveLength(0);
  });
});
