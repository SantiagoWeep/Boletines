const db = require('../config/db'); // o tu ORM/configuración
exports.mostrarAlumnos = async (req, res) => {
  try {
         const [alumnos] = await db.query(`
      SELECT alumnos.*, cursos.nombre AS curso_nombre, cursos.orden
      FROM alumnos
      JOIN cursos ON alumnos.curso_id = cursos.id
      WHERE alumnos.ciclo_id = ?
      ORDER BY cursos.orden ASC, alumnos.apellido ASC, alumnos.nombre ASC
    `, [req.ciclo]);

    const [cursos] = await db.query(`SELECT * FROM cursos ORDER BY orden`);

    // Agrupar alumnos por curso
    const alumnosPorCurso = {};
    alumnos.forEach(alumno => {
      if (!alumnosPorCurso[alumno.curso_nombre]) {
        alumnosPorCurso[alumno.curso_nombre] = [];
      }
      alumnosPorCurso[alumno.curso_nombre].push(alumno);
    });

    res.render('alumnos', {
      layout: 'administracion',
      alumnosPorCurso,
      cursos,
      textoBotonAgregar: 'Agregar Alumno',
      tipoBusqueda: 'DNI o Nombre',
      idInputBusqueda: 'inputBuscarAlumno',
      idModalAgregar: 'modalAgregarAlumno',
      mostrarFiltroCurso: false
    });

  } catch (error) {
    console.error('💥 Error en mostrarAlumnos:', error); // Log completo
    res.status(500).send('💥 Error al obtener los alumnos: ' + error.message);
  }
};



exports.insertarAlumno = async (req, res) => {
  const { nombre, apellido, dni, edad, telefono, tutor, curso_id, regular } = req.body;

  try {
    const ciclo = req.ciclo;

        await db.query(`
        INSERT INTO alumnos
        (nombre, apellido, dni, edad, telefono, tutor, regular, curso_id, ciclo_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
        nombre, apellido, dni, edad,
        telefono || null,
        tutor || null,
        regular === 'on',
        curso_id,
        ciclo
        ]);

    res.redirect('/administracion?success=Alumno agregado correctamente');
  } catch (error) {
    console.error(error);
    res.redirect('/administracion?error=Error al agregar el alumno');
  }
};



exports.editarAlumno = async (req, res) => {
  const { id } = req.params;
  const { nombre, apellido, dni, edad, telefono, tutor, curso_id, regular } = req.body;

  try {
    await db.query(`
      UPDATE alumnos SET 
        nombre = ?, apellido = ?, dni = ?, edad = ?, telefono = ?, tutor = ?, curso_id = ?, regular = ?
      WHERE id = ?
    `, [
      nombre, apellido, dni, edad, telefono || null, tutor || null,
      curso_id, regular === 'on', id
    ]);

    res.redirect('/administracion?success=Alumno editado correctamente');
  } catch (error) {
    console.error(error);
    res.redirect('/administracion?error=Error al editar el alumno');
  }
};


exports.eliminarAlumno = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ success: false, message: 'ID de alumno no proporcionado' });
  }

  try {

    await db.query(`
      DELETE FROM notas 
      WHERE alumno_id = ? AND ciclo_id = ?
    `, [id, req.ciclo]);

    await db.query(`
      DELETE FROM alumnos
      WHERE id = ? AND ciclo_id = ?
    `, [id, req.ciclo]);

    return res.status(200).json({ success: true, message: 'Alumno eliminado correctamente' });

  } catch (error) {
    console.error('Error al eliminar alumno:', error);
    return res.status(500).json({ success: false, message: 'Ocurrió un error al eliminar el alumno' });
  }
};





exports.actualizarEstadoRegular = async (req, res) => {
  const { id } = req.params;
  const { regular } = req.body;

  try {
    await db.query(`UPDATE alumnos SET regular = ? WHERE id = ?`, [regular, id]);
    res.status(200).json({ message: 'Estado actualizado correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al actualizar el estado' });
  }
};

exports.buscarAlumnos = async (req, res) => {
  const q = req.query.q || '';

  try {
    const [alumnos] = await db.query(`
  SELECT alumnos.*, cursos.nombre AS curso_nombre, cursos.orden 
  FROM alumnos 
  JOIN cursos ON alumnos.curso_id = cursos.id 
  WHERE alumnos.ciclo_id = ?
  AND (alumnos.nombre LIKE ? OR alumnos.apellido LIKE ? OR alumnos.dni LIKE ?)
  ORDER BY 
  cursos.orden ASC, 
  alumnos.apellido COLLATE utf8mb4_spanish_ci ASC, 
  alumnos.nombre ASC
`, [req.ciclo, `%${q}%`, `%${q}%`, `%${q}%`]);

    const alumnosPorCurso = {};
    alumnos.forEach(alumno => {
      if (!alumnosPorCurso[alumno.curso_nombre]) {
        alumnosPorCurso[alumno.curso_nombre] = [];
      }
      alumnosPorCurso[alumno.curso_nombre].push(alumno);
    });

    res.render('parciales/tablaAlumnos', { alumnosPorCurso, layout: false }); // 🔥
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al buscar alumnos');
  }
};
