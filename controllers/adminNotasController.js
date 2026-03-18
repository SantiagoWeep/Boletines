const db = require('../config/db');


function truncar2Decimales(num) {
  return Math.trunc(num * 100) / 100;
}
// ==================== MOSTRAR NOTAS (vista principal) ====================
exports.mostrarNotas = async (req, res) => {
  const cursoFiltro = req.query.curso || '';
  const cursosValidos = ["Primero", "Segundo", "Tercero", "Cuarto", "Quinto"];
  const filtrarPorCurso = cursosValidos.includes(cursoFiltro);

 const ciclo = req.session.ciclo;

    let query = `
    SELECT 
      c.id AS curso_id,
      c.nombre AS curso_nombre,
      m.id AS materia_id,
      m.nombre AS materia_nombre,
      p.nombre AS profesor_nombre,
      p.apellido AS profesor_apellido,
      a.id AS alumno_id,
      a.nombre AS alumno_nombre,
      a.apellido AS alumno_apellido,
      n.trimestre,
      n.numero,
      TRUNCATE(n.nota, 2) AS nota
    FROM curso_profesor_materia cpm
    JOIN cursos c ON c.id = cpm.curso_id
    JOIN materias m ON m.id = cpm.materia_id
    JOIN profesores p ON p.id = cpm.profesor_id
    JOIN alumnos a ON a.curso_id = c.id
    LEFT JOIN notas n ON 
      n.alumno_id = a.id
      AND n.curso_id = c.id
      AND n.materia_id = m.id
      AND n.ciclo_id = ?
    `;

    if (filtrarPorCurso) query += ` WHERE c.nombre = ? `;
  query += ` ORDER BY c.id, m.id, a.apellido, a.nombre, n.trimestre, n.numero`;
 

  try {
    const params = filtrarPorCurso ? [ciclo, cursoFiltro] : [ciclo];
    const [results] = await db.query(query, params);

    const cursos = {};

    results.forEach(row => {
      if (!cursos[row.curso_id]) {
        cursos[row.curso_id] = { curso_id: row.curso_id, curso: row.curso_nombre, materias: {} };
      }
      const curso = cursos[row.curso_id];

      if (!curso.materias[row.materia_id]) {
        curso.materias[row.materia_id] = {
          materia_id: row.materia_id,
          materia_nombre: row.materia_nombre,
          profesor_nombre: row.profesor_nombre,
          profesor_apellido: row.profesor_apellido,
          alumnos: new Map()
        };
      }
      const materia = curso.materias[row.materia_id];

      if (!materia.alumnos.has(row.alumno_id)) {
        materia.alumnos.set(row.alumno_id, {
          id: row.alumno_id,
          nombre: row.alumno_nombre,
          apellido: row.alumno_apellido,
          notas: [1, 2, 3].map(tri => ({
            trimestre: tri,
            calificaciones: {1: null, 2: null, 3: null, 4: null}
          })),
          examen_dic: null,
          examen_mar: null
        });
      }

      const alumno = materia.alumnos.get(row.alumno_id);

      if (row.trimestre >= 1 && row.trimestre <= 3 && row.numero >= 1 && row.numero <= 4) {
        alumno.notas[row.trimestre - 1].calificaciones[row.numero] = row.nota !== null ? Number(row.nota) : null;
      }
      if (row.trimestre === 4) {
        if (row.numero === 1) alumno.examen_dic = row.nota !== null ? Number(row.nota) : null;
        if (row.numero === 2) alumno.examen_mar = row.nota !== null ? Number(row.nota) : null;
      }
    });

    // CÁLCULO FINAL + ORDEN ALFABÉTICO
    const cursosArray = Object.values(cursos).map(c => ({
      curso_id: c.curso_id,
      curso: c.curso,
      materias: Object.values(c.materias).map(m => ({
        materia_id: m.materia_id,
        materia_nombre: m.materia_nombre,
        profesor_nombre: m.profesor_nombre,
        profesor_apellido: m.profesor_apellido,
        alumnos: Array.from(m.alumnos.values())
          .map(al => {

            const promsTrim = al.notas
              .map(t => {
                const valores = Object.values(t.calificaciones).filter(n => n !== null);
                return valores.length
                  ? truncar2Decimales(valores.reduce((a, b) => a + b, 0) / valores.length)
                  : null;
              })
              .filter(x => x !== null);

            let final = promsTrim.length > 0
              ? truncar2Decimales(promsTrim.reduce((a, b) => a + b, 0) / promsTrim.length)
              : null;

            const exDic = al.examen_dic !== null ? parseFloat(al.examen_dic) : null;
            const exMar = al.examen_mar !== null ? parseFloat(al.examen_mar) : null;

            if ((final === null || final < 6) && exDic !== null && exDic >= 6) final = exDic;
            else if ((final === null || final < 6) && exMar !== null && exMar >= 6) final = exMar;

            let estado = 'APROBADO';

            if (final === null || final < 6) {
              estado = 'EP';
            }

            return {
              ...al,
              promedio_final: final,
              estado
            };
          })
          .sort((a, b) => {
            const apA = (a.apellido || '').trim().toLowerCase();
            const apB = (b.apellido || '').trim().toLowerCase();
            if (apA !== apB) return apA.localeCompare(apB);
            return (a.nombre || '').trim().toLowerCase().localeCompare(b.nombre || '');
          })
      }))
    }));

    res.render('admin/notas', {
      tipoBusqueda: 'materia o nombre',
      idInputBusqueda: 'input-busqueda',
      textoBotonAgregar: '',
      idModalAgregar: '',
      mostrarFiltroCurso: true,
      cursoSeleccionado: cursoFiltro,
      cursos: cursosArray,
           search: req.query.q || '',
      offset: 0
    });
    

  } catch (err) {
    console.error('Error al obtener notas:', err);
    res.status(500).send('Error de base de datos');
  }
};
// ==================== BUSCAR NOTAS (AJAX) ====================
exports.buscarNotas = async (req, res) => {
  const q = req.query.q?.trim() || '';
const ciclo = req.session.ciclo;
  if (!q) {
    return res.render('parciales/NotasList', { cursos: [], search: '', layout: false });
  }

  try {
    const [results] = await db.query(`
SELECT 
  c.id AS curso_id, c.nombre AS curso,
  m.id AS materia_id, m.nombre AS materia_nombre,
  p.nombre AS profesor_nombre, p.apellido AS profesor_apellido,
  a.id AS alumno_id, a.nombre AS alumno_nombre, a.apellido AS alumno_apellido,
  n.trimestre, n.numero, TRUNCATE(n.nota, 2) AS nota
FROM curso_profesor_materia cpm
JOIN cursos c ON c.id = cpm.curso_id
JOIN materias m ON m.id = cpm.materia_id
JOIN profesores p ON p.id = cpm.profesor_id
JOIN alumnos a ON a.curso_id = c.id
LEFT JOIN notas n ON 
  n.alumno_id = a.id 
  AND n.curso_id = c.id 
  AND n.materia_id = m.id
  AND n.ciclo_id = ?
WHERE 
  CONCAT(a.apellido, ' ', a.nombre) LIKE ? OR
  CONCAT(a.nombre, ' ', a.apellido) LIKE ? OR
  m.nombre LIKE ? OR 
  p.nombre LIKE ? OR 
  p.apellido LIKE ?
ORDER BY c.id, m.id, a.apellido, a.nombre, n.trimestre, n.numero
`, [
  ciclo,
  `%${q}%`,
  `%${q}%`,
  `%${q}%`,
  `%${q}%`,
  `%${q}%`
]);

    const cursos = {};

    results.forEach(row => {
      if (!cursos[row.curso_id]) cursos[row.curso_id] = { curso_id: row.curso_id, curso: row.curso, materias: {} };
      const curso = cursos[row.curso_id];

      if (!curso.materias[row.materia_id]) {
        curso.materias[row.materia_id] = {
          materia_id: row.materia_id,
          materia_nombre: row.materia_nombre,
          profesor_nombre: row.profesor_nombre,
          profesor_apellido: row.profesor_apellido,
          alumnos: new Map()
        };
      }
      const materia = curso.materias[row.materia_id];

      if (!materia.alumnos.has(row.alumno_id)) {
        materia.alumnos.set(row.alumno_id, {
          id: row.alumno_id,
          nombre: row.alumno_nombre,
          apellido: row.alumno_apellido,
          notas: [1,2,3].map(t => ({ trimestre: t, calificaciones: {1:null,2:null,3:null,4:null} })),
          examen_dic: null,
          examen_mar: null
        });
      }

      const al = materia.alumnos.get(row.alumno_id);
      if (row.trimestre >=1 && row.trimestre <=3 && row.numero >=1 && row.numero <=4) {
        al.notas[row.trimestre-1].calificaciones[row.numero] = row.nota !== null ? Number(row.nota) : null;
      }
      if (row.trimestre === 4) {
        if (row.numero === 1) al.examen_dic = row.nota !== null ? Number(row.nota) : null;
        if (row.numero === 2) al.examen_mar = row.nota !== null ? Number(row.nota) : null;
      }
    });

    const cursosArray = Object.values(cursos).map(c => ({
      curso: c.curso,
      materias: Object.values(c.materias).map(m => ({
        materia_nombre: m.materia_nombre,
        profesor_nombre: m.profesor_nombre,
        profesor_apellido: m.profesor_apellido,
        alumnos: Array.from(m.alumnos.values())
          .map(al => {
            const proms = al.notas.map(t => {
              const v = Object.values(t.calificaciones).filter(n => n !== null);
              return v.length ? truncar2Decimales(v.reduce((a,b)=>a+b,0)/v.length) : null;
            }).filter(x => x !== null);

            let final = proms.length ? truncar2Decimales(proms.reduce((a,b)=>a+b,0)/proms.length) : null;
            const exD = al.examen_dic; const exM = al.examen_mar;
            if ((final===null || final<6) && exD>=6) final = exD;
            else if ((final===null || final<6) && exM>=6) final = exM;

            let estado = 'APROBADO';

          if (final === null || final < 6) {
            estado = 'EP';
          }

          return {
            ...al,
            promedio_final: final,
            estado
          };
          })
          .sort((a,b) => {
            const aa = (a.apellido||'').toLowerCase();
            const bb = (b.apellido||'').toLowerCase();
            if (aa !== bb) return aa.localeCompare(bb);
            return (a.nombre||'').toLowerCase().localeCompare(b.nombre||'');
          })
      }))
    }));

    res.render('parciales/NotasList', { cursos: cursosArray, search: q, layout: false });

  } catch (err) {
    console.error('Error búsqueda:', err);
    res.status(500).send('Error');
  }
};


// ==================== IMPRIMIR NOTAS ====================
exports.imprimirNotas = async (req, res) => {
  const { cursoId, materiaId } = req.params;
  const ciclo = req.session.ciclo;

  try {
    const [results] = await db.query(`
      SELECT 
        c.nombre AS curso,
        m.nombre AS materia_nombre,
        p.nombre AS profesor_nombre, p.apellido AS profesor_apellido,
        a.id AS alumno_id, a.nombre AS alumno_nombre, a.apellido AS alumno_apellido,
        n.trimestre, n.numero, TRUNCATE(n.nota, 2) AS nota
      FROM curso_profesor_materia cpm
      JOIN cursos c ON c.id = cpm.curso_id
      JOIN materias m ON m.id = cpm.materia_id
      JOIN profesores p ON p.id = cpm.profesor_id
      JOIN alumnos a ON a.curso_id = c.id
      LEFT JOIN notas n ON 
      n.alumno_id = a.id 
      AND n.curso_id = c.id 
      AND n.materia_id = m.id
      AND n.ciclo_id = ?
      WHERE c.id = ? AND m.id = ?
      ORDER BY a.apellido ASC, a.nombre ASC, n.trimestre, n.numero
    `, [ciclo, cursoId, materiaId]);

    const alumnosMap = new Map();
    let materiaInfo = null;

    results.forEach(row => {
      if (!materiaInfo) {
        materiaInfo = {
          curso: row.curso,
          materia: row.materia_nombre,
          profesor: `${row.profesor_nombre} ${row.profesor_apellido}`
        };
      }

      if (!alumnosMap.has(row.alumno_id)) {
        alumnosMap.set(row.alumno_id, {
          nombre: row.alumno_nombre,
          apellido: row.alumno_apellido,
          notas: [1,2,3].map(t => ({ trimestre: t, calificaciones: {1:null,2:null,3:null,4:null} })),
          examen_dic: null,
          examen_mar: null
        });
      }

      const al = alumnosMap.get(row.alumno_id);
      if (row.trimestre >=1 && row.trimestre <=3 && row.numero >=1 && row.numero <=4) {
        al.notas[row.trimestre-1].calificaciones[row.numero] = row.nota;
      }
      if (row.trimestre === 4) {
        if (row.numero === 1) al.examen_dic = row.nota;
        if (row.numero === 2) al.examen_mar = row.nota;
      }
    });

    const alumnosOrdenados = Array.from(alumnosMap.values())
      .map(al => {
        const proms = al.notas.map(t => {
  const v = Object.values(t.calificaciones)
    .filter(n => typeof n === 'number' && !isNaN(n));

  return v.length
    ? truncar2Decimales(v.reduce((a,b)=>a+b,0)/v.length)
    : null;

}).filter(x => typeof x === 'number' && !isNaN(x));

        let final = proms.length ? truncar2Decimales(proms.reduce((a,b)=>a+b,0)/proms.length) : null;
        if ((final===null || final<6) && al.examen_dic >=6) final = al.examen_dic;
        else if ((final===null || final<6) && al.examen_mar >=6) final = al.examen_mar;

              let estado = 'APROBADO';

        if (final === null || final < 6) {
          estado = 'EP';
        }

         return {
        ...al,
        promedio_final: final !== null ? Number(final) : null,
        estado
      };;
      })
      .sort((a,b) => 
          (a.apellido || '').localeCompare(b.apellido || '', 'es', { sensitivity: 'base' }) || 
          (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' })
        );

      const cicloId = req.session.ciclo;

      const [[cicloData]] = await db.query(
        "SELECT anio FROM ciclos_lectivos WHERE id = ?",
        [cicloId]
      );

      const cicloAnio = cicloData.anio;

   res.render('admin/notas_imprimir', {
  materia: materiaInfo,
  alumnos: alumnosOrdenados,
  ciclo: cicloAnio,
  layout: false
});

  } catch (error) {
    console.error('Error impresión:', error);
    res.status(500).send('Error al generar impresión');
  }
};
