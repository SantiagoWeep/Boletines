
const db = require('../config/db');


// ============================================================
// MOSTRAR LISTA DE ALUMNOS Y CALIFICACIONES
// ============================================================

exports.mostrarListaAlumnos = async (req, res) => {

  if (!req.profesor) {
    return res.status(401).send('No autorizado');
  }

  const profesorId = parseInt(req.profesor.id, 10);
  const nombreCompleto = `${req.profesor.nombre} ${req.profesor.apellido}`;

  const query = `
    SELECT 
      c.id AS curso_id,
      c.nombre AS curso_nombre,

      m.id AS materia_id,
      m.nombre AS materia_nombre,

      a.id AS alumno_id,
      a.nombre AS alumno_nombre,
      a.apellido AS alumno_apellido,

      n.trimestre,
      n.numero,
      n.nota,
      n.condicion

    FROM curso_profesor_materia cpm

    JOIN cursos c 
      ON c.id = cpm.curso_id

    JOIN materias m 
      ON m.id = cpm.materia_id

    JOIN alumnos a 
      ON a.curso_id = c.id

    LEFT JOIN notas n 
      ON n.alumno_id = a.id
      AND n.curso_id = c.id
      AND n.materia_id = m.id

    WHERE cpm.profesor_id = ?
  `;

  try {

    const [results] = await db.query(query, [profesorId]);

    const cursos = {};

    results.forEach(row => {

      // --------------------------------------------------------
      // CURSO
      // --------------------------------------------------------

      if (!cursos[row.curso_id]) {

        cursos[row.curso_id] = {
          curso_id: row.curso_id,
          curso: row.curso_nombre,
          materias: {}
        };

      }

      const curso = cursos[row.curso_id];


      // --------------------------------------------------------
      // MATERIA
      // --------------------------------------------------------

      if (!curso.materias[row.materia_id]) {

        curso.materias[row.materia_id] = {
          materia_id: row.materia_id,
          materia_nombre: row.materia_nombre,
          alumnos: new Map()
        };

      }

      const materia = curso.materias[row.materia_id];


      // --------------------------------------------------------
      // ALUMNO
      // --------------------------------------------------------

      if (!materia.alumnos.has(row.alumno_id)) {

        materia.alumnos.set(row.alumno_id, {

          id: row.alumno_id,
          nombre: row.alumno_nombre,
          apellido: row.alumno_apellido,

          notas: [1, 2, 3].map(tri => ({

            trimestre: tri,

            calificaciones: {
              1: null,
              2: null,
              3: null,
              4: null
            },

            condiciones: {
              1: 'NUMERICA',
              2: 'NUMERICA',
              3: 'NUMERICA',
              4: 'NUMERICA'
            }

          })),

          examen_dic: null,
          examen_dic_condicion: 'NUMERICA',

          examen_mar: null,
          examen_mar_condicion: 'NUMERICA'

        });

      }

      const alumno = materia.alumnos.get(row.alumno_id);


      // --------------------------------------------------------
      // TRIMESTRES 1, 2 Y 3
      // --------------------------------------------------------

      if (
        row.trimestre >= 1 &&
        row.trimestre <= 3 &&
        row.numero >= 1 &&
        row.numero <= 4
      ) {

        const trimestre = alumno.notas.find(
          n => n.trimestre === row.trimestre
        );

        if (trimestre) {

          trimestre.calificaciones[row.numero] = row.nota;

          trimestre.condiciones[row.numero] =
            row.condicion || 'NUMERICA';

        }

      }


      // --------------------------------------------------------
      // DICIEMBRE Y MARZO
      // trimestre = 4
      //
      // numero 1 = diciembre
      // numero 2 = marzo
      // --------------------------------------------------------

      if (row.trimestre === 4) {

        if (row.numero === 1) {

          alumno.examen_dic = row.nota;

          alumno.examen_dic_condicion =
            row.condicion || 'NUMERICA';

        }

        if (row.numero === 2) {

          alumno.examen_mar = row.nota;

          alumno.examen_mar_condicion =
            row.condicion || 'NUMERICA';

        }

      }

    });


    // ============================================================
    // CONVERTIR A ARRAY
    // ============================================================

    const cursosArray = Object.values(cursos).map(c => ({

      curso_id: c.curso_id,

      curso: c.curso,

      materias: Object.values(c.materias).map(m => ({

        materia_id: m.materia_id,

        materia_nombre: m.materia_nombre,

        alumnos: Array
          .from(m.alumnos.values())
          .sort((a, b) => {

            const apellidoA = a.apellido.toLowerCase();
            const apellidoB = b.apellido.toLowerCase();

            if (apellidoA < apellidoB) return -1;
            if (apellidoA > apellidoB) return 1;

            const nombreA = a.nombre.toLowerCase();
            const nombreB = b.nombre.toLowerCase();

            return nombreA.localeCompare(nombreB);

          })

      }))

    }));


    const mostrarMensaje = req.query.guardado === '1';


    res.render('calificaciones', {

      layout: false,

      nombreCompleto,

      cursos: cursosArray,

      mensaje: mostrarMensaje
        ? '¡Notas guardadas correctamente!'
        : undefined,

      tipoMensaje: mostrarMensaje
        ? 'success'
        : undefined

    });


  } catch (err) {

    console.error('Error al obtener datos:', err);

    res.status(500).send('Error en base de datos');

  }

};



// ============================================================
// GUARDAR NOTAS
// ============================================================

exports.guardarNotas = async (req, res) => {

  const data = req.body;

  const valores = [];


  for (const key in data) {

    if (!key.startsWith('nota_')) {
      continue;
    }


    const [
      ,
      alumnoId,
      cursoId,
      materiaId,
      trimestre,
      numero
    ] = key.split('_');


    const valor = String(data[key]).trim();


    let nota = null;

    if (valor !== '') {

      nota = parseFloat(valor);

      // Evita guardar NaN
      if (Number.isNaN(nota)) {
        nota = null;
      }

    }


    valores.push([
      alumnoId,
      cursoId,
      materiaId,
      trimestre,
      numero,
      nota
    ]);

  }


  // Si no llegó ninguna nota, no intentamos hacer INSERT
  if (valores.length === 0) {

    return res.redirect('/calificaciones?guardado=1');

  }


  try {

    await db.query(`

      INSERT INTO notas
      (
        alumno_id,
        curso_id,
        materia_id,
        trimestre,
        numero,
        nota
      )

      VALUES ?

      ON DUPLICATE KEY UPDATE

        nota = VALUES(nota)

    `, [valores]);


    res.redirect('/calificaciones?guardado=1');


  } catch (err) {

    console.error('Error guardando notas:', err);

    res.status(500).send('Error guardando notas');

  }

};
