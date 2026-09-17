const express = require('express');
const router = express.Router();

const adminBoletinController = require('../controllers/adminBoletinController');
const { verifyAdministracion } = require('../controllers/authAdministracionController');

router.get('/admin/boletines', verifyAdministracion, adminBoletinController.mostrarBoletines);
router.get('/admin/boletines/buscar', verifyAdministracion, adminBoletinController.buscarBoletines);
router.get('/admin/boletines/imprimir/boletin/:alumnoId', adminBoletinController.imprimirBoletin);

module.exports = router;
