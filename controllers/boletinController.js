// controllers/boletinController.js
const db = require('../config/db');


exports.mostrarBoletin = async (req, res) => {

const alumnoId = req.alumno.id;

try {

const [alumnoRows] = await db.query(
"SELECT * FROM alumnos WHERE id = ?",
[alumnoId]
);

if(!alumnoRows.length){
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
nota_final
FROM vista_boletines
WHERE alumno_id = ?

ORDER BY materia
`,[alumnoId]);

const materias = rows.map(r => ({

nombre: r.materia,

notas:{
T1: r.t1 ?? "-",
T2: r.t2 ?? "-",
T3: r.t3 ?? "-"
},

examenDic: r.examen_dic,
examenMar: r.examen_mar,

estado: r.nota_final === null ? "EP" : "APROBADO",
promedioFinal: r.nota_final === null ? "EP" : r.nota_final

}));

res.render("boletin",{
layout:false,
alumno,
materias
});

} catch(err){

console.error("Error al mostrar boletín:",err);
res.status(500).send("Error interno");

}

};
