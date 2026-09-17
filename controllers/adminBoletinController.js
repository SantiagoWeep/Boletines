
const db = require('../config/db');


exports.mostrarBoletines = async (req, res) => {

  const cursoFiltro = req.query.curso || '';

  let sql = `
    SELECT
      v.alumno_id,
      a.nombre,
      a.apellido,
      v.curso,
      v.materia,
      v.t1,
      v.t2,
      v.t3,
      v.examen_dic,
      v.examen_mar,
      v.nota_final,
      v.estado
    FROM vista_boletines v
    JOIN alumnos a ON v.alumno_id = a.id
  `;

  const params = [];

  if (cursoFiltro) {
    sql += " WHERE v.curso = ?";
    params.push(cursoFiltro);
  }

  sql += " ORDER BY v.curso, a.apellido, a.nombre, v.materia";

  const [rows] = await db.query(sql, params);

  const alumnos = {};

  rows.forEach(r => {

    if (!alumnos[r.alumno_id]) {
      alumnos[r.alumno_id] = {
        id: r.alumno_id,
        alumno: r.nombre,
        apellido: r.apellido,
        curso: r.curso,
        materias: []
      };
    }

    alumnos[r.alumno_id].materias.push({
      materia: r.materia,
      t1: r.t1,
      t2: r.t2,
      t3: r.t3,
      examen_dic: r.examen_dic,
      examen_mar: r.examen_mar,
      nota_final: r.nota_final,
      estado: r.estado
    });

  });

  const alumnosArray = Object.values(alumnos);

  // AJAX: devolvemos solamente el partial
  if (req.xhr) {
    return res.render('parciales/boletinesList', {
      alumnos: alumnosArray,
      layout: false
    });
  }

  // Carga normal: página completa
  res.render('admin/boletines', {
    alumnos: alumnosArray,
    tipoBusqueda: 'Nombre o DNI',
    idInputBusqueda: 'input-busqueda',
    mostrarFiltroCurso: true,
    cursoSeleccionado: cursoFiltro
  });

};


exports.buscarBoletines = async (req, res) => {

  const q = req.query.q || '';

  try {

    const [rows] = await db.query(`
      SELECT
        v.alumno_id,
        a.nombre,
        a.apellido,
        v.curso,
        v.materia,
        v.t1,
        v.t2,
        v.t3,
        v.examen_dic,
        v.examen_mar,
        v.nota_final,
        v.estado
      FROM vista_boletines v
      JOIN alumnos a ON v.alumno_id = a.id
      WHERE
        a.nombre LIKE ?
        OR a.apellido LIKE ?
        OR a.dni LIKE ?
        OR v.curso LIKE ?
      ORDER BY
        v.curso,
        a.apellido COLLATE utf8mb4_spanish_ci,
        a.nombre,
        v.materia
      LIMIT 50
    `, [
      `%${q}%`,
      `%${q}%`,
      `%${q}%`,
      `%${q}%`
    ]);

    const alumnos = {};

    rows.forEach(r => {

      if (!alumnos[r.alumno_id]) {
        alumnos[r.alumno_id] = {
          id: r.alumno_id,
          alumno: r.nombre,
          apellido: r.apellido,
          curso: r.curso,
          materias: []
        };
      }

      alumnos[r.alumno_id].materias.push({
        materia: r.materia,
        t1: r.t1,
        t2: r.t2,
        t3: r.t3,
        examen_dic: r.examen_dic,
        examen_mar: r.examen_mar,
        nota_final: r.nota_final,
        estado: r.estado
      });

    });

    res.render('parciales/boletinesList', {
      alumnos: Object.values(alumnos),
      layout: false
    });

  } catch (error) {

    console.error(error);
    res.status(500).send('Error buscando boletines');

  }

};


exports.imprimirBoletin = async (req, res) => {

  const alumnoId = req.params.alumnoId;

  try {

    const [rows] = await db.query(`
      SELECT
        v.*,
        a.nombre,
        a.apellido,
        a.dni,
        a.edad,
        a.tutor
      FROM vista_boletines v
      JOIN alumnos a ON a.id = v.alumno_id
      WHERE v.alumno_id = ?
      ORDER BY v.materia
    `, [alumnoId]);

    if (rows.length === 0) {
      return res.send('No existe boletín');
    }

    const alumno = {
      id: alumnoId,
      nombre: rows[0].nombre,
      apellido: rows[0].apellido,
      dni: rows[0].dni,
      edad: rows[0].edad,
      curso: rows[0].curso,

      materias: rows.map(r => ({

        materia: r.materia,

        // Promedios trimestrales
        t1: r.t1,
        t2: r.t2,
        t3: r.t3,

        // Diciembre y marzo
        nota_diciembre: r.examen_dic,
        nota_marzo: r.examen_mar,

        // Promedio / nota final
        promedioFinal: r.nota_final,

        // Estado
        estado: r.estado

      }))
    };

    console.log('BOLETÍN IMPRESIÓN:', JSON.stringify(alumno, null, 2));

    res.render('admin/imprimir/boletin', {
      alumno,
      layout: false
    });

  } catch (err) {

    console.error('Error al imprimir boletín:', err);
    res.status(500).send('Error');

  }

};
