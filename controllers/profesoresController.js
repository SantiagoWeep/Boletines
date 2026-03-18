const db = require('../config/db');

exports.mostrarProfesores = async (req, res) => {
  try {
    // Consulta profesores con sus cursos y materias
    const [profesores] = await db.query(`
      SELECT 
        profesores.id, profesores.nombre, profesores.apellido, profesores.dni, profesores.activo,
        cursos.id AS curso_id,
        cursos.nombre AS curso_nombre,
        materias.id AS materia_id,
        materias.nombre AS materia_nombre,
        cpm.id AS relacion_id
      FROM profesores
      LEFT JOIN curso_profesor_materia cpm ON profesores.id = cpm.profesor_id
      LEFT JOIN cursos ON cursos.id = cpm.curso_id
      LEFT JOIN materias ON materias.id = cpm.materia_id
      ORDER BY 
      cursos.orden, 
      profesores.apellido COLLATE utf8mb4_spanish_ci, 
      profesores.nombre
    `);

    // Agrupar profesores por curso
    const profesoresPorCurso = {};
    profesores.forEach(p => {
      const curso = p.curso_nombre || 'Sin Curso';
      if (!profesoresPorCurso[curso]) profesoresPorCurso[curso] = [];
      profesoresPorCurso[curso].push(p);
    });

    // Obtener todos los cursos para el select (sin repeticiones)
    const [cursos] = await db.query('SELECT id, nombre FROM cursos ORDER BY orden');

    // Obtener todas las materias para el select
    const [materias] = await db.query('SELECT id, nombre FROM materias ORDER BY nombre');

  res.render('profesores', {
  layout: 'administracion',
  profesoresPorCurso,
  cursos,
  materias,
  textoBotonAgregar: 'Agregar Profesor',
  tipoBusqueda: 'DNI o Nombre',
  idInputBusqueda: 'inputBuscarProfesor',
  idModalAgregar: 'modalAgregarProfesor',
  mostrarFiltroCurso: false // o simplemente no lo pongas
});



  } catch (error) {
    console.error(error);
    res.status(500).send('Error al obtener los profesores');
  }
};

exports.actualizarActivo = async (req, res) => {
  const { id } = req.params;
  const { activo } = req.body;

  try {
    await db.query('UPDATE profesores SET activo = ? WHERE id = ?', [activo, id]);
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
};
exports.agregarProfesor = async (req, res) => {
  const { nombre, apellido, dni, curso_id, materia_id, activo } = req.body;
  const activoValor = activo ? 1 : 0;

  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    const [existing] = await connection.query(
      'SELECT id FROM profesores WHERE dni = ?',
      [dni]
    );

    let profesorId;

    if (existing.length > 0) {
      profesorId = existing[0].id;
      await connection.query(
        'UPDATE profesores SET nombre = ?, apellido = ?, activo = ? WHERE id = ?',
        [nombre, apellido, activoValor, profesorId]
      );
    } else {
      const [result] = await connection.query(
        'INSERT INTO profesores (nombre, apellido, dni, activo) VALUES (?, ?, ?, ?)',
        [nombre, apellido, dni, activoValor]
      );
      profesorId = result.insertId;
    }

    const [relacionExiste] = await connection.query(
      'SELECT id FROM curso_profesor_materia WHERE profesor_id = ? AND curso_id = ? AND materia_id = ?',
      [profesorId, curso_id, materia_id]
    );

    if (relacionExiste.length > 0) {
      throw new Error('Este profesor ya está asignado a esa materia en ese curso.');
    }

    await connection.query(
      'INSERT INTO curso_profesor_materia (profesor_id, curso_id, materia_id) VALUES (?, ?, ?)',
      [profesorId, curso_id, materia_id]
    );

    await connection.commit();
    res.json({ success: true, message: 'Profesor agregado correctamente' });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(400).json({ success: false, message: err.message });
  } finally {
    connection.release();
  }
};





exports.editarProfesor = async (req, res) => {
  const { profesor_id, nombre, apellido, dni, activo, curso_id, materia_id, relacion_id } = req.body;
  const activoValor = activo ? 1 : 0;

  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    const [dniRepetido] = await connection.query(
      'SELECT id FROM profesores WHERE dni = ? AND id != ?',
      [dni, profesor_id]
    );
    if (dniRepetido.length > 0) {
      throw new Error('Ya existe otro profesor con ese DNI.');
    }

    await connection.query(
      'UPDATE profesores SET nombre = ?, apellido = ?, dni = ?, activo = ? WHERE id = ?',
      [nombre, apellido, dni, activoValor, profesor_id]
    );

    await connection.query(
      'UPDATE curso_profesor_materia SET curso_id = ?, materia_id = ? WHERE id = ?',
      [curso_id, materia_id, relacion_id]
    );

    await connection.commit();
    res.redirect('/profesores');
  } catch (err) {
    await connection.rollback();
    res.redirect(`/profesores?error=${encodeURIComponent(err.message)}`);
  } finally {
    connection.release();
  }
};





exports.eliminarProfesor = async (req, res) => {
  const { id } = req.params;

  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    // Eliminar primero la relación (por la FK)
    await connection.query(
      'DELETE FROM curso_profesor_materia WHERE profesor_id = ?',
      [id]
    );

    // Luego eliminar el profesor
    await connection.query('DELETE FROM profesores WHERE id = ?', [id]);

    await connection.commit();
    res.json({ success: true });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ success: false, message: 'Error al eliminar el profesor' });
  } finally {
    connection.release();
  }
};



exports.buscarProfesores = async (req, res) => {
  const q = req.query.q || '';

  try {
    const [profesores] = await db.query(`
      SELECT 
        profesores.id, profesores.nombre, profesores.apellido, profesores.dni, profesores.activo,
        cursos.nombre AS curso_nombre,
        materias.nombre AS materia_nombre
      FROM profesores
      LEFT JOIN curso_profesor_materia cpm ON profesores.id = cpm.profesor_id
      LEFT JOIN cursos ON cursos.id = cpm.curso_id
      LEFT JOIN materias ON materias.id = cpm.materia_id
      WHERE profesores.nombre LIKE ? OR profesores.apellido LIKE ? OR profesores.dni LIKE ?
      ORDER BY cursos.orden, profesores.apellido
    `, [`%${q}%`, `%${q}%`, `%${q}%`]);

    // Agrupar por curso
    const profesoresPorCurso = {};
    profesores.forEach(p => {
      const curso = p.curso_nombre || 'Sin Curso';
      if (!profesoresPorCurso[curso]) profesoresPorCurso[curso] = [];
      profesoresPorCurso[curso].push(p);
    });

    res.render('parciales/tablaProfesores', { profesoresPorCurso, layout: false });

  } catch (err) {
    console.error(err);
    res.status(500).send('Error al buscar profesores');
  }
};