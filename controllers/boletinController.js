
const db = require('../config/db');

exports.mostrarBoletin = async (req, res) => {

    const alumnoId = req.alumno.id;

    try {

        const [alumnoRows] = await db.query(
            "SELECT * FROM alumnos WHERE id = ?",
            [alumnoId]
        );

        if (!alumnoRows.length) {
            return res.status(404).send("Alumno no encontrado");
        }

        const alumno = alumnoRows[0];

        const [rows] = await db.query(`
            SELECT
                materia,
                t1,
                t2,
                t3,
                examen_dic,
                examen_mar,
                nota_final,
                estado
            FROM vista_boletines
            WHERE alumno_id = ?
            ORDER BY materia
        `, [alumnoId]);

        // Construimos las materias con la estructura
        // que espera boletin.ejs.
        alumno.materias = rows.map(r => ({

            materia: r.materia,

            t1: r.t1,
            t2: r.t2,
            t3: r.t3,

            nota_diciembre: r.examen_dic,
            nota_marzo: r.examen_mar,

            promedioFinal: r.nota_final,

            estado: r.estado

        }));

        res.render("boletin", {
            layout: false,
            alumno
        });

    } catch (err) {

        console.error("Error al mostrar boletín:", err);

        res.status(500).send("Error interno");

    }

};
