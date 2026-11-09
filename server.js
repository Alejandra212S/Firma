require('dotenv').config();
const express = require('express');
const mssql = require('mssql');
const cors = require('cors');

const app = express();

// Configuraciones del servidor express
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Ampliamos el límite para soportar el tamaño de la firma en Base64

// Configuración de la conexión a SQL Server Express
// Configuración robusta usando el nuevo usuario de SQL Server
const dbConfig = {
    user: 'UsuarioPlanta',
    password: 'TuPasswordPlanta123!',
    server: 'localhost\\SQLEXPRESS',
    database: 'EnviosImagenesDB',
    options: {
        encrypt: false, 
        trustServerCertificate: true // Requerido para desarrollo local
    }
};

// Ruta API encargada de procesar el registro y guardarlo en SQL Server
app.post('/api/guardar-responsiva', async (req, res) => {
    const { nomina, nombre, area, articulo, talla, firma } = req.body;

    try {
        // Conectar al clúster de base de datos
        let pool = await mssql.connect(dbConfig);

        // 1. Verificar si el empleado ya existe por su Nómina, si no, registrarlo primero.
        let resultadoEmpleado = await pool.request()
            .input('nomina', mssql.VarChar(20), nomina)
            .input('nombre', mssql.NVarChar(150), nombre)
            .input('area', mssql.NVarChar(50), area)
            .query(`
                IF NOT EXISTS (SELECT 1 FROM Empleados WHERE Nomina = @nomina)
                BEGIN
                    INSERT INTO Empleados (Nomina, NombreCompleto, AreaPlanta) 
                    VALUES (@nomina, @nombre, @area);
                END
                SELECT Id FROM Empleados WHERE Nomina = @nomina;
            `);

        // Extraer el Id numérico del empleado
        const empleadoId = resultadoEmpleado.recordset[0].Id;

        // 2. Insertar la asignación del artículo EPP junto con la firma Base64
        await pool.request()
            .input('empleadoId', mssql.Int, empleadoId)
            .input('articulo', mssql.NVarChar(100), articulo)
            .input('talla', mssql.NVarChar(20), talla)
            .input('firma', mssql.VarChar(mssql.MAX), firma) // Guardamos el binario traducido en MAX
            .query(`
                INSERT INTO AsignacionesEPP (EmpleadoId, ArticuloEntregado, Talla, UrlFirma)
                VALUES (@empleadoId, @articulo, @talla, @firma);
            `);

        res.status(200).json({ mensaje: '¡Registro completado y guardado correctamente!' });

    } catch (error) {
        console.error('Error procesando la base de datos:', error);
        res.status(500).json({ error: 'Error en SQL Server: ' + error.message });
    }
});

// Levantar el servidor local en el puerto 3000
const PUERTO = 3000;
app.listen(PUERTO, () => {
    console.log(`=======================================================`);
    console.log(` Servidor de Planta activo en http://localhost:${PUERTO}`);
    console.log(`=======================================================`);
});