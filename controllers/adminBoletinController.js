const db = require('../config/db');


exports.mostrarBoletines = async (req, res) => {

  const ciclo = req.ciclo;
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
    WHERE v.ciclo_id = ?
  `;

  const params = [ciclo];

  if (cursoFiltro) {
    sql += " AND v.curso = ?";
    params.push(cursoFiltro);
  }

  sql += " ORDER BY v.curso, a.apellido, a.nombre, v.materia";

  const [rows] = await db.query(sql, params);

  const alumnos = {};

  rows.forEach(r => {

    if(!alumnos[r.alumno_id]){
      alumnos[r.alumno_id] = {
        alumno: r.nombre,
        apellido: r.apellido,
        curso: r.curso,
        materias: []
      }
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

  // 👇 si es AJAX devolvemos solo el partial
  if (req.xhr) {
    return res.render('parciales/boletinesList', {
      alumnos: alumnosArray,
      layout: false
    });
  }

  // 👇 si es carga normal devolvemos la página completa
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
  const ciclo = req.ciclo;

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
      WHERE v.ciclo_id = ?
      AND (
        a.nombre LIKE ?
        OR a.apellido LIKE ?
        OR a.dni LIKE ?
        OR v.curso LIKE ?
      )
      ORDER BY 
        v.curso, 
        a.apellido COLLATE utf8mb4_spanish_ci, 
        a.nombre, 
        v.materia
      LIMIT 50
    `,[ciclo, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`]);

    const alumnos = {};

    rows.forEach(r => {

      if(!alumnos[r.alumno_id]){
        alumnos[r.alumno_id] = {
          alumno: r.nombre,
          apellido: r.apellido,
          curso: r.curso,
          materias: []
        }
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

    res.render('parciales/boletinesList',{
  alumnos:Object.values(alumnos),
  layout:false
});

  } catch (error) {
    console.error(error);
    res.status(500).send('Error buscando boletines');
  }

};